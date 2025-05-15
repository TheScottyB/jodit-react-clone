/**
 * Type definitions for inventory synchronization
 */
import { SpocketProduct, SpocketProductVariant } from '../types/spocket.types';
import { SquareCatalogObject, SquareInventory } from '../types/square.types';
import { EntityMapping, SyncEntityType } from '../sync/sync.types';

/**
 * Inventory change reason
 */
export enum InventoryChangeReason {
  PURCHASE = 'purchase',
  RETURN = 'return',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
  SYNC = 'sync',
  SALE = 'sale'
}

/**
 * Inventory adjustment direction
 */
export enum InventoryAdjustmentDirection {
  INCREASE = 'increase',
  DECREASE = 'decrease'
}

/**
 * Inventory level
 */
export interface InventoryLevel {
  productId: string;
  variantId?: string;
  sku: string;
  quantity: number;
  locationId?: string;
  updatedAt: Date;
}

/**
 * Inventory adjustment
 */
export interface InventoryAdjustment {
  productId: string;
  variantId?: string;
  sku: string;
  quantityDelta: number; // Positive for increase, negative for decrease
  reason: InventoryChangeReason;
  notes?: string;
  locationId?: string;
  timestamp: Date;
  referenceId?: string; // Order ID or other reference
}

/**
 * Inventory batch operation
 */
export interface InventoryBatchOperation {
  adjustments: InventoryAdjustment[];
  timestamp: Date;
  idempotencyKey: string;
}

/**
 * Inventory synchronization request
 */
export interface InventorySyncRequest {
  direction: 'spocket_to_square' | 'square_to_spocket' | 'bidirectional';
  productMappings: EntityMapping[];
  locationId?: string; // Square location ID for inventory operations
  batchSize: number;
  forceUpdate?: boolean; // Force update even if quantities match
}

/**
 * Inventory synchronization result
 */
export interface InventorySyncResult {
  success: boolean;
  syncedItems: number;
  skippedItems: number;
  errors: {
    sku: string;
    message: string;
    code: string;
  }[];
  details: {
    sku: string;
    spocketQuantity: number;
    squareQuantity: number;
    action: 'updated' | 'skipped' | 'error';
  }[];
}

/**
 * Inventory comparison result
 */
export interface InventoryComparisonResult {
  sku: string;
  spocketQuantity: number;
  squareQuantity: number;
  discrepancy: number; // squareQuantity - spocketQuantity
  requiresSync: boolean;
  productMapping?: EntityMapping;
}

/**
 * Mapping between Product/Variant IDs and inventory-specific identifiers
 */
export interface InventoryMapping {
  productId: string;
  variantId?: string;
  sku: string;
  spocketInventoryId?: string;
  squareInventoryId?: string;
  lastSynced?: Date;
}

