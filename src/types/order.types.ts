/**
 * Type definitions for order synchronization between Spocket and Square
 */
import { EntityMapping } from './sync.types';
import { Money, Address, Customer } from './common.types';

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
 * Common interface for order shipping details
 */
export interface OrderShipping {
  address: Address;
  method: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
  cost: Money;
}

/**
 * Common interface for order payment details
 */
export interface OrderPayment {
  id: string;
  amount: Money;
  status: OrderPaymentStatus;
  method: string;
  cardBrand?: string;
  cardLast4?: string;
  transactionId?: string;
  refundedAmount?: Money;
  capturedAt?: Date;
  refundedAt?: Date;
}

/**
 * Common order interface for cross-platform synchronization
 */
export interface Order {
  id: string;
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  shipping: OrderShipping;
  payment: OrderPayment;
  fulfillmentStatus: OrderFulfillmentStatus;
  paymentStatus: OrderPaymentStatus;
  subtotal: Money;
  taxTotal: Money;
  shippingTotal: Money;
  discountTotal: Money;
  total: Money;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  platformData?: Record<string, any>; // Platform-specific data
}

/**
 * Order synchronization request
 */
export interface OrderSyncRequest {
  direction: 'spocket_to_square' | 'square_to_spocket' | 'bidirectional';
  orderMappings: EntityMapping[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  fulfillmentStatuses?: OrderFulfillmentStatus[];
  paymentStatuses?: OrderPaymentStatus[];
  batchSize: number;
  syncFulfillmentUpdates?: boolean;
  syncPaymentUpdates?: boolean;
}

/**
 * Order synchronization result
 */
export interface OrderSyncResult {
  success: boolean;
  syncedOrders: number;
  skippedOrders: number;
  errors: {
    orderId: string;
    message: string;
    code: string;
  }[];
  details: {
    orderId: string;
    orderNumber: string;
    action: 'created' | 'updated' | 'skipped' | 'error';
  }[];
}

/**
 * Order status mapping between platforms
 */
export interface OrderStatusMapping {
  spocketStatus: string;
  squareStatus: string;
  direction: 'spocket_to_square' | 'square_to_spocket' | 'bidirectional';
}

/**
 * Order fulfillment update
 */
export interface OrderFulfillmentUpdate {
  orderId: string;
  fulfillmentStatus: OrderFulfillmentStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  notes?: string;
  timestamp: Date;
}

/**
 * Order payment update
 */
export interface OrderPaymentUpdate {
  orderId: string;
  paymentStatus: OrderPaymentStatus;
  amount?: Money;
  transactionId?: string;
  notes?: string;
  timestamp: Date;
}

