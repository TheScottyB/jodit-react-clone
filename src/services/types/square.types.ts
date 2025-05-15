/**
 * Type definitions for Square API data structures
 * Based on Square's official API documentation
 * https://developer.squareup.com/reference/square
 */

/**
 * Square Catalog Object Types
 */
export enum SquareCatalogObjectType {
  ITEM = 'ITEM',
  ITEM_VARIATION = 'ITEM_VARIATION',
  CATEGORY = 'CATEGORY',
  DISCOUNT = 'DISCOUNT',
  TAX = 'TAX',
  IMAGE = 'IMAGE',
  MODIFIER = 'MODIFIER',
  MODIFIER_LIST = 'MODIFIER_LIST',
  PRICING_RULE = 'PRICING_RULE',
  PRODUCT_SET = 'PRODUCT_SET',
  TIME_PERIOD = 'TIME_PERIOD',
  MEASUREMENT_UNIT = 'MEASUREMENT_UNIT',
  SUBSCRIPTION_PLAN = 'SUBSCRIPTION_PLAN',
  ITEM_OPTION = 'ITEM_OPTION',
  ITEM_OPTION_VAL = 'ITEM_OPTION_VAL',
  CUSTOM_ATTRIBUTE_DEFINITION = 'CUSTOM_ATTRIBUTE_DEFINITION',
  QUICK_AMOUNTS_SETTINGS = 'QUICK_AMOUNTS_SETTINGS'
}

/**
 * Square Money Type
 */
export interface Money {
  amount: number | bigint; // Amount in the smallest denomination of the currency
  currency: string; // Currency code (e.g., 'USD')
}

/**
 * Square Catalog Object
 */
export interface SquareCatalogObject {
  type: SquareCatalogObjectType;
  id: string;
  updated_at: string;
  version: number;
  is_deleted: boolean;
  present_at_all_locations: boolean;
  present_at_location_ids?: string[];
  absent_at_location_ids?: string[];
  catalog_v1_ids?: {
    catalog_v1_id: string;
    location_id: string;
  }[];
  item_data?: SquareCatalogItem;
  item_variation_data?: SquareCatalogItemVariation;
  category_data?: SquareCatalogCategory;
  image_data?: SquareCatalogImage;
  custom_attribute_values?: { [key: string]: any };
  custom_attribute_definition_data?: any;
}

/**
 * Square Catalog Item
 */
export interface SquareCatalogItem {
  name: string;
  description?: string;
  abbreviation?: string;
  label_color?: string;
  available_online?: boolean;
  available_for_pickup?: boolean;
  available_electronically?: boolean;
  category_id?: string;
  tax_ids?: string[];
  modifier_list_info?: {
    modifier_list_id: string;
    enabled: boolean;
  }[];
  variations?: SquareCatalogObject[];
  product_type?: 'REGULAR' | 'APPOINTMENTS_SERVICE' | 'APPOINTEMENTS_CLASS' | 'DINING' | 'RETAIL' | 'EVENT';
  skip_modifier_screen?: boolean;
  item_options?: {
    item_option_id: string;
  }[];
  image_ids?: string[];
  sort_name?: string;
  categories?: { id: string; ordinal: number }[];
  description_html?: string;
  description_plaintext?: string;
}

/**
 * Square Catalog Item Variation
 */
export interface SquareCatalogItemVariation {
  item_id: string;
  name: string;
  sku?: string;
  upc?: string;
  ordinal?: number;
  pricing_type?: 'FIXED_PRICING' | 'VARIABLE_PRICING';
  price_money?: Money;
  location_overrides?: {
    location_id: string;
    price_money?: Money;
    pricing_type?: 'FIXED_PRICING' | 'VARIABLE_PRICING';
    track_inventory?: boolean;
    inventory_alert_type?: 'NONE' | 'LOW_QUANTITY' | 'NONE';
    inventory_alert_threshold?: number;
  }[];
  track_inventory?: boolean;
  inventory_alert_type?: 'NONE' | 'LOW_QUANTITY' | 'NONE';
  inventory_alert_threshold?: number;
  user_data?: string;
  service_duration?: number;
  available_for_booking?: boolean;
  item_option_values?: {
    item_option_id: string;
    item_option_value_id: string;
  }[];
  measurement_unit_id?: string;
  stockable?: boolean;
  team_member_ids?: string[];
  stockable_conversion?: {
    stockable_item_variation_id: string;
    stockable_quantity: string;
    nonstockable_quantity: string;
  };
}

/**
 * Square Catalog Category
 */
export interface SquareCatalogCategory {
  name: string;
  image_ids?: string[];
}

/**
 * Square Catalog Image
 */
export interface SquareCatalogImage {
  name?: string;
  url?: string;
  caption?: string;
  photo_studio_order_id?: string;
}

/**
 * Square Inventory
 */
export interface SquareInventory {
  catalog_object_id: string;
  catalog_object_type: string;
  state: 'IN_STOCK' | 'SOLD' | 'RETURNED_BY_CUSTOMER' | 'RESERVED_FOR_SALE' | 'SOLD_ONLINE' | 'ORDERED_FROM_VENDOR' | 'RECEIVED_FROM_VENDOR' | 'IN_TRANSIT_TO' | 'NONE' | 'WASTE' | 'UNLINKED_RETURN';
  location_id: string;
  quantity: string; // Decimal representation of a quantity
  calculated_quantity: string;
  occurred_at: string;
}

/**
 * Square Order
 */
export interface SquareOrder {
  id: string;
  location_id: string;
  reference_id?: string;
  source?: {
    name: string;
  };
  customer_id?: string;
  line_items: SquareOrderLineItem[];
  taxes?: SquareOrderTax[];
  discounts?: SquareOrderDiscount[];
  service_charges?: SquareOrderServiceCharge[];
  fulfillments?: SquareOrderFulfillment[];
  created_at?: string;
  updated_at?: string;
  state?: 'OPEN' | 'COMPLETED' | 'CANCELED';
  version?: number;
  total_money?: Money;
  total_tax_money?: Money;
  total_discount_money?: Money;
  total_service_charge_money?: Money;
  net_amounts?: {
    total_money?: Money;
    tax_money?: Money;
    discount_money?: Money;
    service_charge_money?: Money;
  };
}

/**
 * Square Order Line Item
 */
export interface SquareOrderLineItem {
  uid?: string;
  name?: string;
  quantity: string; // Decimal representation of a quantity
  catalog_object_id?: string;
  catalog_version?: number;
  variation_name?: string;
  item_type?: 'ITEM' | 'CUSTOM_AMOUNT';
  base_price_money?: Money;
  variation_total_price_money?: Money;
  gross_sales_money?: Money;
  total_tax_money?: Money;
  total_discount_money?: Money;
  total_money?: Money;
  pricing_blocklists?: {
    blocked_discounts?: {
      uid: string;
      discount_uid: string;
    }[];
    blocked_taxes?: {
      uid: string;
      tax_uid: string;
    }[];
  };
  modifiers?: {
    uid?: string;
    catalog_object_id?: string;
    catalog_version?: number;
    name?: string;
    quantity?: string;
    base_price_money?: Money;
    total_price_money?: Money;
  }[];
  applied_taxes?: {
    uid: string;
    tax_uid: string;
    applied_money?: Money;
  }[];
  applied_discounts?: {
    uid: string;
    discount_uid: string;
    applied_money?: Money;
  }[];
  applied_service_charges?: {
    uid: string;
    service_charge_uid: string;
    applied_money?: Money;
  }[];
  note?: string;
}

/**
 * Square Order Tax
 */
export interface SquareOrderTax {
  uid?: string;
  catalog_object_id?: string;
  catalog_version?: number;
  name?: string;
  type?: 'UNKNOWN_TAX' | 'ADDITIVE' | 'INCLUSIVE';
  percentage?: string;
  applied_money?: Money;
  scope?: 'OTHER_TAX_SCOPE' | 'LINE_ITEM' | 'ORDER';
}

/**
 * Square Order Discount
 */
export interface SquareOrderDiscount {
  uid?: string;
  catalog_object_id?: string;
  catalog_version?: number;
  name?: string;
  type?: 'UNKNOWN_DISCOUNT' | 'FIXED_PERCENTAGE' | 'FIXED_AMOUNT' | 'VARIABLE_PERCENTAGE' | 'VARIABLE_AMOUNT';
  percentage?: string;
  amount_money?: Money;
  applied_money?: Money;
  scope?: 'OTHER_DISCOUNT_SCOPE' | 'LINE_ITEM' | 'ORDER';
}

/**
 * Square Order Service Charge
 */
export interface SquareOrderServiceCharge {
  uid?: string;
  name?: string;
  catalog_object_id?: string;
  catalog_version?: number;
  percentage?: string;
  amount_money?: Money;
  applied_money?: Money;
  total_money?: Money;
  total_tax_money?: Money;
  calculation_phase?: 'SUBTOTAL_PHASE' | 'TOTAL_PHASE';
  taxable?: boolean;
  applied_taxes?: {
    uid: string;
    tax_uid: string;
    applied_money?: Money;
  }[];
  metadata?: { [key: string]: string };
}

/**
 * Square Order Fulfillment
 */
export interface SquareOrderFulfillment {
  uid?: string;
  type?: 'PICKUP' | 'SHIPMENT' | 'DELIVERY';
  state?: 'PROPOSED' | 'RESERVED' | 'PREPARED' | 'COMPLETED' | 'CANCELED' | 'FAILED';
  pickup_details?: {
    recipient?: {
      customer_id?: string;
      display_name?: string;
      email_address?: string;
      phone_number?: string;
    };
    auto_complete_duration?: string;
    expires_at?: string;
    pickup_at?: string;
    pickup_window_duration?: string;
    prep_time_duration?: string;
    note?: string;
    placed_at?: string;
    accepted_at?: string;
    rejected_at?: string;
    ready_at?: string;
    expired_at?: string;
    picked_up_at?: string;
    canceled_at?: string;
    cancel_reason?: string;
    is_curbside_pickup?: boolean;
    curbside_pickup_details?: {
      curbside_details?: string;
      buyer_arrived_at?: string;
    };
  };
  shipment_details?: {
    recipient?: {
      customer_id?: string;
      display_name?: string;
      email_address?: string;
      phone_number?: string;
      address?: {
        address_line_1?: string;
        address_line_2?: string;
        address_line_3?: string;
        locality?: string;
        sublocality?: string;
        sublocality_2?: string;
        sublocality_3?: string;
        administrative_district_level_1?: string;
        administrative_district_level_2?: string;
        administrative_district_level_3?: string;
        postal_code?: string;
        country?: string;
        first_name?: string;
        last_name?: string;
      };
    };
    carrier?: string;
    shipping_note?: string;
    shipping_type?: string;
    tracking_number?: string;
    tracking_url?: string;
    placed_at?: string;
    in_progress_at?: string;
    packaged_at?: string;
    expected_shipped_at?: string;
    shipped_at?: string;
    canceled_at?: string;
    cancel_reason?: string;
    failed_at?: string;
    failure_reason?: string;
  };
  delivery_details?: {
    recipient?: {
      customer_id?: string;
      display_name?: string;
      email_address?: string;
      phone_number?: string;
      address?: {
        address_line_1?: string;
        address_line_2?: string;
        address_line_3?: string;
        locality?: string;
        sublocality?: string;
        sublocality_2?: string;
        sublocality_3?: string;
        administrative_district_level_1?: string;
        administrative_district_level_2?: string;
        administrative_district_level_3?: string;
        postal_code?: string;
        country?: string;
        first_name?: string;
        last_name?: string;
      };
    };
    schedule_type?: 'ASAP' | 'SCHEDULED';
    placed_at?: string;
    deliver_at?: string;
    prep_time_duration?: string;
    delivery_window_duration?: string;
    note?: string;
    completed_at?: string;
    in_progress_at?: string;
    rejected_at?: string;
    ready_at?: string;
    delivered_at?: string;
    canceled_at?: string;
    cancel_reason?: string;
    courier_pickup_at?: string;
    courier_pickup_window_duration?: string;
    is_no_contact_delivery?: boolean;
    dropoff_notes?: string;
    courier_provider_name?: string;
    courier_support_phone_number?: string;
    square_delivery_id?: string;
    external_delivery_id?: string;
    managed_delivery?: boolean;
  };
}
