import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { act } from '@testing-library/react';

// Extend timeout for async operations in tests
jest.setTimeout(10000);

// Configure testing-library
configure({
  testIdAttribute: 'data-testid',
  throwSuggestions: true,
  asyncUtilTimeout: 2000,
  eventWrapper: (cb) => {
    let result;
    act(() => {
      result = cb();
    });
    return result;
  }
});

// Mock Jodit for tests (preserve existing mock)
jest.mock('jodit', () => ({
  Jodit: {
    make: jest.fn(() => ({
      value: '',
      events: {
        on: jest.fn(),
        off: jest.fn()
      },
      workplace: {
        tabIndex: -1
      },
      destruct: jest.fn()
    }))
  }
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock ResizeObserver
const mockResizeObserver = jest.fn();
mockResizeObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.ResizeObserver = mockResizeObserver;

// Export test utilities
export { act };

// Global test cleanup
afterEach(() => {
  // Clean up any global state after each test
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Add custom matchers if needed
expect.extend({
  toBeValidDate(received) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    return {
      message: () =>
        `expected ${received} to be a valid Date object`,
      pass
    };
  },
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () =>
        `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass
    };
  }
});

// Add global type definitions for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Mock global fetch
global.fetch = jest.fn();

// Customize console error handling
const originalConsoleError = console.error;
console.error = (...args) => {
  // Ignore specific React errors during tests
  if (args[0]?.includes?.('Warning: ReactDOM.render is no longer supported')) {
    return;
  }
  
  // Use the mock behavior for other errors
  jest.fn()(...args);
};
