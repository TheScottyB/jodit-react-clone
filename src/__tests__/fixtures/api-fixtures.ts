import { mockConfig } from './index';
import { createSpocketOrder, createSquareOrder } from './index';

/**
 * API response templates
 */
export const apiResponses = {
  spocket: {
    // Order endpoints
    getOrder: (orderId: string) => ({
      url: `${mockConfig.spocket.apiUrl}/orders/${orderId}`,
      response: {
        data: createSpocketOrder(orderId),
        meta: {
          requestId: `req_${orderId}`
        }
      }
    }),

    createOrder: (orderData: any) => ({
      url: `${mockConfig.spocket.apiUrl}/orders`,
      response: {
        data: {
          ...createSpocketOrder(orderData.id || 'new-order'),
          ...orderData
        },
        meta: {
          requestId: `req_${new Date().getTime()}`
        }
      }
    }),

    updateOrder: (orderId: string, updates: any) => ({
      url: `${mockConfig.spocket.apiUrl}/orders/${orderId}`,
      response: {
        data: {
          ...createSpocketOrder(orderId),
          ...updates
        },
        meta: {
          requestId: `req_${new Date().getTime()}`
        }
      }
    })
  },

  square: {
    // Order endpoints
    getOrder: (orderId: string) => ({
      url: `${mockConfig.square.apiUrl}/v2/orders/${orderId}`,
      response: {
        order: createSquareOrder(orderId)
      }
    }),

    createOrder: (orderData: any) => ({
      url: `${mockConfig.square.apiUrl}/v2/orders`,
      response: {
        order: {
          ...createSquareOrder(orderData.id || 'new-order'),
          ...orderData
        }
      }
    }),

    updateOrder: (orderId: string, updates: any) => ({
      url: `${mockConfig.square.apiUrl}/v2/orders/${orderId}`,
      response: {
        order: {
          ...createSquareOrder(orderId),
          ...updates
        }
      }
    })
  }
};

/**
 * Error response templates
 */
export const errorResponses = {
  // Authentication errors
  auth: {
    invalidKey: {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key'
      }
    },
    expired: {
      error: {
        code: 'UNAUTHORIZED',
        message: 'API key has expired'
      }
    }
  },

  // Resource errors
  resource: {
    notFound: (resourceType: string, id: string) => ({
      error: {
        code: 'NOT_FOUND',
        message: `${resourceType} with ID ${id} not found`
      }
    }),
    alreadyExists: (resourceType: string, id: string) => ({
      error: {
        code: 'CONFLICT',
        message: `${resourceType} with ID ${id} already exists`
      }
    })
  },

  // Validation errors
  validation: {
    invalidField: (field: string, reason: string) => ({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Validation failed',
        details: [{
          field,
          message: reason
        }]
      }
    }),
    missingRequired: (field: string) => ({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Validation failed',
        details: [{
          field,
          message: 'Field is required'
        }]
      }
    })
  },

  // Rate limiting
  rateLimit: {
    exceeded: (retryAfter: number = 60) => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryAfter
      }
    })
  },

  // Network errors
  network: {
    timeout: {
      code: 'TIMEOUT',
      message: 'Request timed out'
    },
    connection: {
      code: 'CONNECTION_ERROR',
      message: 'Failed to connect to server'
    }
  }
};

/**
 * Helper functions for API testing
 */
export const apiTestUtils = {
  mockSuccessResponse: (data: any, status = 200) => ({
    status,
    statusText: 'OK',
    data,
    headers: {
      'content-type': 'application/json'
    }
  }),

  mockErrorResponse: (error: any, status = 400) => ({
    status,
    statusText: 'Error',
    data: error,
    headers: {
      'content-type': 'application/json'
    }
  }),

  verifyRequest: (mockAxios: any, method: string, url: string, data?: any) => {
    expect(mockAxios.history[method]).toHaveLength(1);
    expect(mockAxios.history[method][0].url).toBe(url);
    if (data) {
      expect(JSON.parse(mockAxios.history[method][0].data)).toEqual(data);
    }
  }
};

