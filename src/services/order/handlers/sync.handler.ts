/**
 * Order Synchronization Handler
 * Handles synchronization of orders between Spocket and Square
 */

import { createLogger } from '../../common/logger';
import { 
  fetchSpocketOrders, 
  getSpocketOrderById, 
  createSpocketOrder, 
  updateSpocketOrder,
  updateSpocketOrderStatus,
  updateSpocketOrderFulfillment,
  updateSpocketOrderPayment,
  extractSquareReferenceFromSpocketOrder
} from './spocket.handler';

import { 
  fetchSquareOrders, 
  getSquareOrderById, 
  createSquareOrder, 
  updateSquareOrder,
  updateSquareOrderStatus,
  updateSquareOrderFulfillment,
  updateSquareOrderPayment,
  extractSpocketReferenceFromSquareOrder
} from './square.handler';

import { withRetry } from '../utils/order.utils';
import {
  Order,
  OrderSyncRequest,
  OrderSyncResult,
  OrderSyncDirection,
  OrderFulfillmentStatus,
  OrderPaymentStatus
} from '../../../types/order.types';

import { EntityMapping, SyncEntityType } from '../../../types/sync.types';

// Configure logger
const logger = createLogger('sync-handler');

/**
 * Build mappings between Spocket and Square orders
 * @param spocketOrders - Orders from Spocket
 * @param squareOrders - Orders from Square
 */
export const buildOrderMappings = (
  spocketOrders: Order[], 
  squareOrders: Order[]
): EntityMapping[] => {
  const mappings: EntityMapping[] = [];
  
  // Build mappings from Spocket to Square
  for (const spocketOrder of spocketOrders) {
    // Look for matching Square order by reference
    const squareOrder = squareOrders.find(sqOrder => {
      return sqOrder.externalId === spocketOrder.id || 
             sqOrder.orderNumber === spocketOrder.orderNumber;
    });
    
    if (squareOrder) {
      mappings.push({
        entityType: SyncEntityType.ORDER,
        sourceId: spocketOrder.id,
        targetId: squareOrder.id,
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
    }
  }
  
  // Look for mappings from Square to Spocket that might have been missed
  for (const squareOrder of squareOrders) {
    const existingMapping = mappings.find(m => m.targetId === squareOrder.id);
    
    if (!existingMapping) {
      // Look for a reference in the Square order that points to a Spocket order
      const spocketOrderId = extractSpocketReferenceFromSquareOrder(squareOrder);
      if (spocketOrderId) {
        // Check if the referenced Spocket order exists
        const spocketOrder = spocketOrders.find(o => o.id === spocketOrderId);
        if (spocketOrder) {
          mappings.push({
            entityType: SyncEntityType.ORDER,
            sourceId: spocketOrder.id,
            targetId: squareOrder.id,
            sourceSystem: 'spocket',
            targetSystem: 'square'
          });
        }
      }
    }
  }
  
  logger.info(`Built ${mappings.length} order mappings between Spocket and Square`);
  return mappings;
};

/**
 * Process a batch of orders for synchronization
 * @param orders - Orders to process
 * @param mappings - Mappings between Spocket and Square orders
 * @param direction - Direction of synchronization
 * @param locationId - Square location ID
 */
export const processOrderBatch = async (
  orders: Order[],
  mappings: EntityMapping[],
  direction: OrderSyncDirection,
  locationId?: string
): Promise<{
  syncedOrders: number;
  createdOrders: number;
  updatedOrders: number;
  errors: Array<{
    message: string;
    orderId: string | null;
    source: string;
    details?: string;
  }>;
}> => {
  const result = {
    syncedOrders: 0,
    createdOrders: 0,
    updatedOrders: 0,
    errors: [] as Array<{
      message: string;
      orderId: string | null;
      source: string;
      details?: string;
    }>
  };
  
  // Process each order in the batch with individual error handling
  await Promise.all(
    orders.map(async (order) => {
      try {
        // Find existing mapping
        const mapping = mappings.find(m => 
          (direction === 'spocket-to-square' && m.sourceId === order.id) ||
          (direction === 'square-to-spocket' && m.targetId === order.id)
        );
        
        if (mapping) {
          // Order exists in both systems - update
          await updateOrderAcrossPlatforms(order, mapping, direction);
          result.updatedOrders++;
        } else {
          // Order only exists in source system - create in target
          await createOrderInTargetPlatform(order, direction, locationId);
          result.createdOrders++;
        }
        
        result.syncedOrders++;
      } catch (error: any) {
        logger.error(`Error processing order ${order.id}`, {
          error: error.toString(),
          direction,
          orderId: order.id
        });
        
        result.errors.push({
          message: `Failed to process order: ${error.message}`,
          orderId: order.id,
          source: direction === 'spocket-to-square' ? 'spocket' : 'square',
          details: error.toString()
        });
      }
    })
  );
  
  return result;
};

/**
 * Create an order in the target platform
 * @param order - Order to create
 * @param direction - Direction of creation
 * @param locationId - Square location ID
 */
export const createOrderInTargetPlatform = async (
  order: Order,
  direction: OrderSyncDirection,
  locationId?: string
): Promise<string> => {
  try {
    if (direction === 'spocket-to-square') {
      // Create order in Square
      return await createSquareOrder(order, locationId);
    } else {
      // Create order in Spocket
      return await createSpocketOrder(order);
    }
  } catch (error: any) {
    logger.error(`Failed to create order in ${direction === 'spocket-to-square' ? 'Square' : 'Spocket'}`, {
      error: error.toString(),
      orderId: order.id
    });
    throw error;
  }
};

/**
 * Update an order across platforms
 * @param order - Order with updates
 * @param mapping - Mapping between Spocket and Square order
 * @param direction - Direction of update
 */
export const updateOrderAcrossPlatforms = async (
  order: Order,
  mapping: EntityMapping,
  direction: OrderSyncDirection
): Promise<void> => {
  // Determine target order ID based on direction
  const targetOrderId = direction === 'spocket-to-square' ? mapping.targetId : mapping.sourceId;
  
  try {
    // Get current target order to compare
    const targetOrder = direction === 'spocket-to-square' 
      ? await getSquareOrderById(targetOrderId)
      : await getSpocketOrderById(targetOrderId);
    
    if (!targetOrder) {
      throw new Error(`Target order ${targetOrderId} not found`);
    }
    
    // Check which aspects need updating
    const updates = determineRequiredUpdates(order, targetOrder);
    
    if (updates.status) {
      await updateOrderStatus(order, targetOrder, direction);
    }
    
    if (updates.fulfillment) {
      await updateOrderFulfillment(order, targetOrder, direction);
    }
    
    if (updates.payment) {
      await updateOrderPayment(order, targetOrder, direction);
    }
    
    logger.info(`Updated order across platforms`, {
      sourceOrderId: order.id,
      targetOrderId,
      direction,
      updates
    });
  } catch (error: any) {
    logger.error(`Failed to update order across platforms`, {
      error: error.toString(),
      orderId: order.id,
      targetOrderId,
      direction
    });
    throw error;
  }
};

/**
 * Determine which order aspects need updating
 * @param sourceOrder - Source order
 * @param targetOrder - Target order
 */
function determineRequiredUpdates(sourceOrder: Order, targetOrder: Order): {
  status: boolean;
  fulfillment: boolean;
  payment: boolean;
} {
  return {
    status: sourceOrder.fulfillmentStatus !== targetOrder.fulfillmentStatus,
    fulfillment: sourceOrder.shipping?.trackingNumber !== targetOrder.shipping?.trackingNumber ||
                sourceOrder.shipping?.carrier !== targetOrder.shipping?.carrier,
    payment: sourceOrder.paymentStatus !== targetOrder.paymentStatus
  };
}

/**
 * Update order status across platforms
 * @param sourceOrder - Source order with current status
 * @param targetOrder - Target order to update
 * @param direction - Direction of update
 */
export const updateOrderStatus = async (
  sourceOrder: Order,
  targetOrder: Order,
  direction: OrderSyncDirection
): Promise<void> => {
  return withRetry(async () => {
    try {
      if (direction === 'spocket-to-square') {
        // Update status in Square
        await updateSquareOrderStatus(targetOrder.id, sourceOrder.fulfillmentStatus);
      } else {
        // Update status in Spocket
        await updateSpocketOrderStatus(targetOrder.id, sourceOrder.fulfillmentStatus);
      }
      
      logger.info(`Updated order status`, {
        targetOrderId: targetOrder.id,
        oldStatus: targetOrder.fulfillmentStatus,
        newStatus: sourceOrder.fulfillmentStatus,
        direction
      });
    } catch (error: any) {
      logger.error(`Failed to update order status`, {
        error: error.toString(),
        sourceOrderId: sourceOrder.id,
        targetOrderId: targetOrder.id,
        direction
      });
      throw error;
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Update order fulfillment across platforms
 * @param sourceOrder - Source order with current fulfillment
 * @param targetOrder - Target order to update
 * @param direction - Direction of update
 */
export const updateOrderFulfillment = async (
  sourceOrder: Order,
  targetOrder: Order,
  direction: OrderSyncDirection
): Promise<void> => {
  return withRetry(async () => {
    try {
      const fulfillmentUpdate = {
        status: sourceOrder.fulfillmentStatus,
        trackingNumber: sourceOrder.shipping?.trackingNumber,
        carrier: sourceOrder.shipping?.carrier
      };
      
      if (direction === 'spocket-to-square') {
        // Update fulfillment in Square
        await updateSquareOrderFulfillment(targetOrder.id, fulfillmentUpdate);
      } else {
        // Update fulfillment in Spocket
        await updateSpocketOrderFulfillment(targetOrder.id, fulfillmentUpdate);
      }
      
      logger.info(`Updated order fulfillment`, {
        targetOrderId: targetOrder.id,
        oldTrackingNumber: targetOrder.shipping?.trackingNumber,
        newTrackingNumber: sourceOrder.shipping?.trackingNumber,
        direction
      });
    } catch (error: any) {
      logger.error(`Failed to update order fulfillment`, {
        error: error.toString(),
        sourceOrderId: sourceOrder.id,
        targetOrderId: targetOrder.id,
        direction
      });
      throw error;
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Update order payment across platforms
 * @param sourceOrder - Source order with current payment
 * @param targetOrder - Target order to update
 * @param direction - Direction of update
 */
export const updateOrderPayment = async (
  sourceOrder: Order,
  targetOrder: Order,
  direction: OrderSyncDirection
): Promise<void> => {
  return withRetry(async () => {
    try {
      const paymentUpdate = {
        status: sourceOrder.paymentStatus
      };
      
      if (direction === 'spocket-to-square') {
        // Update payment in Square
        await updateSquareOrderPayment(targetOrder.id, paymentUpdate);
      } else {
        // Update payment in Spocket
        await updateSpocketOrderPayment(targetOrder.id, paymentUpdate);
      }
      
      logger.info(`Updated order payment`, {
        targetOrderId: targetOrder.id,
        oldStatus: targetOrder.paymentStatus,
        newStatus: sourceOrder.paymentStatus,
        direction
      });
    } catch (error: any) {
      logger.error(`Failed to update order payment`, {
        error: error.toString(),
        sourceOrderId: sourceOrder.id,
        targetOrderId: targetOrder.id,
        direction
      });
      throw error;
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Resolve a conflict between order statuses
 * @param spocketOrder - Spocket order
 * @param squareOrder - Square order
 */
export const resolveStatusConflict = (
  spocketOrder: Order,
  squareOrder: Order
): { resolution: OrderFulfillmentStatus; platform: 'spocket' | 'square' } => {
  // Define priority of statuses (higher = more advanced)
  const statusPriority: Record<OrderFulfillmentStatus, number> = {
    [OrderFulfillmentStatus.PENDING]: 0,
    [OrderFulfillmentStatus.PROCESSED]: 1,
    [OrderFulfillmentStatus.SHIPPED]: 2,
    [OrderFulfillmentStatus.DELIVERED]: 3,
    [OrderFulfillmentStatus.CANCELED]: 4
  };
  
  const spocketPriority = statusPriority[spocketOrder.fulfillmentStatus] || 0;
  const squarePriority = statusPriority[squareOrder.fulfillmentStatus] || 0;
  
  if (spocketPriority > squarePriority) {
    // Spocket has a more advanced status
    return {
      resolution: spocketOrder.fulfillmentStatus,
      platform: 'spocket'
    };
  } else if (squarePriority > spocketPriority) {
    // Square has a more advanced status
    return {
      resolution: squareOrder.fulfillmentStatus,
      platform: 'square'
    };
  }
  
  // Same status, no conflict
  return {
    resolution: spocketOrder.fulfillmentStatus,
    platform: 'spocket' // Default to Spocket when equal
  };
};

/**
 * Resolve a conflict between payment statuses
 * @param spocketOrder - Spocket order
 * @param squareOrder - Square order
 */
export const resolvePaymentConflict = (
  spocketOrder: Order,
  squareOrder: Order
): { resolution: OrderPaymentStatus; platform: 'spocket' | 'square' } => {
  // Define priority of payment statuses (higher = more advanced)
  const paymentPriority: Record<OrderPaymentStatus, number> = {
    [OrderPaymentStatus.PENDING]: 0,
    [OrderPaymentStatus.AUTHORIZED]: 1,
    [OrderPaymentStatus.PAID]: 2,
    [OrderPaymentStatus.PARTIALLY_REFUNDED]: 3,
    [OrderPaymentStatus.REFUNDED]: 4,
    [OrderPaymentStatus.FAILED]: 5,
    [OrderPaymentStatus.VOIDED]: 6
  };
  
  const spocketPriority = paymentPriority[spocketOrder.paymentStatus] || 0;
  const squarePriority = paymentPriority[squareOrder.paymentStatus] || 0;
  
  // Special handling for payment statuses
  // For payment statuses, we prioritize failures and refunds as they require immediate attention
  if (spocketOrder.paymentStatus === OrderPaymentStatus.FAILED || 
      spocketOrder.paymentStatus === OrderPaymentStatus.REFUNDED) {
    return {
      resolution: spocketOrder.paymentStatus,
      platform: 'spocket'
    };
  }
  
  if (squareOrder.paymentStatus === OrderPaymentStatus.FAILED || 
      squareOrder.paymentStatus === OrderPaymentStatus.REFUNDED) {
    return {
      resolution: squareOrder.paymentStatus,
      platform: 'square'
    };
  }
  
  // For normal cases, use priority
  if (spocketPriority > squarePriority) {
    return {
      resolution: spocketOrder.paymentStatus,
      platform: 'spocket'
    };
  } else if (squarePriority > spocketPriority) {
    return {
      resolution: squareOrder.paymentStatus,
      platform: 'square'
    };
  }
  
  // Same status, no conflict
  return {
    resolution: spocketOrder.paymentStatus,
    platform: 'spocket' // Default to Spocket when equal
  };
};

// Interface for sync progress tracking
export interface SyncProgress {
  startTime: Date;
  endTime?: Date;
  totalOrders: number;
  processedOrders: number;
  createdOrders: {
    spocket: number;
    square: number;
  };
  updatedOrders: {
    spocket: number;
    square: number;
  };
  failedOrders: number;
  errors: Array<{
    message: string;
    orderId: string | null;
    source: string;
    details?: string;
  }>;
  status: 'running' | 'completed' | 'failed' | 'interrupted';
  lastSyncedOrderId?: string;
}

// Store for tracking sync progress
let currentSyncProgress: SyncProgress | null = null;

/**
 * Start tracking a new sync operation
 * @param totalOrders - Total number of orders to sync
 * @returns New sync progress object
 */
export const startSyncProgress = (totalOrders: number): SyncProgress => {
  currentSyncProgress = {
    startTime: new Date(),
    totalOrders,
    processedOrders: 0,
    createdOrders: {
      spocket: 0,
      square: 0
    },
    updatedOrders: {
      spocket: 0,
      square: 0
    },
    failedOrders: 0,
    errors: [],
    status: 'running'
  };
  
  logger.info(`Started sync operation with ${totalOrders} orders`, { 
    syncId: currentSyncProgress.startTime.getTime() 
  });
  
  return currentSyncProgress;
};

/**
 * Update sync progress
 * @param update - Partial progress update
 */
export const updateSyncProgress = (update: Partial<SyncProgress>): SyncProgress => {
  if (!currentSyncProgress) {
    throw new Error('No sync progress tracking has been started');
  }
  
  currentSyncProgress = {
    ...currentSyncProgress,
    ...update,
    // Merge nested objects
    createdOrders: {
      ...currentSyncProgress.createdOrders,
      ...update.createdOrders
    },
    updatedOrders: {
      ...currentSyncProgress.updatedOrders,
      ...update.updatedOrders
    },
    // Append to error array rather than replacing
    errors: [
      ...currentSyncProgress.errors,
      ...(update.errors || [])
    ]
  };
  
  // Log progress update if significant change (every 10%)
  const progressPercent = Math.floor((currentSyncProgress.processedOrders / currentSyncProgress.totalOrders) * 100);
  if (progressPercent % 10 === 0 && progressPercent > 0) {
    logger.info(`Sync progress: ${progressPercent}%`, { 
      syncId: currentSyncProgress.startTime.getTime(),
      processed: currentSyncProgress.processedOrders,
      total: currentSyncProgress.totalOrders,
      created: currentSyncProgress.createdOrders,
      updated: currentSyncProgress.updatedOrders,
      failed: currentSyncProgress.failedOrders
    });
  }
  
  return currentSyncProgress;
};

/**
 * Complete sync progress tracking
 * @param status - Final status of the sync operation
 */
export const completeSyncProgress = (
  status: 'completed' | 'failed' | 'interrupted' = 'completed'
): SyncProgress => {
  if (!currentSyncProgress) {
    throw new Error('No sync progress tracking has been started');
  }
  
  currentSyncProgress = {
    ...currentSyncProgress,
    endTime: new Date(),
    status
  };
  
  const duration = currentSyncProgress.endTime.getTime() - currentSyncProgress.startTime.getTime();
  const durationMinutes = Math.floor(duration / 60000);
  const durationSeconds = Math.floor((duration % 60000) / 1000);
  
  logger.info(`Sync operation ${status}`, { 
    syncId: currentSyncProgress.startTime.getTime(),
    duration: `${durationMinutes}m ${durationSeconds}s`,
    processed: currentSyncProgress.processedOrders,
    total: currentSyncProgress.totalOrders,
    created: currentSyncProgress.createdOrders,
    updated: currentSyncProgress.updatedOrders,
    failed: currentSyncProgress.failedOrders,
    errorCount: currentSyncProgress.errors.length
  });
  
  // Store sync results for later recovery if needed
  saveSyncProgress(currentSyncProgress);
  
  return currentSyncProgress;
};

/**
 * Get current sync progress
 */
export const getCurrentSyncProgress = (): SyncProgress | null => {
  return currentSyncProgress;
};

/**
 * Save sync progress for later recovery
 * @param progress - Sync progress to save
 */
const saveSyncProgress = (progress: SyncProgress): void => {
  try {
    // In a real implementation, this would save to a database or file
    // For this mock implementation, we'll just log it
    logger.info('Saving sync progress for recovery', { syncId: progress.startTime.getTime() });
  } catch (error) {
    logger.error('Error saving sync progress', { error });
  }
};

/**
 * Load previous sync progress for recovery
 * @param syncId - ID of the sync operation to recover
 */
export const loadSyncProgress = (syncId: string): SyncProgress | null => {
  try {
    // In a real implementation, this would load from a database or file
    // For this mock implementation, we'll just return null
    logger.info('Loading sync progress for recovery', { syncId });
    return null;
  } catch (error) {
    logger.error('Error loading sync progress', { error });
    return null;
  }
};

/**
 * Process webhook event for real-time sync
 * @param event - Webhook event from either platform
 * @param source - Source platform (spocket or square)
 */
export const processWebhookForSync = async (
  event: any,
  source: 'spocket' | 'square'
): Promise<void> => {
  try {
    logger.info(`Processing webhook from ${source}`, { eventType: event.type });
    
    // Extract order ID from the event
    let orderId: string | null = null;
    
    if (source === 'spocket') {
      orderId = event.data?.order?.id;
    } else if (source === 'square') {
      orderId = event.data?.order?.id;
    }
    
    if (!orderId) {
      logger.warn(`No order ID found in webhook event from ${source}`);
      return;
    }
    
    // Get the full order details
    const order = source === 'spocket'
      ? await getSpocketOrderById(orderId)
      : await getSquareOrderById(orderId);
      
    if (!order) {
      logger.warn(`Order ${orderId} not found for webhook event from ${source}`);
      return;
    }
    
    // Determine the webhook event type and corresponding action
    switch (event.type) {
      case 'order.created':
        await handleOrderCreatedWebhook(order, source);
        break;
        
      case 'order.updated':
      case 'order.status.updated':
        await handleOrderUpdatedWebhook(order, source);
        break;
        
      case 'order.fulfillment.updated':
        await handleOrderFulfillmentUpdatedWebhook(order, source);
        break;
        
      case 'payment.updated':
      case 'order.payment.updated':
        await handleOrderPaymentUpdatedWebhook(order, source);
        break;
        
      default:
        logger.info(`Ignoring unsupported webhook event type: ${event.type}`);
    }
    
    logger.info(`Successfully processed webhook for order ${orderId} from ${source}`);
  } catch (error: any) {
    logger.error(`Error processing webhook from ${source}`, { 
      error: error.toString(), 
      event 
    });
  }
};

/**
 * Handle order created webhook
 * @param order - Order that was created
 * @param source - Source platform
 */
async function handleOrderCreatedWebhook(
  order: Order, 
  source: 'spocket' | 'square'
): Promise<void> {
  try {
    logger.info(`Processing order.created webhook for ${source} order ${order.id}`);
    
    // Create order in the target platform
    await createOrderInTargetPlatform(
      order, 
      source === 'spocket' ? 'spocket-to-square' : 'square-to-spocket'
    );
    
    logger.info(`Created order in target platform for ${source} order ${order.id}`);
  } catch (error: any) {
    logger.error(`Error handling order.created webhook`, { 
      error: error.toString(), 
      orderId: order.id,
      source
    });
  }
}

/**
 * Handle order updated webhook
 * @param order - Order that was updated
 * @param source - Source platform
 */
async function handleOrderUpdatedWebhook(
  order: Order, 
  source: 'spocket' | 'square'
): Promise<void> {
  try {
    logger.info(`Processing order.updated webhook for ${source} order ${order.id}`);
    
    // Find corresponding order in target platform
    const targetOrderId = source === 'spocket'
      ? extractSquareReferenceFromSpocketOrder(order)
      : extractSpocketReferenceFromSquareOrder(order);
      
    if (!targetOrderId) {
      logger.warn(`No target order found for ${source} order ${order.id}`);
      return;
    }
    
    // Get target order
    const targetOrder = source === 'spocket'
      ? await getSquareOrderById(targetOrderId)
      : await getSpocketOrderById(targetOrderId);

    if (!targetOrder) {
      logger.warn(`Target order ${targetOrderId} not found for ${source} order ${order.id}`);
      return;
    }

    // Check which aspects need updating
    const updates = determineRequiredUpdates(order, targetOrder);
    
    // Update the order in the target platform
    try {
      if (updates.status) {
        await updateOrderStatus(
          order, 
          targetOrder, 
          source === 'spocket' ? 'spocket-to-square' : 'square-to-spocket'
        );
      }
      
      if (updates.fulfillment) {
        await updateOrderFulfillment(
          order, 
          targetOrder, 
          source === 'spocket' ? 'spocket-to-square' : 'square-to-spocket'
        );
      }
      
      if (updates.payment) {
        await updateOrderPayment(
          order, 
          targetOrder, 
          source === 'spocket' ? 'spocket-to-square' : 'square-to-spocket'
        );
      }
      
      logger.info(`Updated target order based on webhook event`, {
        sourceOrderId: order.id,
        targetOrderId,
        source,
        updates
      });
    } catch (error: any) {
      logger.error(`Error updating target order from webhook`, {
        error: error.toString(),
        sourceOrderId: order.id,
        targetOrderId,
        source
      });
    }
  } catch (error: any) {
    logger.error(`Error handling order.updated webhook`, { 
      error: error.toString(), 
      orderId: order.id,
      source
    });
  }
}

/**
 * Handle order fulfillment updated webhook
 * @param order - Order with updated fulfillment
 * @param source - Source platform
 */
async function handleOrderFulfillmentUpdatedWebhook(
  order: Order, 
  source: 'spocket' | 'square'
): Promise<void> {
  try {
    logger.info(`Processing order.fulfillment.updated webhook for ${source} order ${order.id}`);
    
    // Find corresponding order in target platform
    const targetOrderId = source === 'spocket'
      ? extractSquareReferenceFromSpocketOrder(order)
      : extractSpocketReferenceFromSquareOrder(order);
      
    if (!targetOrderId) {
      logger.warn(`No target order found for ${source} order ${order.id}`);
      return;
    }
    
    // Get target order
    const targetOrder = source === 'spocket'
      ? await getSquareOrderById(targetOrderId)
      : await getSpocketOrderById(targetOrderId);
      
    if (!targetOrder) {
      logger.warn(`Target order ${targetOrderId} not found for ${source} order ${order.id}`);
      return;
    }
    
    // Check if fulfillment details have changed
    if (
      order.fulfillmentStatus !== targetOrder.fulfillmentStatus ||
      order.shipping?.trackingNumber !== targetOrder.shipping?.trackingNumber ||
      order.shipping?.carrier !== targetOrder.shipping?.carrier
    ) {
      // Update fulfillment in target platform
      const fulfillmentUpdate = {
        status: order.fulfillmentStatus,
        trackingNumber: order.shipping?.trackingNumber,
        carrier: order.shipping?.carrier
      };
      
      if (source === 'spocket') {
        await updateSquareOrderFulfillment(targetOrderId, fulfillmentUpdate);
      } else {
        await updateSpocketOrderFulfillment(targetOrderId, fulfillmentUpdate);
      }
      
      logger.info(`Updated target order fulfillment based on webhook event`, {
        sourceOrderId: order.id,
        targetOrderId,
        source,
        oldStatus: targetOrder.fulfillmentStatus,
        newStatus: order.fulfillmentStatus,
        oldTrackingNumber: targetOrder.shipping?.trackingNumber,
        newTrackingNumber: order.shipping?.trackingNumber
      });
    } else {
      logger.info(`No fulfillment changes needed for order ${order.id}`);
    }
  } catch (error: any) {
    logger.error(`Error handling order.fulfillment.updated webhook`, { 
      error: error.toString(), 
      orderId: order.id,
      source
    });
  }
}

/**
 * Handle payment updated webhook
 * @param order - Order with updated payment
 * @param source - Source platform
 */
async function handleOrderPaymentUpdatedWebhook(
  order: Order, 
  source: 'spocket' | 'square'
): Promise<void> {
  try {
    logger.info(`Processing payment.updated webhook for ${source} order ${order.id}`);
    
    // Find corresponding order in target platform
    const targetOrderId = source === 'spocket'
      ? extractSquareReferenceFromSpocketOrder(order)
      : extractSpocketReferenceFromSquareOrder(order);
      
    if (!targetOrderId) {
      logger.warn(`No target order found for ${source} order ${order.id}`);
      return;
    }
    
    // Get target order
    const targetOrder = source === 'spocket'
      ? await getSquareOrderById(targetOrderId)
      : await getSpocketOrderById(targetOrderId);
      
    if (!targetOrder) {
      logger.warn(`Target order ${targetOrderId} not found for ${source} order ${order.id}`);
      return;
    }
    
    // Check if payment status has changed
    if (order.paymentStatus !== targetOrder.paymentStatus) {
      // Update payment status in target platform
      const paymentUpdate = {
        status: order.paymentStatus
      };
      
      if (source === 'spocket') {
        await updateSquareOrderPayment(targetOrderId, paymentUpdate);
      } else {
        await updateSpocketOrderPayment(targetOrderId, paymentUpdate);
      }
      
      logger.info(`Updated target order payment status based on webhook event`, {
        sourceOrderId: order.id,
        targetOrderId,
        source,
        oldStatus: targetOrder.paymentStatus,
        newStatus: order.paymentStatus
      });
    } else {
      logger.info(`No payment status changes needed for order ${order.id}`);
    }
  } catch (error: any) {
    logger.error(`Error handling payment.updated webhook`, { 
      error: error.toString(), 
      orderId: order.id,
      source
    });
  }
}

/**
 * Validate webhook signature from Spocket
 * @param signature - Webhook signature header
 * @param body - Raw webhook request body
 * @returns True if signature is valid
 */
export const validateSpocketWebhookSignature = (
  signature: string, 
  body: string
): boolean => {
  try {
    // In a real implementation, you would:
    // 1. Get the webhook secret from configuration
    // 2. Compute HMAC using the webhook secret and request body
    // 3. Compare the computed signature with the provided signature
    
    // Mock implementation for demonstration
    logger.info('Validating Spocket webhook signature');
    
    // Always return true in mock implementation
    return true;
  } catch (error: any) {
    logger.error('Error validating Spocket webhook signature', { error: error.toString() });
    return false;
  }
};

/**
 * Validate webhook signature from Square
 * @param signature - Webhook signature header
 * @param body - Raw webhook request body
 * @returns True if signature is valid
 */
export const validateSquareWebhookSignature = (
  signature: string,
  url: string,
  body: string
): boolean => {
  try {
    // In a real implementation, you would:
    // 1. Get the webhook signature key from Square Dashboard or API
    // 2. Use Square's signature verification method
    // 3. Return the result of the verification
    
    // Mock implementation for demonstration
    logger.info('Validating Square webhook signature');
    
    // Always return true in mock implementation
    return true;
  } catch (error: any) {
    logger.error('Error validating Square webhook signature', { error: error.toString() });
    return false;
  }
};

/**
 * Retry failed syncs or recover from interrupted syncs
 * @param syncId - ID of the sync operation to recover
 */
export const recoverSync = async (syncId: string): Promise<SyncProgress | null> => {
  try {
    logger.info(`Attempting to recover sync operation ${syncId}`);
    
    // Load previous sync progress
    const progress = loadSyncProgress(syncId);
    
    if (!progress) {
      logger.warn(`No sync progress found for ID ${syncId}`);
      return null;
    }
    
    // Start a new sync from where we left off
    if (progress.lastSyncedOrderId) {
      // In a real implementation, you would:
      // 1. Determine the platform and direction from the saved progress
      // 2. Fetch orders starting after the last synced order
      // 3. Resume the sync process
      
      logger.info(`Recovered sync operation will resume after order ${progress.lastSyncedOrderId}`);
    }
    
    // Return the loaded progress
    return progress;
  } catch (error: any) {
    logger.error(`Failed to recover sync operation ${syncId}`, { error: error.toString() });
    return null;
  }
};
