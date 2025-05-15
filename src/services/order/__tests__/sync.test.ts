import {
  buildOrderMappings,
  processOrderBatch,
  createOrderInTargetPlatform,
  updateOrderAcrossPlatforms,
  resolveStatusConflict,
  resolvePaymentConflict,
  startSyncProgress,
  updateSyncProgress,
  completeSyncProgress,
  processWebhookForSync,
  validateSpocketWebhookSignature,
  validateSquareWebhookSignature,
  recoverSync
} from '../handlers/sync.handler';

// Import mock implementations of dependencies
import * as spocketHandler from '../handlers/spocket.handler';
import * as squareHandler from '../handlers/square.handler';

// Mock the handlers to prevent actual API calls
jest.mock('../handlers/spocket.handler');
jest.mock('../handlers/square.handler');
jest.mock('../../common/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  })
}));

// Sample data for tests
import { 
  Order, 
  OrderFulfillmentStatus, 
  OrderPaymentStatus 
} from '../../../types/order.types';
import { EntityMapping, SyncEntityType } from '../../../types/sync.types';

// Sample Spocket order for testing
const sampleSpocketOrder: Order = {
  id: 'spkt_123',
  orderNumber: 'SPK12345',
  externalId: 'sq_123',
  fulfillmentStatus: OrderFulfillmentStatus.PENDING,
  paymentStatus: OrderPaymentStatus.PAID,
  customer: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-123-4567'
  },
  items: [
    {
      id: 'item_1',
      name: 'Test Product',
      sku: 'TEST-1',
      quantity: 1,
      unitPrice: 19.99,
      total: 19.99
    }
  ],
  shipping: {
    address: {
      firstName: 'John',
      lastName: 'Doe',
      addressLine1: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      postalCode: '12345',
      country: 'US'
    },
    method: 'Standard',
    carrier: 'USPS',
    trackingNumber: '1234567890',
    cost: {
      amount: 5.99,
      currency: 'USD'
    }
  },
  subtotal: {
    amount: 19.99,
    currency: 'USD'
  },
  total: {
    amount: 25.98,
    currency: 'USD'
  },
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01')
};

// Sample Square order for testing
const sampleSquareOrder: Order = {
  id: 'sq_123',
  orderNumber: 'SQ12345',
  externalId: 'spkt_123',
  fulfillmentStatus: OrderFulfillmentStatus.SHIPPED,
  paymentStatus: OrderPaymentStatus.PAID,
  customer: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-123-4567'
  },
  items: [
    {
      id: 'sq_item_1',
      name: 'Test Product',
      sku: 'TEST-1',
      quantity: 1,
      unitPrice: 19.99,
      total: 19.99
    }
  ],
  shipping: {
    address: {
      firstName: 'John',
      lastName: 'Doe',
      addressLine1: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      postalCode: '12345',
      country: 'US'
    },
    method: 'Standard',
    carrier: 'USPS',
    trackingNumber: '0987654321', // Different tracking number
    cost: {
      amount: 5.99,
      currency: 'USD'
    }
  },
  subtotal: {
    amount: 19.99,
    currency: 'USD'
  },
  total: {
    amount: 25.98,
    currency: 'USD'
  },
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-02') // Updated more recently
};

// Sample webhook event
const sampleWebhookEvent = {
  type: 'order.created',
  data: {
    order: {
      id: 'spkt_123'
    }
  }
};

describe('Order Sync Handler', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    (spocketHandler.getSpocketOrderById as jest.Mock).mockResolvedValue(sampleSpocketOrder);
    (squareHandler.getSquareOrderById as jest.Mock).mockResolvedValue(sampleSquareOrder);
    (spocketHandler.createSpocketOrder as jest.Mock).mockResolvedValue('spkt_new');
    (squareHandler.createSquareOrder as jest.Mock).mockResolvedValue('sq_new');
    (spocketHandler.updateSpocketOrderStatus as jest.Mock).mockResolvedValue(undefined);
    (squareHandler.updateSquareOrderStatus as jest.Mock).mockResolvedValue(undefined);
    (spocketHandler.updateSpocketOrderFulfillment as jest.Mock).mockResolvedValue(undefined);
    (squareHandler.updateSquareOrderFulfillment as jest.Mock).mockResolvedValue(undefined);
    (spocketHandler.updateSpocketOrderPayment as jest.Mock).mockResolvedValue(undefined);
    (squareHandler.updateSquareOrderPayment as jest.Mock).mockResolvedValue(undefined);
    (spocketHandler.extractSquareReferenceFromSpocketOrder as jest.Mock).mockReturnValue('sq_123');
    (squareHandler.extractSpocketReferenceFromSquareOrder as jest.Mock).mockReturnValue('spkt_123');
  });

  // Test buildOrderMappings
  describe('buildOrderMappings', () => {
    test('should build mappings between Spocket and Square orders', () => {
      // Setup
      const spocketOrders = [sampleSpocketOrder];
      const squareOrders = [sampleSquareOrder];
      
      // Execute
      const result = buildOrderMappings(spocketOrders, squareOrders);
      
      // Verify
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spkt_123',
        targetId: 'sq_123',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
    });
    
    test('should handle empty order lists', () => {
      // Execute
      const result = buildOrderMappings([], []);
      
      // Verify
      expect(result).toHaveLength(0);
    });
  });

  // Test resolveStatusConflict
  describe('resolveStatusConflict', () => {
    test('should prioritize more advanced status from Spocket', () => {
      // Setup
      const spocketOrderWithHigherStatus = {
        ...sampleSpocketOrder,
        fulfillmentStatus: OrderFulfillmentStatus.DELIVERED
      };
      
      // Execute
      const result = resolveStatusConflict(spocketOrderWithHigherStatus, sampleSquareOrder);
      
      // Verify
      expect(result.resolution).toBe(OrderFulfillmentStatus.DELIVERED);
      expect(result.platform).toBe('spocket');
    });
    
    test('should prioritize more advanced status from Square', () => {
      // Setup
      const spocketOrderWithLowerStatus = {
        ...sampleSpocketOrder,
        fulfillmentStatus: OrderFulfillmentStatus.PENDING
      };
      const squareOrderWithHigherStatus = {
        ...sampleSquareOrder,
        fulfillmentStatus: OrderFulfillmentStatus.SHIPPED
      };
      
      // Execute
      const result = resolveStatusConflict(spocketOrderWithLowerStatus, squareOrderWithHigherStatus);
      
      // Verify
      expect(result.resolution).toBe(OrderFulfillmentStatus.SHIPPED);
      expect(result.platform).toBe('square');
    });
    
    test('should default to Spocket when statuses are equal', () => {
      // Setup - both orders with same status
      const equalStatusSpocketOrder = {
        ...sampleSpocketOrder,
        fulfillmentStatus: OrderFulfillmentStatus.SHIPPED
      };
      const equalStatusSquareOrder = {
        ...sampleSquareOrder,
        fulfillmentStatus: OrderFulfillmentStatus.SHIPPED
      };
      
      // Execute
      const result = resolveStatusConflict(equalStatusSpocketOrder, equalStatusSquareOrder);
      
      // Verify
      expect(result.resolution).toBe(OrderFulfillmentStatus.SHIPPED);
      expect(result.platform).toBe('spocket');
    });
  });

  // Test resolvePaymentConflict
  describe('resolvePaymentConflict', () => {
    test('should prioritize FAILED payment status from Spocket', () => {
      // Setup
      const spocketOrderWithFailedPayment = {
        ...sampleSpocketOrder,
        paymentStatus: OrderPaymentStatus.FAILED
      };
      
      // Execute
      const result = resolvePaymentConflict(spocketOrderWithFailedPayment, sampleSquareOrder);
      
      // Verify
      expect(result.resolution).toBe(OrderPaymentStatus.FAILED);
      expect(result.platform).toBe('spocket');
    });
    
    test('should prioritize REFUNDED payment status from Square', () => {
      // Setup
      const squareOrderWithRefundedPayment = {
        ...sampleSquareOrder,
        paymentStatus: OrderPaymentStatus.REFUNDED
      };
      
      // Execute
      const result = resolvePaymentConflict(sampleSpocketOrder, squareOrderWithRefundedPayment);
      
      // Verify
      expect(result.resolution).toBe(OrderPaymentStatus.REFUNDED);
      expect(result.platform).toBe('square');
    });
    
    test('should prioritize higher payment status by default', () => {
      // Setup
      const spocketOrderWithLowerStatus = {
        ...sampleSpocketOrder,
        paymentStatus: OrderPaymentStatus.PENDING
      };
      const squareOrderWithHigherStatus = {
        ...sampleSquareOrder,
        paymentStatus: OrderPaymentStatus.PAID
      };
      
      // Execute
      const result = resolvePaymentConflict(spocketOrderWithLowerStatus, squareOrderWithHigherStatus);
      
      // Verify
      expect(result.resolution).toBe(OrderPaymentStatus.PAID);
      expect(result.platform).toBe('square');
    });
  });

  // Test createOrderInTargetPlatform
  describe('createOrderInTargetPlatform', () => {
    test('should create order in Square when direction is spocket-to-square', async () => {
      // Execute
      await createOrderInTargetPlatform(sampleSpocketOrder, 'spocket-to-square');
      
      // Verify
      expect(squareHandler.createSquareOrder).toHaveBeenCalledWith(sampleSpocketOrder, undefined);
      expect(spocketHandler.createSpocketOrder).not.toHaveBeenCalled();
    });
    
    test('should create order in Spocket when direction is square-to-spocket', async () => {
      // Execute
      await createOrderInTargetPlatform(sampleSquareOrder, 'square-to-spocket');
      
      // Verify
      expect(spocketHandler.createSpocketOrder).toHaveBeenCalledWith(sampleSquareOrder);
      expect(squareHandler.createSquareOrder).not.toHaveBeenCalled();
    });
    
    test('should handle errors during order creation', async () => {
      // Setup
      (squareHandler.createSquareOrder as jest.Mock).mockRejectedValue(new Error('API error'));
      
      // Execute & Verify
      await expect(createOrderInTargetPlatform(sampleSpocketOrder, 'spocket-to-square'))
        .rejects.toThrow('API error');
    });
  });

  // Test processOrderBatch
  describe('processOrderBatch', () => {
    test('should process orders in batch correctly', async () => {
      // Setup
      const orders = [sampleSpocketOrder];
      const mappings = [{
        entityType: SyncEntityType.ORDER,
        sourceId: 'spkt_123',
        targetId: 'sq_123',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      }];
      
      // Execute
      const result = await processOrderBatch(orders, mappings, 'spocket-to-square');
      
      // Verify
      expect(result.syncedOrders).toBe(1);
      expect(result.updatedOrders).toBe(1);
      expect(result.createdOrders).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should create new orders when no mapping exists', async () => {
      // Setup
      const orders = [sampleSpocketOrder];
      const mappings: EntityMapping[] = []; // No mappings
      
      // Execute
      const result = await processOrderBatch(orders, mappings, 'spocket-to-square');
      
      // Verify
      expect(result.syncedOrders).toBe(1);
      expect(result.updatedOrders).toBe(0);
      expect(result.createdOrders).toBe(1);
      expect(squareHandler.createSquareOrder).toHaveBeenCalled();
    });
    
    test('should handle errors gracefully', async () => {
      // Setup
      const orders = [sampleSpocketOrder];
      const mappings: EntityMapping[] = [];
      (squareHandler.createSquareOrder as jest.Mock).mockRejectedValue(new Error('API error'));
      
      // Execute
      const result = await processOrderBatch(orders, mappings, 'spocket-to-square');
      
      // Verify
      expect(result.syncedOrders).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Failed to process order');
    });
  });

  // Test progress tracking
  describe('progress tracking', () => {
    test('should track sync progress correctly', () => {
      // Start progress
      const progress = startSyncProgress(100);
      expect(progress.totalOrders).toBe(100);
      expect(progress.processedOrders).toBe(0);
      expect(progress.status).toBe('running');
      
      // Update progress
      const updatedProgress = updateSyncProgress({
        processedOrders: 50,
        createdOrders: { spocket: 20, square: 30 }
      });
      expect(updatedProgress.processedOrders).toBe(50);
      expect(updatedProgress.createdOrders.spocket).toBe(20);
      expect(updatedProgress.createdOrders.square).toBe(30);
      
      // Complete progress
      const completedProgress = completeSyncProgress('completed');
      expect(completedProgress.status).toBe('completed');
      expect(completedProgress.endTime).toBeDefined();
    });
    
    test('should throw error when trying to update without starting', () => {
      // Reset sync progress
      jest.spyOn(global, 'startSyncProgress').mockImplementation(() => {
        return null as any;
      });
      
      // Attempt to update without starting
      expect(() => updateSyncProgress({ processedOrders: 10 })).toThrow('No sync progress tracking has been started');
    });
    
    test('should throw error when trying to complete without starting', () => {
      // Reset sync progress
      jest.spyOn(global, 'startSyncProgress').mockImplementation(() => {
        return null as any;
      });
      
      // Attempt to complete without starting
      expect(() => completeSyncProgress()).toThrow('No sync progress tracking has been started');
    });
  });

  // Test webhook processing
  describe('webhook processing', () => {
    test('should process order.created webhook correctly', async () => {
      // Execute
      await processWebhookForSync(
        { 
          type: 'order.created', 
          data: { order: { id: 'spkt_123' } } 
        },
        'spocket'
      );
      
      // Verify correct handler was called
      expect(spocketHandler.getSpocketOrderById).toHaveBeenCalledWith('spkt_123');
      expect(squareHandler.createSquareOrder).toHaveBeenCalled();
    });
    
    test('should process order.updated webhook correctly', async () => {
      // Execute
      await processWebhookForSync(
        { 
          type: 'order.updated', 
          data: { order: { id: 'spkt_123' } } 
        },
        'spocket'
      );
      
      // Verify order status was checked and updated appropriately
      expect(spocketHandler.getSpocketOrderById).toHaveBeenCalledWith('spkt_123');
      expect(squareHandler.getSquareOrderById).toHaveBeenCalledWith('sq_123');
      
      // At least one of these should be called depending on the updates needed
      const updateCalled = 
        (squareHandler.updateSquareOrderStatus as jest.Mock).mock.calls.length > 0 ||
        (squareHandler.updateSquareOrderFulfillment as jest.Mock).mock.calls.length > 0 ||
        (squareHandler.updateSquareOrderPayment as jest.Mock).mock.calls.length > 0;
        
      expect(updateCalled).toBe(true);
    });
    
    test('should process order.fulfillment.updated webhook correctly', async () => {
      // Setup - order with different fulfillment status
      const updatedSpocketOrder = {
        ...sampleSpocketOrder,
        fulfillmentStatus: OrderFulfillmentStatus.DELIVERED,
        shipping: {
          ...sampleSpocketOrder.shipping,
          trackingNumber: 'NEW1234567'
        }
      };
      (spocketHandler.getSpocketOrderById as jest.Mock).mockResolvedValue(updatedSpocketOrder);
      
      // Execute
      await processWebhookForSync(
        { 
          type: 'order.fulfillment.updated', 
          data: { order: { id: 'spkt_123' } } 
        },
        'spocket'
      );
      
      // Verify order fulfillment was updated
      expect(spocketHandler.getSpocketOrderById).toHaveBeenCalledWith('spkt_123');
      expect(squareHandler.getSquareOrderById).toHaveBeenCalledWith('sq_123');
      expect(squareHandler.updateSquareOrderFulfillment).toHaveBeenCalled();
    });
    
    test('should process payment.updated webhook correctly', async () => {
      // Setup - order with different payment status
      const updatedSpocketOrder = {
        ...sampleSpocketOrder,
        paymentStatus: OrderPaymentStatus.REFUNDED
      };
      (spocketHandler.getSpocketOrderById as jest.Mock).mockResolvedValue(updatedSpocketOrder);
      
      // Execute
      await processWebhookForSync(
        { 
          type: 'payment.updated', 
          data: { order: { id: 'spkt_123' } } 
        },
        'spocket'
      );
      
      // Verify order payment was updated
      expect(spocketHandler.getSpocketOrderById).toHaveBeenCalledWith('spkt_123');
      expect(squareHandler.getSquareOrderById).toHaveBeenCalledWith('sq_123');
      expect(squareHandler.updateSquareOrderPayment).toHaveBeenCalled();
    });
    
    test('should handle webhook with missing order ID', async () => {
      // Execute with missing order ID
      await processWebhookForSync(
        { 
          type: 'order.created', 
          data: { /* No order ID */ } 
        },
        'spocket'
      );
      
      // Verify no order lookup was attempted
      expect(spocketHandler.getSpocketOrderById).not.toHaveBeenCalled();
      expect(squareHandler.createSquareOrder).not.toHaveBeenCalled();
    });
    
    test('should handle webhook for non-existent order', async () => {
      // Setup - order not found
      (spocketHandler.getSpocketOrderById as jest.Mock).mockResolvedValue(null);
      
      // Execute
      await processWebhookForSync(
        { 
          type: 'order.created', 
          data: { order: { id: 'non_existent' } } 
        },
        'spocket'
      );
      
      // Verify lookup was attempted but no further processing
      expect(spocketHandler.getSpocketOrderById).toHaveBeenCalledWith('non_existent');
      expect(squareHandler.createSquareOrder).not.toHaveBeenCalled();
    });
    
    test('should handle unsupported webhook event type', async () => {
      // Execute with unsupported event type
      await processWebhookForSync(
        { 
          type: 'unsupported.event', 
          data: { order: { id: 'spkt_123' } } 
        },
        'spocket'
      );
      
      // Verify order was fetched but no handlers were called
      expect(spocketHandler.getSpocketOrderById).toHaveBeenCalledWith('spkt_123');
      expect(squareHandler.createSquareOrder).not.toHaveBeenCalled();
      expect(squareHandler.updateSquareOrderStatus).not.toHaveBeenCalled();
      expect(squareHandler.updateSquareOrderFulfillment).not.toHaveBeenCalled();
      expect(squareHandler.updateSquareOrderPayment).not.toHaveBeenCalled();
    });
  });

  // Test webhook signature validation
  describe('webhook signature validation', () => {
    test('should validate Spocket webhook signature', () => {
      // Execute
      const result = validateSpocketWebhookSignature(
        'test-signature',
        '{"test":"payload"}'
      );
      
      // In our mock implementation this always returns true
      expect(result).toBe(true);
    });
    
    test('should validate Square webhook signature', () => {
      // Execute
      const result = validateSquareWebhookSignature(
        'test-signature',
        'https://example.com/webhook',
        '{"test":"payload"}'
      );
      
      // In our mock implementation this always returns true
      expect(result).toBe(true);
    });
    
    test('should handle signature validation errors', () => {
      // Setup - mock implementation to throw an error
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock implementation to simulate an error
      const mockValidate = jest.fn().mockImplementation(() => {
        throw new Error('Signature validation error');
      });
      
      // Temporarily replace implementation
      const originalImplementation = validateSpocketWebhookSignature;
      (validateSpocketWebhookSignature as any) = mockValidate;
      
      // Execute and verify it handles the error
      expect(() => {
        validateSpocketWebhookSignature('invalid-signature', '{}');
      }).not.toThrow();
      
      // Restore original implementation
      (validateSpocketWebhookSignature as any) = originalImplementation;
    });
  });

  // Test sync recovery
  describe('sync recovery', () => {
    test('should attempt to recover a sync operation', async () => {
      // Setup spy on loadSyncProgress
      const mockProgress = {
        startTime: new Date(),
        totalOrders: 100,
        processedOrders: 50,
        createdOrders: { spocket: 20, square: 30 },
        updatedOrders: { spocket: 0, square: 0 },
        failedOrders: 0,
        errors: [],
        status: 'interrupted',
        lastSyncedOrderId: 'last_order_123'
      };
      
      jest.spyOn(global, 'loadSyncProgress').mockImplementation(() => mockProgress);
      
      // Execute
      const result = await recoverSync('test-sync-id');
      
      // Verify
      expect(result).toBe(mockProgress);
    });
    
    test('should handle recovery for non-existent sync', async () => {
      // Setup spy on loadSyncProgress to return null
      jest.spyOn(global, 'loadSyncProgress').mockImplementation(() => null);
      
      // Execute
      const result = await recoverSync('non-existent-sync');
      
      // Verify
      expect(result).toBeNull();
    });
    
    test('should handle errors during recovery', async () => {
      // Setup spy on loadSyncProgress to throw
      jest.spyOn(global, 'loadSyncProgress').mockImplementation(() => {
        throw new Error('Recovery error');
      });
      
      // Execute
      const result = await recoverSync('error-sync');
      
      // Verify recovery fails gracefully
      expect(result).toBeNull();
    });
  });
});
