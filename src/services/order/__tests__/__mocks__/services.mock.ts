import { jest } from '@jest/globals';

export const createMockSquareHandler = () => ({
  extractSpocketReferenceFromSquareOrder: jest.fn(),
  updateSquareOrderPayment: jest.fn(),
  findOrderByReferenceId: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  processWebhook: jest.fn().mockImplementation(async (event) => ({
    success: true,
    eventType: event.type,
    orderId: event.data?.orderId || 'test_123'
  }))
});

export const createMockSpocketHandler = () => ({
  extractSquareReferenceFromSpocketOrder: jest.fn(),
  updateSpocketOrderPayment: jest.fn(),
  findOrderByReferenceId: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  processWebhook: jest.fn().mockImplementation(async (event) => ({
    success: true,
    eventType: event.event,
    orderId: event.data?.order_id || 'test_123'
  }))
});

export const createMockOrderMapper = () => ({
  mapSpocketToSquare: jest.fn().mockImplementation((order) => ({
    id: order.referenceId,
    sourceId: order.id,
    status: 'mapped'
  })),
  mapSquareToSpocket: jest.fn().mockImplementation((order) => ({
    id: order.referenceId,
    sourceId: order.id,
    status: 'mapped'
  }))
});

export const createMockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
});

export const createMockConfig = () => ({
  get: jest.fn().mockImplementation((key) => {
    const config = {
      spocket: {
        apiUrl: 'https://api.spocket.test',
        apiKey: 'test-key'
      },
      square: {
        apiUrl: 'https://api.square.test',
        accessToken: 'test-token'
      }
    };
    return key.split('.').reduce((obj, k) => obj?.[k], config);
  })
});
