/**
 * Order Synchronization Module
 * Handles synchronization of orders between Spocket and Square platforms
 */

import { createLogger } from '../common/logger';
import { createSpocketRateLimiter, createSquareRateLimiter } from '../common/rate-limiter';
import { OrderFetcher, orderFetcher } from './order-fetcher';
import {
  buildOrderMappings,
  processOrderBatch,
  resolveStatusConflict,
  resolvePaymentConflict,
  startSyncProgress,
  updateSyncProgress,
  completeSyncProgress,
  getCurrentSyncProgress,
  recoverSync,
  createOrderInTargetPlatform,
  updateOrderAcrossPlatforms,
  processWebhookForSync
} from './handlers/sync.handler';

import {
  Order,
  OrderSyncRequest,
  OrderSyncResult,
  OrderFulfillmentStatus
} from '../../types/order.types';

import { withRetry } from './utils/order.utils';

// Configure logger
const logger = createLogger('order-sync');

/**
 * Class responsible for orchestrating order synchronization between platforms
 */
export class OrderSynchronizer {
  private static instance: OrderSynchronizer;
  
  // Rate limiters for API calls
  private spocketLimiter;
  private squareLimiter;
  
  // Reference to order fetcher
  private fetcher: OrderFetcher;
  
  // Default sync batch size
  private defaultBatchSize: number = 25;
  
  // Default Square location ID
  private squareLocationId: string = '';
  
  private constructor() {
    // Initialize rate limiters
    this.spocketLimiter = createSpocketRateLimiter();
    this.squareLimiter = createSquareRateLimiter();
    
    // Get reference to order fetcher
    this.fetcher = orderFetcher;
    
    // Set default Square location ID - should be injected from config in real implementation
    this.squareLocationId = process.env.SQUARE_LOCATION_ID || 'default_location';
    
    logger.info(`OrderSynchronizer initialized with Square location: ${this.squareLocationId}`);
  }

  /**
   * Get singleton instance of OrderSynchronizer
   */
  public static getInstance(): OrderSynchronizer {
    if (!OrderSynchronizer.instance) {
      OrderSynchronizer.instance = new OrderSynchronizer();
    }
    return OrderSynchronizer.instance;
  }

  /**
   * Synchronize orders between Spocket and Square
   * @param params - Order sync parameters
   * @returns Sync result with statistics
   */
  public async synchronizeOrders(params: OrderSyncRequest = {}): Promise<OrderSyncResult> {
    try {
      // Default sync direction if not specified
      const direction = params.direction || 'bidirectional';
      
      // Get location ID from params or use default
      const locationId = params.locationId || this.squareLocationId;
      
      // Define batch size (default to class setting if not specified)
      const batchSize = params.batchSize || this.defaultBatchSize;
      
      logger.info('Starting order synchronization', { 
        direction, 
        dateRange: params.dateRange, 
        locationId, 
        batchSize 
      });

      // Fetch orders from both platforms
      const { spocketOrders, squareOrders } = await this.fetcher.fetchOrdersForSync(
        params.dateRange,
        locationId
      );
      
      logger.info(`Fetched ${spocketOrders.length} Spocket orders and ${squareOrders.length} Square orders`);
      
      // Calculate total orders to process based on sync direction
      const totalOrdersToProcess = direction === 'bidirectional' 
        ? spocketOrders.length + squareOrders.length
        : direction === 'spocket-to-square' ? spocketOrders.length : squareOrders.length;
      
      // Start sync progress tracking
      const progress = startSyncProgress(totalOrdersToProcess);
      
      // Build mappings between orders
      const mappings = buildOrderMappings(spocketOrders, squareOrders);
      
      // Initialize result object
      const result: OrderSyncResult = {
        syncedOrders: 0,
        createdOrders: {
          spocket: 0,
          square: 0
        },
        updatedOrders: {
          spocket: 0,
          square: 0
        },
        errors: []
      };
      
      try {
        // Process based on sync direction
        if (direction === 'spocket-to-square' || direction === 'bidirectional') {
          await this.processOrderSync(spocketOrders, mappings, 'spocket-to-square', batchSize, locationId, result, progress);
        }
        
        if (direction === 'square-to-spocket' || direction === 'bidirectional') {
          await this.processOrderSync(squareOrders, mappings, 'square-to-spocket', batchSize, locationId, result, progress);
        }
        
        // Complete sync progress tracking
        completeSyncProgress('completed');
        
        logger.info('Order synchronization completed', { 
          syncedOrders: result.syncedOrders,
          createdOrders: result.createdOrders,
          updatedOrders: result.updatedOrders,
          errorCount: result.errors.length
        });
        
        return result;
      } catch (error: any) {
        // Mark sync as failed but return partial results
        completeSyncProgress('failed');
        
        logger.error(`Order synchronization failed: ${error.message}`, { 
          error: error.toString(),
          stack: error.stack
        });
        
        return result;
      }
    } catch (error: any) {
      logger.error(`Failed to synchronize orders: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      
      // Return empty result with error
      return {
        syncedOrders: 0,
        createdOrders: { spocket: 0, square: 0 },
        updatedOrders: { spocket: 0, square: 0 },
        errors: [{
          message: `Synchronization failed: ${error.message}`,
          orderId: null,
          source: 'system',
          details: error.toString()
        }]
      };
    }
  }
  
  /**
   * Process order synchronization for a platform direction
   */
  private async processOrderSync(
    orders: Order[],
    mappings: any[],
    direction: 'spocket-to-square' | 'square-to-spocket',
    batchSize: number,
    locationId: string,
    result: OrderSyncResult,
    progress: any
  ): Promise<void> {
    const platform = direction === 'spocket-to-square' ? 'spocket' : 'square';
    const targetPlatform = direction === 'spocket-to-square' ? 'square' : 'spocket';
    const limiter = direction === 'spocket-to-square' ? this.spocketLimiter : this.squareLimiter;
    
    logger.info(`Processing ${platform} to ${targetPlatform} sync`);
    
    // Process orders in batches
    for (let i = 0; i < orders.length; i += batchSize) {
      const orderBatch = orders.slice(i, i + batchSize);
      
      // Process batch with rate limiting and retry
      const batchResult = await limiter.schedule(async () => {
        return await withRetry(async () => {
          return await processOrderBatch(orderBatch, mappings, direction, locationId);
        }, 3, [500, 1000, 2000]);
      });
      
      // Update result counts
      result.syncedOrders += batchResult.syncedOrders;
      if (direction === 'spocket-to-square') {
        result.createdOrders.square += batchResult.createdOrders;
        result.updatedOrders.square += batchResult.updatedOrders;
      } else {
        result.createdOrders.spocket += batchResult.createdOrders;
        result.updatedOrders.spocket += batchResult.updatedOrders;
      }
      result.errors.push(...batchResult.errors);
      
      // Update progress tracker
      updateSyncProgress({
        processedOrders: progress.processedOrders + orderBatch.length,
        createdOrders: {
          [targetPlatform]: progress.createdOrders[targetPlatform] + batchResult.createdOrders
        },
        updatedOrders: {
          [targetPlatform]: progress.updatedOrders[targetPlatform] + batchResult.updatedOrders
        },
        failedOrders: progress.failedOrders + batchResult.errors.length,
        errors: batchResult.errors,
        lastSyncedOrderId: orderBatch[orderBatch.length - 1]?.id
      });
      
      logger.info(`Processed batch ${i / batchSize + 1} of ${Math.ceil(orders.length / batchSize)} for ${platform} to ${targetPlatform} sync`);
    }
  }

  /**
   * Synchronize a single order between platforms
   * @param orderId - Order ID to synchronize
   * @param platform - Source platform
   */
  public async synchronizeOrder(
    orderId: string,
    platform: 'spocket' | 'square',
    locationId: string = this.squareLocationId
  ): Promise<{success: boolean; message: string}> {
    try {
      logger.info(`Synchronizing individual order ${orderId} from ${platform}`);
      
      // Fetch the order from the source platform
      const sourceOrder = await this.fetcher.getOrderById(orderId, platform);
      
      if (!sourceOrder) {
        throw new Error(`Order ${orderId} not found on ${platform}`);
      }
      
      // Set sync direction based on platform
      const direction = platform === 'spocket' ? 'spocket-to-square' : 'square-to-spocket';
      
      // Create order in the target platform
      await createOrderInTargetPlatform(sourceOrder, direction, locationId);
      
      logger.info(`Successfully synchronized order ${orderId} from ${platform}`);
      
      return { 
        success: true, 
        message: `Order ${orderId} successfully synchronized from ${platform}` 
      };
    } catch (error: any) {
      logger.error(`Failed to synchronize order ${orderId}: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      
      return { 
        success: false, 
        message: `Failed to synchronize order: ${error.message}` 
      };
    }
  }
  
  /**
   * Handle a webhook event from either platform for real-time sync
   * @param event - Webhook event payload
   * @param platform - Source platform
   */
  public async handleWebhook(
    event: any, 
    platform: 'spocket' | 'square'
  ): Promise<{success: boolean; message: string}> {
    try {
      logger.info(`Processing webhook from ${platform}`);
      
      // Process the webhook for synchronization
      await processWebhookForSync(event, platform);
      
      return {
        success: true,
        message: `Successfully processed ${platform} webhook`
      };
    } catch (error: any) {
      logger.error(`Failed to process ${platform} webhook: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      
      return {
        success: false,
        message: `Failed to process webhook: ${error.message}`
      };
    }
  }

  /**
   * Recover an interrupted sync operation
   * @param syncId - ID of the sync operation to recover
   */
  public async recoverSyncOperation(syncId: string): Promise<{success: boolean; message: string}> {
    try {
      logger.info(`Attempting to recover sync operation ${syncId}`);
      
      const syncProgress = await recoverSync(syncId);
      
      if (!syncProgress) {
        return {
          success: false,
          message: `No sync progress found for ID ${syncId}`
        };
      }
      
      return {
        success: true,
        message: `Successfully recovered sync operation ${syncId}`
      };
    } catch (error: any) {
      logger.error(`Failed to recover sync operation ${syncId}: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      
      return {
        success: false,
        message: `Failed to recover sync operation: ${error.message}`
      };
    }
  }
}

// Export a singleton instance
export const orderSynchronizer = OrderSynchronizer.getInstance();

