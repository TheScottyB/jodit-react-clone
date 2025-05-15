/**
 * Synchronization Service for managing product and data synchronization between Spocket and Square
 */
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import Bottleneck from 'bottleneck';
import { Client, Environment } from '@square/web-sdk';

import { configService } from '../config/config.service';
import { spocketAuthService } from '../auth/spocket-auth.service';
import { 
  spocketToSquareCatalog, 
  squareToSpocketProduct,
  findRelatedSquareCatalogObjects,
  compareInventoryLevels
} from '../mapping/product.mapper';

import { SpocketProduct, SpocketProductsResponse } from '../types/spocket.types';
import { SquareCatalogObject } from '../types/square.types';
import { 
  SyncDirection, 
  SyncEntityType, 
  SyncStatus, 
  ConflictResolutionStrategy,
  SyncErrorSeverity,
  SyncTask,
  ProductSyncTask,
  SyncError,
  SyncConflict,
  SyncResult,
  SyncOptions,
  EntityMapping
} from './sync.types';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'sync-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Add file transport for production
  ],
});

/**
 * In-memory repository for sync data
 * In a production system, this would be replaced with a database store
 */
class InMemorySyncRepository {
  private tasks: Map<string, SyncTask> = new Map();
  private mappings: Map<string, EntityMapping> = new Map();
  private results: Map<string, SyncResult[]> = new Map();
  private errors: Map<string, SyncError[]> = new Map();
  private conflicts: Map<string, SyncConflict[]> = new Map();

  // Generate a unique mapping key
  private getMappingKey(entityType: SyncEntityType, id: string, idType: 'spocket' | 'square'): string {
    return `${entityType}:${idType}:${id}`;
  }

  // Generate a task-related key
  private getTaskKey(taskId: string, type: 'results' | 'errors' | 'conflicts'): string {
    return `${taskId}:${type}`;
  }

  // Task operations
  async saveTask(task: SyncTask): Promise<SyncTask> {
    this.tasks.set(task.id, task);
    return task;
  }

  async getTaskById(id: string): Promise<SyncTask | null> {
    return this.tasks.get(id) || null;
  }

  async updateTaskStatus(id: string, status: SyncStatus): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      if (status === SyncStatus.IN_PROGRESS && !task.startedAt) {
        task.startedAt = new Date();
      } else if (status === SyncStatus.COMPLETED || status === SyncStatus.FAILED) {
        task.completedAt = new Date();
      }
      this.tasks.set(id, task);
    }
  }

  // Mapping operations
  async saveMapping(mapping: EntityMapping): Promise<void> {
    const spocketKey = this.getMappingKey(mapping.entityType, mapping.spocketId, 'spocket');
    const squareKey = this.getMappingKey(mapping.entityType, mapping.squareId, 'square');
    
    this.mappings.set(spocketKey, mapping);
    this.mappings.set(squareKey, mapping);
  }

  async getMappingBySpocketId(entityType: SyncEntityType, spocketId: string): Promise<EntityMapping | null> {
    const key = this.getMappingKey(entityType, spocketId, 'spocket');
    return this.mappings.get(key) || null;
  }

  async getMappingBySquareId(entityType: SyncEntityType, squareId: string): Promise<EntityMapping | null> {
    const key = this.getMappingKey(entityType, squareId, 'square');
    return this.mappings.get(key) || null;
  }

  // Result operations
  async saveResult(taskId: string, result: SyncResult): Promise<void> {
    const key = this.getTaskKey(taskId, 'results');
    const results = this.results.get(key) || [];
    results.push(result);
    this.results.set(key, results);

    // Update task counters
    const task = this.tasks.get(taskId);
    if (task) {
      task.processedCount++;
      if (result.success) {
        task.successCount++;
      } else {
        task.failureCount++;
      }
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);
    }
  }

  // Error operations
  async saveError(taskId: string, error: SyncError): Promise<void> {
    const key = this.getTaskKey(taskId, 'errors');
    const errors = this.errors.get(key) || [];
    errors.push(error);
    this.errors.set(key, errors);

    // Update task errors
    const task = this.tasks.get(taskId);
    if (task) {
      task.errors.push(error);
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);
    }
  }

  // Conflict operations
  async saveConflict(taskId: string, conflict: SyncConflict): Promise<void> {
    const key = this.getTaskKey(taskId, 'conflicts');
    const conflicts = this.conflicts.get(key) || [];
    conflicts.push(conflict);
    this.conflicts.set(key, conflicts);

    // Update task conflicts
    const task = this.tasks.get(taskId);
    if (task) {
      task.conflicts.push(conflict);
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);
    }
  }
}

/**
 * Main synchronization service for Spocket-Square integration
 */
export class SyncService {
  private static instance: SyncService;
  private repository: InMemorySyncRepository;
  private squareClient: Client;
  private spocketBasePath: string;

  // Rate limiters for API calls
  private spocketLimiter: Bottleneck;
  private squareLimiter: Bottleneck;

  // Default Square location ID
  private squareLocationId: string = '';

  private constructor() {
    this.repository = new InMemorySyncRepository();
    this.spocketBasePath = configService.getEnv('SPOCKET_API_BASE_URL') || 'https://api.spocket.co';
    
    // Initialize limiters with default settings
    this.spocketLimiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: 1000 // 1 request per second
    });
    
    this.squareLimiter = new Bottleneck({
      maxConcurrent: 2,
      minTime: 500 // 2 requests per second
    });
    
    // Initialize Square client
    this.initializeSquareClient();
  }

  /**
   * Get singleton instance of SyncService
   */
  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }
  
  /**
   * Initialize Square client
   */
  private initializeSquareClient(): void {
    const environment = configService.getSquareEnvironment();
    const accessToken = configService.getSquareAccessToken();
    
    this.squareClient = new Client({
      environment: environment === 'production' ? Environment.Production : Environment.Sandbox,
      accessToken
    });
    
    // Set default location ID (would be fetched from Square in a real implementation)
    this.squareLocationId = 'default_location';
    
    logger.info(`Square client initialized with environment: ${environment}`);
  }
  
  /**
   * Start a synchronization task
   */
  public async startSync(options: SyncOptions): Promise<SyncTask> {
    logger.info(`Starting sync with options: ${JSON.stringify(options)}`);
    
    const taskId = uuidv4();
    const now = new Date();
    
    // Initialize the sync task
    const task: SyncTask = {
      id: taskId,
      entityType: options.entityTypes[0], // For simplicity, we're focusing on the first entity type
      direction: options.direction,
      status: SyncStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      conflictResolutionStrategy: options.conflictResolutionStrategy,
      errors: [],
      conflicts: [],
      entityCount: 0,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      skipCount: 0
    };
    
    // Save the task
    await this.repository.saveTask(task);
    
    // Start the sync process asynchronously
    this.processSyncTask(task, options).catch(error => {
      logger.error(`Error in sync task ${taskId}: ${error.message}`, { error });
    });
    
    return task;
  }
  
  /**
   * Process a synchronization task
   */
  private async processSyncTask(task: SyncTask, options: SyncOptions): Promise<void> {
    try {
      // Update task status to in-progress
      await this.repository.updateTaskStatus(task.id, SyncStatus.IN_PROGRESS);
      logger.info(`Processing sync task ${task.id} for ${task.entityType}`);
      
      // Process different entity types
      switch (task.entityType) {
        case SyncEntityType.PRODUCT:
          await this.processProductSync(task as ProductSyncTask, options);
          break;
        
        case SyncEntityType.INVENTORY:
          // TODO: Implement inventory sync
          throw new Error('Inventory sync not yet implemented');
        
        case SyncEntityType.ORDER:
          // TODO: Implement order sync
          throw new Error('Order sync not yet implemented');
        
        default:
          throw new Error(`Unsupported entity type: ${task.entityType}`);
      }
      
      // Mark task as completed
      await this.repository.updateTaskStatus(task.id, SyncStatus.COMPLETED);
      logger.info(`Sync task ${task.id} completed successfully`);
    } catch (error: any) {
      logger.error(`Error processing sync task ${task.id}: ${error.message}`, { error });
      
      // Record the error
      const syncError: SyncError = {
        code: 'SYNC_TASK_FAILED',
        message: error.message,
        severity: SyncErrorSeverity.ERROR,
        retryable: false,
        timestamp: new Date()
      };
      await this.repository.saveError(task.id, syncError);
      
      // Mark task as failed
      await this.repository.updateTaskStatus(task.id, SyncStatus.FAILED);
    }
  }
  
  /**
   * Process product synchronization
   */
  private async processProductSync(task: ProductSyncTask, options: SyncOptions): Promise<void> {
    logger.info(`Processing product sync for task ${task.id} in direction ${task.direction}`);
    
    // Initialize product mappings array if not present
    if (!task.productMappings) {
      task.productMappings = [];
    }
    
    // Determine sync direction
    switch (task.direction) {
      case SyncDirection.SPOCKET_TO_SQUARE:
        await this.syncProductsFromSpocketToSquare(task, options);
        break;
      
      case SyncDirection.SQUARE_TO_SPOCKET:
        await this.syncProductsFromSquareToSpocket(task, options);
        break;
      
      case SyncDirection.BIDIRECTIONAL:
        // For bidirectional sync, we process both directions
        // In practice, you'd need conflict resolution strategies for bidirectional syncs
        await this.syncProductsFromSpocketToSquare(task, options);
        await this.syncProductsFromSquareToSpocket(task, options);
        break;
      
      default:
        throw new Error(`Unsupported sync direction: ${task.direction}`);
    }
  }
  
  /**
   * Sync products from Spocket to Square
   */
  private async syncProductsFromSpocketToSquare(task: ProductSyncTask, options: SyncOptions): Promise<void> {
    // Fetch products from Spocket
    const spocketProducts = await this.fetchSpocketProducts(options);
    task.entityCount = spocketProducts.length;
    await this.repository.saveTask(task);
    
    logger.info(`Fetched ${spocketProducts.length} Spocket products for sync task ${task.id}`);
    
    // Configure batch processing
    const batchSize = options.batchSize || 10;
    
    // Process products in batches
    for (let i = 0; i < spocketProducts.length; i += batchSize) {
      const batch = spocketProducts.slice(i, i + batchSize);
      
      // Process each product in the batch
      await Promise.all(batch.map(async (product) => {
        try {
          // Check if product has already been mapped
          const existingMapping = await this.repository.getMappingBySpocketId(
            SyncEntityType.PRODUCT,
            product.id
          );
          
          if (existingMapping && options.skipExisting) {
            // Skip if already mapped and skipExisting is true
            task.skipCount++;
            logger.info(`Skipping already mapped product ${product.id} -> ${existingMapping.squareId}`);
            
            const result: SyncResult = {
              entityId: product.id,
              entityType: SyncEntityType.PRODUCT,
              success: true,
              sourceId: product.id,
              targetId: existingMapping.squareId,
              timestamp: new Date()
            };
            await this.repository.saveResult(task.id, result);
            return;
          }
          
          // Convert Spocket product to Square catalog objects
          const catalogObjects = spocketToSquareCatalog(product, this.squareLocationId);
          
          // Save to Square via the Square API
          const savedObjects = await this.saveSquareCatalogObjects(catalogObjects);
          
          // Extract the main item ID (for mapping)
          const mainItemObject = savedObjects.find(obj => 
            obj.type === 'ITEM' && obj.id.includes(product.id)
          );
          
          if (!mainItemObject) {
            throw new Error(`Failed to identify main item object for product ${product.id}`);
          }
          
          // Create a mapping between Spocket and Square products
          const mapping: EntityMapping = {
            spocketId: product.id,
            squareId: mainItemObject.id,
            entityType: SyncEntityType.PRODUCT,
            lastSynced: new Date()
          };
          
          // Save the mapping
          await this.repository.saveMapping(mapping);
          
          // Record the successful sync result
          const result: SyncResult = {
            entityId: product.id,
            entityType: SyncEntityType.PRODUCT,
            success: true,
            sourceId: product.id,
            targetId: mainItemObject.id,
            timestamp: new Date()
          };
          
          await this.repository.saveResult(task.id, result);
          logger.info(`Successfully synced Spocket product ${product.id} to Square ${mainItemObject.id}`);
          
        } catch (error: any) {
          // Record the error
          logger.error(`Error syncing Spocket product ${product.id} to Square: ${error.message}`, {
            productId: product.id,
            error
          });
          
          const syncError: SyncError = {
            code: 'PRODUCT_SYNC_FAILED',
            message: `Failed to sync product ${product.id}: ${error.message}`,
            severity: SyncErrorSeverity.ERROR,
            entityId: product.id,
            entityType: SyncEntityType.PRODUCT,
            retryable: true,
            timestamp: new Date()
          };
          
          await this.repository.saveError(task.id, syncError);
          
          // Record the failed sync result
          const result: SyncResult = {
            entityId: product.id,
            entityType: SyncEntityType.PRODUCT,
            success: false,
            sourceId: product.id,
            error: syncError,
            timestamp: new Date()
          };
          
          await this.repository.saveResult(task.id, result);
        }
      }));
      
      // Small delay between batches to prevent overwhelming the APIs
      if (i + batchSize < spocketProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  /**
   * Sync products from Square to Spocket
   */
  private async syncProductsFromSquareToSpocket(task: ProductSyncTask, options: SyncOptions): Promise<void> {
    // Fetch products from Square
    const squareCatalogObjects = await this.fetchSquareCatalogObjects(options);
    
    // Filter to only include items
    const squareItems = squareCatalogObjects.filter(obj => obj.type === 'ITEM');
    task.entityCount = squareItems.length;
    await this.repository.saveTask(task);
    
    logger.info(`Fetched ${squareItems.length} Square catalog items for sync task ${task.id}`);
    
    // Configure batch processing
    const batchSize = options.batchSize || 10;
    
    // Process items in batches
    for (let i = 0; i < squareItems.length; i += batchSize) {
      const batch = squareItems.slice(i, i + batchSize);
      
      // Process each item in the batch
      await Promise.all(batch.map(async (item) => {
        try {
          // Check if Square item has already been mapped
          const existingMapping = await this.repository.getMappingBySquareId(
            SyncEntityType.PRODUCT,
            item.id
          );
          
          if (existingMapping && options.skipExisting) {
            // Skip if already mapped and skipExisting is true
            task.skipCount++;
            logger.info(`Skipping already mapped Square item ${item.id} -> ${existingMapping.spocketId}`);
            
            const result: SyncResult = {
              entityId: item.id,
              entityType: SyncEntityType.PRODUCT,
              success: true,
              sourceId: item.id,
              targetId: existingMapping.spocketId,
              timestamp: new Date()
            };
            await this.repository.saveResult(task.id, result);
            return;
          }
          
          // Find related objects (variations, images) for this item
          const relatedObjects = findRelatedSquareCatalogObjects(
            item.id, 
            squareCatalogObjects
          );
          
          // Convert Square catalog item to Spocket product
          const spocketProduct = squareToSpocketProduct(
            item,
            relatedObjects.variations,
            relatedObjects.images
          );
          
          // Save to Spocket via the Spocket API
          const savedProduct = await this.saveSpocketProduct(spocketProduct);
          
          // Create a mapping between Square and Spocket products
          const mapping: EntityMapping = {
            spocketId: savedProduct.id,
            squareId: item.id,
            entityType: SyncEntityType.PRODUCT,
            lastSynced: new Date()
          };
          
          // Save the mapping
          await this.repository.saveMapping(mapping);
          
          // Record the successful sync result
          const result: SyncResult = {
            entityId: item.id,
            entityType: SyncEntityType.PRODUCT,
            success: true,
            sourceId: item.id,
            targetId: savedProduct.id,
            timestamp: new Date()
          };
          
          await this.repository.saveResult(task.id, result);
          logger.info(`Successfully synced Square item ${item.id} to Spocket ${savedProduct.id}`);
          
        } catch (error: any) {
          // Record the error
          logger.error(`Error syncing Square item ${item.id} to Spocket: ${error.message}`, {
            itemId: item.id,
            error
          });
          
          const syncError: SyncError = {
            code: 'PRODUCT_SYNC_FAILED',
            message: `Failed to sync Square item ${item.id}: ${error.message}`,
            severity: SyncErrorSeverity.ERROR,
            entityId: item.id,
            entityType: SyncEntityType.PRODUCT,
            retryable: true,
            timestamp: new Date()
          };
          
          await this.repository.saveError(task.id, syncError);
          
          // Record the failed sync result
          const result: SyncResult = {
            entityId: item.id,
            entityType: SyncEntityType.PRODUCT,
            success: false,
            sourceId: item.id,
            error: syncError,
            timestamp: new Date()
          };
          
          await this.repository.saveResult(task.id, result);
        }
      }));
      
      // Small delay between batches to prevent overwhelming the APIs
      if (i + batchSize < squareItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  /**
   * Fetch products from Spocket
   * In a real implementation, this would use the actual Spocket API
   */
  private async fetchSpocketProducts(options: SyncOptions): Promise<SpocketProduct[]> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.spocketLimiter.schedule(async () => {
        logger.info('Fetching products from Spocket');
        
        // In a real implementation, you would:
        // 1. Get an access token from spocketAuthService
        // 2. Call the Spocket API to get products
        // 3. Parse the response into SpocketProduct objects
        
        const token = await spocketAuthService.getAccessToken();
        
        // This is a placeholder for the actual API call
        // In a real implementation, replace with actual API call
        const mockResponse: SpocketProductsResponse = {
          data: [
            {
              id: 'spkt_123',
              title: 'Sample Product 1',
              description: 'This is a sample product',
              sku: 'SP001',
              price: 19.99,
              currency: 'USD',
              inventory_quantity: 100,
              inventory_policy: 'deny',
              status: 'active',
              images: [
                {
                  id: 'img_1',
                  src: 'https://example.com/image1.jpg',
                  position: 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }
              ],
              variants: [],
              tags: ['sample', 'test'],
              weight: 0.5,
              weight_unit: 'kg',
              shipping_origin_country: 'US',
              processing_time: '1-3 days',
              categories: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]
        };
        
        // Apply any filters from options
        const filters = options.filters || {};
        let products = mockResponse.data;
        
        if (filters.status) {
          products = products.filter(p => p.status === filters.status);
        }
        
        logger.info(`Fetched ${products.length} products from Spocket`);
        return products;
      });
    } catch (error: any) {
      logger.error(`Error fetching products from Spocket: ${error.message}`, { error });
      throw new Error(`Failed to fetch Spocket products: ${error.message}`);
    }
  }
  
  /**
   * Fetch catalog objects from Square
   */
  private async fetchSquareCatalogObjects(options: SyncOptions): Promise<SquareCatalogObject[]> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.squareLimiter.schedule(async () => {
        logger.info('Fetching catalog objects from Square');
        
        // In a real implementation, you would use the Square SDK to fetch catalog objects
        // This is a placeholder for the actual API call
        
        // Initialize with retry logic
        let retries = 0;
        const maxRetries = options.retryCount || 3;
        const retryDelay = options.retryDelay || 1000;
        
        while (true) {
          try {
            // Mock response for demo purposes
            // In a real implementation, use the Square client
            const mockCatalogObjects: SquareCatalogObject[] = [
              {
                type: 'ITEM',
                id: 'sq_item_1',
                updated_at: new Date().toISOString(),
                version: 1,
                is_deleted: false,
                present_at_all_locations: true,
                item_data: {
                  name: 'Square Sample Product',
                  description: 'A sample product from Square',
                  available_online: true
                }
              }
            ];
            
            logger.info(`Fetched ${mockCatalogObjects.length} catalog objects from Square`);
            return mockCatalogObjects;
            
          } catch (err: any) {
            if (retries >= maxRetries) {
              throw err; // Rethrow after max retries
            }
            
            // Handle rate limiting specifically
            if (err instanceof ApiError && err.statusCode === 429) {
              const waitTime = retryDelay * Math.pow(2, retries);
              logger.warn(`Square API rate limit hit, waiting ${waitTime}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retries++;
              continue;
            }
            
            // For other errors, maybe retry depending on the error type
            if (err instanceof ApiError && [500, 502, 503, 504].includes(err.statusCode)) {
              const waitTime = retryDelay * Math.pow(2, retries);
              logger.warn(`Square API server error (${err.statusCode}), waiting ${waitTime}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retries++;
              continue;
            }
            
            // For other errors, rethrow
            throw err;
          }
        }
      });
    } catch (error: any) {
      logger.error(`Error fetching catalog objects from Square: ${error.message}`, { error });
      throw new Error(`Failed to fetch Square catalog objects: ${error.message}`);
    }
  }
  
  /**
   * Save catalog objects to Square
   */
  private async saveSquareCatalogObjects(catalogObjects: SquareCatalogObject[]): Promise<SquareCatalogObject[]> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.squareLimiter.schedule(async () => {
        logger.info(`Saving ${catalogObjects.length} catalog objects to Square`);
        
        // In a real implementation, you would use the Square catalog API
        // This is a placeholder for the actual API call
        
        // Initialize with retry logic
        let retries = 0;
        const maxRetries = 3;
        const retryDelay = 1000;
        
        while (true) {
          try {
            // In a real implementation, you'd use the Square SDK like this:
            // const response = await this.squareClient.catalogApi.batchUpsertCatalogObjects({
            //   idempotencyKey: uuidv4(),
            //   batches: [
            //     {
            //       objects: catalogObjects
            //     }
            //   ]
            // });
            
            // For simulation, we'll just return the same objects
            // but would normally return the updated objects from Square
            const savedObjects = catalogObjects.map(obj => ({
              ...obj,
              // In a real implementation, Square would assign IDs to new objects
              id: obj.id.startsWith('#') ? obj.id.replace('#', 'sq_') : obj.id,
              updated_at: new Date().toISOString()
            }));
            
            logger.info(`Successfully saved ${savedObjects.length} catalog objects to Square`);
            return savedObjects;
            
          } catch (err: any) {
            // Check if we've exhausted retries
            if (retries >= maxRetries) {
              throw err; // Rethrow after max retries
            }
            
            // Handle rate limiting specifically
            if (err.statusCode === 429) {
              const waitTime = retryDelay * Math.pow(2, retries);
              logger.warn(`Square API rate limit hit, waiting ${waitTime}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retries++;
              continue;
            }
            
            // Handle server errors with exponential backoff
            if ([500, 502, 503, 504].includes(err.statusCode)) {
              const waitTime = retryDelay * Math.pow(2, retries);
              logger.warn(`Square API server error (${err.statusCode}), waiting ${waitTime}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retries++;
              continue;
            }
            
            // For other errors, rethrow immediately
            throw err;
          }
        }
      });
    } catch (error: any) {
      logger.error(`Error saving catalog objects to Square: ${error.message}`, { error });
      throw new Error(`Failed to save catalog objects to Square: ${error.message}`);
    }
  }
  
  /**
   * Save product to Spocket
   */
  private async saveSpocketProduct(product: SpocketProduct): Promise<SpocketProduct> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.spocketLimiter.schedule(async () => {
        logger.info(`Saving product ${product.id} to Spocket`);
        
        // In a real implementation, you would:
        // 1. Get an access token from spocketAuthService
        // 2. Call the Spocket API to save the product
        // 3. Parse the response into a SpocketProduct object
        
        // Get access token
        const token = await spocketAuthService.getAccessToken();
        
        // Initialize with retry logic
        let retries = 0;
        const maxRetries = 3;
        const retryDelay = 1000;
        
        while (true) {
          try {
            // In a real implementation, you'd make an API call like:
            // const response = await axios.post(
            //   `${this.spocketBasePath}/api/products`,
            //   product,
            //   {
            //     headers: {
            //       'Authorization': `Bearer ${token}`,
            //       'Content-Type': 'application/json'
            //     }
            //   }
            // );
            
            // For simulation, we'll just return the same product
            // but with updated timestamps and a simulated Spocket ID if it doesn't have one
            const now = new Date().toISOString();
            const savedProduct: SpocketProduct = {
              ...product,
              id: product.id.startsWith('square_') ? `spkt_${product.id.substring(7)}` : product.id,
              created_at: product.created_at || now,
              updated_at: now
            };
            
            logger.info(`Successfully saved product ${savedProduct.id} to Spocket`);
            return savedProduct;
            
          } catch (err: any) {
            // Check if we've exhausted retries
            if (retries >= maxRetries) {
              throw err; // Rethrow after max retries
            }
            
            // Handle common error cases with retries
            if (err.response) {
              const status = err.response.status;
              
              // Handle rate limiting
              if (status === 429) {
                const waitTime = retryDelay * Math.pow(2, retries);
                logger.warn(`Spocket API rate limit hit, waiting ${waitTime}ms before retry`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                retries++;
                continue;
              }
              
              // Handle server errors with exponential backoff
              if ([500, 502, 503, 504].includes(status)) {
                const waitTime = retryDelay * Math.pow(2, retries);
                logger.warn(`Spocket API server error (${status}), waiting ${waitTime}ms before retry`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                retries++;
                continue;
              }
              
              // Handle authentication errors - attempt to refresh token and retry once
              if (status === 401 && retries === 0) {
                logger.warn('Spocket API authentication error, refreshing token and retrying');
                await spocketAuthService.refreshTokenIfNeeded();
                token = await spocketAuthService.getAccessToken();
                retries++;
                continue;
              }
            }
            
            // For network errors, retry with backoff
            if (err.request && !err.response && retries < maxRetries) {
              const waitTime = retryDelay * Math.pow(2, retries);
              logger.warn(`Network error connecting to Spocket API, waiting ${waitTime}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retries++;
              continue;
            }
            
            // For other errors, rethrow immediately
            throw err;
          }
        }
      });
    } catch (error: any) {
      logger.error(`Error saving product to Spocket: ${error.message}`, { 
        productId: product.id,
        error 
      });
      throw new Error(`Failed to save product to Spocket: ${error.message}`);
    }
  }
  
  /**
   * Get a sync task by ID
   */
  public async getSyncTask(taskId: string): Promise<SyncTask | null> {
    return this.repository.getTaskById(taskId);
  }
  
  /**
   * Get all entity mappings for a specific entity type
   * In a real implementation, this would query a database
   */
  public async getEntityMappings(entityType: SyncEntityType): Promise<EntityMapping[]> {
    // This is a simplified implementation since we're using an in-memory store
    // In a real implementation, you would query your database
    
    const mappings: EntityMapping[] = [];
    // This requires access to the internal repository implementation
    // In a real application, you would have a proper query method
    
    return mappings;
  }
}

// Export singleton instance
export const syncService = SyncService.getInstance();
export default syncService;
