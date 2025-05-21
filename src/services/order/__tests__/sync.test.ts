import { jest } from '@jest/globals';
import {
  createMockSquareHandler,
  createMockSpocketHandler,
  createMockOrderMapper,
  createMockLogger,
  createMockConfig
} from './mocks/services.mock';

describe('Order Sync Handler', () => {
  const mockSquareHandler = createMockSquareHandler();
  const mockSpocketHandler = createMockSpocketHandler();
  const mockOrderMapper = createMockOrderMapper();
  const mockLogger = createMockLogger();
  const mockConfig = createMockConfig();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Order Mapping', () => {
    it('should map orders correctly between platforms', async () => {
      // Arrange
      const spocketOrder = {
        id: 'spkt_123',
        referenceId: 'sq_123',
        status: 'pending'
      };

      // Act
      const result = await mockOrderMapper.mapSpocketToSquare(spocketOrder);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('sq_123');
      expect(result.sourceId).toBe('spkt_123');
      expect(result.status).toBe('mapped');
    });
  });

  describe('Webhook Processing', () => {
    it('should process webhooks correctly', async () => {
      // Arrange
      const webhookEvent = {
        type: 'order.created',
        data: { orderId: 'test_123' }
      };

      // Act
      const result = await mockSquareHandler.processWebhook(webhookEvent);

      // Assert
      expect(result.success).toBe(true);
      expect(result.eventType).toBe('order.created');
      expect(result.orderId).toBe('test_123');
    });
  });
});
