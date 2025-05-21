/**
 * Spocket Order Types
 */

export enum SpocketOrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export interface SpocketOrderLineItem {
  productId: string;
  quantity: number;
  pricePerItem: number;
  name: string;
  sku: string;
}

export interface SpocketOrderAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface SpocketOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  status: SpocketOrderStatus;
  totalAmount: number;
  orderDate: Date;
  lineItems: SpocketOrderLineItem[];
  shippingAddress: SpocketOrderAddress;
  billingAddress?: SpocketOrderAddress;
  note?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpocketOrderFulfillment {
  id: string;
  orderId: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  shippingDate: Date;
  status: string;
  items: {
    lineItemId: string;
    quantity: number;
  }[];
}

export interface SpocketOrderPayment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentDate: Date;
  metadata?: Record<string, any>;
}

