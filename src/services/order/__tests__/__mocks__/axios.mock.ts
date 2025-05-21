import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

let mockAxios: MockAdapter;

export const setupAxiosMock = () => {
  // Create a fresh instance
  const axiosInstance = axios.create();
  mockAxios = new MockAdapter(axiosInstance);
  
  // Set default behavior for any request
  mockAxios.onAny().reply(200, { data: {} });
  
  return mockAxios;
};

export const mockGet = (url: string, response: any, status = 200) => {
  mockAxios.onGet(url).reply(status, response);
};

export const mockPost = (url: string, response: any, status = 200) => {
  mockAxios.onPost(url).reply(status, response);
};

export const mockPut = (url: string, response: any, status = 200) => {
  mockAxios.onPut(url).reply(status, response);
};

export const mockPatch = (url: string, response: any, status = 200) => {
  mockAxios.onPatch(url).reply(status, response);
};

export const mockDelete = (url: string, response: any, status = 200) => {
  mockAxios.onDelete(url).reply(status, response);
};

export const mockError = (url: string, method: string, status = 500, message = 'Error') => {
  const methodFn = mockAxios[`on${method.charAt(0).toUpperCase() + method.slice(1)}`];
  methodFn(url).reply(status, { error: message });
};

export const mockTimeout = (url: string, method: string, timeout: number) => {
  const methodFn = mockAxios[`on${method.charAt(0).toUpperCase() + method.slice(1)}`];
  methodFn(url).timeout();
};

export const mockRateLimit = (url: string, method: string) => {
  const methodFn = mockAxios[`on${method.charAt(0).toUpperCase() + method.slice(1)}`];
  methodFn(url).reply(429, { error: 'Rate limit exceeded' });
};

export const resetMock = () => {
  if (mockAxios) {
    mockAxios.reset();
  }
};

export const restoreMock = () => {
  if (mockAxios) {
    mockAxios.restore();
  }
};

export { mockAxios };
