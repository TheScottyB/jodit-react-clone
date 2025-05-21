import { SpocketOrderStatus } from '../../services/order/spocket/types';
import { SquareOrderState } from '../../services/order/square/types';
import { createSpocketOrder, createSquareOrder } from './index';

/**
 * Spocket webhook fixtures
 */
export const spocketWebhooks = {
  orderCreated: {
    event: 'order.created',
    data: {
      order: createSpocketOrder('new-order'),
      created_at: new Date().toISOString()
    },
    webhook_id: 'wh_spocket_1',
    timestamp: new Date().toISOString()
  },

  orderStatusUpdated: {
    event: 'order.status_updated',
    data: {
      order_id: 'test-order',
      previous_status: SpocketOrderStatus.PENDING,
      new_status: SpocketOrderStatus.SHIPPED,
      updated_at: new Date().toISOString()
    },
    webhook_id: 'wh_spocket_2',
    timestamp: new Date().toISOString()
  },

  fulfillmentCreated: {
    event: 'order.fulfillment_created',
    data: {
      order_id: 'test-order',
      fulfillment: {
        id: 'ful-1',
        tracking_number: '1Z999AA1234567890',
        carrier: 'UPS',
        status: 'shipped'
      },
      created_at: new Date().toISOString()
    },
    webhook_id: 'wh_spocket_3',
    timestamp: new Date().toISOString()
  },

  paymentCompleted: {
    event: 'order.payment_completed',
    data: {
      order_id: 'test-order',
      payment: {
        id: 'pay-1',
        amount: 29.99,
        currency: 'USD',
        status: 'completed'
      },
      completed_at: new Date().toISOString()
    },
    webhook_id: 'wh_spocket_4',
    timestamp: new Date().toISOString()
  }
};

/**
 * Square webhook fixtures
 */
export const squareWebhooks = {
  orderCreated: {
    type: 'order.created',
    data: {
      type: 'order',
      id: 'new-order',
      object: createSquareOrder('new-order')
    },
    event_id: 'wh_square_1',
    created_at: new Date().toISOString(),
    merchant_id: 'merchant-1'
  },

  orderUpdated: {
    type: 'order.updated',
    data: {
      type: 'order',
      id: 'test-order',
      object: {
        ...createSquareOrder('test-order'),
        state: SquareOrderState.COMPLETED,
        version: 2
      }
    },
    event_id: 'wh_square_2',
    created_at: new Date().toISOString(),
    merchant_id: 'merchant-1'
  },

  fulfillmentUpdated: {
    type: 'order.fulfillment.updated',
    data: {
      type: 'fulfillment',
      id: 'ful-1',
      object: {
        order_id: 'test-order',
        state: 'COMPLETED',
        shipment_details: {
          carrier: 'UPS',
          tracking_number: '1Z999AA1234567890'
        }
      }
    },
    event_id: 'wh_square_3',
    created_at: new Date().toISOString(),
    merchant_id: 'merchant-1'
  },

  paymentUpdated: {
    type: 'payment.updated',
    data: {
      type: 'payment',
      id: 'pay-1',
      object: {
        id: 'pay-1',
        order_id: 'test-order',
        status: 'COMPLETED',
        amount_money: {
          amount: 2999,
          currency: 'USD'
        }
      }
    },
    event_id: 'wh_square_4',
    created_at: new Date().toISOString(),
    merchant_id: 'merchant-1'
  }
};

/**
 * Webhook signature helpers
 */
export const webhookSignatures = {
  spocket: {
    valid: 'sha256=valid-signature',
    invalid: 'sha256=invalid-signature'
  },
  square: {
    valid: {
      signature: 'valid-signature',
      timestamp: new Date().toISOString()
    },
    invalid: {
      signature: 'invalid-signature',
      timestamp: new Date().toISOString()
    }
  }
};

/**
 * Helper functions for webhook testing
 */
export const webhookTestUtils = {
  createSignedSpocketWebhook: (event: any, signature = webhookSignatures.spocket.valid) => ({
    event,
    signature
  }),

  createSignedSquareWebhook: (
    event: any,
    signature = webhookSignatures.square.valid.signature,
    timestamp = webhookSignatures.square.valid.timestamp
  ) => ({
    event,
    signature,
    timestamp
  }),

  verifyWebhookProcessing: (result: any, expectedEvent: string, expectedOrderId: string) => {
    expect(result.success).toBe(true);
    expect(result.event).toBe(expectedEvent);
    expect(result.orderId).toBe(expectedOrderId);
  }
};

