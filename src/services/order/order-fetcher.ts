/**
 * Order Fetcher Module
 * Handles fetching orders from both Spocket and Square platforms
 */

import { createLogger } from '../common/logger';
import { createSpocketRateLimiter, createSquareRateLimiter } from '../common/rate-limiter';
import { 
  fetchSpocketOrders as fetchSpocketOrdersHandler,
  getSpocketOrderById
} from './handlers/spocket.handler';
import { 
  fetchSquareOrders as fetchSquareOrdersHandler,
  getSquareOrderById
} from './handlers/square.handler';
import { 
  Order,
  OrderFulfillmentStatus
} from '../../types/order.types';

// Configure logger
const logger = createLogger('order-fetcher');

/**
 * Class responsible for fetching orders from various platforms
 */
export class OrderFetcher {
  private static instance: OrderFetcher;
  
  // Rate limiters for API calls
  private spocketLimiter;
  private squareLimiter;
  
  // Default Square location ID
  private squareLocationId: string = '';
  
  private constructor() {
    // Initialize rate limiters
    this.spocketLimiter = createSpocketRateLimiter();
    this.squareLimiter = createSquareRateLimiter();
    
    // Set default Square location ID - should be injected from config in real implementation
    this.squareLocationId = process.env.SQUARE_LOCATION_ID || 'default_location';
    
    logger.info(`OrderFetcher initialized with Square location: ${this.squareLocationId}`);
  }

  /**
   * Get singleton instance of OrderFetcher
   */
  public static getInstance(): OrderFetcher {
    if (!OrderFetcher.instance) {
      OrderFetcher.instance = new OrderFetcher();
    }
    return OrderFetcher.instance;
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
        logger.info('Fetching orders from Spocket', { dateRange, statuses, page, limit });
        
        // Use the handler function from spocket.handler.ts
        const orders = await fetchSpocketOrdersHandler(dateRange, statuses, page, limit);
        
        logger.info(`Fetched ${orders.length} orders from Spocket`);
        return orders;
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
        logger.info(`Fetching orders from Square for location ${locationId}`, { dateRange, statuses });
        
        // Use the handler function from square.handler.ts
        const orders = await fetchSquareOrdersHandler(dateRange, statuses, locationId);
        
        logger.info(`Fetched ${orders.length} orders from Square`);
        return orders;
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
   * Get a specific order by ID from either platform
   * @param orderId - Order ID
   * @param platform - Platform to fetch from
   */
  public async getOrderById(
    orderId: string,
    platform: 'spocket' | 'square'
  ): Promise<Order | null> {
    try {
      logger.info(`Fetching order ${orderId} from ${platform}`);
      
      if (platform === 'spocket') {
        return await this.spocketLimiter.schedule(async () => {
          return await getSpocketOrderById(orderId);
        });
      } else {
        return await this.squareLimiter.schedule(async () => {
          return await getSquareOrderById(orderId);
        });
      }
    } catch (error: any) {
      logger.error(`Error fetching order ${orderId} from ${platform}: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      throw new Error(`Failed to fetch order from ${platform}: ${error.message}`);
    }
  }

  /**
   * Fetch orders from both platforms for synchronization
   * @param dateRange - Optional date range filter
   * @param locationId - Square location ID
   */
  public async fetchOrdersForSync(
    dateRange?: { start: Date; end: Date },
    locationId: string = this.squareLocationId
  ): Promise<{
    spocketOrders: Order[]; 
    squareOrders: Order[];
  }> {
    try {
      logger.info('Fetching orders from both platforms for synchronization', { dateRange });
      
      // Fetch orders in parallel for efficiency
      const [spocketOrders, squareOrders] = await Promise.all([
        this.fetchSpocketOrders(dateRange),
        this.fetchSquareOrders(dateRange, undefined, locationId)
      ]);
      
      logger.info(`Fetched ${spocketOrders.length} Spocket orders and ${squareOrders.length} Square orders for sync`);
      
      return { 
        spocketOrders, 
        squareOrders 
      };
    } catch (error: any) {
      logger.error(`Error fetching orders for sync: ${error.message}`, {
        error: error.toString(),
        stack: error.stack
      });
      throw new Error(`Failed to fetch orders for synchronization: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const orderFetcher = OrderFetcher.getInstance();

