/**
 * Rate limiter for order service API calls
 */
import Bottleneck from 'bottleneck';
import { createLogger } from '../common/logger';
import { createSpocketRateLimiter as commonSpocketLimiter, createSquareRateLimiter as commonSquareLimiter } from '../common/rate-limiter';

// Configure logger
const logger = createLogger('order-rate-limiter');

/**
 * Create a rate limiter for Spocket API with order-specific configuration
 * @returns Configured Bottleneck instance
 */
export function createSpocketRateLimiter(): Bottleneck {
  const limiter = commonSpocketLimiter();
  
  // Add order-specific configuration or event handlers
  limiter.on('error', (error) => {
    logger.error('Spocket rate limiter error', { error });
  });
  
  limiter.on('depleted', () => {
    logger.warn('Spocket rate limit depleted, requests will be delayed');
  });
  
  return limiter;
}

/**
 * Create a rate limiter for Square API with order-specific configuration
 * @returns Configured Bottleneck instance
 */
export function createSquareRateLimiter(): Bottleneck {
  const limiter = commonSquareLimiter();
  
  // Add order-specific configuration or event handlers
  limiter.on('error', (error) => {
    logger.error('Square rate limiter error', { error });
  });
  
  limiter.on('depleted', () => {
    logger.warn('Square rate limit depleted, requests will be delayed');
  });
  
  return limiter;
}

/**
 * Retry function with exponential backoff for API calls
 * @param fn - Function to retry
 * @param retries - Number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of the function call
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries === 0) {
      throw error;
    }
    
    const delay = baseDelay * Math.pow(2, 3 - retries);
    logger.info(`Retrying after ${delay}ms. Retries left: ${retries-1}`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, baseDelay);
  }
}

