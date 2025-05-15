/**
 * Square Order Handler
 * Handles all operations related to Square orders
 */

import { Client, Environment, ApiError } from 'square';
import { RateLimiter } from 'limiter';
import { createLogger } from '../../common/logger';
import { configService } from '../../config/config.service';
import { handleApiError, withRetry } from '../utils/order.utils';
import { spocketToSquareOrder } from '../mappers/order.mapper';

import {
  Order,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderFulfillmentUpdate,
  OrderPaymentUpdate,
  SquareWebhookEvent
} from '../../../types/order.types';

// Configure logger
const logger = createLogger('square-handler');

// Configure rate limiter (40 requests per minute)
const squareRateLimiter = new RateLimiter({ tokensPerInterval: 40, interval: 60000 });

// Default Square location
let defaultLocationId = '';

// Square API client instance
let squareClient: Client | null = null;

/**
 * Initialize or get the Square API client
 */
export const getSquareClient = (): Client => {
  if (squareClient) {
    return squareClient;
  }

  const accessToken = configService.getEnv('SQUARE_ACCESS_TOKEN');
  const environment = configService.getEnv('SQUARE_ENVIRONMENT') === 'production'
    ? Environment.Production
    : Environment.Sandbox;

  squareClient = new Client({
    accessToken,
    environment
  });

  // Set default location ID
  defaultLocationId = configService.getEnv('SQUARE_LOCATION_ID') || '';
  
  logger.info(`Square client initialized with environment: ${environment}`);
  
  return squareClient;
};

/**
 * Get the default Square location ID
 */
export const getDefaultLocationId = async (): Promise<string> => {
  if (defaultLocationId) {
    return defaultLocationId;
  }

  // If no default location is set, try to get the main location
  const client = getSquareClient();
  
  try {
    // Use rate limiter
    await squareRateLimiter.removeTokens(1);
    
    const { result } = await client.locationsApi.listLocations();
    
    if (result.locations && result.locations.length > 0) {
      // Get the first location as default
      defaultLocationId = result.locations[0].id!;
      logger.info(`Set default Square location ID: ${defaultLocationId}`);
      return defaultLocationId;
    }
    
    throw new Error('No Square locations found');
  } catch (error: any) {
    logger.error('Error getting Square locations', { error });
    throw new Error(`Failed to get Square locations: ${error.message}`);
  }
};

/**
 * Fetch orders from Square API
 * @param dateRange - Optional date range filter
 * @param statuses - Optional status filter
 * @param locationId - Square location ID
 */
export const fetchSquareOrders = async (
  dateRange?: { start: Date; end: Date },
  statuses?: string[],
  locationId?: string
): Promise<Order[]> => {
  try {
    // Use rate limiter
    await squareRateLimiter.removeTokens(1);
    
    const client = getSquareClient();
    logger.info('Fetching orders from Square');
    
    // If no location ID is provided, use the default one
    const location = locationId || await getDefaultLocationId();

    // In a real implementation, you'd make an API call using Square SDK
    // This is a placeholder for the actual API call
    
    // Sample request parameters for real API:
    // const params = {
    //   locationId: location,
    //   query: {
    //     filter: {
    //       stateFilter: {
    //         states: statuses || ['OPEN', 'COMPLETED']
    //       },
    //       dateTimeFilter: dateRange ? {
    //         createdAt: {
    //           startAt: dateRange.start.toISOString(),
    //           endAt: dateRange.end.toISOString()
    //         }
    //       } : undefined
    //     },
    //     sort: {
    //       sortField: 'CREATED_AT',
    //       sortOrder: 'DESC'
    //     }
    //   }
    // };
    
    // const { result } = await client.ordersApi.searchOrders(params);
    
    // Mock Square orders - in a real implementation, fetch from API
    const mockSquareOrders = [{
      id: 'sq_order_123',
      reference_id: 'SQ12345',
      state: 'COMPLETED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      line_items: [{
        uid: 'item_1',
        name: 'Sample Product',
        quantity: '2',
        base_price_money: {
          amount: 1999,
          currency: 'USD'
        },
        total_money: {
          amount: 3998,
          currency: 'USD'
        },
        variation_name: 'Regular'
      }],
      fulfillments: [
        {
          uid: 'fulfillment_1',
          type: 'SHIPMENT',
          state: 'COMPLETED',
          shipment_details: {
            recipient: {
              display_name: 'John Doe',
              email_address: 'john.doe@example.com',
              phone_number: '555-123-4567',
              address: {
                address_line_1: '123 Main St',
                locality: 'Anytown',
                administrative_district_level_1: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            },
            carrier: 'USPS',
            tracking_number: '9400123456789',
            tracking_url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400123456789'
          }
        }
      ],
      tenders: [
        {
          id: 'tender_1',
          type: 'CARD',
          amount_money: {
            amount: 4597,
            currency: 'USD'
          },
          card_details: {
            status: 'CAPTURED',
            card: {
              card_brand: 'VISA',
              last_4: '4242'
            }
          }
        }
      ],
      total_money: {
        amount: 4597,
        currency: 'USD'
      },
      total_tax_money: {
        amount: 0,
        currency: 'USD'
      },
      total_discount_money: {
        amount: 0,
        currency: 'USD'
      },
      total_service_charge_money: {
        amount: 599,
        currency: 'USD'
      },
      customer_id: 'customer_123'
    }];

    // Apply filters
    let filteredOrders = mockSquareOrders;
    
    // Filter by date range
    if (dateRange) {
      filteredOrders = filteredOrders.filter(order => {
        const createdAt = new Date(order.created_at);
        return createdAt >= dateRange.start && createdAt <= dateRange.end;
      });
    }
    
    // Filter by status
    if (statuses && statuses.length > 0) {
      filteredOrders = filteredOrders.filter(order => 
        statuses.includes(order.state)
      );
    }

    logger.info(`Fetched ${filteredOrders.length} orders from Square`);
    
    // Convert Square orders to our unified Order format
    return filteredOrders.map(squareOrder => {
      // In a real implementation this would call a mapper
      return {
        id: squareOrder.id,
        orderNumber: squareOrder.reference_id || '',
        externalId: squareOrder.id,
        fulfillmentStatus: squareOrder.fulfillments?.[0]?.state === 'COMPLETED' 
          ? OrderFulfillmentStatus.SHIPPED 
          : OrderFulfillmentStatus.PENDING,
        paymentStatus: squareOrder.tenders?.[0]?.card_details?.status === 'CAPTURED'
          ? OrderPaymentStatus.PAID
          : OrderPaymentStatus.PENDING,
        customer: {
          firstName: squareOrder.fulfillments?.[0]?.shipment_details?.recipient?.display_name?.split(' ')[0] || '',
          lastName: squareOrder.fulfillments?.[0]?.shipment_details?.recipient?.display_name?.split(' ')[1] || '',
          email: squareOrder.fulfillments?.[0]?.shipment_details?.recipient?.email_address || '',
          phone: squareOrder.fulfillments?.[0]?.shipment_details?.recipient?.phone_number || ''
        },
        createdAt: new Date(squareOrder.created_at),
        updatedAt: new Date(squareOrder.updated_at),
        items: squareOrder.line_items?.map(item => ({
          id: item.uid,
          name: item.name,
          sku: item.variation_name || '',
          quantity: parseInt(item.quantity || '0'),
          unitPrice: parseFloat((item.base_price_money?.amount || 0) / 100),
          total: parseFloat((item.total_money?.amount || 0) / 100)
        })) || [],
        shipping: {
          address: {
            firstName: '',
            lastName: '',
            addressLine1: squareOrder.fulfillments?.[0]?.shipment_details?.recipient?.address?.address_line_1 || '',
            city: squareOrder.fulfillments?.[0]?.shipment_details?.recipient?.address?.locality || '',
            state: squareOrder.fulfillments?.[0]?.shipment_details?.recipient?.address?.administrative_district_level_1 || '',
            postalCode: squareOrder.fulfillments?.[0]?.shipment_details?.recipient?.address?.postal_code || '',
            country: squareOrder.fulfillments?.[0]?.shipment_details?.recipient?.address?.country || ''
          },
          method: squareOrder.fulfillments?.[0]?.type || '',
          carrier: squareOrder.fulfillments?.[0]?.shipment_details?.carrier || '',
          trackingNumber: squareOrder.fulfillments?.[0]?.shipment_details?.tracking_number || '',
          cost: {
            amount: parseFloat((squareOrder.total_service_charge_money?.amount || 0) / 100),
            currency: squareOrder.total_service_charge_money?.currency || 'USD'
          }
        },
        payment: {
          id: squareOrder.tenders?.[0]?.id || '',
          method: squareOrder.tenders?.[0]?.type || '',
          status: squareOrder.tenders?.[0]?.card_details?.status === 'CAPTURED' 
            ? OrderPaymentStatus.PAID 
            : OrderPaymentStatus.PENDING,
          amount: {
            amount: parseFloat((squareOrder.total_money?.amount || 0) / 100),
            currency: squareOrder.total_money?.currency || 'USD'
          },
          cardBrand: squareOrder.tenders?.[0]?.card_details?.card?.card_brand || '',
          cardLast4: squareOrder.tenders?.[0]?.card_details?.card?.last_4 || ''
        },
        subtotal: {
          amount: parseFloat(((squareOrder.total_money?.amount || 0) - (squareOrder.total_service_charge_money?.amount || 0)) / 100),
          currency: squareOrder.total_money?.currency || 'USD'
        },
        taxTotal: {
          amount: parseFloat((squareOrder.total_tax_money?.amount || 0) / 100),
          currency: squareOrder.total_tax_money?.currency || 'USD'
        },
        shippingTotal: {
          amount: parseFloat((squareOrder.total_service_charge_money?.amount || 0) / 100),
          currency: squareOrder.total_service_charge_money?.currency || 'USD'
        },
        discountTotal: {
          amount: parseFloat((squareOrder.total_discount_money?.amount || 0) / 100),
          currency: squareOrder.total_discount_money?.currency || 'USD'
        },
        total: {
          amount: parseFloat((squareOrder.total_money?.amount || 0) / 100),
          currency: squareOrder.total_money?.currency || 'USD'
        }
      };
    });
  } catch (error: any) {
    return handleApiError(error, 'Failed to fetch Square orders');
  }
};

/**
 * Create a new order in Square
 * @param order - Order to create in unified format
 * @param locationId - Square location ID
 */
export const createSquareOrder = async (
  order: Order,
  locationId?: string
): Promise<string> => {
  return withRetry(async () => {
    try {
      // Use rate limiter
      await squareRateLimiter.removeTokens(1);
      
      const client = getSquareClient();
      logger.info('Creating order in Square', { orderNumber: order.orderNumber });
      
      // If no location ID is provided, use the default one
      const location = locationId || await getDefaultLocationId();
      
      // In a real implementation, convert the unified order to Square format
      // const squareOrder = spocketToSquareOrder(order);
      
      // In a real implementation, you'd call the Square API
      // const { result } = await client.ordersApi.createOrder({
      //   order: {
      //     locationId: location,
      //     referenceId: order.orderNumber,
      //     lineItems: squareOrder.lineItems,
      //     // ... other order details
      //   }
      // });
      
      // Mock implementation
      const orderId = `sq_${Math.random().toString(36).substring(2, 10)}`;
      
      logger.info(`Created Square order with ID: ${orderId}`);
      return orderId;
    } catch (error: any) {
      return handleApiError(error, 'Failed to create Square order');
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Update an existing order in Square
 * @param orderId - Square order ID
 * @param updates - Order updates
 * @param version - Order version (for optimistic concurrency)
 */
export const updateSquareOrder = async (
  orderId: string,
  updates: Partial<Order>,
  version?: number
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Use rate limiter
      await squareRateLimiter.removeTokens(1);
      
      const client = getSquareClient();
      logger.info('Updating Square order', { orderId });
      
      // In a real implementation, you'd retrieve the current order first
      // const { result: orderResult } = await client.ordersApi.retrieveOrder(orderId);
      // const currentVersion = orderResult.order?.version;
      
      // Then apply updates and send the update request
      // const { result } = await client.ordersApi.updateOrder({
      //   orderId,
      //   order: {
      //     // Apply updates
      //     version: version || currentVersion
      //   }
      // });
      
      logger.info('Square order updated successfully', { orderId });
    } catch (error: any) {
      // Handle version conflict errors specifically
      if (error?.errors?.some((e: any) => e.code === 'CONFLICT')) {
        logger.warn('Square order version conflict, retrying with latest version', { orderId });
        // Recursive retry with latest version
        // This approach handles optimistic concurrency by getting the latest version
        return updateSquareOrder(orderId, updates);
      }
      
      return handleApiError(error, `Failed to update Square order ${orderId}`);
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Get Square order by ID
 * @param orderId - Square order ID
 */
export const getSquareOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    // Use rate limiter
    await squareRateLimiter.removeTokens(1);
    
    const client = getSquareClient();
    logger.info('Fetching Square order by ID', { orderId });
    
    // In a real implementation, you'd make an API call to get the order
    // const { result } = await client.ordersApi.retrieveOrder(orderId);
    // const squareOrder = result.order;
    
    // Mock implementation
    if (!orderId.startsWith('sq_')) {
      logger.warn(`Order not found: ${orderId}`);
      return null;
    }
    
    // Mock Square order
    const mockSquareOrder = {
      id: orderId,
      reference_id: `REF-${orderId.substring(3, 8)}`,
      state: 'COMPLETED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      line_items: [{
        uid: 'item_1',
        name: 'Sample Product',
        quantity: '2',
        base_price_money: {
          amount: 1999,
          currency: 'USD'
        },
        total_money: {
          amount: 3998,
          currency: 'USD'
        }
      }],
      fulfillments: [
        {
          uid: 'fulfillment_1',
          type: 'SHIPMENT',
          state: 'COMPLETED',
          shipment_details: {
            recipient: {
              display_name: 'John Doe',
              email_address: 'john.doe@example.com',
              phone_number: '555-123-4567',
              address: {
                address_line_1: '123 Main St',
                locality: 'Anytown',
                administrative_district_level_1: 'CA',
                postal_code: '12345',
                country: 'US'
              }
            },
            carrier: 'USPS',
            tracking_number: '9400123456789'
          }
        }
      ],
      tenders: [
        {
          id: 'tender_1',
          type: 'CARD',
          amount_money: {
            amount: 4597,
            currency: 'USD'
          },
          card_details: {
            status: 'CAPTURED',
            card: {
              card_brand: 'VISA',
              last_4: '4242'
            }
          }
        }
      ],
      total_money: {
        amount: 4597,
        currency: 'USD'
      },
      total_tax_money: {
        amount: 0,
        currency: 'USD'
      },
      total_discount_money: {
        amount: 0,
        currency: 'USD'
      },
      total_service_charge_money: {
        amount: 599,
        currency: 'USD'
      }
    };
    
    // Convert to our unified format - in a real implementation use a mapper
    const order: Order = {
      id: mockSquareOrder.id,
      orderNumber: mockSquareOrder.reference_id || '',
      externalId: mockSquareOrder.id,
      fulfillmentStatus: mockSquareOrder.fulfillments?.[0]?.state === 'COMPLETED' 
        ? OrderFulfillmentStatus.SHIPPED 
        : OrderFulfillmentStatus.PENDING,
      paymentStatus: mockSquareOrder.tenders?.[0]?.card_details?.status === 'CAPTURED'
        ? OrderPaymentStatus.PAID
        : OrderPaymentStatus.PENDING,
      // ... rest of the mapping (simplified for brevity) 
      createdAt: new Date(mockSquareOrder.created_at),
      updatedAt: new Date(mockSquareOrder.updated_at),
      // We'd add more fields here in a complete implementation
      items: []
    };
    
    logger.info('Fetched Square order by ID', { orderId });
    return order;
  } catch (error: any) {
    // If 404, return null instead of throwing
    if (error?.statusCode === 404 || error?.errors?.some((e: any) => e.code === 'NOT_FOUND')) {
      logger.warn(`Square order not found: ${orderId}`);
      return null;
    }
    
    return handleApiError(error, `Failed to get Square order ${orderId}`);
  }
};

/**
 * Update order status in Square
 * @param orderId - Square order ID
 * @param status - New order status
 */
export const updateSquareOrderStatus = async (
  orderId: string,
  status: string
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Use rate limiter
      await squareRateLimiter.removeTokens(1);
      
      const client = getSquareClient();
      logger.info('Updating Square order status', { orderId, status });
      
      // Validate the status is one of Square's valid order states
      if (!isValidSquareOrderStatus(status)) {
        throw new Error(`Invalid Square order status: ${status}`);
      }
      
      // In a real implementation, you'd make an API call to update the status
      // Example:
      // const { result: orderResult } = await client.ordersApi.retrieveOrder(orderId);
      // const currentVersion = orderResult.order?.version;
      
      // const { result } = await client.ordersApi.updateOrder({
      //   orderId,
      //   order: {
      //     state: status,
      //     version: currentVersion
      //   }
      // });
      
      logger.info('Square order status updated successfully', { orderId, status });
    } catch (error: any) {
      return handleApiError(error, `Failed to update Square order status for ${orderId}`);
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Update order fulfillment in Square
 * @param orderId - Square order ID
 * @param fulfillmentUpdate - Fulfillment update details
 */
export const updateSquareOrderFulfillment = async (
  orderId: string,
  fulfillmentUpdate: OrderFulfillmentUpdate
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Use rate limiter
      await squareRateLimiter.removeTokens(1);
      
      const client = getSquareClient();
      logger.info('Updating Square order fulfillment', { 
        orderId, 
        status: fulfillmentUpdate.status,
        trackingNumber: fulfillmentUpdate.trackingNumber
      });
      
      // In a real implementation, you'd need to:
      // 1. Get the current order and its fulfillments
      // 2. Update the fulfillment state
      // 3. If adding tracking information, update shipment details
      
      // Example (commented out as we don't have real Square SDK):
      // const { result: orderResult } = await client.ordersApi.retrieveOrder(orderId);
      // const currentOrder = orderResult.order;
      // const fulfillmentUid = currentOrder?.fulfillments?.[0]?.uid;
      
      // if (!fulfillmentUid) {
      //   throw new Error('No fulfillment found for this order');
      // }
      
      // await client.ordersApi.updateOrder({
      //   orderId,
      //   order: {
      //     fulfillments: [
      //       {
      //         uid: fulfillmentUid,
      //         state: mapFulfillmentStatusToSquare(fulfillmentUpdate.status),
      //         shipmentDetails: {
      //           trackingNumber: fulfillmentUpdate.trackingNumber,
      //           carrier: fulfillmentUpdate.carrier
      //         }
      //       }
      //     ],
      //     version: currentOrder.version
      //   }
      // });
      
      logger.info('Square order fulfillment updated successfully', { orderId });
    } catch (error: any) {
      return handleApiError(error, `Failed to update Square order fulfillment for ${orderId}`);
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Update order payment in Square
 * @param orderId - Square order ID
 * @param paymentUpdate - Payment status update
 */
export const updateSquareOrderPayment = async (
  orderId: string,
  paymentUpdate: OrderPaymentUpdate
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Use rate limiter
      await squareRateLimiter.removeTokens(1);
      
      const client = getSquareClient();
      logger.info('Updating Square order payment', { 
        orderId, 
        status: paymentUpdate.status 
      });
      
      // In Square, payment status updates typically involve working with payments API
      // rather than the orders API directly. You'd need to:
      // 1. Get the associated payment IDs for the order
      // 2. Update each payment's status as needed
      
      // Example (commented out as we don't have real SDK):
      // const { result } = await client.ordersApi.retrieveOrder(orderId);
      // const tenderIds = result.order?.tenders?.map(tender => tender.id) || [];
      
      // for (const tenderId of tenderIds) {
      //   // Perform appropriate action based on payment status
      //   if (paymentUpdate.status === OrderPaymentStatus.PAID) {
      //     await client.paymentsApi.completePayment(tenderId);
      //   } else if (paymentUpdate.status === OrderPaymentStatus.REFUNDED) {
      //     await client.refundsApi.refundPayment({
      //       paymentId: tenderId,
      //       amountMoney: { /* amount details */ },
      //       reason: paymentUpdate.reason || 'Customer request'
      //     });
      //   }
      // }
      
      logger.info('Square order payment updated successfully', { orderId });
    } catch (error: any) {
      return handleApiError(error, `Failed to update Square order payment for ${orderId}`);
    }
  }, 3, [400, 500, 1000]);
};

/**
 * Cancel an order in Square
 * @param orderId - Square order ID
 * @param reason - Cancellation reason
 */
export const cancelSquareOrder = async (
  orderId: string,
  reason: string
): Promise<void> => {
  return withRetry(async () => {
    try {
      // Use rate limiter
      await squareRateLimiter.removeTokens(1);
      
      const client = getSquareClient();
      logger.info('Cancelling Square order', { orderId, reason });
      
      // In a real implementation, you'd make an API call to cancel the order
      // Example:
