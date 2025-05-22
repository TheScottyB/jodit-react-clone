import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

let mockAxios: MockAdapter;

/**
 * Set up a fresh axios mock instance
 */
export const setupAxiosMock = (): MockAdapter => {
  // Clean up any existing mock
  if (mockAxios) {
    mockAxios.restore();
  }
  
  // Create new mock adapter
  mockAxios = new MockAdapter(axios, { onNoMatch: 'throwException' });
  return mockAxios;
};

/**
 * Reset the mock adapter's history and handlers
 */
export const resetAxiosMock = (): void => {
  if (mockAxios) {
    mockAxios.reset();
  }
};

/**
 * Restore original axios implementation and cleanup
 */
export const restoreAxiosMock = (): void => {
  if (mockAxios) {
    mockAxios.restore();
    mockAxios = undefined as any;
  }
};

/**
 * Helper functions for common mock patterns
 */
export const mockGet = (url: string, response: any, status = 200): void => {
  mockAxios.onGet(url).reply(status, response);
};

export const mockPost = (url: string, response: any, status = 200): void => {
  mockAxios.onPost(url).reply(status, response);
};

export const mockPut = (url: string, response: any, status = 200): void => {
  mockAxios.onPut(url).reply(status, response);
};

export const mockPatch = (url: string, response: any, status = 200): void => {
  mockAxios.onPatch(url).reply(status, response);
};

export const mockDelete = (url: string, status = 200): void => {
  mockAxios.onDelete(url).reply(status);
};

/**
 * Mock error responses
 */
export const mockError = (url: string, method: string, status: number, message: string): void => {
  const matcher = { url, method: method.toLowerCase() };
  mockAxios.onAny(matcher).reply(status, { error: message });
};

/**
 * Mock network timeout
 */
export const mockTimeout = (url: string, method: string): void => {
  const matcher = { url, method: method.toLowerCase() };
  mockAxios.onAny(matcher).timeout();
};

/**
 * Mock rate limiting response
 */
export const mockRateLimit = (url: string, method: string, retryAfter = 60): void => {
  const matcher = { url, method: method.toLowerCase() };
  mockAxios.onAny(matcher).reply(429, {
    error: 'Rate limit exceeded',
    retryAfter
  });
};

// Add type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWithUrl(url: string): R;
      toHaveBeenCalledWithMethod(method: string): R;
    }
  }
}

// Add custom matchers for axios requests
expect.extend({
  toHaveBeenCalledWithUrl(received: MockAdapter, url: string) {
    const calls = received.history[received.history.method];
    const match = calls?.some(call => call.url === url);
    
    return {
      pass: match,
      message: () => 
        match
          ? `Expected ${url} not to have been called`
          : `Expected ${url} to have been called`
    };
  },
  
  toHaveBeenCalledWithMethod(received: MockAdapter, method: string) {
    const calls = received.history[method.toLowerCase()];
    
    return {
      pass: calls?.length > 0,
      message: () => 
        calls?.length > 0
          ? `Expected ${method} not to have been called`
          : `Expected ${method} to have been called`
    };
  }
});

// Initialize mock adapter
setupAxiosMock();

// Export singleton instance
export { mockAxios };

