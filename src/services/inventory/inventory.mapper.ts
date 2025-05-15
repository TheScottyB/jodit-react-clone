/**
 * Inventory mapping utilities for converting between Spocket and Square inventory formats
 */
import { SpocketProduct, SpocketProductVariant } from '../types/spocket.types';
import { SquareInventory, SquareCatalogObject, Money } from '../types/square.types';
import { 
  InventoryLevel, 
  InventoryAdjustment, 
  InventoryBatchOperation,
  InventoryComparisonResult
} from './inventory.types';
import { EntityMapping, SyncEntityType } from '../sync/sync.types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extract inventory levels from Spocket product
 */
export function extractSpocketInventoryLevels(product: SpocketProduct): InventoryLevel[] {
  const levels: InventoryLevel[] = [];
  
  if (product.variants.length > 0) {
    // Extract inventory levels from each variant
    product.variants.forEach(variant => {
      levels.push({
        productId: product.id,
        variantId: variant.id,
        sku: variant.sku,
        quantity: variant.inventory_quantity,
        updatedAt: new Date(variant.updated_at)
      });
    });
  } else {
    // Extract inventory level from the main product
    levels.push({
      productId: product.id,
      sku: product.sku,
      quantity: product.inventory_quantity,
      updatedAt: new Date(product.updated_at)
    });
  }
  
  return levels;
}

/**
 * Extract inventory levels from Square catalog and inventory data
 */
export function extractSquareInventoryLevels(
  catalogObjects: SquareCatalogObject[],
  inventoryData: SquareInventory[],
  locationId: string
): InventoryLevel[] {
  const levels: InventoryLevel[] = [];
  
  // First, create a mapping of catalog object IDs to inventory data
  const inventoryMap = new Map<string, SquareInventory>();
  inventoryData.forEach(inventory => {
    if (inventory.location_id === locationId) {
      inventoryMap.set(inventory.catalog_object_id, inventory);
    }
  });
  
  // Find all item variations with SKUs
  const variations = catalogObjects.filter(obj => 
    obj.type === 'ITEM_VARIATION' && 
    obj.item_variation_data?.sku
  );
  
  // Extract inventory levels from variations
  variations.forEach(variation => {
    const variationData = variation.item_variation_data;
    if (!variationData) return;
    
    const sku = variationData.sku || '';
    if (!sku) return;
    
    // Find the parent item
    const parentItem = catalogObjects.find(obj => 
      obj.type === 'ITEM' && 
      obj.id === variationData.item_id
    );
    
    if (!parentItem || !parentItem.item_data) return;
    
    // Get inventory data if available
    const inventory = inventoryMap.get(variation.id);
    const quantity = inventory ? parseInt(inventory.quantity || '0') : 0;
    
    levels.push({
      productId: parentItem.id,
      variantId: variation.id,
      sku,
      quantity,
      locationId,
      updatedAt: new Date(variation.updated_at)
    });
  });
  
  return levels;
}

/**
 * Create Square inventory adjustments for batch operation
 */
export function createSquareInventoryAdjustments(
  inventoryLevels: InventoryLevel[],
  comparisonResults: InventoryComparisonResult[],
  locationId: string
): {
  adjustments: {
    catalog_object_id: string;
    location_id: string;
    quantity: string;
    from_state?: string;
    to_state?: string;
    occurred_at?: string;
  }[];
  idempotencyKey: string;
} {
  const adjustments: any[] = [];
  
  // Process each comparison result that requires sync
  comparisonResults
    .filter(result => result.requiresSync && result.productMapping)
    .forEach(result => {
      const squareId = result.productMapping?.squareId || '';
      if (!squareId) return;
      
      // Calculate the adjustment quantity (difference between Square and Spocket)
      const difference = result.spocketQuantity - result.squareQuantity;
      if (difference === 0) return;
      
      // Add the adjustment
      adjustments.push({
        catalog_object_id: squareId,
        location_id: locationId,
        // Square expects a string for quantity
        quantity: Math.abs(difference).toString(),
        // If difference is positive, we're adding inventory
        from_state: difference > 0 ? 'NONE' : 'IN_STOCK',
        to_state: difference > 0 ? 'IN_STOCK' : 'NONE',
        occurred_at: new Date().toISOString()
      });
    });
  
  return {
    adjustments,
    idempotencyKey: uuidv4()
  };
}

/**
 * Create Spocket inventory adjustments
 */
export function createSpocketInventoryAdjustments(
  comparisonResults: InventoryComparisonResult[]
): InventoryAdjustment[] {
  const adjustments: InventoryAdjustment[] = [];
  
  // Process each comparison result that requires sync
  comparisonResults
    .filter(result => result.requiresSync)
    .forEach(result => {
      // Calculate the adjustment quantity (difference between Spocket and Square)
      const difference = result.squareQuantity - result.spocketQuantity;
      if (difference === 0) return;
      
      // Add the adjustment
      adjustments.push({
        productId: result.productMapping?.spocketId || '',
        sku: result.sku,
        quantityDelta: difference,
        reason: 'sync',
        timestamp: new Date(),
        notes: `Synchronized with Square inventory (${Math.abs(difference)} ${difference > 0 ? 'added' : 'removed'})`
      });
    });
  
  return adjustments;
}

/**
 * Compare inventory levels between Spocket and Square to identify discrepancies
 */
export function compareInventoryLevels(
  spocketLevels: InventoryLevel[],
  squareLevels: InventoryLevel[],
  productMappings: EntityMapping[],
  threshold: number = 0
): InventoryComparisonResult[] {
  const results: InventoryComparisonResult[] = [];
  
  // Create mappings for easier lookup
  const spocketMap = new Map<string, InventoryLevel>();
  spocketLevels.forEach(level => {
    spocketMap.set(level.sku, level);
  });
  
  const squareMap = new Map<string, InventoryLevel>();
  squareLevels.forEach(level => {
    squareMap.set(level.sku, level);
  });
  
  // Create a set of all unique SKUs
  const allSkus = new Set<string>();
  spocketLevels.forEach(level => allSkus.add(level.sku));
  squareLevels.forEach(level => allSkus.add(level.sku));
  
  // Process each SKU
  allSkus.forEach(sku => {
    const spocketLevel = spocketMap.get(sku);
    const squareLevel = squareMap.get(sku);
    
    // Skip SKUs that don't exist in both systems unless we have a mapping
    if (!spocketLevel && !squareLevel) return;
    
    // Find product mapping based on IDs
    let productMapping: EntityMapping | undefined;
    
    if (spocketLevel) {
      productMapping = productMappings.find(
        mapping => mapping.spocketId === spocketLevel.productId
      );
    }
    
    if (!productMapping && squareLevel) {
      productMapping = productMappings.find(
        mapping => mapping.squareId === squareLevel.productId
      );
    }
    
    // Calculate quantities and discrepancy
    const spocketQuantity = spocketLevel ? spocketLevel.quantity : 0;
    const squareQuantity = squareLevel ? squareLevel.quantity : 0;
    const discrepancy = squareQuantity - spocketQuantity;
    
    // Determine if sync is required based on threshold
    const requiresSync = Math.abs(discrepancy) > threshold;
    
    results.push({
      sku,
      spocketQuantity,
      squareQuantity,
      discrepancy,
      requiresSync,
      productMapping
    });
  });
  
  return results;
}

