export * from './test-utils';
export * from './axios-mock';

// Set up any global test configuration here
beforeAll(() => {
  // Suppress console errors in tests
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  // Restore console and axios mocks
  jest.restoreAllMocks();
});

// Add global test cleanup
afterEach(() => {
  // Clean up any remaining test state
  jest.clearAllMocks();
});

