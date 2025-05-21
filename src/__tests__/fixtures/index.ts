import { SpocketOrder, SpocketOrderStatus } from '../../services/order/spocket/types';
import { SquareOrder, SquareOrderState } from '../../services/order/square/types';

/**
 * Test configuration
 */
export const mockConfig = {
  spocket: {
    apiUrl: 'https://api.spocket.com/v1',
    apiKey: 'test-spocket-key',
    webhookSecret: 'test-webhook-secret',
  },
  square: {
    apiUrl: 'https://connect.squareup.com/v2',
    accessToken: 'test-square-token',
    locationId: 'test-location',
    webhookSignatureKey: 'test-signature-key',
  },
  sync: {
    maxRetries: 3,
    retryDelay: 1000,
    batchSize: 10,
    pollIntervalMs: 1000,
  },
};

/**
 * Mock logger for testing
 */
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

/**
 * Create a sample Spocket order for testing
 */
export const createSpocketOrder = (id: string, status = SpocketOrderStatus.PENDING): SpocketOrder => ({
  id,
  orderNumber: `TEST-${id}`,
  customerId: `cust-${id}`,
  status,
  totalAmount: 29.99,
  orderDate: new Date('2025-05-01T12:00:00Z'),
  lineItems: [
    {
      productId: 'prod-1',
      quantity: 1,
      pricePerItem: 19.99,
      name: 'Test Product',
      sku: 'TST-123',
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
    source: 'test',
  },
});

/**
 * Create a sample Square order for testing
 */
export const createSquareOrder = (id: string, state = SquareOrderState.OPEN): SquareOrder => ({
  id,
  locationId: mockConfig.square.locationId,
  referenceId: `ref-${id}`,
  state,
  createdAt: '2025-05-01T12:00:00Z',
  updatedAt: '2025-05-01T12:00:00Z',
  lineItems: [
    {
      uid: 'item-1',
      name: 'Test Product',
      quantity: '1',
      basePriceMoney: {
        amount: 1999,
        currency: 'USD',
      },
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
    name: 'Test',
  },
});

/**
 * Create a sample webhook event
 */
export const createWebhookEvent = (type: string, data: any) => ({
  type,
  data,
  timestamp: new Date().toISOString(),
  webhook_id: 'test-webhook',
});

/**
 * Sample error responses
 */
export const errorResponses = {
  notFound: {
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
  },
  rateLimit: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      retryAfter: 60,
    },
  },
  validation: {
    error: {
      code: 'INVALID_REQUEST',
      message: 'Invalid request data',
      details: [
        {
          field: 'status',
          message: 'Invalid status value',
        },
      ],
    },
  },
};

/**
 * Mock service responses
 */
export const mockResponses = {
  spocket: {
    order: createSpocketOrder('test-order'),
    orderList: Array.from({ length: 5 }, (_, i) => createSpocketOrder(`test-order-${i}`)),
  },
  square: {
    order: createSquareOrder('test-order'),
    orderList: Array.from({ length: 5 }, (_, i) => createSquareOrder(`test-order-${i}`)),
  },
};

/**
 * Test utilities
 */
export const testUtils = {
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  createMockAxiosResponse: (data: any, status = 200) => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {},
  }),
};

