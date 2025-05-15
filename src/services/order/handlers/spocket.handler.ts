/**
 * Spocket Order Handler
 * Handles all operations related to Spocket orders
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { RateLimiter } from 'limiter';
import { createLogger } from '../../common/logger';
import { spocketAuthService } from '../../auth/spocket-auth.service';
import { configService } from '../../config/config.service';
import { handleApiError, withRetry } from '../utils/order.utils';
import { squareToSpocketOrder } from '../mappers/order.mapper';

import {
  Order,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderFulfillmentUpdate,
  OrderPaymentUpdate
} from '../../../types/order.types';

// Configure logger
const logger = createLogger('spocket-handler');

// Configure rate limiter (50 requests per minute)
const spocketRateLimiter = new RateLimiter({ tokensPerInterval: 50, interval: 60000 });

// API client
let apiClient: AxiosInstance | null = null;

/**
 * Initialize or get the Spocket API client
 */
export const getSpocketClient = async (): Promise<AxiosInstance> => {
  if (apiClient) {
    return apiClient;
  }

  const token = await spocketAuthService.getAccessToken();
  const basePath = configService.getEnv('SPOCKET_API_BASE_URL') || 'https://api.spocket.co';

  apiClient = axios.create({
    baseURL: basePath,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  // Add response interceptor for token refresh
  apiClient.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Token expired, refresh and retry
        const newToken = await spocketAuthService.refreshAccessToken();
        if (error.config) {
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return axios(error.config);
        }
      }
      return Promise.reject(error);
    }
  );

  return apiClient;
};

/**
 * Fetch orders from Spocket API
 * @param dateRange - Optional date range filter
 * @param statuses - Optional status filter
 * @param page - Page number for pagination
 * @param limit - Number of items per page
 */
export const fetchSpocketOrders = async (
  dateRange?: { start: Date; end: Date },
  statuses?: OrderFulfillmentStatus[],
  page: number = 1,
  limit: number = 50
): Promise<Order[]> => {
  try {
    // Respect rate limiting
    await spocketRateLimiter.removeTokens(1);

    logger.info('Fetching orders from Spocket');
    const client = await getSpocketClient();

    // In a real implementation, you'd make API calls to fetch orders
    // For now we'll simulate this with a mock response
    
    // Mock orders - in a real implementation, fetch from Spocket API
    const mockOrders: Order[] = [{
      id: 'spkt_order_123',
      orderNumber: 'SPK12345',
      customer: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567'
      },
      items: [{
        id: 'item_1',
        productId: 'prod_1',
        name: 'Sample Product',
        sku: 'SP001',
        quantity: 2,
        unitPrice: 19.99,
        total: 39.98
      }],
      shipping: {
        address: {
          firstName: 'John',
          lastName: 'Doe',
          addressLine1: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          postalCode: '12345',
          country: 'US'
        },
        method: 'Standard',
        carrier: 'USPS',
        trackingNumber: '9400123456789',
        cost: {
          amount: 5.99,
          currency: 'USD'
        }
      },
      payment: {
        id: 'payment_1',
        amount: {
          amount: 45.97,
          currency: 'USD'
        },
        status: OrderPaymentStatus.PAID,
        method: 'Credit Card',
        cardBrand: 'Visa',
        cardLast4: '4242'
      },
      fulfillmentStatus: OrderFulfillmentStatus.SHIPPED,
      paymentStatus: OrderPaymentStatus.PAID,
      subtotal: {
        amount: 39.98,
        currency: 'USD'
      },
      taxTotal: {
        amount: 0,
        currency: 'USD'
      },
      shippingTotal: {
        amount: 5.99,
        currency: 'USD'
      },
      discountTotal: {
        amount: 0,
        currency: 'USD'
      },
      total: {
        amount: 45.97,
        currency: 'USD'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }];
    
    // Apply filters
    let filteredOrders = mockOrders;
    
    // Filter by date range
    if (dateRange) {
      filteredOrders = filteredOrders.filter(order => 
        order.createdAt >= dateRange.start && 
        order.createdAt <= dateRange.end
      );
    }
    
    // Filter by status
    if (statuses && statuses.length > 0) {
      filteredOrders = filteredOrders.filter(order => 
        statuses.includes(order.fulfillmentStatus)
      );
    }
    
    logger.info(`Fetched ${filteredOrders.length} orders from Spocket`);
    return filteredOrders;
  } catch (error: any) {
    return handleApiError(error, 'Failed to fetch Spocket orders');
  }
};

/**
 * Create a new order in Spocket
 * @param order - Order to create
 */
export const createSpocketOrder = async (order: Order): Promise<string> => {
  return withRetry(async () => {
    try {
      // Respect rate limiting
      await spocketRateLimiter.removeTokens(1);

      logger.info('Creating order in Spocket', { orderNumber: order.orderNumber });
      const client = await getSpocketClient();

      // In a real implementation, you'd make an API call to create the order
      // This is a placeholder for the actual API call

      // Mock implementation - simulate creating an order
      const orderId = `spkt_${Math.random().toString(36).substring(2, 10)}`;

      logger.info(`Created Spocket order with ID: ${orderId}`);
      return orderId;
    } catch (error: any) {
      return handleApiError(error, 'Failed to create Spocket order');
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Update an existing order in Spocket
 * @param orderId - Spocket order ID
 * @param updates - Order updates
 */
export const updateSpocketOrder = async (
  orderId: string,
  updates: Partial<Order>
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Respect rate limiting
      await spocketRateLimiter.removeTokens(1);

      logger.info('Updating Spocket order', { orderId });
      const client = await getSpocketClient();

      // In a real implementation, you'd make an API call to update the order
      // This is a placeholder for the actual API call

      logger.info('Spocket order updated successfully', { orderId });
    } catch (error: any) {
      return handleApiError(error, `Failed to update Spocket order ${orderId}`);
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Update order status in Spocket
 * @param orderId - Spocket order ID
 * @param status - New order status
 */
export const updateSpocketOrderStatus = async (
  orderId: string,
  status: string
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Respect rate limiting
      await spocketRateLimiter.removeTokens(1);

      logger.info('Updating Spocket order status', { orderId, status });
      const client = await getSpocketClient();

      // In a real implementation, you'd make an API call to update the status
      // This is a placeholder for the actual API call

      logger.info('Spocket order status updated successfully', { orderId, status });
    } catch (error: any) {
      return handleApiError(error, `Failed to update Spocket order status for ${orderId}`);
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Update order fulfillment status in Spocket
 * @param orderId - Spocket order ID
 * @param fulfillmentUpdate - Fulfillment status update
 */
export const updateSpocketOrderFulfillment = async (
  orderId: string,
  fulfillmentUpdate: OrderFulfillmentUpdate
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Respect rate limiting
      await spocketRateLimiter.removeTokens(1);

      logger.info('Updating Spocket order fulfillment', { 
        orderId, 
        status: fulfillmentUpdate.status,
        trackingNumber: fulfillmentUpdate.trackingNumber
      });
      const client = await getSpocketClient();

      // In a real implementation, you'd make an API call to update the fulfillment
      // This is a placeholder for the actual API call

      logger.info('Spocket order fulfillment updated successfully', { orderId });
    } catch (error: any) {
      return handleApiError(error, `Failed to update Spocket order fulfillment for ${orderId}`);
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Update order payment status in Spocket
 * @param orderId - Spocket order ID
 * @param paymentUpdate - Payment status update
 */
export const updateSpocketOrderPayment = async (
  orderId: string,
  paymentUpdate: OrderPaymentUpdate
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Respect rate limiting
      await spocketRateLimiter.removeTokens(1);

      logger.info('Updating Spocket order payment', { 
        orderId, 
        status: paymentUpdate.status 
      });
      const client = await getSpocketClient();

      // In a real implementation, you'd make an API call to update the payment
      // This is a placeholder for the actual API call

      logger.info('Spocket order payment updated successfully', { orderId });
    } catch (error: any) {
      return handleApiError(error, `Failed to update Spocket order payment for ${orderId}`);
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Cancel an order in Spocket
 * @param orderId - Spocket order ID
 * @param reason - Cancellation reason
 */
export const cancelSpocketOrder = async (
  orderId: string,
  reason: string
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Respect rate limiting
      await spocketRateLimiter.removeTokens(1);

      logger.info('Cancelling Spocket order', { orderId, reason });
      const client = await getSpocketClient();

      // In a real implementation, you'd make an API call to cancel the order
      // This is a placeholder for the actual API call

      logger.info('Spocket order cancelled successfully', { orderId });
    } catch (error: any) {
      return handleApiError(error, `Failed to cancel Spocket order ${orderId}`);
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Get a single order from Spocket by ID
 * @param orderId - Spocket order ID
 */
export const getSpocketOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    // Respect rate limiting
    await spocketRateLimiter.removeTokens(1);

    logger.info('Fetching Spocket order by ID', { orderId });
    const client = await getSpocketClient();

    // In a real implementation, you'd make an API call to get the order
    // This is a placeholder for the actual API call

    // Mock order - in a real implementation, fetch from API
    const mockOrder: Order = {
      id: orderId,
      orderNumber: `SPK-${orderId.substring(5, 10)}`,
      customer: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567'
      },
      items: [{
        id: 'item_1',
        productId: 'prod_1',
        name: 'Sample Product',
        sku: 'SP001',
        quantity: 2,
        unitPrice: 19.99,
        total: 39.98
      }],
      shipping: {
        address: {
          firstName: 'John',
          lastName: 'Doe',
          addressLine1: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          postalCode: '12345',
          country: 'US'
        },
        method: 'Standard',
        carrier: 'USPS',
        trackingNumber: '9400123456789',
        cost: {
          amount: 5.99,
          currency: 'USD'
        }
      },
      payment: {
        id: 'payment_1',
        amount: {
          amount: 45.97,
          currency: 'USD'
        },
        status: OrderPaymentStatus.PAID,
        method: 'Credit Card',
        cardBrand: 'Visa',
        cardLast4: '4242'
      },
      fulfillmentStatus: OrderFulfillmentStatus.SHIPPED,
      paymentStatus: OrderPaymentStatus.PAID,
      subtotal: {
        amount: 39.98,
        currency: 'USD'
      },
      taxTotal: {
        amount: 0,
        currency: 'USD'
      },
      shippingTotal: {
        amount: 5.99,
        currency: 'USD'
      },
      discountTotal: {
        amount: 0,
        currency: 'USD'
      },
      total: {
        amount: 45.97,
        currency: 'USD'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    logger.info('Fetched Spocket order by ID', { orderId });
    return mockOrder;
  } catch (error: any) {
    // If 404, return null instead of throwing
    if (error.response?.status === 404) {
      logger.warn(`Spocket order not found: ${orderId}`);
      return null;
    }
    return handleApiError(error, `Failed to get Spocket order ${orderId}`);
  }
};

/**
 * Extract external reference ID from Spocket order
 * @param order - Spocket order
 * @returns External reference ID if exists
 */
export const extractSquareReferenceFromSpocketOrder = (order: Order): string | null => {
  // In a real implementation, you'd extract this from order metadata or reference fields
  // This is a simplified mock implementation
  
  // Check for external reference in the order metadata
  if (order.externalId) {
    return order.externalId;
  }
  
  // Check for references in notes or tags
  if (order.notes && order.notes.includes('square_order_id:')) {
    const match = order.notes.match(/square_order_id:([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

/**
 * Check if a Spocket order has been updated since the last sync
 * @param orderId - Spocket order ID
 * @param lastSyncTime - Last synchronization time
 * @returns True if order has been updated
 */
export const hasSpocketOrderChanged = async (
  orderId: string,
  lastSyncTime: Date
): Promise<boolean> => {
  try {
    const order = await getSpocketOrderById(orderId);
    if (!order) {
      // Order not found, consider it changed (might have been deleted)
      return true;
    }
    
    // Check if order has been updated since last sync
    return order.updatedAt > lastSyncTime;
  } catch (error) {
    logger.error(`Error checking if Spocket order has changed: ${error}`);
    // In case of error, assume order has changed to force sync
    return true;
  }
};
