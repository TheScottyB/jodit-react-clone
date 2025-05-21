/**
 * Type definitions for order synchronization
 */
import { EntityMapping, SyncEntityType } from '../sync/sync.types';

/**
 * Order fulfillment status
 */
export enum OrderFulfillmentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

/**
 * Order payment status
 */
export enum OrderPaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  FAILED = 'failed',
  VOIDED = 'voided'
}

/**
 * Common interface for order items across platforms
 */
export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  total: number;
  metadata?: Record<string, any>;
}

/**
 * Common interface for customer information
 */
export interface OrderCustomer {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
}

/**
 * Common interface for shipping address
 */
export interface OrderAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

/**
 * Common interface for order shipping details
 */
export interface OrderShipping {
  address: OrderAddress;
  method: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
  cost?: {
    amount: number;
    currency: string;
  };
  notes?: string;
}

/**
 * Common interface for payment information
 */
export interface OrderPayment {
  id: string;
  amount: {
    amount: number;
    currency: string;
  };
  status: OrderPaymentStatus;
  method: string;
  cardBrand?: string;
  cardLast4?: string;
  externalPaymentId?: string;
  refundId?: string;
  transactionDate?: Date;
}

/**
 * Common interface for order fulfillment updates
 */
export interface OrderFulfillmentUpdate {
  orderId: string;
  status: OrderFulfillmentStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  notes?: string;
  updatedAt: Date;
}

/**
 * Common interface for order payment updates
 */
export interface OrderPaymentUpdate {
  orderId: string;
  status: OrderPaymentStatus;
  amount?: {
    amount: number;
    currency: string;
  };
  transactionId?: string;
  notes?: string;
  updatedAt: Date;
}

/**
 * Common interface for orders across platforms
 */
export interface Order {
  id: string;
  orderNumber: string;
  externalId?: string;
  customer: OrderCustomer;
  items: OrderItem[];
  shipping: OrderShipping;
  payment?: OrderPayment;
  fulfillmentStatus: OrderFulfillmentStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: {
    amount: number;
    currency: string;
  };
  taxTotal: {
    amount: number;
    currency: string;
  };
  shippingTotal: {
    amount: number;
    currency: string;
  };
  discountTotal: {
    amount: number;
    currency: string;
  };
  total: {
    amount: number;
    currency: string;
  };
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Order synchronization request parameters
 */
export interface OrderSyncRequest {
  dateRange?: {
    start: Date;
    end: Date;
  };
  direction?: 'spocket-to-square' | 'square-to-spocket' | 'bidirectional';
  batchSize?: number;
  locationId?: string;
  statuses?: OrderFulfillmentStatus[];
}

/**
 * Result of order synchronization operation
 */
export interface OrderSyncResult {
  syncedOrders: number;
  createdOrders: {
    spocket: number;
    square: number;
  };
  updatedOrders: {
    spocket: number;
    square: number;
  };
  errors: Array<{
    message: string;
    orderId: string | null;
    source: string;
    details?: string;
  }>;
}
