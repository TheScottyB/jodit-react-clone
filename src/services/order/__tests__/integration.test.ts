import { jest } from '@jest/globals';
import axios from 'axios';
import winston from 'winston';

// Mock external dependencies
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

// Mock configuration
const mockConfig = {
  spocket: {
    apiUrl: 'https://api.spocket.com/v1',
    apiKey: 'spocket-api-key',
    webhookSecret: 'spocket-webhook-secret',
  },
  square: {
    apiUrl: 'https://connect.squareup.com/v2',
    accessToken: 'square-access-token',
    location: 'location-id',
    webhookSignatureKey: 'square-signature-key',
  },
  sync: {
    maxRetries: 3,
    retryDelay: 1000,
    batchSize: 10,
  },
};

// Import services (these would be actual imports in your implementation)
// import { OrderSyncService } from '../orderSyncService';
// import { WebhookHandler } from '../../webhook/webhookHandler';
// import { RecoveryService } from '../recoveryService';

// Mock the services for testing
const mockOrderSyncService = {
  syncOrderFromSpocketToSquare: jest.fn(),
  syncOrderFromSquareToSpocket: jest.fn(),
  syncFulfillmentStatus: jest.fn(),
  syncPaymentStatus: jest.fn(),
  handlePartialSync: jest.fn(),
  retryFailedSync: jest.fn(),
  resolveConflicts: jest.fn(),
  validateDataConsistency: jest.fn(),
  reconcileState: jest.fn(),
};

const mockWebhookHandler = {
  verifySpocketSignature: jest.fn(),
  verifySquareSignature: jest.fn(),
  processSpocketWebhook: jest.fn(),
  processSquareWebhook: jest.fn(),
};

const mockRecoveryService = {
  recoverPartialSync: jest.fn(),
  retryFailedOperations: jest.fn(),
  resolveConflicts: jest.fn(),
  checkDataConsistency: jest.fn(),
  reconcileState: jest.fn(),
};

// Helper functions for testing
const createMockSpocketOrder = (id: string) => ({
  id,
  customer: {
    id: `cust-${id}`,
    email: `customer-${id}@example.com`,
    first_name: 'Test',
    last_name: 'Customer',
  },
  line_items: [
    {
      id: `item-${id}-1`,
      product_id: `prod-${id}-1`,
      quantity: 1,
      price: 19.99,
    },
  ],
  shipping_address: {
    address1: '123 Test St',
    city: 'Test City',
    state: 'TS',
    zip: '12345',
    country: 'US',
  },
  status: 'pending',
  total_price: 19.99,
  created_at: new Date().toISOString(),
});

const createMockSquareOrder = (id: string) => ({
  id,
  customer_id: `cust-${id}`,
  line_items: [
    {
      uid: `item-${id}-1`, 
      name: 'Test Product',
      quantity: '1',
      base_price_money: {
        amount: 1999,
        currency: 'USD',
      },
    },
  ],
  state: 'OPEN',
  total_money: {
    amount: 1999,
    currency: 'USD',
  },
  created_at: new Date().toISOString(),
});

// Setup & teardown
beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
  
  // Setup default responses
  mockedAxios.get.mockResolvedValue({ data: {} });
  mockedAxios.post.mockResolvedValue({ data: {} });
  mockedAxios.put.mockResolvedValue({ data: {} });
  mockedAxios.patch.mockResolvedValue({ data: {} });
});

describe('Order Synchronization Service Integration Tests', () => {
  // Existing test examples assumed to be before line 980
  
  describe('Webhook Handling', () => {
    test('should process Square fulfillment webhook and sync status to Spocket', async () => {
      // Arrange
      const orderId = 'order-12345';
      const webhookEvent = {
        type: 'order.fulfillment.updated',
        data: {
          object: {
            order_id: orderId,
            fulfillment_id: 'fulfillment-123',
            state: 'COMPLETED',
          },
        },
      };
      
      const signature = 'valid-signature';
      const timestamp = new Date().toISOString();
      const requestBody = JSON.stringify(webhookEvent);
      
      mockWebhookHandler.verifySquareSignature.mockReturnValue(true);
      mockWebhookHandler.processSquareWebhook.mockResolvedValue({
        success: true,
        orderId,
        actionRequired: 'sync-fulfillment',
      });
      
      mockOrderSyncService.syncFulfillmentStatus.mockResolvedValue({
        success: true,
        message: 'Fulfillment status synced successfully',
      });
      
      // Act
      const result = await mockWebhookHandler.processSquareWebhook(
        webhookEvent,
        signature,
        timestamp,
      );
      
      const syncResult = await mockOrderSyncService.syncFulfillmentStatus(
        orderId,
        'COMPLETED',
        'square',
      );
      
      // Assert
      expect(mockWebhookHandler.verifySquareSignature).toHaveBeenCalledWith(
        signature,
        requestBody,
        timestamp,
      );
      expect(mockWebhookHandler.processSquareWebhook).toHaveBeenCalledWith(
        webhookEvent,
        signature,
        timestamp,
      );
      expect(result.success).toBe(true);
      expect(result.actionRequired).toBe('sync-fulfillment');
      
      expect(mockOrderSyncService.syncFulfillmentStatus).toHaveBeenCalledWith(
        orderId,
        'COMPLETED',
        'square',
      );
      expect(syncResult.success).toBe(true);
    });
    
    test('should verify webhook signatures from Spocket correctly', async () => {
      // Arrange
      const payload = JSON.stringify({ event: 'order.created', data: { id: 'order-123' } });
      const validSignature = 'valid-signature';
      const invalidSignature = 'invalid-signature';
      
      mockWebhookHandler.verifySpocketSignature
        .mockImplementation((sig) => sig === validSignature);
      
      // Act & Assert
      const validResult = mockWebhookHandler.verifySpocketSignature(validSignature, payload);
      expect(validResult).toBe(true);
      
      const invalidResult = mockWebhookHandler.verifySpocketSignature(invalidSignature, payload);
      expect(invalidResult).toBe(false);
    });
    
    test('should verify webhook signatures from Square correctly', async () => {
      // Arrange
      const payload = JSON.stringify({ type: 'order.updated', data: { id: 'order-123' } });
      const timestamp = new Date().toISOString();
      const validSignature = 'valid-signature';
      const invalidSignature = 'invalid-signature';
      
      mockWebhookHandler.verifySquareSignature
        .mockImplementation((sig) => sig === validSignature);
      
      // Act & Assert
      const validResult = mockWebhookHandler.verifySquareSignature(
        validSignature,
        payload,
        timestamp,
      );
      expect(validResult).toBe(true);
      
      const invalidResult = mockWebhookHandler.verifySquareSignature(
        invalidSignature,
        payload,
        timestamp,
      );
      expect(invalidResult).toBe(false);
    });
    
    test('should handle webhook processing errors gracefully', async () => {
      // Arrange
      const webhookEvent = {
        type: 'order.payment.updated',
        data: { 
          object: {
            order_id: 'invalid-order',
          }
        },
      };
      
      mockWebhookHandler.processSquareWebhook.mockRejectedValue(
        new Error('Order not found')
      );
      
      // Act & Assert
      await expect(async () => {
        await mockWebhookHandler.processSquareWebhook(
          webhookEvent,
          'valid-signature',
          new Date().toISOString(),
        );
      }).rejects.toThrow('Order not found');
      
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    test('should ensure idempotency for duplicate webhook events', async () => {
      // Arrange
      const webhookId = 'webhook-123';
      const orderId = 'order-123';
      const eventTime = new Date().toISOString();
      
      const webhookEvent = {
        id: webhookId,
        type: 'order.created',
        data: {
          id: orderId,
          created_at: eventTime,
        },
      };
      
      // First call succeeds
      mockWebhookHandler.processSpocketWebhook.mockResolvedValueOnce({
        success: true,
        orderId,
        new: true,
      });
      
      // Second call (duplicate) returns already processed
      mockWebhookHandler.processSpocketWebhook.mockResolvedValueOnce({
        success: true,
        orderId,
        new: false,
      });
      
      // Act
      const firstResult = await mockWebhookHandler.processSpocketWebhook(
        webhookEvent,
        'valid-signature',
      );
      
      const secondResult = await mockWebhookHandler.processSpocketWebhook(
        webhookEvent,
        'valid-signature',
      );
      
      // Assert
      expect(firstResult.new).toBe(true);
      expect(secondResult.new).toBe(false);
      
      // Verify sync was only called once
      expect(mockOrderSyncService.syncOrderFromSpocketToSquare).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Recovery and Resilience', () => {
    test('should recover from partial sync failures', async () => {
      // Arrange
      const orderId = 'order-123';
      const spocketOrder = createMockSpocketOrder(orderId);
      
      // Simulate a partial sync where the order was created in Square
      // but the fulfillment failed to sync
      const partialSyncState = {
        orderId,
        source: 'spocket',
        steps: [
          { name: 'createOrder', status: 'completed', targetId: 'square-order-123' },
          { name: 'syncFulfillment', status: 'failed', error: 'Connection error' },
        ],
      };
      
      mockRecoveryService.recoverPartialSync.mockResolvedValue({
        success: true,
        message: 'Recovered partial sync',
        completedSteps: ['syncFulfillment'],
      });
      
      // Act
      const result = await mockRecoveryService.recoverPartialSync(partialSyncState);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.completedSteps).toContain('syncFulfillment');
      expect(mockOrderSyncService.syncFulfillmentStatus).toHaveBeenCalled();
    });
    
    test('should retry failed operations with exponential backoff', async () => {
      // Arrange
      const operationId = 'op-123';
      const orderId = 'order-123';
      const operation = {
        id: operationId,
        type: 'syncPaymentStatus',
        params: { orderId, status: 'PAID' },
        attempts: 2,
        lastAttempt: new Date(Date.now() - 5000).toISOString(),
        error: 'Timeout error',
      };
      
      mockRecoveryService.retryFailedOperations.mockResolvedValue({
        success: true,
        message: 'Operation retried successfully',
      });
      
      // Act
      const result = await mockRecoveryService.retryFailedOperations([operation]);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockOrderSyncService.syncPaymentStatus).toHaveBeenCalledWith(
        orderId,
        'PAID',
        expect.any(String),
      );
    });
    
    test('should resolve conflicts between Spocket and Square data', async () => {
      // Arrange
      const orderId = 'order-123';
      const spocketOrder = createMockSpocketOrder(orderId);
      const squareOrder = createMockSquareOrder('square-order-123');
      
      const conflict = {
        orderId,
        spocketId: orderId,
        squareId: 'square-order-123',
        type: 'fulfillment_status_mismatch',
        spocketValue: 'shipped',
        squareValue: 'COMPLETED',
        detectedAt: new Date().toISOString(),
      };
      
      mockRecoveryService.resolveConflicts.mockResolvedValue({
        success: true,
        resolution: 'spocket_to_square',
        message: 'Conflict resolved by updating Square',
      });
      
      // Act
      const result = await mockRecoveryService.resolveConflicts([conflict]);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.resolution).toBe('spocket_to_square');
      expect(mockOrderSyncService.syncFulfillmentStatus).toHaveBeenCalled();
    });
    
    test('should perform data consistency checks between systems', async () => {
      // Arrange
      const orderId = 'order-123';
      const spocketOrder = createMockSpocketOrder(orderId);
      const squareOrder = createMockSquareOrder('square-order-123');
      
      mockRecoveryService.checkDataConsistency.mockResolvedValue({
        success: true,
        consistent: false,
        inconsistencies: [
          {
            field: 'line_items.quantity',
            spocketValue: 1,
            squareValue: 2,
          },
        ],
      });
      
      // Act
      const result = await mockRecoveryService.checkDataConsistency(
        orderId,
        '

import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Import services
import { SpocketOrderService } from '../spocket/orderService';
import { SquareOrderService } from '../square/orderService';
import { OrderSyncService } from '../syncService';
import { OrderMapper } from '../mapper';
import { LogService } from '../../logging/logService';
import { ConfigService } from '../../config/configService';

// Types
import { SpocketOrder, SpocketOrderStatus } from '../spocket/types';
import { SquareOrder, SquareOrderState } from '../square/types';
import { SyncDirection } from '../types';

// Mock the axios instance
const mockAxios = new MockAdapter(axios);

// Mock config
const mockConfig = {
  spocket: {
    apiUrl: 'https://api.spocket.test',
    apiKey: 'test-spocket-api-key',
    webhookSecret: 'test-webhook-secret',
  },
  square: {
    apiUrl: 'https://connect.squareup.test',
    accessToken: 'test-square-access-token',
    locationId: 'test-location-id',
    webhookSignatureKey: 'test-signature-key',
  },
  sync: {
    pollIntervalMs: 1000,
    maxRetries: 3,
    retryDelayMs: 500,
  },
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Sample data
const sampleSpocketCustomer = {
  id: 'spkt_cust_123',
  name: 'Test Customer',
  email: 'test@example.com',
  phone: '+11234567890',
  address: {
    line1: '123 Test St',
    city: 'Test City',
    state: 'TS',
    postalCode: '12345',
    country: 'US',
  },
};

const sampleSpocketProduct = {
  id: 'spkt_prod_123',
  name: 'Test Product',
  description: 'A test product',
  price: 19.99,
  sku: 'TST-123456',
  inventoryQuantity: 100,
};

const sampleSpocketOrder: SpocketOrder = {
  id: 'spkt_ord_123',
  orderNumber: 'TEST-12345',
  customerId: sampleSpocketCustomer.id,
  status: SpocketOrderStatus.PENDING,
  totalAmount: 29.99,
  orderDate: new Date('2025-05-01T12:00:00Z'),
  lineItems: [
    {
      productId: sampleSpocketProduct.id,
      quantity: 1,
      pricePerItem: 19.99,
      name: sampleSpocketProduct.name,
      sku: sampleSpocketProduct.sku,
    },
  ],
  shippingAddress: {
    line1: '123 Test St',
    city: 'Test City',
    state: 'TS',
    postalCode: '12345',
    country: 'US',
  },
  note: 'Test order',
  metadata: {
    source: 'integration_test',
  },
};

const sampleSquareOrder: SquareOrder = {
  id: 'sq_ord_123',
  locationId: mockConfig.square.locationId,
  referenceId: 'TEST-12345',
  customerId: 'sq_cust_123',
  state: SquareOrderState.OPEN,
  createdAt: '2025-05-01T12:00:00Z',
  updatedAt: '2025-05-01T12:00:00Z',
  lineItems: [
    {
      uid: 'item_1',
      name: 'Test Product',
      quantity: '1',
      basePriceMoney: {
        amount: 1999,
        currency: 'USD',
      },
      variationName: 'Regular',
    },
  ],
  netAmounts: {
    totalMoney: {
      amount: 2999,
      currency: 'USD',
    },
    taxMoney: {
      amount: 0,
      currency: 'USD',
    },
    discountMoney: {
      amount: 0,
      currency: 'USD',
    },
    tipMoney: {
      amount: 0,
      currency: 'USD',
    },
    serviceMoney: {
      amount: 0,
      currency: 'USD',
    },
  },
  source: {
    name: 'Spocket',
  },
  metadata: {
    source_order_id: 'spkt_ord_123',
  },
};

// Setup services
let configService: ConfigService;
let logService: LogService;
let spocketOrderService: SpocketOrderService;
let squareOrderService: SquareOrderService;
let orderMapper: OrderMapper;
let orderSyncService: OrderSyncService;

describe('Spocket-Square Order Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();

    // Setup services with mocks
    configService = {
      get: jest.fn((key) => {
        const keys = key.split('.');
        let value = mockConfig;
        for (const k of keys) {
          if (value[k] === undefined) return undefined;
          value = value[k];
        }
        return value;
      }),
    } as any;

    logService = mockLogger as any;

    spocketOrderService = new SpocketOrderService(configService, logService);
    squareOrderService = new SquareOrderService(configService, logService);
    orderMapper = new OrderMapper(configService);
    orderSyncService = new OrderSyncService(
      configService,
      logService,
      spocketOrderService,
      squareOrderService,
      orderMapper
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Order Synchronization Flow', () => {
    it('should sync a new Spocket order to Square', async () => {
      // Mock Spocket API response for getting an order
      mockAxios
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}`)
        .reply(200, { data: sampleSpocketOrder });

      // Mock Square API response for creating an order
      mockAxios
        .onPost(`${mockConfig.square.apiUrl}/v2/orders`)
        .reply(200, { order: sampleSquareOrder });

      // Mock method to find matching Square order (should return none first, then the created one)
      jest.spyOn(squareOrderService, 'findOrderByReferenceId')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sampleSquareOrder);

      // Execute sync from Spocket to Square
      const result = await orderSyncService.syncOrder(sampleSpocketOrder.id, SyncDirection.SPOCKET_TO_SQUARE);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSpocketOrder.id);
      expect(result.targetOrderId).toBe(sampleSquareOrder.id);
      
      // Verify Square order creation was called
      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe(`${mockConfig.square.apiUrl}/v2/orders`);
      
      // Verify logger called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced order'),
        expect.any(Object)
      );
    });

    it('should sync a new Square order to Spocket', async () => {
      // Mock Square API response for getting an order
      mockAxios
        .onGet(`${mockConfig.square.apiUrl}/v2/orders/${sampleSquareOrder.id}`)
        .reply(200, { order: sampleSquareOrder });

      // Mock Spocket API response for creating an order
      mockAxios
        .onPost(`${mockConfig.spocket.apiUrl}/orders`)
        .reply(200, { data: sampleSpocketOrder });

      // Mock method to find matching Spocket order (should return none first, then the created one)
      jest.spyOn(spocketOrderService, 'findOrderByReferenceId')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(sampleSpocketOrder);

      // Execute sync from Square to Spocket
      const result = await orderSyncService.syncOrder(sampleSquareOrder.id, SyncDirection.SQUARE_TO_SPOCKET);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSquareOrder.id);
      expect(result.targetOrderId).toBe(sampleSpocketOrder.id);
      
      // Verify Spocket order creation was called
      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe(`${mockConfig.spocket.apiUrl}/orders`);
      
      // Verify logger called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced order'),
        expect.any(Object)
      );
    });

    it('should not create duplicate orders if one already exists', async () => {
      // Mock that a matching order already exists in Square
      jest.spyOn(squareOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(sampleSquareOrder);

      // Execute sync from Spocket to Square
      const result = await orderSyncService.syncOrder(sampleSpocketOrder.id, SyncDirection.SPOCKET_TO_SQUARE);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSpocketOrder.id);
      expect(result.targetOrderId).toBe(sampleSquareOrder.id);
      expect(result.alreadyExists).toBe(true);
      
      // Verify no order creation API call was made
      expect(mockAxios.history.post).toHaveLength(0);
      
      // Verify logger called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Order already exists'),
        expect.any(Object)
      );
    });
  });

  describe('Status Update Synchronization', () => {
    it('should sync status updates from Spocket to Square', async () => {
      // Create a modified order with a different status
      const updatedSpocketOrder = {
        ...sampleSpocketOrder,
        status: SpocketOrderStatus.SHIPPED,
      };

      // Mock Spocket API response for getting an order
      mockAxios
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}`)
        .reply(200, { data: updatedSpocketOrder });

      // Mock that a matching order already exists in Square
      jest.spyOn(squareOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(sampleSquareOrder);

      // Mock Square API response for updating an order
      mockAxios
        .onPost(`${mockConfig.square.apiUrl}/v2/orders/${sampleSquareOrder.id}`)
        .reply(200, { 
          order: {
            ...sampleSquareOrder,
            state: SquareOrderState.COMPLETED,
          }
        });

      // Execute sync from Spocket to Square
      const result = await orderSyncService.syncOrderStatus(
        sampleSpocketOrder.id, 
        updatedSpocketOrder.status,
        SyncDirection.SPOCKET_TO_SQUARE
      );

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSpocketOrder.id);
      expect(result.sourceStatus).toBe(updatedSpocketOrder.status);
      expect(result.targetOrderId).toBe(sampleSquareOrder.id);
      expect(result.targetStatus).toBe(SquareOrderState.COMPLETED);
      
      // Verify Square order update API call was made
      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe(
        `${mockConfig.square.apiUrl}/v2/orders/${sampleSquareOrder.id}`
      );
      
      // Verify logger called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced order status'),
        expect.any(Object)
      );
    });

    it('should sync status updates from Square to Spocket', async () => {
      // Create a modified order with a different status
      const updatedSquareOrder = {
        ...sampleSquareOrder,
        state: SquareOrderState.COMPLETED,
      };

      // Mock Square API response for getting an order
      mockAxios
        .onGet(`${mockConfig.square.apiUrl}/v2/orders/${sampleSquareOrder.id}`)
        .reply(200, { order: updatedSquareOrder });

      // Mock that a matching order already exists in Spocket
      jest.spyOn(spocketOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(sampleSpocketOrder);

      // Mock Spocket API response for updating an order
      mockAxios
        .onPatch(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}`)
        .reply(200, { 
          data: {
            ...sampleSpocketOrder,
            status: SpocketOrderStatus.COMPLETED,
          }
        });

      // Execute sync from Square to Spocket
      const result = await orderSyncService.syncOrderStatus(
        sampleSquareOrder.id, 
        updatedSquareOrder.state,
        SyncDirection.SQUARE_TO_SPOCKET
      );

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSquareOrder.id);
      expect(result.sourceStatus).toBe(updatedSquareOrder.state);
      expect(result.targetOrderId).toBe(sampleSpocketOrder.id);
      expect(result.targetStatus).toBe(SpocketOrderStatus.COMPLETED);
      
      // Verify Spocket order update API call was made
      expect(mockAxios.history.patch).toHaveLength(1);
      expect(mockAxios.history.patch[0].url).toBe(
        `${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}`
      );
      
      // Verify logger called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced order status'),
        expect.any(Object)
      );
    });
  });

  describe('Fulfillment Synchronization', () => {
    // Sample fulfillment data
    const sampleSpocketFulfillment = {
      id: 'spkt_ful_123',
      orderId: sampleSpocketOrder.id,
      trackingNumber: '1Z999AA10123456784',
      trackingUrl: 'https://example.com/track/1Z999AA10123456784',
      carrier: 'UPS',
      shippingDate: new Date('2025-05-05T12:00:00Z'),
      status: 'shipped',
      items: [
        {
          lineItemId: sampleSpocketOrder.lineItems[0].productId,
          quantity: 1,
        },
      ],
    };

    const sampleSquareFulfillment = {
      id: 'sq_ful_123',
      orderId: sampleSquareOrder.id,
      type: 'SHIPMENT',
      state: 'COMPLETED',
      createdAt: '2025-05-05T12:00:00Z',
      shipmentDetails: {
        recipient: {
          displayName: 'Test Customer',
          emailAddress: 'test@example.com',
          phoneNumber: '+11234567890',
          address: {
            addressLine1: '123 Test St',
            locality: 'Test City',
            administrativeDistrictLevel1: 'TS',
            postalCode: '12345',
            country: 'US',
          },
        },
        carrier: 'UPS',
        shippingNote: 'Test shipment',
        trackingNumber: '1Z999AA10123456784',
        trackingUrl: 'https://example.com/track/1Z999AA10123456784',
      },
    };

    it('should sync fulfillment details from Spocket to Square', async () => {
      // Mock Spocket API response for getting a fulfillment
      mockAxios
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}/fulfillments/${sampleSpocketFulfillment.id}`)
        .reply(200, { data: sampleSpocketFulfillment });

      // Mock Square API response for creating a fulfillment
      mockAxios
        .onPost(`${mockConfig.square.apiUrl}/v2/orders/${sampleSquareOrder.id}/fulfillments`)
        .reply(200, { fulfillment: sampleSquareFulfillment });

      // Mock method to find matching Square order 
      jest.spyOn(squareOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(sampleSquareOrder);

      // Execute sync fulfillment from Spocket to Square
      const result = await orderSyncService.syncFulfillment(
        sampleSpocketOrder.id,
        sampleSpocketFulfillment.id,
        SyncDirection.SPOCKET_TO_SQUARE
      );

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSpocketOrder.id);
      expect(result.sourceFulfillmentId).toBe(sampleSpocketFulfillment.id);
      expect(result.targetOrderId).toBe(sampleSquareOrder.id);
      expect(result.targetFulfillmentId).toBe(sampleSquareFulfillment.id);

      // Verify Square fulfillment creation was called
      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe(
        `${mockConfig.square.apiUrl}/v2/orders/${sampleSquareOrder.id}/fulfillments`
      );

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced fulfillment'),
        expect.any(Object)
      );
    });

    it('should sync fulfillment details from Square to Spocket', async () => {
      // Mock Square API response for getting a fulfillment
      mockAxios
        .onGet(`${mockConfig.square.apiUrl}/v2/orders/${sampleSquareOrder.id}/fulfillments/${sampleSquareFulfillment.id}`)
        .reply(200, { fulfillment: sampleSquareFulfillment });

      // Mock Spocket API response for creating a fulfillment
      mockAxios
        .onPost(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}/fulfillments`)
        .reply(200, { data: sampleSpocketFulfillment });

      // Mock method to find matching Spocket order 
      jest.spyOn(spocketOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(sampleSpocketOrder);

      // Execute sync fulfillment from Square to Spocket
      const result = await orderSyncService.syncFulfillment(
        sampleSquareOrder.id,
        sampleSquareFulfillment.id,
        SyncDirection.SQUARE_TO_SPOCKET
      );

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSquareOrder.id);
      expect(result.sourceFulfillmentId).toBe(sampleSquareFulfillment.id);
      expect(result.targetOrderId).toBe(sampleSpocketOrder.id);
      expect(result.targetFulfillmentId).toBe(sampleSpocketFulfillment.id);

      // Verify Spocket fulfillment creation was called
      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe(
        `${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}/fulfillments`
      );

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced fulfillment'),
        expect.any(Object)
      );
    });

    it('should not create duplicate fulfillments if one already exists', async () => {
      // Mock Spocket API response for getting a fulfillment
      mockAxios
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}/fulfillments/${sampleSpocketFulfillment.id}`)
        .reply(200, { data: sampleSpocketFulfillment });

      // Mock method to find matching Square order
      jest.spyOn(squareOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(sampleSquareOrder);

      // Mock that a matching fulfillment already exists
      jest.spyOn(squareOrderService, 'findFulfillmentByTrackingNumber')
        .mockResolvedValue(sampleSquareFulfillment);

      // Execute sync fulfillment from Spocket to Square
      const result = await orderSyncService.syncFulfillment(
        sampleSpocketOrder.id,
        sampleSpocketFulfillment.id,
        SyncDirection.SPOCKET_TO_SQUARE
      );

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSpocketOrder.id);
      expect(result.sourceFulfillmentId).toBe(sampleSpocketFulfillment.id);
      expect(result.targetOrderId).toBe(sampleSquareOrder.id);
      expect(result.targetFulfillmentId).toBe(sampleSquareFulfillment.id);
      expect(result.alreadyExists).toBe(true);

      // Verify no fulfillment creation API call was made
      expect(mockAxios.history.post).toHaveLength(0);

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Fulfillment already exists'),
        expect.any(Object)
      );
    });
  });

  describe('Payment Synchronization', () => {
    // Sample payment data
    const sampleSpocketPayment = {
      id: 'spkt_pay_123',
      orderId: sampleSpocketOrder.id,
      amount: 29.99,
      currency: 'USD',
      status: 'completed',
      paymentMethod: 'credit_card',
      paymentDate: new Date('2025-05-02T12:00:00Z'),
      metadata: {
        transactionId: 'card_123456',
      },
    };

    const sampleSquarePayment = {
      id: 'sq_pay_123',
      orderId: sampleSquareOrder.id,
      amountMoney: {
        amount: 2999,
        currency: 'USD',
      },
      status: 'COMPLETED',
      sourceType: 'CARD',
      cardDetails: {
        status: 'CAPTURED',
        card: {
          cardBrand: 'VISA',
          last4: '1234',
        },
      },
      createdAt: '2025-05-02T12:00:00Z',
      receiptNumber: 'Rcpt123',
      locationId: mockConfig.square.locationId,
    };

    it('should sync payment details from Spocket to Square', async () => {
      // Mock Spocket API response for getting a payment
      mockAxios
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}/payments/${sampleSpocketPayment.id}`)
        .reply(200, { data: sampleSpocketPayment });

      // Mock Square API response for creating a payment
      mockAxios
        .onPost(`${mockConfig.square.apiUrl}/v2/payments`)
        .reply(200, { payment: sampleSquarePayment });

      // Mock method to find matching Square order
      jest.spyOn(squareOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(sampleSquareOrder);

      // Execute sync payment from Spocket to Square
      const result = await orderSyncService.syncPayment(
        sampleSpocketOrder.id,
        sampleSpocketPayment.id,
        SyncDirection.SPOCKET_TO_SQUARE
      );

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSpocketOrder.id);
      expect(result.sourcePaymentId).toBe(sampleSpocketPayment.id);
      expect(result.targetOrderId).toBe(sampleSquareOrder.id);
      expect(result.targetPaymentId).toBe(sampleSquarePayment.id);

      // Verify Square payment creation was called
      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe(
        `${mockConfig.square.apiUrl}/v2/payments`
      );

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced payment'),
        expect.any(Object)
      );
    });

    it('should sync payment details from Square to Spocket', async () => {
      // Mock Square API response for getting a payment
      mockAxios
        .onGet(`${mockConfig.square.apiUrl}/v2/payments/${sampleSquarePayment.id}`)
        .reply(200, { payment: sampleSquarePayment });

      // Mock Spocket API response for creating a payment
      mockAxios
        .onPost(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}/payments`)
        .reply(200, { data: sampleSpocketPayment });

      // Mock method to find matching Spocket order
      jest.spyOn(spocketOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(sampleSpocketOrder);

      // Execute sync payment from Square to Spocket
      const result = await orderSyncService.syncPayment(
        sampleSquareOrder.id,
        sampleSquarePayment.id,
        SyncDirection.SQUARE_TO_SPOCKET
      );

      // Verify results
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSquareOrder.id);
      expect(result.sourcePaymentId).toBe(sampleSquarePayment.id);
      expect(result.targetOrderId).toBe(sampleSpocketOrder.id);
      expect(result.targetPaymentId).toBe(sampleSpocketPayment.id);

      // Verify Spocket payment creation was called
      expect(mockAxios.history.post).toHaveLength(1);
      expect(mockAxios.history.post[0].url).toBe(
        `${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}/payments`
      );

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced payment'),
        expect.any(Object)
      );
    });
  });

  describe('Error Handling', () => {
    // Setup test timer for timeout tests
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should handle API error responses gracefully', async () => {
      // Mock Spocket API response with an error
      mockAxios
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}`)
        .reply(404, { error: 'Order not found' });

      // Execute sync from Spocket to Square
      const result = await orderSyncService.syncOrder(sampleSpocketOrder.id, SyncDirection.SPOCKET_TO_SQUARE);

      // Verify results indicate failure
      expect(result.success).toBe(false);
      expect(result.sourceOrderId).toBe(sampleSpocketOrder.id);
      expect(result.error).toContain('Order not found');
      
      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sync order'),
        expect.objectContaining({
          orderId: sampleSpocketOrder.id,
          error: expect.any(String)
        })
      );
    });

    it('should handle network timeouts with retry mechanism', async () => {
      // Mock network timeout then success
      mockAxios
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}`)
        .replyOnce(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), 3000);
          });
        })
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}`)
        .replyOnce(200, { data: sampleSpocketOrder });

      // Mock Square API response for creating an order
      mockAxios
        .onPost(`${mockConfig.square.apiUrl}/v2/orders`)
        .reply(200, { order: sampleSquareOrder });

      // Mock method to find matching Square order
      jest.spyOn(squareOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(null);

      // Start the sync operation but don't await it yet
      const syncPromise = orderSyncService.syncOrder(sampleSpocketOrder.id, SyncDirection.SPOCKET_TO_SQUARE);
      
      // Advance timers to trigger timeout
      jest.advanceTimersByTime(3500);
      
      // Advance timers for retry delay
      jest.advanceTimersByTime(mockConfig.sync.retryDelayMs);
      
      // Now await the result
      const result = await syncPromise;

      // Verify results indicate success after retry
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSpocketOrder.id);
      expect(result.targetOrderId).toBe(sampleSquareOrder.id);
      expect(result.retryCount).toBe(1);
      
      // Verify warning was logged about retry
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Retrying after error'),
        expect.any(Object)
      );
    });

    it('should handle rate limiting by implementing backoff strategy', async () => {
      // Mock rate limit error then success
      mockAxios
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}`)
        .replyOnce(429, { error: 'Rate limit exceeded' })
        .onGet(`${mockConfig.spocket.apiUrl}/orders/${sampleSpocketOrder.id}`)
        .replyOnce(200, { data: sampleSpocketOrder });

      // Mock Square API response for creating an order
      mockAxios
        .onPost(`${mockConfig.square.apiUrl}/v2/orders`)
        .reply(200, { order: sampleSquareOrder });

      // Mock method to find matching Square order
      jest.spyOn(squareOrderService, 'findOrderByReferenceId')
        .mockResolvedValue(null);

      // Execute sync from Spocket to Square
      const result = await orderSyncService.syncOrder(sampleSpocketOrder.id, SyncDirection.SPOCKET_TO_SQUARE);

      // Verify results indicate success after rate limit retry
      expect(result.success).toBe(true);
      expect(result.sourceOrderId).toBe(sampleSpocketOrder.id);
      expect(result.targetOrderId).toBe(sampleSquareOrder.id);
      expect(result.retryCount).toBe(1);
      
      // Verify warning was logged about rate limiting
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded'),
        expect.any(Object)
      );
    });

    it('should handle invalid data by validating before processing', async () => {
      // Create an invalid order missing required fields
      const invalidSpocketOrder = {
        id: 'spkt_ord_invalid',
        // Missing crucial fields like orderNumber, totalAmount, etc.
      };

      // Mock Spocket API response with invalid data
      mockAxios
        .onGet(`${mockConfig.spocket.apiUrl}/orders/spkt_ord_invalid`)
        .reply(200, { data: invalidSpocketOrder });

      // Execute sync with invalid data
      const result = await orderSyncService.syncOrder('spkt_ord_invalid', SyncDirection.SPOCKET_TO_SQUARE);

      // Verify results indicate validation failure
      expect(result.success).toBe(false);
      expect(result.sourceOrderId).toBe('spkt_ord_invalid');
      expect(result.error).toContain('Validation failed');
      
      // Verify validation error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed'),
        expect.objectContaining({
          orderId: 'spkt_ord_invalid',
          error: expect.any(String)
        })
      );
      
      // Verify no attempt was made to create an order in Square
      expect(mockAxios.history.post).toHaveLength(0);
    });
  });

  describe('Webhook Handling', () => {
    // Sample webhook payloads
    const sampleSpocketOrderWebhook = {
      event: 'order.status_updated',
      data: {
        order_id: sampleSpocketOrder.id,
        status: SpocketOrderStatus.SHIPPED,
        previous_status: SpocketOrderStatus.PENDING,
        updated_at: '2025-05-06T14:30:00Z'
      },
      timestamp: '2025-05-06T14:30:00Z',
      webhook_id: 'spkt_wh_123'
    };

    const sampleSquareOrderWebhook = {
      merchant_id: 'merchant_123',
      type: 'order.updated',
      event_id: 'sq_wh_123',
      data: {
        type: 'order',
        id: sampleSquareOrder.id,
        object: {
          order_id: sampleSquareOrder.id,
          state: SquareOrderState.COMPLETED,
          version: 2,
          updated_at: '2025-05-06T14:30:00Z'
        }
      },
      created_at: '2025-05-06T14:30:00Z'
    };

    const sampleSpocketFulfillmentWebhook = {
      event: 'order.fulfillment_created',
      data: {
        order_id: sampleSpocketOrder.id,
        fulfillment_id: 'spkt_ful_123',
        tracking_number: '1Z999AA10123456784',
        carrier: 'UPS',
        created_at: '2025-05-06T14:30:00Z'
      },
      timestamp: '2025-05-06T14:30:00Z',
      webhook_id: 'spkt_wh_456'
    };

    const sampleSquareFulfillmentWebhook = {
      merchant_id: 'merchant_123',
      type: 'order.fulfillment.updated',
      event_id: 'sq_wh_456',
      data: {
        type: 'fulfillment',
        id: 'sq_ful_123',
        object: {
          fulfillment_id: 'sq_ful_123',
          order_id: sampleSquareOrder.id,
          state: 'COMPLETED',
          tracking_number: '1Z999AA10123456784',
          updated_at: '2025-05-06T14:30:00Z'
        }
      },
      created_at: '2025-05-06T14:30:00Z'
    };

    const sampleSpocketPaymentWebhook = {
      event: 'order.payment_completed',
      data: {
        order_id: sampleSpocketOrder.id,
        payment_id: 'spkt_pay_123',
        amount: 29.99,
        currency: 'USD',
        completed_at: '2025-05-06T14:30:00Z'
      },
      timestamp: '2025-05-06T14:30:00Z',
      webhook_id: 'spkt_wh_789'
    };

    const sampleSquarePaymentWebhook = {
      merchant_id: 'merchant_123',
      type: 'payment.updated',
      event_id: 'sq_wh_789',
      data: {
        type: 'payment',
        id: 'sq_pay_123',
        object: {
          payment_id: 'sq_pay_123',
          order_id: sampleSquareOrder.id,
          status: 'COMPLETED',
          amount_money: {
            amount: 2999,
            currency: 'USD'
          },
          updated_at: '2025-05-06T14:30:00Z'
        }
      },
      created_at: '2025-05-06T14:30:00Z'
    };

    it('should process order status webhooks from Spocket', async () => {
      // Create spy on syncOrderStatus method
      const syncOrderStatusSpy = jest.spyOn(orderSyncService, 'syncOrderStatus')
        .mockResolvedValue({
          success: true,
          sourceOrderId: sampleSpocketOrder.id,
          sourceStatus: SpocketOrderStatus.SHIPPED,
          targetOrderId: sampleSquareOrder.id,
          targetStatus: SquareOrderState.COMPLETED
        });

      // Mock webhook verification
      jest.spyOn(spocketOrderService, 'verifyWebhookSignature').mockReturnValue(true);

      // Process webhook
      const result = await orderSyncService.processSpocketWebhook(
        sampleSpocketOrderWebhook,
        'valid-signature-header'
      );

      // Verify results
      expect(result.success).toBe(true);
      expect(result.event).toBe('order.status_updated');
      expect(result.orderId).toBe(sampleSpocketOrder.id);
      
      // Verify syncOrderStatus was called with correct parameters
      expect(syncOrderStatusSpy).toHaveBeenCalledWith(
        sampleSpocketOrder.id,
        SpocketOrderStatus.SHIPPED,
        SyncDirection.SPOCKET_TO_SQUARE
      );
      
      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processed Spocket webhook'),
        expect.any(Object)
      );
    });

    it('should process fulfillment webhooks from Square', async () => {
      // Create spy on syncFulfillment method
      const syncFulfillmentSpy = jest.spyOn(orderSyncService, 'syncFulfillment')
        .mockResolvedValue({
          success: true,
          sourceOrderId: sampleSquareOrder.id,
          sourceFulfillmentId: 'sq_ful_123',
          targetOrderId: sampleSpocketOrder.id,
          targetFulfillmentId: 'spkt_ful_123'
        });

      // Mock webhook verification
      jest.spyOn(squareOrderService,
