/**
 * Jest setup file for Spocket-Square integration tests
 */

// Set the test environment
process.env.NODE_ENV = 'test';
process.env.SPOCKET_API_KEY = 'test_spocket_api_key';
process.env.SPOCKET_API_SECRET = 'test_spocket_api_secret';
process.env.SQUARE_ACCESS_TOKEN = 'test_square_access_token';
process.env.SQUARE_ENVIRONMENT = 'sandbox';
process.env.SPOCKET_API_BASE_URL = 'https://test-api.spocket.co';

// Add a dummy test so Jest doesn't complain about empty test suite
test('test environment setup', () => {
  expect(process.env.NODE_ENV).toBe('test');
});


// Mock external dependencies
jest.mock('winston', () => ({
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  transports: {
    Console: jest.fn(),
  },
}));

// Mock UUID for consistent test results
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Mock Bottleneck for rate limiting
jest.mock('bottleneck', () => {
  return jest.fn().mockImplementation(() => ({
    schedule: jest.fn((fn) => fn()),
  }));
});

// Mock Square Web SDK
jest.mock('@square/web-sdk', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      catalogApi: {
        batchUpsertCatalogObjects: jest.fn(() => Promise.resolve({ 
          objects: [
            {
              type: 'ITEM',
              id: 'sq_item_1',
              updated_at: new Date().toISOString(),
              version: 1,
              is_deleted: false,
              present_at_all_locations: true,
              item_data: {
                name: 'Test Product',
                description: 'A test product',
                available_online: true
              }
            }
          ] 
        })),
        listCatalog: jest.fn(() => Promise.resolve({ 
          objects: [
            {
              type: 'ITEM',
              id: 'sq_item_1',
              updated_at: new Date().toISOString(),
              version: 1,
              is_deleted: false,
              present_at_all_locations: true,
              item_data: {
                name: 'Test Product',
                description: 'A test product',
                available_online: true
              }
            }
          ] 
        })),
      },
      inventoryApi: {
        batchChangeInventory: jest.fn(() => Promise.resolve({ counts: [] })),
        retrieveInventoryCount: jest.fn(() => Promise.resolve({ counts: [] })),
      },
      ordersApi: {
        searchOrders: jest.fn(() => Promise.resolve({ orders: [] })),
        retrieveOrder: jest.fn(() => Promise.resolve({ order: null })),
      },
    })),
    Environment: {
      Sandbox: 'sandbox',
      Production: 'production',
    },
    ApiError: class extends Error {
      statusCode: number;
      
      constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ApiError';
      }
    }
  };
});

// Mock axios for Spocket API calls
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(() => Promise.resolve({ 
      data: { 
        data: [
          {
            id: 'spkt_123',
            title: 'Test Spocket Product',
            description: 'A test product from Spocket',
            sku: 'TSP001',
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
            tags: ['test'],
            weight: 0.5,
            weight_unit: 'kg',
            shipping_origin_country: 'US',
            processing_time: '1-3 days',
            categories: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ] 
      } 
    })),
    post: jest.fn(() => Promise.resolve({ 
      data: { 
        id: 'spkt_123',
        title: 'Test Spocket Product',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } 
    })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  put: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
  isAxiosError: jest.fn(() => true),
}));

// Mock the authentication services
jest.mock('../services/auth/spocket-auth.service', () => ({
  spocketAuthService: {
    getAccessToken: jest.fn(() => Promise.resolve('test-access-token')),
    refreshTokenIfNeeded: jest.fn(() => Promise.resolve()),
    isTokenValid: jest.fn(() => true),
    getAuthState: jest.fn(() => ({
      isAuthenticated: true,
      token: {
        accessToken: 'test-access-token',
        expiresAt: new Date(Date.now() + 3600000)
      },
      lastUpdated: new Date()
    }))
  }
}));

// Mock the config service
jest.mock('../services/config/config.service', () => ({
  configService: {
    getEnv: jest.fn((key, required) => {
      const values: Record<string, string> = {
        SPOCKET_API_KEY: 'test_spocket_api_key',
        SPOCKET_API_SECRET: 'test_spocket_api_secret',
        SQUARE_ACCESS_TOKEN: 'test_square_access_token',
        SQUARE_ENVIRONMENT: 'sandbox',
        SPOCKET_API_BASE_URL: 'https://test-api.spocket.co'
      };
      return values[key];
    }),
    getSpocketApiKey: jest.fn(() => 'test_spocket_api_key'),
    getSpocketApiSecret: jest.fn(() => 'test_spocket_api_secret'),
    getSquareAccessToken: jest.fn(() => 'test_square_access_token'),
    getSquareRefreshToken: jest.fn(() => 'test_square_refresh_token'),
    getSquareEnvironment: jest.fn(() => 'sandbox')
  }
}));

// Global Jest settings
jest.setTimeout(30000); // Increase timeout for sync operations

// Global test utilities
global.waitForExpect = async (expectation: () => void, timeout = 5000, interval = 100) => {
  const startTime = Date.now();
  let lastError: any;

  while (Date.now() - startTime < timeout) {
    try {
      expectation();
      return;
    } catch (err) {
      lastError = err;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw lastError;
};

