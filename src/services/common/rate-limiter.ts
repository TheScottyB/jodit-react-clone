/**
 * Rate limiter configuration for API calls
 */
import Bottleneck from 'bottleneck';
import { logger } from './logger';

/**
 * Create a rate limiter for Spocket API
 * @returns Configured Bottleneck instance
 */
export function createSpocketRateLimiter(): Bottleneck {
  const rateLimit = parseInt(process.env.SPOCKET_RATE_LIMIT || '60', 10);
  
  logger.info(`Creating Spocket rate limiter with ${rateLimit} requests per minute`);
  
  return new Bottleneck({
    maxConcurrent: 1,
    minTime: 60000 / rateLimit // Distribute requests evenly
  });
}

/**
 * Create a rate limiter for Square API
 * @returns Configured Bottleneck instance
 */
export function createSquareRateLimiter(): Bottleneck {
  const rateLimit = parseInt(process.env.SQUARE_RATE_LIMIT || '120', 10);
  
  logger.info(`Creating Square rate limiter with ${rateLimit} requests per minute`);
  
  return new Bottleneck({
    maxConcurrent: 2,
    minTime: 60000 / rateLimit // Distribute requests evenly
  });
}

/**
 * Create a general purpose rate limiter
 * @param requestsPerMinute - Number of requests allowed per minute
 * @param maxConcurrent - Maximum number of concurrent requests
 * @returns Configured Bottleneck instance
 */
export function createRateLimiter(
  requestsPerMinute: number = 60,
  maxConcurrent: number = 1
): Bottleneck {
  return new Bottleneck({
    maxConcurrent,
    minTime: 60000 / requestsPerMinute
  });
}

