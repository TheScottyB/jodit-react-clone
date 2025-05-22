import { AxiosError } from 'axios';

/**
 * Error response from API
 */
export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: any;
  originalError?: Error;
}

/**
 * Options for retry functionality
 */
export interface RetryOptions {
  maxRetries: number;
  retryDelay: number; // milliseconds
  retryableStatusCodes?: number[];
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Standardized error handling for API responses
 */
export function handleApiError(error: any): ApiError {
  // Handle Axios errors
  if (error.isAxiosError) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status || 500;
    const responseData = axiosError.response?.data as any;
    
    return {
      status,
      message: responseData?.error || axiosError.message || 'Unknown API error',
      code: responseData?.code,
      details: responseData?.details || responseData,
      originalError: error,
    };
  }
  
  // Handle standard errors
  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message || 'Unknown error',
      originalError: error,
    };
  }
  
  // Handle unknown error types
  return {
    status: 500,
    message: typeof error === 'string' ? error : 'Unknown error',
    details: error,
  };
}

/**
 * Function wrapper for retrying failed API calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retryOptions: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
    try {
      // Execute the function
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry based on error type
      const shouldRetry = attempt < retryOptions.maxRetries && isShouldRetryError(error, retryOptions);
      
      if (!shouldRetry) {
        throw lastError;
      }
      
      // Call the onRetry callback if provided
      if (retryOptions.onRetry) {
        retryOptions.onRetry(lastError, attempt + 1);
      }
      
      // Implement exponential backoff
      const delay = calculateBackoff(attempt, retryOptions.retryDelay);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Determine if an error should trigger a retry
 */
function isShouldRetryError(error: any, options: RetryOptions): boolean {
  // Network errors should always be retried
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // Check for retryable status codes
  if (error.isAxiosError && error.response && options.retryableStatusCodes) {
    return options.retryableStatusCodes.includes(error.response.status);
  }
  
  return false;
}

/**
 * Calculate backoff time with exponential increase
 */
function calculateBackoff(attempt: number, baseDelay: number): number {
  // Exponential backoff with jitter: (base * 2^attempt) + random jitter
  const exponentialPart = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 100; // Add up to 100ms of jitter
  return exponentialPart + jitter;
}

/**
 * Sleep utility function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

