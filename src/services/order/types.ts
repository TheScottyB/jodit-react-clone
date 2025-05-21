/**
 * Common types for order synchronization
 */

export enum SyncDirection {
  SPOCKET_TO_SQUARE = 'SPOCKET_TO_SQUARE',
  SQUARE_TO_SPOCKET = 'SQUARE_TO_SPOCKET',
  BIDIRECTIONAL = 'BIDIRECTIONAL',
}

export interface SyncResult {
  success: boolean;
  sourceOrderId: string;
  targetOrderId?: string;
  error?: string;
  alreadyExists?: boolean;
  retryCount?: number;
}

export interface StatusSyncResult extends SyncResult {
  sourceStatus: string;
  targetStatus?: string;
}

export interface FulfillmentSyncResult extends SyncResult {
  sourceFulfillmentId: string;
  targetFulfillmentId?: string;
}

export interface PaymentSyncResult extends SyncResult {
  sourcePaymentId: string;
  targetPaymentId?: string;
}

export interface WebhookProcessResult {
  success: boolean;
  event: string;
  orderId: string;
  new?: boolean;
  actionRequired?: string;
}

