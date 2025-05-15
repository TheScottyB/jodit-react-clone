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
  method: string

