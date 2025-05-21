import { jest } from '@jest/globals';
import axios from 'axios';
import winston from 'winston';

// Import types
import { SpocketOrder, SpocketOrderStatus } from '../../spocket/types';
import { SquareOrder, SquareOrderState } from '../../square/types';
import { SyncDirection } from '../../types';

// Import actual services we're testing
import { OrderSyncService } from '../../order-sync.service';

// Import axios mock helpers
import { 
  setupAxiosMock, 
  resetAxiosMock, 
  restoreAxiosMock, 
  mockAxios, 
  mockGet, 
  mockPost, 
  mockPut,
  mockPatch,
  mockDelete,
  mockError,
  mockTimeout,
  mockRateLimit 
} from '../../../../__tests__/setup/axios-mock';

// =============================================================================
// Mock Configuration
// =============================================================================

// Mock logger that can be used across tests
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

// Standard config object used across tests
export const mockConfig = {
  spocket: {
    apiUrl: 'https://api.spocket.com/v1',
    apiKey: 'spocket-api-key',
    webhookSecret: 'spocket-webhook-secret',
  },
  square: {
    apiUrl: 'https://connect.squareup.com/v2',
    accessToken: 'square-access-token',
    location: 'location-id',
    locationId: 'location-id',
    webhookSignatureKey: 'square-signature-key',
  },
  sync: {
    maxRetries: 3,
    retryDelay: 1000,
    retryDelayMs: 500,
    batchSize: 10,
    pollIntervalMs: 1000,
  },
};

// =============================================================================
// Mock Service Implementations
// =============================================================================

// Mock service implementations that can be used across tests
export const createMockOrderSyncService = () => ({
  syncOrderFromSpocketToSquare: jest.fn(),
  syncOrderFromSquareToSpocket: jest.fn(),
  syncFulfillmentStatus: jest.fn(),
  syncPaymentStatus: jest.fn(),
  handlePartialSync: jest.fn(),
  retryFailedSync: jest.fn(),
  resolveConflicts: jest.fn(),
  validateDataConsistency: jest.fn(),
  reconcileState: jest.fn(),
});

export const createMockWebhookHandler = () => ({
  verifySpocketSignature: jest.fn(),
  verifySquareSignature: jest.fn(),
  processSpocketWebhook: jest.fn(),
  processSquareWebhook: jest.fn(),
});

export const createMockRecoveryService = () => ({
  recoverPartialSync: jest.fn(),
  retryFailedOperations: jest.fn(),
  resolveConflicts: jest.fn(),
  checkDataConsistency: jest.fn(),
  reconcileState: jest.fn(),
});

// Create mock configuration service
export const createConfigService = () => ({
  get: jest.fn((key) => {
    const keys = key.split('.');
    let value = mockConfig;
    for (const k of keys) {
      if (value[k] === undefined) return undefined;
      value = value[k];
    }
    return value;
  }),
});

// Create mock order services
export const createSpocketOrderService = () => ({
  findOrderByReferenceId: jest.fn(),
  verifyWebhookSignature: jest.fn().mockReturnValue(true)
});

export const createSquareOrderService = () => ({
  findOrderByReferenceId: jest.fn(),
  findFulfillmentByTrackingNumber: jest.fn(),
  verifyWebhookSignature: jest.fn().mockReturnValue(true)
});

export const createOrderMapper = () => ({
  mapSpocketToSquare: jest.fn(),
  mapSquareToSpocket: jest.fn()
});

// =============================================================================
// Sample Data Factories
// =============================================================================

// Helper functions for creating test data
export const createMockSpocketOrder = (id: string) => ({
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

export const createMockSquareOrder = (id: string) => ({
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

// Sample customer data
export const sampleSpocketCustomer = {
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

// Sample product data
export const sampleSpocketProduct = {
  id: 'spkt_prod_123',
  name: 'Test Product',
  description: 'A test product',
  price: 19.99,
  sku: 'TST-123456',
  inventoryQuantity: 100,
};

// Sample Spocket order data
export const sampleSpocketOrder: SpocketOrder = {
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

// Sample Square order data
export const sampleSquareOrder: SquareOrder = {
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
    source_order_id: 'spkt_ord_123'
  }
};

// Webhook sample data
export const sampleSpocketOrderWebhook = {
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

export const sampleSquareOrderWebhook = {
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

export const sampleSpocketFulfillmentWebhook = {
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

export const sampleSquareFulfillmentWebhook = {
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

export const sampleSpocketPaymentWebhook = {
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

export const sampleSquarePaymentWebhook = {
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

// =============================================================================
// Test Setup and Teardown Functions
// =============================================================================

// Setup function to initialize test environment
export const setupTests = () => {
  // Reset all Jest mocks
  jest.clearAllMocks();
  
  // Initialize a fresh MockAdapter for axios
  setupAxiosMock();
  
  return {
    mockOrderSyncService: createMockOrderSyncService(),
    mockWebhookHandler: createMockWebhookHandler(),
    mockRecoveryService: createMockRecoveryService(),
    configService: createConfigService(),
    logService: mockLogger,
    spocketOrderService: createSpocketOrderService(),
    squareOrderService: createSquareOrderService(),
    orderMapper: createOrderMapper(),
  };
};

// Function to create a real OrderSyncService with mock dependencies
export const createOrderSyncService = () => {
  const configService = createConfigService();
  const logService = mockLogger;
  const spocketOrderService = createSpocketOrderService();
  const squareOrderService = createSquareOrderService();
  const orderMapper = createOrderMapper();
  
  return new OrderSyncService(
    configService,
    logService,
    spocketOrderService,
    squareOrderService,
    orderMapper
  );
};

// Cleanup after tests
export const cleanupTests = () => {
  // Clean up the axios mock
  resetAxiosMock();
  
  // Reset all Jest mocks
  jest.resetAllMocks();
};

// Final cleanup after all tests complete
export const finalCleanup = () => {
  restoreAxiosMock();
};

// Export all axios mock helpers for direct use in tests
export {
  setupAxiosMock,
  resetAxiosMock,
  restoreAxiosMock,
  mockAxios,
  mockGet,
  mockPost,
  mockPut,
  mockPatch,
  mockDelete,
  mockError,
  mockTimeout,
  mockRateLimit
};

