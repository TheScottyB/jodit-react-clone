/**
 * Unit tests for the order synchronization handler
 */
import { jest } from '@jest/globals';
import {
  buildOrderMappings,
  processOrderBatch,
  resolveStatusConflict,
  resolvePaymentConflict,
  startSyncProgress,
  updateSyncProgress,
  completeSyncProgress,
  getCurrentSyncProgress,
  recoverSync
} from '../../services/order/handlers/sync.handler';

import { OrderFulfillmentStatus, OrderPaymentStatus } from '../../types/order.types';
import { SyncEntityType } from '../../types/sync.types';

// Mock dependencies
jest.mock('../../services/common/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock Spocket and Square handlers
jest.mock('../../services/order/handlers/spocket.handler', () => ({
  fetchSpocketOrders: jest.fn(),
  getSpocketOrderById: jest.fn(),
  createSpocketOrder: jest.fn(),
  updateSpocketOrder: jest.fn(),
  updateSpocketOrderStatus: jest.fn(),
  updateSpocketOrderFulfillment: jest.fn(),
  updateSpocketOrderPayment: jest.fn(),
  extractSquareReferenceFromSpocketOrder: jest.fn()
}));

jest.mock('../../services/order/handlers/square.handler', () => ({
  fetchSquareOrders: jest.fn(),
  getSquareOrderById: jest.fn(),
  createSquareOrder: jest.fn(),
  updateSquareOrder: jest.fn(),
  updateSquareOrderStatus: jest.fn(),
  updateSquareOrderFulfillment: jest.fn(),
  updateSquareOrderPayment: jest.fn(),
  extractSpocketReferenceFromSquareOrder: jest.fn()
}));

describe('Order Sync Handler', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildOrderMappings', () => {
    it('should correctly map orders between platforms', () => {
      // Arrange
      const spocketOrders = [
        { id: 'spkt_1', orderNumber: '1001', externalId: null },
        { id: 'spkt_2', orderNumber: '1002', externalId: 'sq_2' },
        { id: 'spkt_3', orderNumber: '1003', externalId: null }
      ];
      
      const squareOrders = [
        { id: 'sq_1', orderNumber: '1001', externalId: 'spkt_1' },
        { id: 'sq_2', orderNumber: null, externalId: null },
        { id: 'sq_3', orderNumber: '2001', externalId: null }
      ];
      
      // Act
      const mappings = buildOrderMappings(spocketOrders, squareOrders);
      
      // Assert
      expect(mappings).toHaveLength(2);
      expect(mappings[0]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spkt_1',
        targetId: 'sq_1',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
      
      expect(mappings[1]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spkt_2',
        targetId: 'sq_2',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
    });
    
    it('should handle empty order lists', () => {
      // Arrange
      const spocketOrders = [];
      const squareOrders = [];
      
      // Act
      const mappings = buildOrderMappings(spocketOrders, squareOrders);
      
      // Assert
      expect(mappings).toHaveLength(0);
    });
    
    it('should find mappings based on references', () => {
      // Arrange
      const spocketOrders = [
        { id: 'spkt_1', orderNumber: '1001', externalId: null }
      ];
      
      const squareOrders = [
        { id: 'sq_1', orderNumber: null, externalId: 'spkt_1' }
      ];
      
      // Mock the extract reference functions
      const extractSpocketReferenceFromSquareOrder = require('../../services/order/handlers/square.handler').extractSpocketReferenceFromSquareOrder;
      extractSpocketReferenceFromSquareOrder.mockImplementation((order) => order.externalId);
      
      // Act
      const mappings = buildOrderMappings(spocketOrders, squareOrders);
      
      // Assert
      expect(mappings).toHaveLength(1);
      expect(mappings[0].sourceId).toBe('spkt_1');
      expect(mappings[0].targetId).toBe('sq_1');
    });
  });

  describe('processOrderBatch', () => {
    it('should process orders and return correct counts', async () => {
      // Arrange
      const orders = [
        { id: 'order1', status: 'pending' },
        { id: 'order2', status: 'processing' },
        { id: 'order3', status: 'completed' }
      ];
      
      const mappings = [
        { 
          sourceId: 'order1', 
          targetId: 'target1', 
          entityType: SyncEntityType.ORDER,
          sourceSystem: 'spocket',
          targetSystem: 'square'
        }
      ];
      
      // Mocks for creating and updating orders
      const createOrderInTargetPlatform = jest.fn().mockResolvedValue('new-order-id');
      const updateOrderAcrossPlatforms = jest.fn().mockResolvedValue(undefined);
      
      // Override the implementation temporarily
      const originalCreate = global.createOrderInTargetPlatform;
      const originalUpdate = global.updateOrderAcrossPlatforms;
      global.createOrderInTargetPlatform = createOrderInTargetPlatform;
      global.updateOrderAcrossPlatforms = updateOrderAcrossPlatforms;
      
      // Act
      const result = await processOrderBatch(orders, mappings, 'spocket-to-square');
      
      // Restore original implementations
      global.createOrderInTargetPlatform = originalCreate;
      global.updateOrderAcrossPlatforms = originalUpdate;
      
      // Assert
      expect(result.syncedOrders).toBe(3);
      expect(result.createdOrders).toBe(2); // 2 orders without mappings
      expect(result.updatedOrders).toBe(1); // 1 order with mapping
      expect(result.errors).toHaveLength(0);
      
      // Verify the correct methods were called
      expect(createOrderInTargetPlatform).toHaveBeenCalledTimes(2);
      expect(updateOrderAcrossPlatforms).toHaveBeenCalledTimes(1);
    });
    
    it('should handle errors during processing', async () => {
      // Arrange
      const orders = [
        { id: 'order1', status: 'pending' },
        { id: 'order2', status: 'processing' } // This will throw an error
      ];
      
      const mappings = [];
      
      // Mocks for creating orders - second call throws error
      const createOrderInTargetPlatform = jest.fn()
        .mockResolvedValueOnce('new-order-id')
        .mockRejectedValueOnce(new Error('API Error'));
      
      // Override the implementation temporarily
      const originalCreate = global.createOrderInTargetPlatform;
      global.createOrderInTargetPlatform = createOrderInTargetPlatform;
      
      // Act
      const result = await processOrderBatch(orders, mappings, 'spocket-to-square');
      
      // Restore original implementations
      global.createOrderInTargetPlatform = originalCreate;
      
      // Assert
      expect(result.syncedOrders).toBe(1); // Only first order was processed
      expect(result.createdOrders).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].orderId).toBe('order2');
      expect(result.errors[0].message).toContain('Failed to process order');
    });
  });

  describe('resolveStatusConflict', () => {
    it('should prioritize higher status from spocket', () => {
      // Arrange
      const spocketOrder = { fulfillmentStatus: OrderFulfillmentStatus.SHIPPED };
      const squareOrder = { fulfillmentStatus: OrderFulfillmentStatus.PENDING };
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result.resolution).toBe(OrderFulfillmentStatus.SHIPPED);
      expect(result.platform).toBe('spocket');
    });
    
    it('should prioritize higher status from square', () => {
      // Arrange
      const spocketOrder = { fulfillmentStatus: OrderFulfillmentStatus.PENDING };
      const squareOrder = { fulfillmentStatus: OrderFulfillmentStatus.DELIVERED };
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result.resolution).toBe(OrderFulfillmentStatus.DELIVERED);
      expect(result.platform).toBe('square');
    });
    
    it('should default to spocket when statuses are equal', () => {
      // Arrange
      const spocketOrder = { fulfillmentStatus: OrderFulfillmentStatus.SHIPPED };
      const squareOrder = { fulfillmentStatus: OrderFulfillmentStatus.SHIPPED };
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result.resolution).toBe(OrderFulfillmentStatus.SHIPPED);
      expect(result.platform).toBe('spocket');
    });
    
    it('should handle invalid status values', () => {
      // Arrange
      const spocketOrder = { fulfillmentStatus: 'invalid_status' as OrderFulfillmentStatus };
      const squareOrder = { fulfillmentStatus: OrderFulfillmentStatus.PENDING };
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result.resolution).toBe(OrderFulfillmentStatus.PENDING);
      expect(result.platform).toBe('square');
    });
  });

  describe('resolvePaymentConflict', () => {
    it('should prioritize payment failures from spocket', () => {
      // Arrange
      const spocketOrder = { paymentStatus: OrderPaymentStatus.FAILED };
      const squareOrder = { paymentStatus: OrderPaymentStatus.PAID };
      
      // Act
      const result = resolvePaymentConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result.resolution).toBe(OrderPaymentStatus.FAILED);
      expect(result.platform).toBe('spocket');
    });
    
    it('should prioritize refunds from square', () => {
      // Arrange
      const spocketOrder = { paymentStatus: OrderPaymentStatus.PAID };
      const squareOrder = { paymentStatus: OrderPaymentStatus.REFUNDED };
      
      // Act
      const result = resolvePaymentConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result.resolution).toBe(OrderPaymentStatus.REFUNDED);
      expect(result.platform).toBe('square');
    });
    
    it('should prioritize higher payment status when no failures or refunds', () => {
      // Arrange
      const spocketOrder = { paymentStatus: OrderPaymentStatus.PENDING };
      const squareOrder = { paymentStatus: OrderPaymentStatus.PAID };
      
      // Act
      const result = resolvePaymentConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result.resolution).toBe(OrderPaymentStatus.PAID);
      expect(result.platform).toBe('square');
    });
    
    it('should default to spocket when payment statuses are equal', () => {
      // Arrange
      const spocketOrder = { paymentStatus: OrderPaymentStatus.PAID };
      const squareOrder = { paymentStatus: OrderPaymentStatus.PAID };
      
      // Act
      const result = resolvePaymentConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result.resolution).toBe(OrderPaymentStatus.PAID);
      expect(result.platform).toBe('spocket');
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      // Reset progress state before each test
      jest.clearAllMocks();
    });

    it('should initialize sync progress correctly', () => {
      const totalOrders = 100;
      const progress = startSyncProgress(totalOrders);
      
      expect(progress).toEqual({
        totalOrders,
        processedOrders: 0,
        createdOrders: { spocket: 0, square: 0 },
        updatedOrders: { spocket: 0, square: 0 },
        failedOrders: 0,
        errors: [],
        status: 'running',
        startTime: expect.any(Date),
        endTime: undefined
      });
    });

    it('should update sync progress with batch results', () => {
      // Start progress
      const initial = startSyncProgress(100);
      
      // Update with batch results
      const update = {
        processedOrders: 25,
        createdOrders: { spocket: 10, square: 5 },
        updatedOrders: { spocket: 8, square: 2 },
        failedOrders: 1,
        errors: [{
          message: 'Failed to process order',
          orderId: 'order-1',
          source: 'spocket'
        }]
      };

      const progress = updateSyncProgress(update);
      
      expect(progress).toEqual({
        ...initial,
        ...update,
        status: 'running',
        endTime: undefined
      });
    });

    it('should mark sync as completed successfully', () => {
      // Setup and process all orders
      startSyncProgress(100);
      updateSyncProgress({
        processedOrders: 100,
        createdOrders: { spocket: 40, square: 20 },
        updatedOrders: { spocket: 30, square: 10 },
        failedOrders: 0,
        errors: []
      

/**
 * Unit tests for the Order Synchronization Handler
 */
import { jest } from '@jest/globals';
import {
  buildOrderMappings,
  processOrderBatch,
  resolveStatusConflict,
  resolvePaymentConflict,
  startSyncProgress,
  updateSyncProgress,
  completeSyncProgress,
  getCurrentSyncProgress,
  recoverSync
} from '../../services/order/handlers/sync.handler';

import {
  Order,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderSyncDirection
} from '../../types/order.types';

import { EntityMapping, SyncEntityType } from '../../types/sync.types';

// Mock external dependencies
jest.mock('../../services/order/handlers/spocket.handler', () => ({
  fetchSpocketOrders: jest.fn(),
  getSpocketOrderById: jest.fn(),
  createSpocketOrder: jest.fn(),
  updateSpocketOrder: jest.fn(),
  updateSpocketOrderStatus: jest.fn(),
  updateSpocketOrderFulfillment: jest.fn(),
  updateSpocketOrderPayment: jest.fn(),
  extractSquareReferenceFromSpocketOrder: jest.fn()
}));

jest.mock('../../services/order/handlers/square.handler', () => ({
  fetchSquareOrders: jest.fn(),
  getSquareOrderById: jest.fn(),
  createSquareOrder: jest.fn(),
  updateSquareOrder: jest.fn(),
  updateSquareOrderStatus: jest.fn(),
  updateSquareOrderFulfillment: jest.fn(),
  updateSquareOrderPayment: jest.fn(),
  extractSpocketReferenceFromSquareOrder: jest.fn()
}));

// Mock common logger
jest.mock('../../services/common/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  })
}));

describe('Order Synchronization Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildOrderMappings', () => {
    it('should build mappings for orders with matching IDs and order numbers', () => {
      // Arrange
      const spocketOrders: Order[] = [
        {
          id: 'spkt_1',
          orderNumber: 'order-1',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        },
        {
          id: 'spkt_2',
          orderNumber: 'order-2',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      const squareOrders: Order[] = [
        {
          id: 'sq_1',
          orderNumber: 'order-1',
          externalId: 'spkt_1',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        },
        {
          id: 'sq_2',
          orderNumber: 'different-number',
          externalId: 'spkt_2',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      // Act
      const mappings = buildOrderMappings(spocketOrders, squareOrders);

      // Assert
      expect(mappings).toHaveLength(2);
      expect(mappings[0]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spkt_1',
        targetId: 'sq_1',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
      expect(mappings[1]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spkt_2',
        targetId: 'sq_2',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
    });

    it('should build mappings based on order number when ID is not matching', () => {
      // Arrange
      const spocketOrders: Order[] = [
        {
          id: 'spkt_1',
          orderNumber: 'order-1',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      const squareOrders: Order[] = [
        {
          id: 'sq_1',
          orderNumber: 'order-1',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      // Act
      const mappings = buildOrderMappings(spocketOrders, squareOrders);

      // Assert
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spkt_1',
        targetId: 'sq_1',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
    });

    it('should handle mutual references between orders', () => {
      // Arrange
      const spocketOrders: Order[] = [
        {
          id: 'spkt_1',
          orderNumber: 'different-number-1',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      const squareOrders: Order[] = [
        {
          id: 'sq_1',
          orderNumber: 'different-number-2',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      // Mock the reference extraction functions
      const { extractSpocketReferenceFromSquareOrder } = require('../../services/order/handlers/square.handler');
      extractSpocketReferenceFromSquareOrder.mockReturnValue('spkt_1');

      // Act
      const mappings = buildOrderMappings(spocketOrders, squareOrders);

      // Assert
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spkt_1',
        targetId: 'sq_1',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
    });

    it('should return empty mappings when no orders match', () => {
      // Arrange
      const spocketOrders: Order[] = [
        {
          id: 'spkt_1',
          orderNumber: 'order-1',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      const squareOrders: Order[] = [
        {
          id: 'sq_1',
          orderNumber: 'order-2',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      // Mock the reference extraction function to return null (no reference)
      const { extractSpocketReferenceFromSquareOrder } = require('../../services/order/handlers/square.handler');
      extractSpocketReferenceFromSquareOrder.mockReturnValue(null);

      // Act
      const mappings = buildOrderMappings(spocketOrders, squareOrders);

      // Assert
      expect(mappings).toHaveLength(0);
    });
  });

  describe('processOrderBatch', () => {
    it('should create new orders that do not have mappings', async () => {
      // Arrange
      const orders: Order[] = [
        {
          id: 'spkt_1',
          orderNumber: 'order-1',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      const mappings: EntityMapping[] = [];

      // Mock the create function
      const { createSquareOrder } = require('../../services/order/handlers/square.handler');
      createSquareOrder.mockResolvedValue('sq_1');

      // Act
      const result = await processOrderBatch(orders, mappings, 'spocket-to-square');

      // Assert
      expect(result.syncedOrders).toBe(1);
      expect(result.createdOrders).toBe(1);
      expect(result.updatedOrders).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(createSquareOrder).toHaveBeenCalledWith(orders[0], undefined);
    });

    it('should update existing orders that have mappings', async () => {
      // Arrange
      const orders: Order[] = [
        {
          id: 'spkt_1',
          orderNumber: 'order-1',
          fulfillmentStatus: OrderFulfillmentStatus.SHIPPED,
          paymentStatus: OrderPaymentStatus.PAID,
          shipping: {
            trackingNumber: '123456',
            carrier: 'UPS'
          }
        }
      ];

      const mappings: EntityMapping[] = [
        {
          entityType: SyncEntityType.ORDER,
          sourceId: 'spkt_1',
          targetId: 'sq_1',
          sourceSystem: 'spocket',
          targetSystem: 'square'
        }
      ];

      // Mock the necessary functions
      const { getSquareOrderById, updateSquareOrderStatus, updateSquareOrderFulfillment, updateSquareOrderPayment } = require('../../services/order/handlers/square.handler');
      getSquareOrderById.mockResolvedValue({
        id: 'sq_1',
        orderNumber: 'order-1',
        fulfillmentStatus: OrderFulfillmentStatus.PENDING,
        paymentStatus: OrderPaymentStatus.PENDING
      });

      // Act
      const result = await processOrderBatch(orders, mappings, 'spocket-to-square');

      // Assert
      expect(result.syncedOrders).toBe(1);
      expect(result.createdOrders).toBe(0);
      expect(result.updatedOrders).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(getSquareOrderById).toHaveBeenCalledWith('sq_1');
      expect(updateSquareOrderStatus).toHaveBeenCalled();
      expect(updateSquareOrderFulfillment).toHaveBeenCalled();
      expect(updateSquareOrderPayment).toHaveBeenCalled();
    });

    it('should handle errors during order processing', async () => {
      // Arrange
      const orders: Order[] = [
        {
          id: 'spkt_1',
          orderNumber: 'order-1',
          fulfillmentStatus: OrderFulfillmentStatus.PENDING,
          paymentStatus: OrderPaymentStatus.PENDING
        }
      ];

      const mappings: EntityMapping[] = [];

      // Mock create function to throw an error
      const { createSquareOrder } = require('../../services/order/handlers/square.handler');
      createSquareOrder.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await processOrderBatch(orders, mappings, 'spocket-to-square');

      // Assert
      expect(result.syncedOrders).toBe(0);
      expect(result.createdOrders).toBe(0);
      expect(result.updatedOrders).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Failed to process order');
      expect(result.errors[0].orderId).toBe('spkt_1');
      expect(result.errors[0].source).toBe('spocket');
    });
  });

  describe('resolveStatusConflict', () => {
    it('should prioritize more advanced fulfillment statuses', () => {
      // Arrange
      const spocketOrder: Order = {
        id: 'spkt_1',
        fulfillmentStatus: OrderFulfillmentStatus.SHIPPED,
        paymentStatus: OrderPaymentStatus.PENDING
      };

      const squareOrder: Order = {
        id: 'sq_1',
        fulfillmentStatus: OrderFulfillmentStatus.PENDING,
        paymentStatus: OrderPaymentStatus.PENDING
      };

      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);

      // Assert
      expect(result.resolution).toBe(OrderFulfillmentStatus.SHIPPED);
      expect(result.platform).toBe('spocket');
    });

    it('should handle when Square has more advanced status', () => {
      // Arrange
      const spocketOrder: Order = {
        id: 'spkt_1',
        fulfillmentStatus: OrderFulfillmentStatus.PENDING,
        paymentStatus: OrderPaymentStatus.PENDING
      };

      const squareOrder: Order = {
        id: 'sq_1',
        fulfillmentStatus: OrderFulfillmentStatus.DELIVERED,
        paymentStatus: OrderPaymentStatus.PENDING
      };

      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);

      // Assert
      expect(result.resolution).toBe(OrderFulfillmentStatus.DELIVERED);
      expect(result.platform).toBe('square');
    });

    it('should default to Spocket when statuses are equal', () => {
      // Arrange
      const spocketOrder: Order = {
        id: 'spkt_1',
        fulfillmentStatus: OrderFulfillmentStatus.SHIPPED,
        paymentStatus: OrderPaymentStatus.PENDING
      };

      const squareOrder: Order = {
        id: 'sq_1',
        fulfillmentStatus: OrderFulfillmentStatus.SHIPPED,
        paymentStatus: OrderPaymentStatus.PENDING
      };

      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);

      // Assert
      expect(result.resolution).toBe(OrderFulfillmentStatus.SHIPPED);
      expect(result.platform).toBe('spocket');
    });

    it('should handle undefined or invalid status gracefully', () => {
      // Arrange
      const spocketOrder: Order = {
        id: 'spkt_1',
        fulfillmentStatus: undefined as unknown as OrderFulfillmentStatus,
        paymentStatus: OrderPaymentStatus.PENDING
      };

      const squareOrder: Order = {
        id: 'sq_1',
        fulfillmentStatus: OrderFulfillmentStatus.SHIPPED,
        paymentStatus: OrderPaymentStatus.PENDING
      };

      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);

      // Assert
      expect(result.resolution).toBe(OrderFulfillmentStatus.SHIPPED);
      expect(result.platform).toBe('square');
    });
  });

import { jest } from '@jest/globals';
import {
  buildOrderMappings,
  processOrderBatch,
  resolveStatusConflict,
  resolvePaymentConflict,
  startSyncProgress,
  updateSyncProgress,
  completeSyncProgress,
  getCurrentSyncProgress,
  recoverSync
} from '../../services/order/handlers/sync.handler';
import { OrderFulfillmentStatus, OrderPaymentStatus } from '../../types/order.types';

// Mock function to create test orders
const createMockOrder = (id: string, orderNumber: string, platform: 'spocket' | 'square') => ({
  id,
  orderNumber,
  platform,
  fulfillmentStatus: OrderFulfillmentStatus.PENDING,
  paymentStatus: OrderPaymentStatus.PENDING,
  customerId: `customer-${id}`,
  lineItems: [],
  shipping: {},
  createdAt: new Date(),
  updatedAt: new Date()
});

// Mock the logger and dependencies
jest.mock('../../services/common/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock Spocket and Square handlers
jest.mock('../../services/order/handlers/spocket.handler', () => ({
  fetchSpocketOrders: jest.fn(),
  getSpocketOrderById: jest.fn(),
  createSpocketOrder: jest.fn(),
  updateSpocketOrder: jest.fn(),
  updateSpocketOrderStatus: jest.fn(),
  updateSpocketOrderFulfillment: jest.fn(),
  updateSpocketOrderPayment: jest.fn(),
  extractSquareReferenceFromSpocketOrder: jest.fn()
}));

jest.mock('../../services/order/handlers/square.handler', () => ({
  fetchSquareOrders: jest.fn(),
  getSquareOrderById: jest.fn(),
  createSquareOrder: jest.fn(),
  updateSquareOrder: jest.fn(),
  updateSquareOrderStatus: jest.fn(),
  updateSquareOrderFulfillment: jest.fn(),
  updateSquareOrderPayment: jest.fn(),
  extractSpocketReferenceFromSquareOrder: jest.fn()
}));

describe('Order Sync Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildOrderMappings', () => {
    it('should map orders by ID', () => {
      // Arrange
      const spocketOrders = [createMockOrder('spocket1', 'order-1', 'spocket')];
      const squareOrders = [
        {
          ...createMockOrder('square1', 'order-1', 'square'),
          externalId: 'spocket1'
        }
      ];

      // Act
      const result = buildOrderMappings(spocketOrders, squareOrders);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].sourceId).toBe('spocket1');
      expect(result[0].targetId).toBe('square1');
    });

    it('should map orders by order number', () => {
      // Arrange
      const spocketOrders = [createMockOrder('spocket1', 'order-matching-number', 'spocket')];
      const squareOrders = [createMockOrder('square1', 'order-matching-number', 'square')];

      // Act
      const result = buildOrderMappings(spocketOrders, squareOrders);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].sourceId).toBe('spocket1');
      expect(result[0].targetId).toBe('square1');
    });

    it('should handle orders with no mappings', () => {
      // Arrange
      const spocketOrders = [createMockOrder('spocket1', 'order-1', 'spocket')];
      const squareOrders = [createMockOrder('square1', 'order-2', 'square')];

      // Act
      const result = buildOrderMappings(spocketOrders, squareOrders);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should map orders by mutual references', () => {
      // Arrange
      const spocketOrders = [
        {
          ...createMockOrder('spocket1', 'order-1', 'spocket'),
          externalId: 'square1'
        }
      ];
      
      const squareOrders = [
        {
          ...createMockOrder('square1', 'order-2', 'square'),
          externalId: 'spocket1'
        }
      ];

      // Set up the extract reference mock
      const { extractSpocketReferenceFromSquareOrder } = require('../../services/order/handlers/square.handler');
      extractSpocketReferenceFromSquareOrder.mockReturnValue('spocket1');

      // Act
      const result = buildOrderMappings(spocketOrders, squareOrders);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].sourceId).toBe('spocket1');
      expect(result[0].targetId).toBe('square1');
    });
  });

  describe('processOrderBatch', () => {
    it('should process orders for creation in target system', async () => {
      // Arrange
      const orders = [createMockOrder('spocket1', 'order-1', 'spocket')];
      const mappings = [];
      const direction = 'spocket-to-square';
      
      // Mock the create function
      const { createSquareOrder } = require('../../services/order/handlers/square.handler');
      createSquareOrder.mockResolvedValue('square1');

      // Act
      const result = await processOrderBatch(orders, mappings, direction);

      // Assert
      expect(result.syncedOrders).toBe(1);
      expect(result.createdOrders).toBe(1);
      expect(result.updatedOrders).toBe(0);
      expect(createSquareOrder).toHaveBeenCalledWith(orders[0], undefined);
    });

    it('should process orders for updating in target system', async () => {
      // Arrange
      const orders = [createMockOrder('spocket1', 'order-1', 'spocket')];
      const mappings = [{
        entityType: 'order',
        sourceId: 'spocket1',
        targetId: 'square1',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      }];
      const direction = 'spocket-to-square';
      
      // Mock the get and update functions
      const { getSquareOrderById } = require('../../services/order/handlers/square.handler');
      const { updateSquareOrderStatus, updateSquareOrderPayment } = require('../../services/order/handlers/square.handler');
      
      getSquareOrderById.mockResolvedValue({
        ...createMockOrder('square1', 'order-1', 'square'),
        fulfillmentStatus: OrderFulfillmentStatus.PROCESSED // Different status to trigger update
      });
      
      updateSquareOrderStatus.mockResolvedValue({});
      updateSquareOrderPayment.mockResolvedValue({});

      // Act
      const result = await processOrderBatch(orders, mappings, direction);

      // Assert
      expect(result.syncedOrders).toBe(1);
      expect(result.createdOrders).toBe(0);
      expect(result.updatedOrders).toBe(1);
      expect(updateSquareOrderStatus).toHaveBeenCalled();
    });

    it('should handle errors during order processing', async () => {
      // Arrange
      const orders = [createMockOrder('spocket1', 'order-1', 'spocket')];
      const mappings = [];
      const direction = 'spocket-to-square';
      
      // Mock the create function to throw an error
      const { createSquareOrder } = require('../../services/order/handlers/square.handler');
      createSquareOrder.mockRejectedValue(new Error('API error'));

      // Act
      const result = await processOrderBatch(orders, mappings, direction);

      // Assert
      expect(result.syncedOrders).toBe(0);
      expect(result.createdOrders).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Failed to process order');
      expect(result.errors[0].orderId).toBe('spocket1');
    });
  });

  describe('resolveStatusConflict', () => {
    it('should prefer SHIPPED status over PENDING', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.fulfillmentStatus = OrderFulfillmentStatus.SHIPPED;
      squareOrder.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderFulfillmentStatus.SHIPPED,
        platform: 'spocket'
      });
    });

    it('should prefer DELIVERED status over SHIPPED', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.fulfillmentStatus = OrderFulfillmentStatus.SHIPPED;
      squareOrder.fulfillmentStatus = OrderFulfillmentStatus.DELIVERED;
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderFulfillmentStatus.DELIVERED,
        platform: 'square'
      });
    });

    it('should default to Spocket when statuses are equal', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
      squareOrder.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderFulfillmentStatus.PENDING,
        platform: 'spocket'
      });
    });

    it('should handle undefined or invalid statuses', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.fulfillmentStatus = undefined as any;
      squareOrder.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderFulfillmentStatus.PENDING,
        platform: 'square'
      });
    });
  });

  describe('resolvePaymentConflict', () => {
    it('should prefer FAILED status over other statuses', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.paymentStatus = OrderPaymentStatus.FAILED;
      squareOrder.paymentStatus = OrderPaymentStatus.PAID;
      
      // Act
      const result = resolvePaymentConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderPaymentStatus.FAILED,
        platform: 'spocket'
      });
    });

    it('should prefer REFUNDED status over PAID', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.paymentStatus = OrderPaymentStatus.PAID;
      squareOrder.paymentStatus = OrderPaymentStatus.REFUNDED;
      
      // Act
      const result = resolvePaymentConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderPaymentStatus.REFUNDED,
        platform: 'square'
      });
    });

    it('should prefer PAID status over PENDING', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.paymentStatus = OrderPaymentStatus.PAID;
      squareOrder.paymentStatus = OrderPaymentStatus.PENDING;
      
      // Act
      const result = resolvePaymentConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderPaymentStatus.PAID,
        platform: 'spocket'
      });
    });

    it('should default to Spocket when statuses are equal', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.paymentStatus = OrderPaymentStatus.PAID;
      squareOrder.paymentStatus = OrderPaymentStatus.PAID;
      
      // Act
      const result = resolvePaymentConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderPaymentStatus.PAID,
        platform: 'spocket'
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should initialize sync progress correctly', () => {
      const totalOrders = 100;
      const progress = startSyncProgress(totalOrders);
      
      expect(progress).toEqual({
        totalOrders,
        processedOrders: 0,
        createdOrders: { spocket: 0, square: 0 },
        updatedOrders: { spocket: 0, square: 0 },
        failedOrders: 0,

import { jest } from '@jest/globals';
import {
  buildOrderMappings,
  processOrderBatch,
  resolveStatusConflict,
  resolvePaymentConflict,
  startSyncProgress,
  updateSyncProgress,
  completeSyncProgress,
  getCurrentSyncProgress,
  recoverSync
} from '../../services/order/handlers/sync.handler';

import {
  Order,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderSyncDirection
} from '../../types/order.types';

import { EntityMapping, SyncEntityType } from '../../types/sync.types';

// Mock the dependencies
jest.mock('../../services/common/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../services/order/handlers/spocket.handler', () => ({
  fetchSpocketOrders: jest.fn(),
  getSpocketOrderById: jest.fn(),
  createSpocketOrder: jest.fn(),
  updateSpocketOrder: jest.fn(),
  updateSpocketOrderStatus: jest.fn(),
  updateSpocketOrderFulfillment: jest.fn(),
  updateSpocketOrderPayment: jest.fn(),
  extractSquareReferenceFromSpocketOrder: jest.fn()
}));

jest.mock('../../services/order/handlers/square.handler', () => ({
  fetchSquareOrders: jest.fn(),
  getSquareOrderById: jest.fn(),
  createSquareOrder: jest.fn(),
  updateSquareOrder: jest.fn(),
  updateSquareOrderStatus: jest.fn(),
  updateSquareOrderFulfillment: jest.fn(),
  updateSquareOrderPayment: jest.fn(),
  extractSpocketReferenceFromSquareOrder: jest.fn()
}));

// Import mocked functions for assertions
import { getSpocketOrderById, createSpocketOrder, updateSpocketOrderStatus, updateSpocketOrderFulfillment, updateSpocketOrderPayment } from '../../services/order/handlers/spocket.handler';
import { getSquareOrderById, createSquareOrder, updateSquareOrderStatus, updateSquareOrderFulfillment, updateSquareOrderPayment, extractSpocketReferenceFromSquareOrder } from '../../services/order/handlers/square.handler';

// Create mock data for testing
const createMockOrder = (id: string, orderNumber: string, platform: 'spocket' | 'square', externalId?: string): Order => {
  return {
    id,
    orderNumber,
    externalId,
    customer: {
      id: `customer_${id}`,
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '123-456-7890'
    },
    items: [
      {
        id: `item_${id}_1`,
        productId: 'product_1',
        name: 'Test Product',
        sku: 'SKU-001',
        quantity: 1,
        unitPrice: 10,
        total: 10
      }
    ],
    shipping: {
      address: {
        line1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US'
      },
      method: 'Standard',
      cost: { amount: 5, currency: 'USD' }
    },
    payment: {
      id: `payment_${id}`,
      amount: { amount: 15, currency: 'USD' },
      status: OrderPaymentStatus.PAID,
      method: 'Credit Card'
    },
    fulfillmentStatus: OrderFulfillmentStatus.PENDING,
    paymentStatus: OrderPaymentStatus.PAID,
    subtotal: { amount: 10, currency: 'USD' },
    taxTotal: { amount: 0, currency: 'USD' },
    shippingTotal: { amount: 5, currency: 'USD' },
    discountTotal: { amount: 0, currency: 'USD' },
    total: { amount: 15, currency: 'USD' },
    createdAt: new Date(),
    updatedAt: new Date()
  } as Order;
};

describe('Order Sync Handler Unit Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('buildOrderMappings', () => {
    it('should correctly map orders based on matching IDs', () => {
      // Arrange
      const spocketOrder1 = createMockOrder('spocket1', 'order-1', 'spocket');
      const spocketOrder2 = createMockOrder('spocket2', 'order-2', 'spocket');
      const squareOrder1 = createMockOrder('square1', 'order-1', 'square', 'spocket1'); // Links to spocketOrder1 via externalId
      const squareOrder2 = createMockOrder('square3', 'order-3', 'square'); // No match
      
      const spocketOrders = [spocketOrder1, spocketOrder2];
      const squareOrders = [squareOrder1, squareOrder2];
      
      // Act
      const mappings = buildOrderMappings(spocketOrders, squareOrders);
      
      // Assert
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spocket1',
        targetId: 'square1',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
    });
    
    it('should map orders based on order numbers when ids don\'t match', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-123', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-123', 'square'); // Same order number as spocketOrder
      
      // Act
      const mappings = buildOrderMappings([spocketOrder], [squareOrder]);
      
      // Assert
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spocket1',
        targetId: 'square1',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
    });
    
    it('should create mappings from Square to Spocket when references exist', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-2', 'square');
      
      // Setup reference from square to spocket
      (extractSpocketReferenceFromSquareOrder as jest.Mock).mockReturnValue('spocket1');
      
      // Act
      const mappings = buildOrderMappings([spocketOrder], [squareOrder]);
      
      // Assert
      expect(extractSpocketReferenceFromSquareOrder).toHaveBeenCalledWith(squareOrder);
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual({
        entityType: SyncEntityType.ORDER,
        sourceId: 'spocket1',
        targetId: 'square1',
        sourceSystem: 'spocket',
        targetSystem: 'square'
      });
    });
    
    it('should return an empty array when no mappings can be created', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-2', 'square');
      
      // No references exist
      (extractSpocketReferenceFromSquareOrder as jest.Mock).mockReturnValue(null);
      
      // Act
      const mappings = buildOrderMappings([spocketOrder], [squareOrder]);
      
      // Assert
      expect(mappings).toHaveLength(0);
    });
  });
  
  describe('processOrderBatch', () => {
    it('should process a batch of orders for creation in target platform', async () => {
      // Arrange
      const spocketOrder1 = createMockOrder('spocket1', 'order-1', 'spocket');
      const spocketOrder2 = createMockOrder('spocket2', 'order-2', 'spocket');
      const orders = [spocketOrder1, spocketOrder2];
      const mappings: EntityMapping[] = [];
      const direction: OrderSyncDirection = 'spocket-to-square';
      
      // Setup mocks
      (createSquareOrder as jest.Mock).mockResolvedValueOnce('square1');
      (createSquareOrder as jest.Mock).mockResolvedValueOnce('square2');
      
      // Act
      const result = await processOrderBatch(orders, mappings, direction);
      
      // Assert
      expect(createSquareOrder).toHaveBeenCalledTimes(2);
      expect(createSquareOrder).toHaveBeenCalledWith(spocketOrder1, undefined);
      expect(createSquareOrder).toHaveBeenCalledWith(spocketOrder2, undefined);
      
      expect(result.syncedOrders).toBe(2);
      expect(result.createdOrders).toBe(2);
      expect(result.updatedOrders).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should process a batch of orders for updating in target platform', async () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      // This order has a different status so it should trigger an update
      spocketOrder.fulfillmentStatus = OrderFulfillmentStatus.SHIPPED;
      squareOrder.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
      
      const orders = [spocketOrder];
      const mappings: EntityMapping[] = [
        {
          entityType: SyncEntityType.ORDER,
          sourceId: 'spocket1',
          targetId: 'square1',
          sourceSystem: 'spocket',
          targetSystem: 'square'
        }
      ];
      const direction: OrderSyncDirection = 'spocket-to-square';
      
      // Setup mocks
      (getSquareOrderById as jest.Mock).mockResolvedValueOnce(squareOrder);
      (updateSquareOrderStatus as jest.Mock).mockResolvedValueOnce(undefined);
      
      // Act
      const result = await processOrderBatch(orders, mappings, direction);
      
      // Assert
      expect(getSquareOrderById).toHaveBeenCalledWith('square1');
      expect(updateSquareOrderStatus).toHaveBeenCalledWith('square1', OrderFulfillmentStatus.SHIPPED);
      
      expect(result.syncedOrders).toBe(1);
      expect(result.createdOrders).toBe(0);
      expect(result.updatedOrders).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should handle errors during order processing', async () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const orders = [spocketOrder];
      const mappings: EntityMapping[] = [];
      const direction: OrderSyncDirection = 'spocket-to-square';
      
      // Setup mock to throw an error
      const errorMessage = 'Failed to create order';
      (createSquareOrder as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));
      
      // Act
      const result = await processOrderBatch(orders, mappings, direction);
      
      // Assert
      expect(createSquareOrder).toHaveBeenCalledWith(spocketOrder, undefined);
      
      expect(result.syncedOrders).toBe(0);
      expect(result.createdOrders).toBe(0);
      expect(result.updatedOrders).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual(expect.objectContaining({
        message: expect.stringContaining(errorMessage),
        orderId: 'spocket1',
        source: 'spocket'
      }));
    });
  });
  
  describe('resolveStatusConflict', () => {
    it('should prefer the more advanced status from Spocket', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.fulfillmentStatus = OrderFulfillmentStatus.SHIPPED;
      squareOrder.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderFulfillmentStatus.SHIPPED,
        platform: 'spocket'
      });
    });
    
    it('should prefer the more advanced status from Square', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.fulfillmentStatus = OrderFulfillmentStatus.PENDING;
      squareOrder.fulfillmentStatus = OrderFulfillmentStatus.DELIVERED;
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderFulfillmentStatus.DELIVERED,
        platform: 'square'
      });
    });
    
    it('should default to Spocket when statuses are equal', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1', 'order-1', 'square');
      
      spocketOrder.fulfillmentStatus = OrderFulfillmentStatus.SHIPPED;
      squareOrder.fulfillmentStatus = OrderFulfillmentStatus.SHIPPED;
      
      // Act
      const result = resolveStatusConflict(spocketOrder, squareOrder);
      
      // Assert
      expect(result).toEqual({
        resolution: OrderFulfillmentStatus.SHIPPED,
        platform: 'spocket'
      });
    });
    
    it('should handle undefined or invalid statuses', () => {
      // Arrange
      const spocketOrder = createMockOrder('spocket1', 'order-1', 'spocket');
      const squareOrder = createMockOrder('square1

