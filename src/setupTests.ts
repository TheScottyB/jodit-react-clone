import '@testing-library/jest-dom';

// Mock Jodit for tests
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

// Suppress console errors during tests
console.error = jest.fn();

