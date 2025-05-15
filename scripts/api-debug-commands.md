# API Debugging Commands for Spocket-Square Integration

Below are curl commands to help debug API calls to both Spocket and Square platforms during development and integration testing.

## Environment Variables

Replace these values with your actual credentials:

```bash
# Square credentials
export SQUARE_ACCESS_TOKEN="YOUR_SQUARE_ACCESS_TOKEN"
export SQUARE_LOCATION_ID="YOUR_SQUARE_LOCATION_ID"

# Spocket credentials
export SPOCKET_API_KEY="YOUR_SPOCKET_API_KEY"
export SPOCKET_CLIENT_ID="YOUR_SPOCKET_CLIENT_ID"
export SPOCKET_CLIENT_SECRET="YOUR_SPOCKET_CLIENT_SECRET"
```

## 1. Authentication Endpoints

### Spocket Authentication

**Get OAuth Token (Client Credentials Grant)**

```bash
curl -X POST https://api.spocket.co/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'"$SPOCKET_CLIENT_ID"'",
    "client_secret": "'"$SPOCKET_CLIENT_SECRET"'",
    "grant_type": "client_credentials"
  }'
```

**Expected Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 7200,
  "scope": "read write"
}
```

**Refresh Access Token**

```bash
curl -X POST https://api.spocket.co/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "YOUR_REFRESH_TOKEN",
    "client_id": "'"$SPOCKET_CLIENT_ID"'",
    "client_secret": "'"$SPOCKET_CLIENT_SECRET"'"
  }'
```

### Square Authentication

Square uses personal access tokens or OAuth 2.0. For testing, personal access tokens are easiest:

**Validate Square Token**

```bash
curl -X GET "https://connect.squareup.com/v2/locations" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**

```json
{
  "locations": [
    {
      "id": "LOCATION_ID",
      "name": "Store Location Name",
      "address": {
        "address_line_1": "123 Main St",
        "locality": "San Francisco",
        "administrative_district_level_1": "CA",
        "postal_code": "94105",
        "country": "US"
      },
      "timezone": "America/Los_Angeles",
      "capabilities": ["CREDIT_CARD_PROCESSING", "AUTOMATIC_TRANSFERS"],
      "status": "ACTIVE",
      "created_at": "2022-01-01T00:00:00Z",
      "merchant_id": "MERCHANT_ID",
      "country": "US",
      "language_code": "en-US",
      "currency": "USD",
      "phone_number": "+12025550142",
      "business_name": "Business Name"
    }
  ]
}
```

## 2. Order Management Endpoints

### Spocket Order Management

**List Orders**

```bash
curl -X GET "https://api.spocket.co/v1/orders" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -G \
  -d "limit=25" \
  -d "page=1" \
  -d "created_at_min=2025-01-01T00:00:00Z" \
  -d "created_at_max=2025-05-01T00:00:00Z" \
  -d "status=any" 
```

**Get Order Details**

```bash
curl -X GET "https://api.spocket.co/v1/orders/ORDER_ID" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Create Order**

```bash
curl -X POST "https://api.spocket.co/v1/orders" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shipping_address": {
      "first_name": "John",
      "last_name": "Doe",
      "address1": "123 Main St",
      "city": "San Francisco",
      "province": "California",
      "country": "United States",
      "zip": "94105",
      "phone": "555-123-4567"
    },
    "line_items": [
      {
        "variant_id": "12345",
        "quantity": 1,
        "price": 19.99
      }
    ],
    "external_id": "sq_order_123",
    "note": "Order from Square"
  }'
```

**Update Order Status**

```bash
curl -X PATCH "https://api.spocket.co/v1/orders/ORDER_ID" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "fulfilled"
  }'
```

### Square Order Management

**List Orders**

```bash
curl -X POST "https://connect.squareup.com/v2/orders/search" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "location_ids": ["'"$SQUARE_LOCATION_ID"'"],
    "query": {
      "filter": {
        "state_filter": {
          "states": ["OPEN", "COMPLETED"]
        },
        "date_time_filter": {
          "created_at": {
            "start_at": "2025-01-01T00:00:00Z",
            "end_at": "2025-05-01T00:00:00Z"
          }
        }
      },
      "sort": {
        "sort_field": "CREATED_AT",
        "sort_order": "DESC"
      }
    },
    "limit": 100
  }'
```

**Get Order Details**

```bash
curl -X GET "https://connect.squareup.com/v2/orders/ORDER_ID" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Create Order**

```bash
curl -X POST "https://connect.squareup.com/v2/orders" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "location_id": "'"$SQUARE_LOCATION_ID"'",
      "reference_id": "spkt_order_123",
      "line_items": [
        {
          "name": "Sample Product",
          "quantity": "1",
          "base_price_money": {
            "amount": 1999,
            "currency": "USD"
          },
          "note": "From Spocket"
        }
      ],
      "fulfillments": [
        {
          "type": "SHIPMENT",
          "state": "PROPOSED",
          "shipment_details": {
            "recipient": {
              "display_name": "John Doe",
              "email_address": "john.doe@example.com",
              "phone_number": "555-123-4567",
              "address": {
                "address_line_1": "123 Main St",
                "locality": "San Francisco",
                "administrative_district_level_1": "CA",
                "postal_code": "94105",
                "country": "US"
              }
            },
            "carrier": "USPS"
          }
        }
      ]
    },
    "idempotency_key": "'"$(uuidgen)"'"
  }'
```

**Update Order**

```bash
curl -X PUT "https://connect.squareup.com/v2/orders/ORDER_ID" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "location_id": "'"$SQUARE_LOCATION_ID"'",
      "version": 1,
      "state": "COMPLETED"
    },
    "idempotency_key": "'"$(uuidgen)"'"
  }'
```

## 3. Fulfillment Endpoints

### Spocket Fulfillment Management

**Update Order Fulfillment**

```bash
curl -X PATCH "https://api.spocket.co/v1/orders/ORDER_ID/fulfillments" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_number": "9400123456789012345678",
    "tracking_company": "USPS",
    "status": "shipped"
  }'
```

**Get Fulfillment Details**

```bash
curl -X GET "https://api.spocket.co/v1/orders/ORDER_ID/fulfillments" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### Square Fulfillment Management

**Update Order Fulfillment**

```bash
curl -X POST "https://connect.squareup.com/v2/orders/ORDER_ID/fulfillments" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fulfillment": {
      "type": "SHIPMENT",
      "state": "COMPLETED",
      "shipment_details": {
        "carrier": "USPS",
        "tracking_number": "9400123456789012345678",
        "tracking_url": "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400123456789012345678"
      }
    },
    "idempotency_key": "'"$(uuidgen)"'"
  }'
```

**Update Existing Fulfillment**

```bash
curl -X PUT "https://connect.squareup.com/v2/orders/ORDER_ID/fulfillments/FULFILLMENT_ID" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fulfillment": {
      "uid": "FULFILLMENT_UID",
      "state": "COMPLETED",
      "shipment_details": {
        "carrier": "USPS",
        "tracking_number": "9400123456789012345678",
        "tracking_url": "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400123456789012345678"
      }
    },
    "idempotency_key": "'"$(uuidgen)"'"
  }'
```

## 4. Payment Endpoints

### Spocket Payment Management

**Get Order Payment Details**

```bash
curl -X GET "https://api.spocket.co/v1/orders/ORDER_ID/transactions" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Update Payment Status**

```bash
curl -X PATCH "https://api.spocket.co/v1/orders/ORDER_ID/transactions/TRANSACTION_ID" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "paid"
  }'
```

### Square Payment Management

**List Payments for Order**

```bash
curl -X GET "https://connect.squareup.com/v2/payments?order_id=ORDER_ID" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Get Payment Details**

```bash
curl -X GET "https://connect.squareup.com/v2/payments/PAYMENT_ID" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Complete Payment (for authorized payments)**

```bash
curl -X POST "https://connect.squareup.com/v2/payments/PAYMENT_ID/complete" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "'"$(uuidgen)"'"
  }'
```

**Capture Payment (for authorized payments)**

```bash
curl -X POST "https://connect.squareup.com/v2/payments/PAYMENT_ID/capture" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "'"$(uuidgen)"'"
  }'
```

**Refund Payment**

```bash
curl -X POST "https://connect.squareup.com/v2/refunds" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "'"$(uuidgen)"'",
    "payment_id": "PAYMENT_ID",
    "amount_money": {
      "amount": 1000,
      "currency": "USD"
    },
    "reason": "Customer requested"
  }'
```

## 5. Webhook Management

### Square Webhook Management

**Create Webhook Subscription**

```bash
curl -X POST "https://connect.squareup.com/v2/webhooks/subscriptions" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {
      "name": "Order Updates",
      "event_types": [
        "order.created",
        "order.updated",
        "payment.updated"
      ],
      "notification_url": "https://yourdomain.com/webhooks/square",
      "api_version": "2023-12-13"
    },
    "idempotency_key": "'"$(uuidgen)"'"
  }'
```

**List Webhook Subscriptions**

```bash
curl -X GET "https://connect.squareup.com/v2/webhooks/subscriptions" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Get Webhook Subscription Details**

```bash
curl -X GET "https://connect.squareup.com/v2/webhooks/subscriptions/SUBSCRIPTION_ID" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Update Webhook Subscription**

```bash
curl -X PUT "https://connect.squareup.com/v2/webhooks/subscriptions/SUBSCRIPTION_ID" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {
      "name": "Updated Order Notifications",
      "event_types": [
        "order.created",
        "order.updated",
        "order.fulfillment.updated",
        "payment.updated"
      ],
      "notification_url": "https://yourdomain.com/webhooks/square",
      "api_version": "2023-12-13"
    },
    "idempotency_key": "'"$(uuidgen)"'"
  }'
```

**Delete Webhook Subscription**

```bash
curl -X DELETE "https://connect.squareup.com/v2/webhooks/subscriptions/SUBSCRIPTION_ID" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN"
```

**Test Webhook Subscription**

```bash
curl -X POST "https://connect.squareup.com/v2/webhooks/subscriptions/SUBSCRIPTION_ID/test" \
  -H "Square-Version: 2023-12-13" \
  -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order.created"
  }'
```

### Spocket Webhook Management

**Create Webhook Endpoint**

```bash
curl -X POST "https://api.spocket.co/v1/webhooks" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourdomain.com/webhooks/spocket",
    "topic": "order/created,order/updated,order/fulfilled",
    "format": "json"
  }'
```

**List Webhook Endpoints**

```bash
curl -X GET "https://api.spocket.co/v1/webhooks" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Get Webhook Endpoint Details**

```bash
curl -X GET "https://api.spocket.co/v1/webhooks/WEBHOOK_ID" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Update Webhook Endpoint**

```bash
curl -X PUT "https://api.spocket.co/v1/webhooks/WEBHOOK_ID" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourdomain.com/webhooks/spocket",
    "topic": "order/created,order/updated,order/fulfilled,order/cancelled",
    "format": "json"
  }'
```

**Delete Webhook Endpoint**

```bash
curl -X DELETE "https://api.spocket.co/v1/webhooks/WEBHOOK_ID" \
  -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN"
```

## 6. Webhook Testing and Validation

### Local Webhook Testing with ngrok

To test webhooks locally, you can use [ngrok](https://ngrok.com/) to create a secure tunnel to your local development server:

1. Install ngrok:
   ```bash
   brew install ngrok/ngrok/ngrok  # For macOS
   ```

2. Start your local server:
   ```bash
   npm start  # Assuming your server runs on port 3000
   ```

3. Start ngrok to tunnel to your local server:
   ```bash
   ngrok http 3000
   ```

4. Use the ngrok URL (e.g., `https://abc123.ngrok.io`) as your webhook endpoint in the API calls above.

### Webhook Payload Testing

**Send Test Webhook to Your Endpoint**

```bash
curl -X POST "https://yourdomain.com/webhooks/spocket" \
  -H "Content-Type: application/json" \
  -H "X-Spocket-Hmac-Sha256: $(echo -n '{"test":"payload"}' | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d ' ' -f 2)" \
  -d '{
    "test": "payload",
    "event": "order.created",
    "order_id": "test_order_123",
    "timestamp": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'"
  }'
```

### Webhook Signature Validation

#### Square Signature Validation

Square uses a notification URL signature for webhook verification. When you receive a webhook, validate it using:

```bash
# Extract signature from request headers
SQUARE_SIGNATURE_HEADER="your_received_signature"

# Get the webhook notification URL and secret from Square Dashboard
SQUARE_SIGNATURE_KEY="your_signature_key"
NOTIFICATION_URL="https://yourdomain.com/webhooks/square"

# Get the request body (save to a file first)
REQUEST_BODY=$(cat /path/to/request_body.json)

# Build the string to sign
STRING_TO_SIGN="${NOTIFICATION_URL}${REQUEST_BODY}"

# Generate the signature
EXPECTED_SIGNATURE=$(echo -n "$STRING_TO_SIGN" | openssl dgst -sha256 -hmac "$SQUARE_SIGNATURE_KEY" -binary | base64)

# Compare signatures
if [ "$EXPECTED_SIGNATURE" = "$SQUARE_SIGNATURE_HEADER" ]; then
  echo "Signature Valid"
else
  echo "Signature Invalid"
fi
```

#### Spocket Signature Validation

Spocket uses HMAC-SHA256 for webhook verification:

```bash
# Extract signature from request headers
SPOCKET_SIGNATURE_HEADER="your_received_signature"

# Get your webhook secret
WEBHOOK_SECRET="your_webhook_secret"

# Get the request body (save to a file first)
REQUEST_BODY=$(cat /path/to/request_body.json)

# Generate the signature
EXPECTED_SIGNATURE=$(echo -n "$REQUEST_BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d ' ' -f 2)

# Compare signatures
if [ "$EXPECTED_SIGNATURE" = "$SPOCKET_SIGNATURE_HEADER" ]; then
  echo "Signature Valid"
else
  echo "Signature Invalid"
fi
```

### Debugging Webhooks

For debugging webhooks, you can use services like:

1. **RequestBin** (https://requestbin.com) - Create a temporary endpoint to inspect webhook payloads

2. **Webhook.site** (https://webhook.site) - A simple tool to test and debug webhooks and HTTP requests

3. **Hookdeck** (https://hookdeck.com) - For more advanced webhook testing and management

Example of using webhook.site:

```bash
# Generate a UUID for a unique endpoint
WEBHOOK_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Create a webhook.site endpoint
WEBHOOK_URL=$(curl -s -X POST https://webhook.site/token -H "Content-Type: application/json" | jq -r '.uuid')
WEBHOOK_URL="https://webhook.site/${WEBHOOK_URL}"

echo "Your webhook testing URL: $WEBHOOK_URL"

# Now use this URL in your Square or Spocket webhook subscription
```

### Sample Webhook Payloads

**Square Order Created Webhook**

```json
{
  "merchant_id": "MERCHANT_ID",
  "type": "order.created",
  "event_id": "00000000-0000-0000-0000-000000000000",
  "created_at": "2025-01-01T00:00:00Z",
  "data": {
    "type": "order",
    "id": "ORDER_ID",
    "object": {
      "order_id": "ORDER_ID",
      "reference_id": "spkt_order_123",
      "state": "OPEN",
      "location_id": "LOCATION_ID",
      "line_items": [
        {
          "uid": "line_item_uid",
          "name": "Sample Product",
          "quantity": "1",
          "base_price_money": {
            "amount": 1999,
            "currency": "USD"
          }
        }
      ],
      "created_at": "2025-01-01T00:00:00Z"
    }
  }
}
```

**Spocket Order Created Webhook**

```json
{
  "event": "order.created",
  "id": "spkt_order_123",
  "created_at": "2025-01-01T00:00:00Z",
  "order": {
    "id": "spkt_order_123",
    "status": "pending",
    "shipping_address": {
      "first_name": "John",
      "last_name": "Doe",
      "address1": "123 Main St",
      "city": "San Francisco",
      "province": "California",
      "country": "United States",
      "zip": "94105"
    },
    "line_items": [
      {
        "id": "item_1",
        "product_id": "product_123",
        "variant_id": "variant_123",
        "quantity": 1,
        "price": 19.99
      }
    ],
    "external_id": "sq_order_123"
  }
}
```
