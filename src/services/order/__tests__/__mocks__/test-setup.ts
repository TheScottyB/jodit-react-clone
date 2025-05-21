import { jest } from '@jest/globals';
import {
  createMockSquareHandler,
  createMockSpocketHandler,
  createMockOrderMapper,
  createMockLogger
} from './services.mock';

export const setupTestEnvironment = () => {
  const mockSquareHandler = createMockSquareHandler();
  const mockSpocketHandler = createMockSpocketHandler();
  const mockOrderMapper = createMockOrderMapper();
  const mockLogger = createMockLogger();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockSquareHandler.extractSpocketReferenceFromSquareOrder.mockReturnValue('spkt_123');
    mockSquareHandler.updateSquareOrderPayment.mockResolvedValue(undefined);
    mockSquareHandler.findOrderByReferenceId.mockResolvedValue(null);
    mockSquareHandler.verifyWebhookSignature.mockReturnValue(true);

    mockSpocketHandler.extractSquareReferenceFromSpocketOrder.mockReturnValue('sq_123');
    mockSpocketHandler.updateSpocketOrderPayment.mockResolvedValue(undefined);
    mockSpocketHandler.findOrderByReferenceId.mockResolvedValue(null);
    mockSpocketHandler.verifyWebhookSignature.mockReturnValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  return {
    mockSquareHandler,
    mockSpocketHandler,
    mockOrderMapper,
    mockLogger
  };
};
