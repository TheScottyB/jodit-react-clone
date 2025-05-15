/**
 * Type definitions for Spocket API data structures
 * Note: These interfaces are based on limited public information about Spocket's API
 * and may need to be adjusted once you have access to Spocket's actual API documentation.
 */

/**
 * Spocket Product
 */
export interface SpocketProduct {
  id: string;
  title: string;
  description: string;
  sku: string;
  price: number;
  currency: string;
  inventory_quantity: number;
  inventory_policy: 'deny' | 'continue';
  status: 'active' | 'archived' | 'draft';
  images: SpocketProductImage[];
  variants: SpocketProductVariant[];
  tags: string[];
  weight: number;
  weight_unit: 'kg' | 'lb' | 'oz';
  shipping_origin_country: string;
  processing_time: string;
  categories: SpocketCategory[];
  created_at: string;
  updated_at: string;
}

/**
 * Spocket Product Image
 */
export interface SpocketProductImage {
  id: string;
  src: string;
  position: number;
  alt?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Spocket Product Variant
 */
export interface SpocketProductVariant {
  id: string;
  product_id: string;
  title: string;
  sku: string;
  price: number;
  compare_at_price?: number;
  inventory_quantity: number;
  inventory_policy: 'deny' | 'continue';
  option1?: string;
  option2?: string;
  option3?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Spocket Category
 */
export interface SpocketCategory {
  id: string;
  name: string;
  parent_id?: string;
}

/**
 * Spocket Order
 */
export interface SpocketOrder {
  id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
  customer: SpocketCustomer;
  line_items: SpocketOrderLineItem[];
  shipping_address: SpocketAddress;
  billing_address: SpocketAddress;
  total_price: number;
  currency: string;
  tracking_number?: string;
  tracking_url?: string;
  note?: string;
}

/**
 * Spocket Order Line Item
 */
export interface SpocketOrderLineItem {
  id: string;
  product_id: string;
  variant_id: string;
  title: string;
  quantity: number;
  price: number;
  sku: string;
  image_url?: string;
}

/**
 * Spocket Customer
 */
export interface SpocketCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

/**
 * Spocket Address
 */
export interface SpocketAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

/**
 * Spocket API Response Envelope
 */
export interface SpocketApiResponse<T> {
  data: T;
  meta?: {
    total_count: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

/**
 * Spocket Paginated Products Response
 */
export interface SpocketProductsResponse extends SpocketApiResponse<SpocketProduct[]> {}

/**
 * Spocket Single Product Response
 */
export interface SpocketProductResponse extends SpocketApiResponse<SpocketProduct> {}

/**
 * Spocket Orders Response
 */
export interface SpocketOrdersResponse extends SpocketApiResponse<SpocketOrder[]> {}

/**
 * Spocket Single Order Response
 */
export interface SpocketOrderResponse extends SpocketApiResponse<SpocketOrder> {}

