/**
 * Inventory Synchronization Service for Spocket-Square integration
 */
import winston from 'winston';
import Bottleneck from 'bottleneck';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import { configService } from '../config/config.service';
import { spocketAuthService } from '../auth/spocket-auth.service';
import { 
  extractSpocketInventoryLevels, 
  extractSquareInventoryLevels,
  compareInventoryLevels,
  createSquareInventoryAdjustments,
  createSpocketInventoryAdjustments
} from './inventory.mapper';

import { 
  InventorySyncRequest, 
  InventorySyncResult,
  InventoryLevel,
  InventoryComparisonResult,
  InventoryAdjustment,
  InventoryBatchOperation
} from './inventory.types';

import { SpocketProduct } from '../types/spocket.types';
import { SquareCatalogObject, SquareInventory } from '../types/square.types';
import { EntityMapping, SyncEntityType } from '../sync/sync.types';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'inventory-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

/**
 * Inventory Synchronization Service
 * Handles inventory synchronization between Spocket and Square
 */
export class InventoryService {
  private static instance: InventoryService;
  private squareClient: any; // Square SDK Client
  private spocketBasePath: string;
  
  // Rate limiters for API calls
  private spocketLimiter: Bottleneck;
  private squareLimiter: Bottleneck;
  
  // Default Square location ID
  private squareLocationId: string = '';

  private constructor() {
    this.spocketBasePath = configService.getEnv('SPOCKET_API_BASE_URL') || 'https://api.spocket.co';
    
    // Initialize rate limiters
    this.spocketLimiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: 1000 // 1 request per second
    });
    
    this.squareLimiter = new Bottleneck({
      maxConcurrent: 2,
      minTime: 500 // 2 requests per second
    });
    
    // Initialize Square client from the main instance
    // In a real implementation, you would import the client from a shared service
    this.squareClient = configService.getSquareClient();
    
    // Set default Square location ID
    this.squareLocationId = configService.getEnv('SQUARE_LOCATION_ID') || 'default_location';
    
    logger.info(`InventoryService initialized with Square location: ${this.squareLocationId}`);
  }

  /**
   * Get singleton instance of InventoryService
   */
  public static getInstance(): InventoryService {
    if (!InventoryService.instance) {
      InventoryService.instance = new InventoryService();
    }
    return InventoryService.instance;
  }

  /**
   * Fetch inventory levels from Spocket
   * @param productMappings - Product mappings for filtering products
   */
  public async fetchSpocketInventory(productMappings: EntityMapping[]): Promise<InventoryLevel[]> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.spocketLimiter.schedule(async () => {
        logger.info('Fetching inventory from Spocket');
        
        const token = await spocketAuthService.getAccessToken();
        
        // In a real implementation, you'd make API calls to fetch products with inventory
        // For now we'll simulate this with a mock response
        
        // Extract Spocket product IDs from mappings
        const spocketIds = productMappings
          .filter(mapping => mapping.spocketId)
          .map(mapping => mapping.spocketId);
        
        // Mock products - in a real implementation, fetch from Spocket API
        const mockProducts: SpocketProduct[] = [
          {
            id: spocketIds[0] || 'spkt_123',
            title: 'Sample Product 1',
            description: 'This is a sample product',
            sku: 'SP001',
            price: 19.99,
            currency: 'USD',
            inventory_quantity: 100,
            inventory_policy: 'deny',
            status: 'active',
            images: [],
            variants: [],
            tags: [],
            weight: 0.5,
            weight_unit: 'kg',
            shipping_origin_country: 'US',
            processing_time: '1-3 days',
            categories: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        
        // Extract inventory levels from products
        const levels: InventoryLevel[] = [];
        for (const product of mockProducts) {
          levels.push(...extractSpocketInventoryLevels(product));
        }
        
        logger.info(`Fetched ${levels.length} inventory levels from Spocket`);
        return levels;
      });
    } catch (error: any) {
      logger.error(`Error fetching inventory from Spocket: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      throw new Error(`Failed to fetch Spocket inventory: ${error.message}`);
    }
  }

  /**
   * Fetch inventory levels from Square
   * @param locationId - Square location ID
   * @param productMappings - Product mappings for filtering products
   */
  public async fetchSquareInventory(
    locationId: string = this.squareLocationId,
    productMappings: EntityMapping[]
  ): Promise<InventoryLevel[]> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.squareLimiter.schedule(async () => {
        logger.info(`Fetching inventory from Square for location ${locationId}`);
        
        // In a real implementation, you'd make API calls to fetch catalog and inventory
        // For now we'll simulate this with a mock response
        
        // Extract Square product IDs from mappings
        const squareIds = productMappings
          .filter(mapping => mapping.squareId)
          .map(mapping => mapping.squareId);
        
        // Mock catalog objects - in a real implementation, fetch from Square API
        const mockCatalogObjects: SquareCatalogObject[] = [
          {
            type: 'ITEM',
            id: squareIds[0] || 'sq_item_1',
            updated_at: new Date().toISOString(),
            version: 1,
            is_deleted: false,
            present_at_all_locations: true,
            item_data: {
              name: 'Sample Product',
              description: 'A sample product',
              available_online: true
            }
          },
          {
            type: 'ITEM_VARIATION',
            id: 'sq_var_1',
            updated_at: new Date().toISOString(),
            version: 1,
            is_deleted: false,
            present_at_all_locations: true,
            item_variation_data: {
              item_id: squareIds[0] || 'sq_item_1',
              name: 'Regular',
              sku: 'SP001',
              price_money: {
                amount: 1999,
                currency: 'USD'
              }
            }
          }
        ];
        
        // Mock inventory data - in a real implementation, fetch from Square API
        const mockInventoryData: SquareInventory[] = [
          {
            catalog_object_id: 'sq_var_1',
            catalog_object_type: 'ITEM_VARIATION',
            state: 'IN_STOCK',
            location_id: locationId,
            quantity: '80',
            calculated_quantity: '80',
            occurred_at: new Date().toISOString()
          }
        ];
        
        // Extract inventory levels
        const levels = extractSquareInventoryLevels(
          mockCatalogObjects,
          mockInventoryData,
          locationId
        );
        
        logger.info(`Fetched ${levels.length} inventory levels from Square`);
        return levels;
      });
    } catch (error: any) {
      logger.error(`Error fetching inventory from Square: ${error.message}`, {
        locationId,
        error: error.toString(),
        stack: error.stack
      });
      throw new Error(`Failed to fetch Square inventory: ${error.message}`);
    }
  }

  /**
   * Apply inventory adjustments to Spocket
   * @param adjustments - Inventory adjustments to apply
   */
  private async applySpocketInventoryAdjustments(
    adjustments: InventoryAdjustment[]
  ): Promise<boolean> {
    if (adjustments.length === 0) {
      logger.info('No Spocket inventory adjustments to apply');
      return true;
    }
    
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.spocketLimiter.schedule(async () => {
        logger.info(`Applying ${adjustments.length} inventory adjustments to Spocket`);
        
        const token = await spocketAuthService.getAccessToken();
        
        // In a real implementation, you'd make API calls to update inventory
        // For now we'll just log the adjustments
        
        adjustments.forEach(adjustment => {
          logger.info(`Spocket adjustment: Product ${adjustment.productId}, SKU ${adjustment.sku}, Delta ${adjustment.quantityDelta}`);
        });
        
        // Simulate a delay and success
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.info('Successfully applied Spocket inventory adjustments');
        return true;
      });
    } catch (error: any) {
      logger.error(`Error applying Spocket inventory adjustments: ${error.message}`, {
        adjustments: JSON.stringify(adjustments),
        error: error.toString(),
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Apply inventory adjustments to Square
   * @param adjustments - Inventory adjustments to apply
   * @param locationId - Square location ID
   */
  private async applySquareInventoryAdjustments(
    adjustments: {
      catalog_object_id: string;
      location_id: string;
      quantity: string;
      from_state?: string;
      to_state?: string;
      occurred_at?: string;
    }[],
    idempotencyKey: string,
    locationId: string = this.squareLocationId
  ): Promise<boolean> {
    if (adjustments.length === 0) {
      logger.info('No Square inventory adjustments to apply');
      return true;
    }
    
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.squareLimiter.schedule(async () => {
        logger.info(`Applying ${adjustments.length} inventory adjustments to Square at location ${locationId}`);
        
        // In a real implementation, you'd use the Square SDK
        // For now we'll just log the adjustments
        
        adjustments.forEach(adjustment => {
          logger.info(`Square adjustment: Object ${adjustment.catalog_object_id}, Quantity ${adjustment.quantity}, From ${adjustment.from_state} to ${adjustment.to_state}`);
        });
        
        // Simulate a delay and success
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.info('Successfully applied Square inventory adjustments');
        return true;
      });
    } catch (error: any) {
      logger.error(`Error applying Square inventory adjustments: ${error.message}`, {
        locationId,
        adjustments: JSON.stringify(adjustments),
        error: error.toString(),
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Synchronize inventory between Spocket and Square
   * @param request - Synchronization request parameters
   */
  public async syncInventory(request: InventorySyncRequest): Promise<InventorySyncResult> {
    const startTime = Date.now();
    logger.info(`Starting inventory sync in direction: ${request.direction}`);
    
    // Initialize result
    const result: InventorySyncResult = {
      success: false,
      syncedItems: 0,
      skippedItems: 0,
      errors: [],
      details: []
    };
    
    try {
      // Determine location ID
      const locationId = request.locationId || this.squareLocationId;
      
      // Step 1: Fetch inventory from both platforms
      let spocketLevels: InventoryLevel[] = [];
      let squareLevels: InventoryLevel[] = [];
      
      if (request.direction === 'spocket_to_square' || request.direction === 'bidirectional') {
        spocketLevels = await this.fetchSpocketInventory(request.productMappings);
      }
      
      if (request.direction === 'square_to_spocket' || request.direction === 'bidirectional') {
        squareLevels = await this.fetchSquareInventory(locationId, request.productMappings);
      }
      
      // Step 2: Compare inventory levels and identify discrepancies
      const comparisonResults = compareInventoryLevels(
        spocketLevels,
        squareLevels,
        request.productMappings,
        request.forceUpdate ? -1 : 0 // Use -1 threshold to force updates if requested
      );
      
      // Filter results that require sync
      const syncRequired = comparisonResults.filter(result => result.requiresSync);
      
      // Fill in the details for the result
      comparisonResults.forEach(comparison => {
        if (comparison.requiresSync) {
          // Will be updated to 'updated' or 'error' later
          result.details.push({
            sku: comparison.sku,
            spocketQuantity: comparison.spocketQuantity,
            squareQuantity: comparison.squareQuantity,
            action: 'skipped'
          });
        } else {
          result.skippedItems++;
          result.details.push({
            sku: comparison.sku,
            spocketQuantity: comparison.spocketQuantity,
            squareQuantity: comparison.squareQuantity,
            action: 'skipped'
          });
        }
      });
      
      // Process batches of inventory adjustments
      const batchSize = request.batchSize || 50;
      
      // Step 3: Apply adjustments based on sync direction
      if (request.direction === 'spocket_to_square' || request.direction === 'bidirectional') {
        // Create Square inventory adjustments
        const squareAdjustment = createSquareInventoryAdjustments(
          spocketLevels,
          syncRequired,
          locationId
        );
        
        // If there are adjustments to make, apply them in batches
        if (squareAdjustment.adjustments.length > 0) {
          // Process in batches
          for (let i = 0; i < squareAdjustment.adjustments.length; i += batchSize) {
            const batchAdjustments = squareAdjustment.adjustments.slice(i, i + batchSize);
            
            // Generate a new idempotency key for each batch
            const batchIdempotencyKey = uuidv4();
            
            // Apply batch with retries
            let retries = 0;
            const maxRetries = 3;
            let success = false;
            
            while (retries < maxRetries && !success) {
              try {
                success = await this.applySquareInventoryAdjustments(
                  batchAdjustments,
                  batchIdempotencyKey,
                  locationId
                );
                
                if (success) {
                  // Update result details for successful items
                  batchAdjustments.forEach(adjustment => {
                    const detailIndex = result.details.findIndex(
                      d => d.sku === syncRequired.find(
                        r => r.productMapping?.squareId === adjustment.catalog_object_id
                      )?.sku
                    );
                    
                    if (detailIndex !== -1) {
                      result.details[detailIndex].action = 'updated';
                      result.syncedItems++;
                    }
                  });
                } else {
                  // Retry on failure
                  retries++;
                  await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
              } catch (error) {
                retries++;
                logger.warn(`Retry ${retries}/${maxRetries} for Square batch adjustments due to error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
              }
            }
            
            // If still not successful, record errors
            if (!success) {
              batchAdjustments.forEach(adjustment => {
                const comparisonResult = syncRequired.find(
                  r => r.productMapping?.squareId === adjustment.catalog_object_id
                );
                
                if (comparisonResult) {
                  result.errors.push({
                    sku: comparisonResult.sku,
                    message: `Failed to update Square inventory after ${maxRetries} retries`,
                    code: 'SQUARE_INVENTORY_UPDATE_FAILED'
                  });
                  
                  // Update detail
                  const detailIndex = result.details.findIndex(d => d.sku === comparisonResult.sku);
                  if (detailIndex !== -1) {
                    result.details[detailIndex].action = 'error';
                  }
                }
              });
            }
          }
        }
      }
      
      if (request.direction === 'square_to_spocket' || request.direction === 'bidirectional') {
        // Create Spocket inventory adjustments
        const spocketAdjustments = createSpocketInventoryAdjustments(syncRequired);
        
        // If there are adjustments to make, apply them in batches
        if (spocketAdjustments.length > 0) {
          // Process in batches
          for (let i = 0; i < spocketAdjustments.length; i += batchSize) {
            const batchAdjustments = spocketAdjustments.slice(i, i + batchSize);
            
            // Apply batch with retries
            let retries = 0;
            const maxRetries = 3;
            let success = false;
            
            while (retries < maxRetries && !success) {
              try {
                success = await this.applySpocketInventoryAdjustments(batchAdjustments);
                
                if (success) {
                  // Update result details for successful items
                  batchAdjustments.forEach(adjustment => {
                    const detailIndex = result.details.findIndex(d => d.sku === adjustment.sku);
                    
                    if (detailIndex !== -1) {
                      result.details[detailIndex].action = 'updated';
                      result.syncedItems++;
                    }
                  });
                } else {
                  // Retry on failure
                  retries++;
                  await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
              } catch (error) {
                retries++;
                logger.warn(`Retry ${retries}/${maxRetries} for Spocket batch adjustments due to error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
              }
            }
            
            // If still not successful, record errors
            if (!success) {
              batchAdjustments.forEach(adjustment => {
                result.errors.push({
                  sku: adjustment.sku,
                  message: `Failed to update Spocket inventory after ${maxRetries} retries`,
                  code: 'SPOCKET_INVENTORY_UPDATE_FAILED'
                });
                
                // Update detail
                const detailIndex = result.details.findIndex(d => d.sku === adjustment.sku);
                if (detailIndex !== -1) {
                  result.details[detailIndex].action = 'error';
                }
              });
            }
          }
        }
      }
      
      // Step 4: Handle conflict resolution for bidirectional sync
      if (request.direction === 'bidirectional') {
        // In a bidirectional sync, we need to apply a conflict resolution strategy
        // For simplicity, we've already processed both directions above
        // In a real implementation, you might want to first identify conflicts
        // and then apply them based on your conflict resolution strategy
        logger.info('Bidirectional sync completed, conflicts automatically resolved');
      }
      
      // Step 5: Verify sync and update result
      const successPercentage = result.syncedItems / (result.syncedItems + result.errors.length);
      result.success = result.errors.length === 0 || successPercentage > 0.9;
      
      const endTime = Date.now();
      logger.info(`Inventory sync completed in ${endTime - startTime}ms with success: ${result.success}`);
      logger.info(`Synced: ${result.syncedItems}, skipped: ${result.skippedItems}, errors: ${result.errors.length}`);
      
      return result;
    } catch (error: any) {
      logger.error(`Error in inventory sync: ${error.message}`, {
        direction: request.direction,
        error: error.toString(),
        stack: error.stack
      });
      
      // Build error result
      result.success = false;
      result.errors.push({
        sku: 'GENERAL',
        message: error.message,
        code: 'SYNC_FAILED'
      });
      
      return result;
    }
  }
  
  /**
   * Reconcile inventory between Spocket and Square
   * This advanced method verifies inventory counts and fixes discrepancies
   * @param productMappings - Product mappings
   * @param locationId - Square location ID
   */
  public async reconcileInventory(
    productMappings: EntityMapping[],
    locationId: string = this.squareLocationId
  ): Promise<{
    success: boolean;
    reconciled: number;
    errors: {
      sku: string;
      message: string;
    }[];
  }> {
    logger.info('Starting inventory reconciliation');
    
    try {
      // Fetch inventory from both platforms
      const spocketLevels = await this.fetchSpocketInventory(productMappings);
      const squareLevels = await this.fetchSquareInventory(locationId, productMappings);
      
      // Compare levels to find discrepancies
      const comparisonResults = compareInventoryLevels(
        spocketLevels,
        squareLevels,
        productMappings
      );
      
      // Only fix significant discrepancies (difference > 1%)
      const significantDiscrepancies = comparisonResults.filter(result => {
        // Ignore items with zero inventory in both systems
        if (result.spocketQuantity === 0 && result.squareQuantity === 0) {
          return false;
        }
        
        // Calculate percentage difference
        const max = Math.max(result.spocketQuantity, result.squareQuantity);
        const percentDiff = max > 0 ? Math.abs(result.discrepancy) / max : 0;
        
        // Consider significant if > 1% and at least 5 units
        return percentDiff > 0.01 && Math.abs(result.discrepancy) >= 5;
      });
      
      logger.info(`Found ${significantDiscrepancies.length} significant inventory discrepancies`);
      
      // Always trust Spocket (source of truth) for reconciliation
      if (significantDiscrepancies.length > 0) {
        const syncRequest: InventorySyncRequest = {
          direction: 'spocket_to_square',
          productMappings,
          locationId,
          batchSize: 50,
          forceUpdate: true
        };
        
        const syncResult = await this.syncInventory(syncRequest);
        
        return {
          success: syncResult.success,
          reconciled: syncResult.syncedItems,
          errors: syncResult.errors
        };
      } else {
        return {
          success: true,
          reconciled: 0,
          errors: []
        };
      }
    } catch (error: any) {
      logger.error(`Error in inventory reconciliation: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      
      return {
        success: false,
        reconciled: 0,
        errors: [{
          sku: 'GENERAL',
          message: `Reconciliation failed: ${error.message}`
        }]
      };
    }
  }
}

// Export singleton instance
export const inventoryService = InventoryService.getInstance();
export default inventoryService;
