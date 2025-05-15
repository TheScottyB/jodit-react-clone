import { createLogger } from '../common/logger';
import { createSpocketRateLimiter, createSquareRateLimiter } from '../common/rate-limiter';
import { configService } from '../config/config.service';
import { spocketAuthService } from '../auth/spocket-auth.service';
import { 
  squareToSpocketOrder, 
  spocketToSquareOrder 
} from './order.mapper';

import {
  Order,
  OrderSyncRequest,
  OrderSyncResult,
  OrderFulfillmentStatus
} from '../../types/order.types';

import { EntityMapping, SyncEntityType } from '../../types/sync.types';
import { 
  processOrderBatch, 
  buildOrderMappings, 
  createSquareOrder, 
  createSpocketOrder,
  updateOrder
} from './order.handlers';
import { setupOrderWebhooks, processOrderWebhook } from './order.webhooks';

// Configure logger
const logger = createLogger('order-service');

/**
 * Order Synchronization Service
 * Handles order synchronization between Spocket and Square
 */
export class OrderService {
  private static instance: OrderService;
  private squareClient: any; // Square SDK Client
  private spocketBasePath: string;
  
  // Rate limiters for API calls
  private spocketLimiter;
  private squareLimiter;
  
  // Default Square location ID
  private squareLocationId: string = '';
  
  // Webhook configuration
  private webhooksEnabled: boolean = false;

  private constructor() {
    this.spocketBasePath = configService.getEnv('SPOCKET_API_BASE_URL') || 'https://api.spocket.co';
    
    // Initialize rate limiters
    this.spocketLimiter = createSpocketRateLimiter();
    this.squareLimiter = createSquareRateLimiter();
    
    // Initialize Square client from the main instance
    this.squareClient = configService.getSquareClient();
    
    // Set default Square location ID
    this.squareLocationId = configService.getEnv('SQUARE_LOCATION_ID') || 'default_location';
    
    // Initialize webhooks if enabled in config
    this.webhooksEnabled = configService.getEnv('ENABLE_ORDER_WEBHOOKS') === 'true';
    if (this.webhooksEnabled) {
      setupOrderWebhooks().catch(error => {
        logger.error('Failed to setup order webhooks', { error });
      });
    }
    
    logger.info(`OrderService initialized with Square location: ${this.squareLocationId}`);
  }

  /**
   * Get singleton instance of OrderService
   */
  public static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  /**
   * Fetch orders from Spocket
   * @param dateRange - Optional date range filter
   * @param statuses - Optional status filter
   * @param page - Page number for pagination
   * @param limit - Number of items per page
   */
  public async fetchSpocketOrders(
    dateRange?: { start: Date; end: Date },
    statuses?: OrderFulfillmentStatus[],
    page: number = 1,
    limit: number = 50
  ): Promise<Order[]> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.spocketLimiter.schedule(async () => {
        logger.info('Fetching orders from Spocket');
        
        const token = await spocketAuthService.getAccessToken();
        
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
            status: 'PAID',
            method: 'Credit Card',
            cardBrand: 'Visa',
            cardLast4: '4242'
          },
          fulfillmentStatus: OrderFulfillmentStatus.SHIPPED,
          paymentStatus: 'PAID',
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
      });
    } catch (error: any) {
      logger.error(`Error fetching orders from Spocket: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      throw new Error(`Failed to fetch Spocket orders: ${error.message}`);
    }
  }

  /**
   * Fetch orders from Square
   * @param dateRange - Optional date range filter
   * @param statuses - Optional status filter
   * @param locationId - Square location ID
   */
  public async fetchSquareOrders(
    dateRange?: { start: Date; end: Date },
    statuses?: string[],
    locationId: string = this.squareLocationId
  ): Promise<Order[]> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.squareLimiter.schedule(async () => {
        logger.info(`Fetching orders from Square for location ${locationId}`);
        
        // In a real implementation, you'd use the Square SDK
        // This is a placeholder for the actual API call
        
        // Mock Square orders - in a real implementation, fetch from Square API
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
          return squareToSpocketOrder(squareOrder);
        });
      });
    } catch (error: any) {
      logger.error(`Error fetching orders from Square: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      throw new Error(`Failed to fetch Square orders: ${error.message}`);
    }
  }

  /**
   * Synchronize orders between Spocket and Square
   * @param request - Sync request parameters
   */
  public async syncOrders(request: OrderSyncRequest = {}): Promise<OrderSyncResult> {
    const { 
      dateRange,
      direction = 'bidirectional', 
      batchSize = 25,
      locationId = this.squareLocationId 
    } = request;

    const result: OrderSyncResult = {
      syncedOrders: 0,
      createdOrders: {
        spocket: 0,
        square: 0
      },
      updatedOrders: {
        spocket: 0,
        square: 0
      },
      errors: []
    };

    try {
      logger.info(`Starting order synchronization with ${direction} direction`, { dateRange });
      
      // Step 1: Fetch orders from both platforms
      const [spocketOrders, squareOrders] = await Promise.all([
        direction === 'square-to-spocket' ? [] : this.fetchSpocketOrders(dateRange),
        direction === 'spocket-to-square' ? [] : this.fetchSquareOrders(dateRange, undefined, locationId)
      ]);
      
      logger.info(`Fetched ${spocketOrders.length} Spocket orders and ${squareOrders.length} Square orders`);
      
      // Step 2: Build a mapping between orders using external references
      const orderMappings = buildOrderMappings(spocketOrders, squareOrders);
      
      // Step 3: Process orders in batches
      if (direction !== 'square-to-spocket') {
        // Process Spocket orders to Square
        for (let i = 0; i < spocketOrders.length; i += batchSize) {
          const batch = spocketOrders.slice(i, Math.min(i + batchSize, spocketOrders.length));
          const batchResult = await processOrderBatch(
            batch, 
            orderMappings, 
            'spocket-to-square',
            locationId
          );
          
          // Update result counts
          result.syncedOrders += batchResult.syncedOrders;
          result.createdOrders.square += batchResult.createdOrders;
          result.updatedOrders.square += batchResult.updatedOrders;
          result.errors = [...result.errors, ...batchResult.errors];
          
          logger.info(`Processed Spocket-to-Square batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(spocketOrders.length / batchSize)}`);
        }
      }
      
      if (direction !== 'spocket-to-square') {
        // Process Square orders to Spocket
        for (let i = 0; i < squareOrders.length; i += batchSize) {
          const batch = squareOrders.slice(i, Math.min(i + batchSize, squareOrders.length));
          const batchResult = await processOrderBatch(
            batch, 
            orderMappings, 
            'square-to-spocket'
          );
          
          // Update result counts
          result.syncedOrders += batchResult.syncedOrders;
          result.createdOrders.spocket += batchResult.createdOrders;
          result.updatedOrders.spocket += batchResult.updatedOrders;
          result.errors = [...result.errors, ...batchResult.errors];
          
          logger.info(`Processed Square-to-Spocket batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(squareOrders.length / batchSize)}`);
        }
      }
      
      logger.info('Order

import { RateLimiter } from 'limiter';
import { logger } from '../../utils/logger';
import { SpocketOrder, SquareOrder } from '../../types/order.types';
import { OrderMapper } from './order.mapper';

/**
 * Singleton service responsible for synchronizing orders between Spocket and Square
 */
export class OrderService {
  private static instance: OrderService;
  private spocketRateLimiter: RateLimiter;
  private squareRateLimiter: RateLimiter;
  private retryDelays = [1000, 3000, 5000]; // Retry delays in milliseconds

  private constructor() {
    // Initialize rate limiters - 50 requests per minute for each API
    this.spocketRateLimiter = new RateLimiter({ tokensPerInterval: 50, interval: 60000 });
    this.squareRateLimiter = new RateLimiter({ tokensPerInterval: 50, interval: 60000 });
  }

  public static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  /**
   * Fetches orders from Spocket with rate limiting
   * @param startDate - Optional start date to filter orders
   * @param endDate - Optional end date to filter orders
   * @returns Promise with array of Spocket orders
   */
  public async fetchSpocketOrders(startDate?: Date, endDate?: Date): Promise<SpocketOrder[]> {
    try {
      // Wait for token from rate limiter
      await this.spocketRateLimiter.removeTokens(1);
      
      logger.info('Fetching orders from Spocket', { startDate, endDate });
      
      // Mock implementation - replace with actual API call
      const mockSpocketOrders: SpocketOrder[] = [
        {
          id: 'spo-123456',
          customerId: 'cust-123',
          status: 'pending',
          paymentStatus: 'paid',
          fulfillmentStatus: 'unfulfilled',
          orderDate: new Date().toISOString(),
          lineItems: [
            { 
              id: 'li-1', 
              name: 'Product 1', 
              sku: 'sku-1',
              quantity: 2,
              price: 19.99,
              totalPrice: 39.98
            }
          ],
          shippingAddress: {
            name: 'John Doe',
            address1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            country: 'US',
            zipCode: '94105',
            phone: '+14155551234'
          },
          billingAddress: {
            name: 'John Doe',
            address1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            country: 'US',
            zipCode: '94105',
            phone: '+14155551234'
          },
          shippingMethod: 'standard',
          shippingCost: 5.99,
          subtotal: 39.98,
          total: 45.97,
          customerEmail: 'john@example.com',
          notes: 'Please leave at the door'
        }
      ];

      return mockSpocketOrders;
    } catch (error) {
      logger.error('Error fetching Spocket orders', { error });
      throw new Error(`Failed to fetch Spocket orders: ${error.message}`);
    }
  }

  /**
   * Fetches orders from Square with rate limiting
   * @param startDate - Optional start date to filter orders
   * @param endDate - Optional end date to filter orders
   * @returns Promise with array of Square orders
   */
  public async fetchSquareOrders(startDate?: Date, endDate?: Date): Promise<SquareOrder[]> {
    try {
      // Wait for token from rate limiter
      await this.squareRateLimiter.removeTokens(1);
      
      logger.info('Fetching orders from Square', { startDate, endDate });
      
      // Mock implementation - replace with actual API call
      const mockSquareOrders: SquareOrder[] = [
        {
          id: 'sq-123456',
          customerId: 'sq-cust-123',
          state: 'OPEN',
          paymentState: 'COMPLETED',
          fulfillmentState: 'PROPOSED',
          createdAt: new Date().toISOString(),
          lineItems: [
            {
              uid: 'li-sq-1',
              name: 'Square Product 1',
              catalogObjectId: 'catalog-1',
              quantity: '2',
              basePriceMoney: {
                amount: 1999,
                currency: 'USD'
              },
              totalMoney: {
                amount: 3998,
                currency: 'USD'
              }
            }
          ],
          fulfillments: [
            {
              uid: 'ful-1',
              type: 'SHIPMENT',
              state: 'PROPOSED',
              shipmentDetails: {
                recipient: {
                  displayName: 'Jane Smith',
                  phoneNumber: '+14155557890',
                  address: {
                    addressLine1: '456 Market St',
                    locality: 'San Francisco',
                    administrativeDistrictLevel1: 'CA',
                    country: 'US',
                    postalCode: '94105'
                  }
                },
                carrier: 'USPS',
                shippingNote: 'Fragile items'
              }
            }
          ],
          totalMoney: {
            amount: 4597,
            currency: 'USD'
          },
          totalTaxMoney: {
            amount: 0,
            currency: 'USD'
          },
          totalDiscountMoney: {
            amount: 0,
            currency: 'USD'
          },
          totalServiceChargeMoney: {
            amount: 599,
            currency: 'USD'
          },
          netAmountDueMoney: {
            amount: 4597,
            currency: 'USD'
          }
        }
      ];

      return mockSquareOrders;
    } catch (error) {
      logger.error('Error fetching Square orders', { error });
      throw new Error(`Failed to fetch Square orders: ${error.message}`);
    }
  }

  /**
   * Synchronizes orders between Spocket and Square in both directions
   * @param startDate - Optional start date to filter orders
   * @param endDate - Optional end date to filter orders
   */
  public async syncOrders(startDate?: Date, endDate?: Date): Promise<void> {
    try {
      logger.info('Starting order synchronization');
      
      // Fetch orders from both platforms
      const [spocketOrders, squareOrders] = await Promise.all([
        this.fetchSpocketOrders(startDate, endDate),
        this.fetchSquareOrders(startDate, endDate)
      ]);
      
      logger.info(`Fetched ${spocketOrders.length} Spocket orders and ${squareOrders.length} Square orders`);
      
      // Process orders in batches
      await this.processOrderBatches(spocketOrders, squareOrders);
      
      logger.info('Order synchronization completed successfully');
    } catch (error) {
      logger.error('Error during order synchronization', { error });
      throw new Error(`Order synchronization failed: ${error.message}`);
    }
  }

  /**
   * Processes orders in batches to avoid overwhelming APIs
   * @param spocketOrders - Array of Spocket orders
   * @param squareOrders - Array of Square orders
   */
  private async processOrderBatches(spocketOrders: SpocketOrder[], squareOrders: SquareOrder[]): Promise<void> {
    const BATCH_SIZE = 10;
    
    // Map Square orders by ID for quick lookup
    const squareOrderMap = new Map<string, SquareOrder>();
    squareOrders.forEach(order => {
      const spocketId = this.extractSpocketIdFromSquareOrder(order);
      if (spocketId) {
        squareOrderMap.set(spocketId, order);
      }
    });
    
    // Process Spocket orders in batches
    for (let i = 0; i < spocketOrders.length; i += BATCH_SIZE) {
      const batch = spocketOrders.slice(i, i + BATCH_SIZE);
      
      // Process each order in the batch concurrently
      await Promise.all(batch.map(async spocketOrder => {
        const correspondingSquareOrder = squareOrderMap.get(spocketOrder.id);
        
        if (correspondingSquareOrder) {
          // Order exists in both systems - update if needed
          await this.reconcileOrders(spocketOrder, correspondingSquareOrder);
        } else {
          // Order exists only in Spocket - create in Square
          await this.createOrderInSquare(spocketOrder);
        }
      }));
      
      logger.info(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(spocketOrders.length / BATCH_SIZE)}`);
    }
    
    // Find orders in Square that don't exist in Spocket
    const spocketOrderIds = new Set(spocketOrders.map(order => order.id));
    const squareOnlyOrders = squareOrders.filter(order => {
      const spocketId = this.extractSpocketIdFromSquareOrder(order);
      return spocketId && !spocketOrderIds.has(spocketId);
    });
    
    // Process Square-only orders
    if (squareOnlyOrders.length > 0) {
      logger.info(`Found ${squareOnlyOrders.length} orders in Square that don't exist in Spocket`);
      
      for (let i = 0; i < squareOnlyOrders.length; i += BATCH_SIZE) {
        const batch = squareOnlyOrders.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async squareOrder => {
          await this.createOrderInSpocket(squareOrder);
        }));
        
        logger.info(`Processed Square-only batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(squareOnlyOrders.length / BATCH_SIZE)}`);
      }
    }
  }

  /**
   * Reconciles orders between Spocket and Square, updating as needed
   * @param spocketOrder - Spocket order
   * @param squareOrder - Corresponding Square order
   */
  private async reconcileOrders(spocketOrder: SpocketOrder, squareOrder: SquareOrder): Promise<void> {
    try {
      // Compare order statuses and update if needed
      if (this.needsStatusUpdate(spocketOrder, squareOrder)) {
        await this.updateOrderStatus(spocketOrder, squareOrder);
      }
      
      // Compare fulfillment status and update if needed
      if (this.needsFulfillmentUpdate(spocketOrder, squareOrder)) {
        await this.updateFulfillmentStatus(spocketOrder, squareOrder);
      }
      
      // Compare payment status and update if needed
      if (this.needsPaymentUpdate(spocketOrder, squareOrder)) {
        await this.updatePaymentStatus(spocketOrder, squareOrder);
      }
    } catch (error) {
      logger.error('Error reconciling orders', { 
        spocketOrderId: spocketOrder.id, 
        squareOrderId: squareOrder.id,
        error 
      });
      throw error;
    }
  }

  /**
   * Determines if an order status update is needed
   */
  private needsStatusUpdate(spocketOrder: SpocketOrder, squareOrder: SquareOrder): boolean {
    const mappedSpocketStatus = OrderMapper.mapSpocketStatusToSquare(spocketOrder.status);
    return mappedSpocketStatus !== squareOrder.state;
  }

  /**
   * Determines if a fulfillment status update is needed
   */
  private needsFulfillmentUpdate(spocketOrder: SpocketOrder, squareOrder: SquareOrder): boolean {
    const mappedFulfillmentStatus = OrderMapper.mapSpocketFulfillmentStatusToSquare(spocketOrder.fulfillmentStatus);
    const squareFulfillmentState = squareOrder.fulfillments?.[0]?.state || 'PROPOSED';
    return mappedFulfillmentStatus !== squareFulfillmentState;
  }

  /**
   * Determines if a payment status update is needed
   */
  private needsPaymentUpdate(spocketOrder: SpocketOrder, squareOrder: SquareOrder): boolean {
    const mappedPaymentStatus = OrderMapper.mapSpocketPaymentStatusToSquare(spocketOrder.paymentStatus);
    return mappedPaymentStatus !== squareOrder.paymentState;
  }

  /**
   * Updates the order status in both systems to keep them in sync
   * @param spocketOrder - Spocket order
   * @param squareOrder - Square order
   */
  public async updateOrderStatus(spocketOrder: SpocketOrder, squareOrder: SquareOrder): Promise<void> {
    try {
      const mappedSpocketStatus = OrderMapper.mapSpocketStatusToSquare(spocketOrder.status);
      const mappedSquareStatus = OrderMapper.mapSquareStatusToSpocket(squareOrder.state);
      
      // Determine which status is more up-to-date (based on status priority)
      const statusPriority = {
        'DRAFT': 0,
        'OPEN': 1,
        'COMPLETED': 2,
        'CANCELED': 3
      };
      
      if (statusPriority[mappedSpocketStatus] < statusPriority[squareOrder.state]) {
        // Square status is more advanced, update Spocket
        await this.updateSpocketOrderStatus(spocketOrder.id, mappedSquareStatus);
        logger.info(`Updated Spocket order status`, { 
          orderId: spocketOrder.id, 
          oldStatus: spocketOrder.status, 
          newStatus: mappedSquareStatus 
        });
      } else if (statusPriority[mappedSpocketStatus] > statusPriority[squareOrder.state]) {
        // Spocket status is more advanced, update Square
        await this.updateSquareOrderStatus(squareOrder.id, mappedSpocketStatus);
        logger.info(`Updated Square order status`, { 
          orderId: squareOrder.id, 
          oldStatus: squareOrder.state, 
          newStatus: mappedSpocketStatus 
        });
      }
    } catch (error) {
      logger.error('Error updating order status', { 
        spocketOrderId: spocketOrder.id, 
        squareOrderId: squareOrder.id,
        error
      });
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  }

  /**
   * Updates the fulfillment status in both systems to keep them in sync
   * @param spocketOrder - Spocket order
   * @param squareOrder - Square order
   */

/**
 * Order Synchronization Service for Spocket-Square integration
 */
import { createLogger } from '../common/logger';
import { createSpocketRateLimiter, createSquareRateLimiter } from '../common/rate-limiter';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import { configService } from '../config/config.service';
import { spocketAuthService } from '../auth/spocket-auth.service';

import {
  spocketToSquareOrder,
  squareToSpocketOrder,
  mapSpocketFulfillmentStatusToSquare,
  mapSquareFulfillmentStatusToSpocket,
  extractShippingDetails,
  extractPaymentDetails
} from './order.mapper';

import {
  Order,
  OrderSyncRequest,
  OrderSyncResult,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderFulfillmentUpdate,
  OrderPaymentUpdate
} from '../../types/order.types';

import { EntityMapping, SyncEntityType } from '../../types/sync.types';

// Configure logger
const logger = createLogger('order-service');

/**
 * Order Synchronization Service
 * Handles order synchronization between Spocket and Square
 */
export class OrderService {
  private static instance: OrderService;
  private squareClient: any; // Square SDK Client
  private spocketBasePath: string;
  
  // Rate limiters for API calls
  private spocketLimiter;
  private squareLimiter;
  
  // Default Square location ID
  private squareLocationId: string = '';

  private constructor() {
    this.spocketBasePath = configService.getEnv('SPOCKET_API_BASE_URL') || 'https://api.spocket.co';
    
    // Initialize rate limiters
    this.spocketLimiter = createSpocketRateLimiter();
    this.squareLimiter = createSquareRateLimiter();
    
    // Initialize Square client from the main instance
    // In a real implementation, you would import the client from a shared service
    this.squareClient = configService.getSquareClient();
    
    // Set default Square location ID
    this.squareLocationId = configService.getEnv('SQUARE_LOCATION_ID') || 'default_location';
    
    logger.info(`OrderService initialized with Square location: ${this.squareLocationId}`);
  }

  /**
   * Get singleton instance of OrderService
   */
  public static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  /**
   * Fetch orders from Spocket
   * @param dateRange - Optional date range filter
   * @param statuses - Optional status filter
   * @param page - Page number for pagination
   * @param limit - Number of items per page
   */
  public async fetchSpocketOrders(
    dateRange?: { start: Date; end: Date },
    statuses?: OrderFulfillmentStatus[],
    page: number = 1,
    limit: number = 50
  ): Promise<Order[]> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.spocketLimiter.schedule(async () => {
        logger.info('Fetching orders from Spocket');
        
        const token = await spocketAuthService.getAccessToken();
        
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
      });
    } catch (error: any) {
      logger.error(`Error fetching orders from Spocket: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      throw new Error(`Failed to fetch Spocket orders: ${error.message}`);
    }
  }

  /**
   * Fetch orders from Square
   * @param dateRange - Optional date range filter
   * @param statuses - Optional status filter
   * @param locationId - Square location ID
   */
  public async fetchSquareOrders(
    dateRange?: { start: Date; end: Date },
    statuses?: string[],
    locationId: string = this.squareLocationId
  ): Promise<any[]> {
    try {
      // Use rate limiter to avoid hitting API limits
      return await this.squareLimiter.schedule(async () => {
        logger.info(`Fetching orders from Square for location ${locationId}`);
        
        // In a real implementation, you'd use the Square SDK
        // This is a placeholder for the actual API call
        
        // Mock Square orders - in a real implementation, fetch from Square API
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
          return squareToSpocketOrder(squareOrder);
        });
      });
    } catch (error: any) {
      logger.error(`Error fetching orders from Square: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      throw new Error(`Failed to fetch Square orders: ${error.message}`);
    }
  }

  /**
   * Synchronize orders between Spocket and Square
   * @param request - Sync request parameters
   */
  public async syncOrders(request: OrderSyncRequest = {}): Promise<OrderSyncResult> {
    const { 
      dateRange,
      direction = 'bidirectional', 
      batchSize = 25,
      locationId = this.squareLocationId 
    } = request;

    const result: OrderSyncResult = {
      syncedOrders: 0,
      createdOrders: {
        spocket: 0,
        square: 0
      },
      updatedOrders: {
        spocket: 0,
        square: 0
      },
      errors: []
    };

    try {
      logger.info(`Starting order synchronization with ${direction} direction`, { dateRange });
      
      // Step 1: Fetch orders from both platforms
      const [spocketOrders, squareOrders] = await Promise.all([
        direction === 'square-to-spocket' ? [] : this.fetchSpocketOrders(dateRange),
        direction === 'spocket-to-square' ? [] : this.fetchSquareOrders(dateRange, undefined, locationId)
      ]);
      
      logger.info(`Fetched ${spocketOrders.length} Spocket orders and ${squareOrders.length} Square orders`);
      
      // Step 2: Build a mapping between orders using external references
      const orderMappings = this.buildOrderMappings(spocketOrders, squareOrders);
      
      // Step 3: Process orders in batches
      if (direction !== 'square-to-spocket') {
        // Process Spocket orders to Square
        for (let i = 0; i < spocketOrders.length; i += batchSize) {
          const batch = spocketOrders.slice(i, Math.min(i + batchSize, spocketOrders.length));
          const batchResult = await this.processOrderBatch(
            batch, 
            orderMappings, 
            'spocket-to-square',
            locationId
          );
          
          // Update result counts
          result.syncedOrders += batchResult.syncedOrders;
          result.createdOrders.square += batchResult.createdOrders;
          result.updatedOrders.square += batchResult.updatedOrders;
          result.errors = [...result.errors, ...batchResult.errors];
          
          logger.info(`Processed Spocket-to-Square batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(spocketOrders.length / batchSize)}`);
        }
      }
      
      if (direction !== 'spocket-to-square') {
        // Process Square orders to Spocket
        for (let i = 0; i < squareOrders.length; i += batchSize) {
          const batch = squareOrders.slice(i, Math.min(i + batchSize, squareOrders.length));
          const batchResult = await this.processOrderBatch(
            batch, 
            orderMappings, 
            'square-to-spocket'
          );
          
          // Update result counts
          result.syncedOrders += batchResult.syncedOrders;
          result.createdOrders.spocket += batchResult.createdOrders;
          result.updatedOrders.spocket += batchResult.updatedOrders;
          result.errors = [...result.errors, ...batchResult.errors];
          
          logger.info(`Processed Square-to-Spocket batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(squareOrders.length / batchSize)}`);
        }
      }
      
      logger.info('Order synchronization completed', result);
      return result;
    } catch (error: any) {
      const errorMessage = `Order synchronization failed: ${error.message}`;
      logger.error(errorMessage, {
        error: error.toString(),
        stack: error.stack
      });
      
      result.errors.push({
        message: errorMessage,
        orderId: null,
        source: 'sync',
        details: error.toString()
      });
      
      return result;
    }
  }

  /**
   * Process a batch of orders for synchronization
   * @param orders - Orders to process
   * @param mappings - Mappings between Spocket and Square orders
   * @param direction - Direction of synchronization
   * @param locationId - Square location ID
   */
  private async processOrderBatch(
    orders: Order[],
    mappings: EntityMapping[],
    direction: 'spocket-to-square' | 'square-to-spocket' | 'bidirectional',
    locationId: string = this.squareLocationId
  ): Promise<{
    syncedOrders: number;
    createdOrders: number;
    updatedOrders: number;
    errors: Array<{
      message: string;
      orderId: string | null;
      source: string;
      details?: string;
    }>;
  }> {
    const result = {
      syncedOrders: 0,
      createdOrders: 0,
      updatedOrders: 0,
      errors: [] as Array<{
        message: string;
        orderId: string | null;
        source: string;
        details?: string;
      }>
    };
    
    // Process each order in the batch with individual error handling
    await Promise.all(
      orders.map(async (order) => {
        try {
          // Find existing mapping
          const mapping = mappings.find(m => 
            (direction === 'spocket-to-square' && m.sourceId === order.id) ||
            (direction === 'square-to-spocket' && m.targetId === order.id)
          );
          
          if (mapping) {
            // Order exists in both systems - update
            await this.updateOrder(order, mapping, direction);
            result.updatedOrders++;
          } else {
            // Order only exists in source system - create in target
            await this.createOrder(order, direction, locationId);
            result.createdOrders++;
          }
          
          result.syncedOrders++;
        } catch (error: any) {
          logger.error(`Error processing order ${order.id}`, {
            error: error.toString(),
            direction,
            orderId: order.id
          });
          
          result.errors.push({
            message: `Failed to process order: ${error.message}`,
            orderId: order.id,
            source: direction === 'spocket-to-square' ? 'spocket' : 'square',
            details: error.toString()
          });
        }
      })
    );
    
    return result;
  }

  /**
   * Build mappings between Spocket and Square orders
   * @param spocketOrders - Orders from Spocket
   * @param squareOrders - Orders from Square
   */
  private buildOrderMappings(spocketOrders: Order[], squareOrders: Order[]): EntityMapping[] {
    const mappings: EntityMapping[] = [];
    
    // Scan for orders with external references
    for (const spocketOrder of spocketOrders) {
      // Look for matching Square order by reference
      const squareOrder = squareOrders.find(sqOrder => {
        // Check if the Square order has a reference_id that matches the Spocket order ID
        return sqOrder.externalId === spocketOrder.id || 
               sqOrder.orderNumber === spocketOrder.orderNumber;
      });
      
      if (squareOrder) {
        mappings.push({
          entityType: SyncEntityType.ORDER,
          sourceId: spocketOrder.id,
          targetId: squareOrder.id,
          sourceSystem: 'spocket',
          targetSystem: 'square'
        });
      }
    }
    
    logger.info(`Built ${mappings.length} order mappings between Spocket and Square`);
    return mappings;
  }

  /**
   * Create an order in the target system
   * @param order - Order to create
   * @param direction - Direction of creation
   * @param locationId - Square location ID
   */
  private async createOrder(
    order: Order,
    direction: 'spocket-to-square' | 'square-to-spocket',
    locationId: string = this.squareLocationId
  ): Promise<string> {
    try {
      if (direction === 'spocket-to-square') {
        // Create order in Square
        return await this.createSquareOrder(order, locationId);
      } else {
        // Create order in Spocket
        return await this.createSpocketOrder(order);
      }
    } catch (error: any) {
      logger.error(`Failed to create order in ${direction === 'spocket-to-square' ? 'Square' : 'Spocket'}`, {
