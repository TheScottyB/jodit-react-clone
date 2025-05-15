/**
 * Order mapping utilities for converting between Spocket and Square order formats
 */
import { createLogger } from '../common/logger';
import { createUniqueId, extractSpocketIdFromSquareId, extractSquareIdFromSpocketId } from '../../utils/mapping';
import { decimalToSmallestUnit, smallestUnitToDecimal } from '../../utils/currency';
import { EntityMapping, SyncEntityType } from '../../types/sync.types';
import { 
  Order, 
  OrderItem, 
  OrderShipping, 
  OrderPayment, 
  OrderFulfillmentStatus, 
  OrderPaymentStatus,
  OrderStatusMapping
} from '../../types/order.types';
import { Money, Address, Customer } from '../../types/common.types';

// Configure logger
const logger = createLogger('order-mapper');

// Status mappings between platforms
const FULFILLMENT_STATUS_MAPPINGS: OrderStatusMapping[] = [
  { spocketStatus: 'pending', squareStatus: 'OPEN', direction: 'bidirectional' },
  { spocketStatus: 'processing', squareStatus: 'IN_PROGRESS', direction: 'bidirectional' },
  { spocketStatus: 'shipped', squareStatus: 'COMPLETED', direction: 'bidirectional' },
  { spocketStatus: 'delivered', squareStatus: 'COMPLETED', direction: 'spocket_to_square' },
  { spocketStatus: 'cancelled', squareStatus: 'CANCELED', direction: 'bidirectional' },
  { spocketStatus: 'failed', squareStatus: 'FAILED', direction: 'bidirectional' }
];

const PAYMENT_STATUS_MAPPINGS: OrderStatusMapping[] = [
  { spocketStatus: 'pending', squareStatus: 'PENDING', direction: 'bidirectional' },
  { spocketStatus: 'paid', squareStatus: 'PAID', direction: 'bidirectional' },
  { spocketStatus: 'partially_paid', squareStatus: 'PARTIALLY_PAID', direction: 'bidirectional' },
  { spocketStatus: 'refunded', squareStatus: 'REFUNDED', direction: 'bidirectional' },
  { spocketStatus: 'partially_refunded', squareStatus: 'PARTIALLY_REFUNDED', direction: 'bidirectional' },
  { spocketStatus: 'failed', squareStatus: 'FAILED', direction: 'bidirectional' },
  { spocketStatus: 'voided', squareStatus: 'VOIDED', direction: 'bidirectional' }
];

/**
 * Map Spocket fulfillment status to Square order state
 * @param spocketStatus - Spocket fulfillment status
 * @returns Corresponding Square order state
 */
export function mapSpocketFulfillmentStatusToSquare(spocketStatus: string): string {
  const mapping = FULFILLMENT_STATUS_MAPPINGS.find(
    m => m.spocketStatus === spocketStatus && 
    (m.direction === 'spocket_to_square' || m.direction === 'bidirectional')
  );
  
  if (!mapping) {
    logger.warn(`No fulfillment status mapping found for Spocket status: ${spocketStatus}`);
    return 'OPEN'; // Default to OPEN if no mapping found
  }
  
  return mapping.squareStatus;
}

/**
 * Map Square order state to Spocket fulfillment status
 * @param squareStatus - Square order state
 * @returns Corresponding Spocket fulfillment status
 */
export function mapSquareFulfillmentStatusToSpocket(squareStatus: string): OrderFulfillmentStatus {
  const mapping = FULFILLMENT_STATUS_MAPPINGS.find(
    m => m.squareStatus === squareStatus &&
    (m.direction === 'square_to_spocket' || m.direction === 'bidirectional')
  );
  
  if (!mapping) {
    logger.warn(`No fulfillment status mapping found for Square status: ${squareStatus}`);
    return OrderFulfillmentStatus.PENDING; // Default to PENDING if no mapping found
  }
  
  return mapping.spocketStatus as OrderFulfillmentStatus;
}

/**
 * Map Spocket payment status to Square payment state
 * @param spocketStatus - Spocket payment status
 * @returns Corresponding Square payment state
 */
export function mapSpocketPaymentStatusToSquare(spocketStatus: string): string {
  const mapping = PAYMENT_STATUS_MAPPINGS.find(
    m => m.spocketStatus === spocketStatus && 
    (m.direction === 'spocket_to_square' || m.direction === 'bidirectional')
  );
  
  if (!mapping) {
    logger.warn(`No payment status mapping found for Spocket status: ${spocketStatus}`);
    return 'PENDING'; // Default to PENDING if no mapping found
  }
  
  return mapping.squareStatus;
}

/**
 * Map Square payment state to Spocket payment status
 * @param squareStatus - Square payment state
 * @returns Corresponding Spocket payment status
 */
export function mapSquarePaymentStatusToSpocket(squareStatus: string): OrderPaymentStatus {
  const mapping = PAYMENT_STATUS_MAPPINGS.find(
    m => m.squareStatus === squareStatus &&
    (m.direction === 'square_to_spocket' || m.direction === 'bidirectional')
  );
  
  if (!mapping) {
    logger.warn(`No payment status mapping found for Square status: ${squareStatus}`);
    return OrderPaymentStatus.PENDING; // Default to PENDING if no mapping found
  }
  
  return mapping.spocketStatus as OrderPaymentStatus;
}

/**
 * Map Spocket address to Square address format
 * @param address - Spocket address
 * @returns Square formatted address
 */
export function mapSpocketAddressToSquare(address: Address): any {
  return {
    address_line_1: address.addressLine1,
    address_line_2: address.addressLine2 || '',
    locality: address.city,
    administrative_district_level_1: address.state,
    postal_code: address.postalCode,
    country: address.country,
    first_name: address.firstName,
    last_name: address.lastName
  };
}

/**
 * Map Square address to Spocket address format
 * @param address - Square address
 * @returns Spocket formatted address
 */
export function mapSquareAddressToSpocket(address: any): Address {
  return {
    firstName: address.first_name || '',
    lastName: address.last_name || '',
    addressLine1: address.address_line_1 || '',
    addressLine2: address.address_line_2 || '',
    city: address.locality || '',
    state: address.administrative_district_level_1 || '',
    postalCode: address.postal_code || '',
    country: address.country || 'US'
  };
}

/**
 * Map order item to Square line item format
 * @param item - Order item
 * @returns Square line item
 */
export function mapOrderItemToSquareLineItem(item: OrderItem): any {
  return {
    name: item.name,
    quantity: item.quantity.toString(),
    base_price_money: {
      amount: decimalToSmallestUnit(item.unitPrice, 'USD'),
      currency: 'USD'
    },
    note: `SKU: ${item.sku}`,
    catalog_object_id: item.productId.startsWith('sq_') ? item.productId : undefined,
    variation_name: item.variantId ? `Variant: ${item.variantId}` : undefined
  };
}

/**
 * Map Square line item to order item format
 * @param lineItem - Square line item
 * @returns Order item
 */
export function mapSquareLineItemToOrderItem(lineItem: any): OrderItem {
  const unitPrice = lineItem.base_price_money ? 
    smallestUnitToDecimal(lineItem.base_price_money.amount, lineItem.base_price_money.currency || 'USD') : 
    0;
  
  const quantity = parseInt(lineItem.quantity, 10) || 1;
  
  return {
    id: lineItem.uid || createUniqueId('item'),
    productId: lineItem.catalog_object_id || '',
    variantId: lineItem.variation_name || '',
    name: lineItem.name || 'Unknown Product',
    sku: lineItem.note ? lineItem.note.replace('SKU: ', '') : '',
    quantity: quantity,
    unitPrice: unitPrice,
    total: unitPrice * quantity,
    tax: lineItem.total_tax_money ? 
      smallestUnitToDecimal(lineItem.total_tax_money.amount, lineItem.total_tax_money.currency || 'USD') : 
      0,
    discount: lineItem.total_discount_money ? 
      smallestUnitToDecimal(lineItem.total_discount_money.amount, lineItem.total_discount_money.currency || 'USD') : 
      0
  };
}

/**
 * Convert Spocket order to Square order format
 * @param order - Spocket order
 * @param orderMappings - Order entity mappings
 * @returns Square order object
 */
export function spocketToSquareOrder(order: Order, orderMappings: EntityMapping[]): any {
  // Check if order has already been mapped
  const existingMapping = orderMappings.find(
    mapping => mapping.spocketId === order.id && mapping.entityType === SyncEntityType.ORDER
  );
  
  // Use existing mapping or create a new Square ID
  const squareId = existingMapping ? 
    existingMapping.squareId : 
    `spkt_${order.id}`;
  
  try {
    logger.info(`Converting Spocket order ${order.id} to Square format`);
    
    // Map order items to Square line items
    const lineItems = order.items.map(mapOrderItemToSquareLineItem);
    
    // Map fulfillment status
    const orderState = mapSpocketFulfillmentStatusToSquare(order.fulfillmentStatus);
    
    // Create Square order object
    const squareOrder = {
      id: squareId,
      reference_id: order.orderNumber,
      customer_id: order.customer.id,
      line_items: lineItems,
      state: orderState,
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
      total_money: {
        amount: decimalToSmallestUnit(order.total.amount, order.total.currency),
        currency: order.total.currency
      },
      total_tax_money: {
        amount: decimalToSmallestUnit(order.taxTotal.amount, order.taxTotal.currency),
        currency: order.taxTotal.currency
      },
      total_discount_money: {
        amount: decimalToSmallestUnit(order.discountTotal.amount, order.discountTotal.currency),
        currency: order.discountTotal.currency
      },
      // Add shipping information
      fulfillments: [
        {
          type: 'SHIPMENT',
          state: orderState === 'OPEN' ? 'PROPOSED' : 
                 orderState === 'IN_PROGRESS' ? 'PREPARED' : 
                 orderState === 'COMPLETED' ? 'COMPLETED' : 
                 orderState === 'CANCELED' ? 'CANCELED' : 'FAILED',
          shipment_details: {
            recipient: {
              display_name: `${order.shipping.address.firstName} ${order.shipping.address.lastName}`,
              address: mapSpocketAddressToSquare(order.shipping.address)
            },
            carrier: order.shipping.carrier,
            tracking_number: order.shipping.trackingNumber,
            tracking_url: order.shipping.trackingUrl
          }
        }
      ],
      source: {
        name: 'Spocket'
      },
      note: order.notes || '',
      metadata: {
        spocket_id: order.id,
        spocket_order_number: order.orderNumber,
        integration_version: '1.0.0'
      }
    };
    
    logger.info(`Successfully converted Spocket order ${order.id} to Square format`);
    return squareOrder;
  } catch (error: any) {
    logger.error(`Error converting Spocket order ${order.id} to Square: ${error.message}`, {
      order: JSON.stringify(order),
      error: error.toString()
    });
    throw new Error(`Failed to convert Spocket order to Square: ${error.message}`);
  }
}

/**
 * Convert Square order to Spocket order format
 * @param squareOrder - Square order
 * @param orderMappings - Order entity mappings
 * @returns Standard order object
 */
export function squareToSpocketOrder(squareOrder: any, orderMappings: EntityMapping[]): Order {
  // Check if order has already been mapped
  const existingMapping = orderMappings.find(
    mapping => mapping.squareId === squareOrder.id && mapping.entityType === SyncEntityType.ORDER
  );
  
  // Use existing mapping or extract a Spocket ID
  const spocketId = existingMapping ? 
    existingMapping.spocketId : 
    extractSpocketIdFromSquareId(squareOrder.id);
  
  try {
    logger.info(`Converting Square order ${squareOrder.id} to Spocket format`);
    
    // Map line items to order items
    const items = (squareOrder.line_items || []).map(mapSquareLineItemToOrderItem);
    
    // Extract customer info
    let customer: Customer = {
      firstName: '',
      lastName: '',
      email: 'unknown@example.com', // Square orders might not always have emails
      phone: ''
    };
    
    // Try to extract shipping address and customer info from fulfillments
    let shippingAddress: Address = {
      firstName: '',
      lastName: '',
      addressLine1: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US'
    };
    
    // Check for fulfillments
    if (squareOrder.fulfillments && squareOrder.fulfillments.length > 0) {
      const fulfillment = squareOrder.fulfillments[0];
      
      if (fulfillment.shipment_details?.recipient) {
        const recipient = fulfillment.shipment_details.recipient;
        
        // Parse display name into first and last name
        if (recipient.display_name) {
          const nameParts = recipient.display_name.split(' ');
          customer.firstName = nameParts[0] || '';
          customer.lastName = nameParts.slice(1).join(' ') || '';
        }
        
        // Extract address
        if (recipient.address) {
          shippingAddress = mapSquareAddressToSpocket(recipient.address);
        }
      }
    }
    
    // Map fulfillment status
    const fulfillmentStatus = mapSquareFulfillmentStatusToSpocket(squareOrder.state || 'OPEN');
    
    // Map payment status - default to PENDING if not available
    let paymentStatus = OrderPaymentStatus.PENDING;
    
    // Get currency from total money or default to USD
    const currency = (squareOrder.total_money?.currency || 'USD');
    
    // Create money objects with proper amounts and currencies
    const createMoney = (amount: number): Money => ({
      amount,
      currency
    });
    
    // Extract payment info if available
    let payment: OrderPayment = {
      id: `square_payment_${squareOrder.id}`,
      amount: createMoney(0),
      status: paymentStatus,
      method: 'Unknown'
    };
    
    // Get totals from Square order
    const total = squareOrder.total_money ? 
      smallestUnitToDecimal(squareOrder.total_money.amount, currency) : 0;
    
    const taxTotal = squareOrder.total_tax_money ? 
      smallestUnitToDecimal(squareOrder.total_tax_money.amount, currency) : 0;
    
    const discountTotal = squareOrder.total_discount_money ? 
      smallestUnitToDecimal(squareOrder.total_discount_money.amount, currency) : 0;
    
    // Calculate subtotal (may need adjustment based on Square's structure)
    const subtotal = total - taxTotal + discountTotal;
    
    // Extract shipping info from fulfillments
    let shipping: OrderShipping = {
      address: shippingAddress,
      method: 'Standard',
      cost: createMoney(0)  // Default to 0 cost
    };
    
    // Extract shipping details if available
    if (squareOrder.fulfillments && squareOrder.fulfillments.length > 0) {
      const fulfillment = squareOrder.fulfillments[0];
      
      if (fulfillment.shipment_details) {
        const shipmentDetails = fulfillment.shipment_details;
        shipping.carrier = shipmentDetails.carrier || shipping.carrier;
        shipping.trackingNumber = shipmentDetails.tracking_number || shipping.trackingNumber;
        shipping.trackingUrl = shipmentDetails.tracking_url || shipping.trackingUrl;
      }
    }
    
    // Create the standard order object
    const order: Order = {
      id: spocketId,
      orderNumber: squareOrder.reference_id || `square-${squareOrder.id}`,
      customer,
      items,
      shipping,
      payment,
      fulfillmentStatus,
      paymentStatus,
      subtotal: createMoney(subtotal),
      taxTotal: createMoney(taxTotal),
      shippingTotal: createMoney(0), // Square doesn't separate shipping costs in the same way
      discountTotal: createMoney(discountTotal),
      total: createMoney(total),
      notes: squareOrder.note || '',
      createdAt: new Date(squareOrder.created_at || new Date().toISOString()),
      updatedAt: new Date(squareOrder.updated_at || new Date().toISOString()),
      platformData: {
        square_id: squareOrder.id,
        source: squareOrder.source?.name || 'Square',
        integration_version: '1.0.0'
      }
    };
    
    logger.info(`Successfully converted Square order ${squareOrder.id} to Spocket format`);
    return order;
  } catch (error: any) {
    logger.error(`Error converting Square order ${squareOrder.id} to Spocket: ${error.message}`, {
      order: JSON.stringify(squareOrder),
      error: error.toString()
    });
    throw new Error(`Failed to convert Square order to Spocket: ${error.message}`);
  }
}

/**
 * Extract shipping details from order
 * @param order - Order with shipping information
 * @returns Shipping details in a standardized format
 */
export function extractShippingDetails(order: Order): {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  recipientName: string;
  address: string;
} {
  const address = order.shipping.address;
  
  return {
    carrier: order.shipping.carrier,
    trackingNumber: order.shipping.trackingNumber,
    trackingUrl: order.shipping.trackingUrl,
    recipientName: `${address.firstName} ${address.lastName}`,
    address: [
      address.addressLine1,
      address.addressLine2,
      `${address.city}, ${address.state} ${address.postalCode}`,
      address.country
    ].filter(Boolean).join(', ')
  };
}

/**
 * Extract payment details from order
 * @param order - Order with payment information
 * @returns Payment details in a standardized format
 */
export function extractPaymentDetails(order: Order): {
  method: string;
  amount: string;
  status: string;
  cardInfo?: string;
  transactionId?: string;
} {
  return {
    method: order.payment.method,
    amount: `${order.payment.amount.amount} ${order.payment.amount.currency}`,
    status: order.paymentStatus,
    cardInfo: order.payment.cardBrand && order.payment.cardLast4 ? 
      `${order.payment.cardBrand} ending in ${order.payment.cardLast4}` : 
      undefined,
    transactionId: order.payment.transactionId
  };
}
