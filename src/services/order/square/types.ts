/**
 * Square Order Types
 */

export enum SquareOrderState {
  OPEN = 'OPEN',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  DRAFT = 'DRAFT',
}

export interface SquareMoney {
  amount: number;
  currency: string;
}

export interface SquareOrderLineItem {
  uid: string;
  name: string;
  quantity: string;
  basePriceMoney: SquareMoney;
  variationName?: string;
}

export interface SquareOrderNetAmounts {
  totalMoney: SquareMoney;
  taxMoney: SquareMoney;
  discountMoney: SquareMoney;
  tipMoney: SquareMoney;
  serviceMoney: SquareMoney;
}

export interface SquareOrderSource {
  name: string;
}

export interface SquareOrder {
  id: string;
  locationId: string;
  referenceId?: string;
  customerId?: string;
  state: SquareOrderState;
  createdAt: string;
  updatedAt: string;
  lineItems: SquareOrderLineItem[];
  netAmounts: SquareOrderNetAmounts;
  source?: SquareOrderSource;
  metadata?: Record<string, any>;
}

export interface SquareFulfillmentRecipient {
  displayName: string;
  emailAddress?: string;
  phoneNumber?: string;
  address?: {
    addressLine1: string;
    addressLine2?: string;
    locality: string;
    administrativeDistrictLevel1: string;
    postalCode: string;
    country: string;
  };
}

export interface SquareShipmentDetails {
  recipient: SquareFulfillmentRecipient;
  carrier: string;
  shippingNote?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface SquareFulfillment {
  id: string;
  orderId: string;
  type: string;
  state: string;
  createdAt: string;
  shipmentDetails?: SquareShipmentDetails;
}

export interface SquarePayment {
  id: string;
  orderId: string;
  amountMoney: SquareMoney;
  status: string;
  sourceType: string;
  cardDetails?: {
    status: string;
    card: {
      cardBrand: string;
      last4: string;
    };
  };
  createdAt: string;
  receiptNumber?: string;
  locationId: string;
}

