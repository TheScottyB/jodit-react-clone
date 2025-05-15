/**
 * Product mapping utility for converting between Spocket and Square product formats
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

import { 
  SpocketProduct,
  SpocketProductVariant,
  SpocketProductImage
} from '../types/spocket.types';

import {
  SquareCatalogObject,
  SquareCatalogObjectType,
  SquareCatalogItem,
  SquareCatalogItemVariation,
  SquareCatalogImage,
  Money
} from '../types/square.types';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'product-mapper' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

/**
 * Currency conversion rates (for demonstration purposes)
 * In a production environment, use a currency conversion API
 */
const CURRENCY_CONVERSION_RATES: Record<string, Record<string, number>> = {
  'USD': {
    'EUR': 0.92,
    'GBP': 0.79,
    'CAD': 1.37,
    'USD': 1.0
  },
  'EUR': {
    'USD': 1.09,
    'GBP': 0.86,
    'CAD': 1.49,
    'EUR': 1.0
  },
  // Add more currencies as needed
};

/**
 * Convert Spocket product to Square catalog objects (item and variations)
 * 
 * @param spocketProduct - The Spocket product to convert
 * @param locationId - The Square location ID where the product will be available
 * @returns An array of Square catalog objects
 */
export function spocketToSquareCatalog(
  spocketProduct: SpocketProduct,
  locationId: string
): SquareCatalogObject[] {
  try {
    logger.info(`Converting Spocket product to Square: ${spocketProduct.id} - ${spocketProduct.title}`);

    const catalogObjects: SquareCatalogObject[] = [];
    
    // Create a unique ID for the item that can be referenced by other objects
    const idempotencyKey = `spocket_${spocketProduct.id}`;
    
    // Map product images
    const imageObjects = spocketProduct.images.map(image => 
      createSquareImageObject(image, idempotencyKey)
    );
    
    // Add image objects to catalog objects array
    catalogObjects.push(...imageObjects);
    
    // Create the item object
    const itemObject = createSquareItemObject(
      spocketProduct,
      imageObjects.map(img => img.id),
      locationId
    );
    
    // Add item object to catalog objects array
    catalogObjects.push(itemObject);

    // Create variation objects
    if (spocketProduct.variants.length === 0) {
      // If no variants, create a default variation from the main product
      const defaultVariation = createSquareDefaultVariation(
        spocketProduct,
        itemObject.id,
        locationId
      );
      catalogObjects.push(defaultVariation);
    } else {
      // Create variations from the product variants
      spocketProduct.variants.forEach(variant => {
        const variationObject = createSquareVariationFromVariant(
          variant,
          itemObject.id,
          locationId
        );
        catalogObjects.push(variationObject);
      });
    }

    logger.info(`Successfully converted product ${spocketProduct.id} to ${catalogObjects.length} Square catalog objects`);
    return catalogObjects;
  } catch (error: any) {
    logger.error(`Error converting Spocket product to Square: ${error.message}`, {
      productId: spocketProduct.id,
      error
    });
    throw new Error(`Failed to convert Spocket product to Square: ${error.message}`);
  }
}

/**
 * Convert Square catalog item back to Spocket product format
 * 
 * @param itemObject - The Square catalog item object
 * @param variationObjects - The Square catalog variation objects for this item
 * @param imageObjects - The Square catalog image objects for this item
 * @returns A Spocket product
 */
export function squareToSpocketProduct(
  itemObject: SquareCatalogObject,
  variationObjects: SquareCatalogObject[],
  imageObjects: SquareCatalogObject[]
): SpocketProduct {
  try {
    logger.info(`Converting Square catalog item to Spocket: ${itemObject.id}`);

    if (!itemObject.item_data) {
      throw new Error('Square catalog object is not an item');
    }

    // Extract Square IDs from the object identifiers
    const squareId = itemObject.id;
    const spocketId = extractSpocketIdFromSquareId(squareId);

    // Map Square images to Spocket image format
    const images = imageObjects.map((imgObj, index) => {
      if (!imgObj.image_data) {
        throw new Error(`Square catalog object ${imgObj.id} is not an image`);
      }
      
      return {
        id: imgObj.id,
        src: imgObj.image_data.url || '',
        position: index,
        alt: imgObj.image_data.caption || '',
        created_at: imgObj.updated_at,
        updated_at: imgObj.updated_at
      } as SpocketProductImage;
    });

    // Map Square variations to Spocket variants
    const variants = variationObjects.map(varObj => {
      if (!varObj.item_variation_data) {
        throw new Error(`Square catalog object ${varObj.id} is not an item variation`);
      }
      
      const variationData = varObj.item_variation_data;
      
      return {
        id: varObj.id,
        product_id: spocketId,
        title: variationData.name,
        sku: variationData.sku || '',
        price: convertSquareMoneyToDecimal(variationData.price_money),
        inventory_quantity: variationData.track_inventory ? 
          parseInt(variationData.item_id || '0') : 0,
        inventory_policy: 'deny',
        created_at: varObj.updated_at,
        updated_at: varObj.updated_at
      } as SpocketProductVariant;
    });
    
    // Create the Spocket product
    const spocketProduct: SpocketProduct = {
      id: spocketId,
      title: itemObject.item_data.name,
      description: itemObject.item_data.description || '',
      sku: variants.length > 0 ? variants[0].sku : '',
      price: variants.length > 0 ? variants[0].price : 0,
      currency: 'USD', // Default currency if not specified in Square
      inventory_quantity: variants.reduce(
        (total, variant) => total + variant.inventory_quantity, 0
      ),
      inventory_policy: 'deny',
      status: 'active',
      images,
      variants,
      tags: [],
      weight: 0,
      weight_unit: 'lb',
      shipping_origin_country: 'US',
      processing_time: '1-3 business days',
      categories: [],
      created_at: itemObject.updated_at,
      updated_at: itemObject.updated_at
    };

    logger.info(`Successfully converted Square catalog item ${itemObject.id} to Spocket product`);
    return spocketProduct;
  } catch (error: any) {
    logger.error(`Error converting Square catalog to Spocket product: ${error.message}`, {
      itemId: itemObject.id,
      error
    });
    throw new Error(`Failed to convert Square catalog to Spocket product: ${error.message}`);
  }
}

/**
 * Create a Square catalog item object from a Spocket product
 */
function createSquareItemObject(
  spocketProduct: SpocketProduct,
  imageIds: string[],
  locationId: string
): SquareCatalogObject {
  const itemId = `#spocket:${spocketProduct.id}`;
  
  const itemData: SquareCatalogItem = {
    name: spocketProduct.title,
    description: spocketProduct.description,
    available_online: spocketProduct.status === 'active',
    available_for_pickup: false,
    available_electronically: false,
    image_ids: imageIds,
    description_html: `<p>${spocketProduct.description}</p>`,
    description_plaintext: spocketProduct.description,
  };

  return {
    type: SquareCatalogObjectType.ITEM,
    id: itemId,
    updated_at: new Date().toISOString(),
    version: 1,
    is_deleted: false,
    present_at_all_locations: false,
    present_at_location_ids: [locationId],
    item_data: itemData
  };
}

/**
 * Create a Square catalog image object from a Spocket product image
 */
function createSquareImageObject(
  spocketImage: SpocketProductImage,
  productIdempotencyKey: string
): SquareCatalogObject {
  const imageId = `#spocket:image:${spocketImage.id}`;
  
  const imageData: SquareCatalogImage = {
    name: `Image ${spocketImage.position}`,
    url: spocketImage.src,
    caption: spocketImage.alt || undefined
  };

  return {
    type: SquareCatalogObjectType.IMAGE,
    id: imageId,
    updated_at: spocketImage.updated_at || new Date().toISOString(),
    version: 1,
    is_deleted: false,
    present_at_all_locations: true,
    image_data: imageData
  };
}

/**
 * Create a default Square catalog item variation when no variants exist
 */
function createSquareDefaultVariation(
  spocketProduct: SpocketProduct,
  itemId: string,
  locationId: string
): SquareCatalogObject {
  const variationId = `#spocket:variation:${spocketProduct.id}:default`;
  
  const variationData: SquareCatalogItemVariation = {
    item_id: itemId,
    name: 'Regular',
    sku: spocketProduct.sku,
    price_money: convertDecimalToSquareMoney(spocketProduct.price, spocketProduct.currency),
    track_inventory: true,
    inventory_alert_type: 'LOW_QUANTITY',
    inventory_alert_threshold: 5
  };

  return {
    type: SquareCatalogObjectType.ITEM_VARIATION,
    id: variationId,
    updated_at: new Date().toISOString(),
    version: 1,
    is_deleted: false,
    present_at_all_locations: false,
    present_at_location_ids: [locationId],
    item_variation_data: variationData
  };
}

/**
 * Create a Square catalog item variation from a Spocket product variant
 */
function createSquareVariationFromVariant(
  variant: SpocketProductVariant,
  itemId: string,
  locationId: string
): SquareCatalogObject {
  const variationId = `#spocket:variation:${variant.id}`;
  
  let variantName = variant.title;
  // Build variant name from options if title is not descriptive
  if (!variantName || variantName === 'Default Title') {
    const options = [variant.option1, variant.option2, variant.option3]
      .filter(Boolean)
      .join(' / ');
    variantName = options || 'Regular';
  }
  
  const variationData: SquareCatalogItemVariation = {
    item_id: itemId,
    name: variantName,
    sku: variant.sku,
    price_money: convertDecimalToSquareMoney(variant.price, 'USD'), // Assuming USD
    track_inventory: true,
    inventory_alert_type: 'LOW_QUANTITY',
    inventory_alert_threshold: 5
  };

  return {
    type: SquareCatalogObjectType.ITEM_VARIATION,
    id: variationId,
    updated_at: new Date().toISOString(),
    version: 1,
    is_deleted: false,
    present_at_all_locations: false,
    present_at_location_ids: [locationId],
    item_variation_data: variationData
  };
}

/**
 * Convert a decimal price to Square Money format
 * Square uses the smallest currency unit (e.g., cents for USD)
 */
export function convertDecimalToSquareMoney(amount: number, currency: string): Money {
  // Square Money requires the amount in the smallest unit (e.g., cents)
  // Multiply by 100 for USD, EUR, etc.
  const multiplier = 100;
  
  return {
    amount: Math.round(amount * multiplier),
    currency: currency
  };
}

/**
 * Convert Square Money format to decimal price
 */
export function convertSquareMoneyToDecimal(money?: Money): number {
  if (!money) return 0;
  
  // Divide by 100 for USD, EUR, etc. to get decimal amount
  const divisor = 100;
  
  return Number(money.amount) / divisor;
}

/**
 * Convert currency from one type to another
 */
export function convertCurrency(
  amount: number, 
  fromCurrency: string, 
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) return amount;
  
  const rates = CURRENCY_CONVERSION_RATES[fromCurrency];
  if (!rates) {
    logger.warn(`No conversion rates found for ${fromCurrency}`);
    return amount;
  }
  
  const rate = rates[toCurrency];
  if (!rate) {
    logger.warn(`No conversion rate found from ${fromCurrency} to ${toCurrency}`);
    return amount;
  }
  
  return amount * rate;
}

/**
 * Extract Spocket ID from Square ID (reverse of the ID mapping process)
 */
function extractSpocketIdFromSquareId(squareId: string): string {
  // If the ID starts with "#spocket:", extract the original Spocket ID
  if (squareId.startsWith('#spocket:')) {
    return squareId.replace(/^#spocket:(?:variation:)?/, '').split(':')[0];
  }
  
  // If not a mapped ID, generate a placeholder Spocket ID
  return `square_${squareId}`;
}

/**
 * Generate a unique identifier for synchronization
 */
export function generateSyncId(): string {
  return uuidv4();
}

/**
 * Create a mapping between Spocket and Square SKUs
 */
export function createSkuMapping(
  spocketProducts: SpocketProduct[],
  squareCatalogObjects: SquareCatalogObject[]
): Record<string, string> {
  // Initialize SKU mapping
  const skuMapping: Record<string, string> = {};
  
  // Get all Square variations with SKUs
  const squareVariations = squareCatalogObjects.filter(
    obj => obj.type === SquareCatalogObjectType.ITEM_VARIATION && 
    obj.item_variation_data?.sku
  );
  
  // Map Spocket SKUs to Square SKUs
  for (const product of spocketProducts) {
    // Map main product SKU if available
    if (product.sku) {
      // Look for matching Square variation
      const matchingVariation = squareVariations.find(
        obj => obj.item_variation_data?.sku === product.sku
      );
      
      if (matchingVariation) {
        skuMapping[product.sku] = matchingVariation.id;
      }
    }
    
    // Map variant SKUs
    for (const variant of product.variants) {
      if (variant.sku) {
        // Look for matching Square variation
        const matchingVariation = squareVariations.find(
          obj => obj.item_variation_data?.sku === variant.sku
        );
        
        if (matchingVariation) {
          skuMapping[variant.sku] = matchingVariation.id;
        }
      }
    }
  }
  
  return skuMapping;
}

/**
 * Find Square catalog objects related to a specific item
 * Useful for grouping items, variations, and images
 */
export function findRelatedSquareCatalogObjects(
  itemId: string,
  catalogObjects: SquareCatalogObject[]
): {
  item: SquareCatalogObject | null;
  variations: SquareCatalogObject[];
  images: SquareCatalogObject[];
} {
  const item = catalogObjects.find(
    obj => obj.id === itemId && obj.type === SquareCatalogObjectType.ITEM
  ) || null;
  
  if (!item || !item.item_data) {
    return { item: null, variations: [], images: [] };
  }
  
  // Find all variations that belong to this item
  const variations = catalogObjects.filter(
    obj => 
      obj.type === SquareCatalogObjectType.ITEM_VARIATION && 
      obj.item_variation_data?.item_id === itemId
  );
  
  // Find all images associated with this item
  const imageIds = item.item_data.image_ids || [];
  const images = catalogObjects.filter(
    obj => obj.type === SquareCatalogObjectType.IMAGE && imageIds.includes(obj.id)
  );
  
  return { item, variations, images };
}

/**
 * Compare inventory levels between Spocket and Square to detect discrepancies
 */
export function compareInventoryLevels(
  spocketProduct: SpocketProduct,
  squareVariations: SquareCatalogObject[]
): {
  hasDiscrepancy: boolean;
  spocketInventory: number;
  squareInventory: number;
  discrepancies: Array<{
    sku: string;
    spocketQuantity: number;
    squareQuantity: number;
  }>;
} {
  const discrepancies = [];
  let totalSpocketInventory = 0;
  let totalSquareInventory = 0;
  
  // Check each variant
  for (const variant of spocketProduct.variants) {
    const matchingVariation = squareVariations.find(
      obj => obj.item_variation_data?.sku === variant.sku
    );
    
    totalSpocketInventory += variant.inventory_quantity;
    
    if (matchingVariation) {
      // This is a simplified approach - in a real implementation,
      // you would need to query Square's Inventory API for actual quantities
      const squareQuantity = 0; // Placeholder
      totalSquareInventory += squareQuantity;
      
      if (variant.inventory_quantity !== squareQuantity) {
        discrepancies.push({
          sku: variant.sku,
          spocketQuantity: variant.inventory_quantity,
          squareQuantity
        });
      }
    }
  }
  
  // If no variants, check the main product
  if (spocketProduct.variants.length === 0) {
    const matchingVariation = squareVariations.find(
      obj => obj.item_variation_data?.sku === spocketProduct.sku
    );
    
    totalSpocketInventory = spocketProduct.inventory_quantity;
    
    if (matchingVariation) {
      // Again, this is simplified - you would query Square's Inventory API
      const squareQuantity = 0; // Placeholder
      totalSquareInventory = squareQuantity;
      
      if (spocketProduct.inventory_quantity !== squareQuantity) {
        discrepancies.push({
          sku: spocketProduct.sku,
          spocketQuantity: spocketProduct.inventory_quantity,
          squareQuantity
        });
      }
    }
  }
  
  return {
    hasDiscrepancy: discrepancies.length > 0,
    spocketInventory: totalSpocketInventory,
    squareInventory: totalSquareInventory,
    discrepancies
  };
}
