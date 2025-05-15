# Spocket-Square Integration Scripts

This directory contains scripts for testing, debugging, and managing the integration between Spocket and Square platforms.

## Scripts Overview

- `test-integration.sh` - Tests the entire order synchronization flow between platforms
- `api-debug-commands.md` - Collection of curl commands for API debugging

## Test Integration Script

The `test-integration.sh` script tests the complete order synchronization flow between Spocket and Square platforms. It validates authentication, order creation, fulfillment updates, payment processing, and webhook delivery.

### Prerequisites

- Bash shell environment (Linux, macOS, or WSL on Windows)
- `curl` installed and available in your PATH
- `jq` for processing JSON responses (optional, but recommended)
- Active Spocket and Square accounts with API credentials
- Webhook.site access for webhook testing

### Required Environment Variables

Set these environment variables before running the script:

```bash
# Spocket API credentials
export SPOCKET_CLIENT_ID="your_spocket_client_id"
export SPOCKET_CLIENT_SECRET="your_spocket_client_secret"

# Square API credentials
export SQUARE_ACCESS_TOKEN="your_square_access_token"
export SQUARE_LOCATION_ID="your_square_location_id"
```

Alternatively, you can create a `.env` file in the project root with these variables, and the script will load them automatically.

### Script Usage

```bash
# Run the complete integration test
./scripts/test-integration.sh

# Skip authentication tests (use when you're sure credentials are valid)
./scripts/test-integration.sh --no-auth-test

# Skip webhook testing (useful for environments where webhook tests may not work)
./scripts/test-integration.sh --no-webhook-test

# Skip both authentication and webhook tests
./scripts/test-integration.sh --no-auth-test --no-webhook-test
```

Make sure to set the script as executable:

```bash
chmod +x scripts/test-integration.sh
```

### Test Flow

The test script follows this flow:

1. **Authentication**: Validates API credentials for both platforms
2. **Order Creation**: Creates a test order in Spocket
3. **Order Sync**: Verifies the order is synchronized to Square
4. **Fulfillment Update**: Updates fulfillment status in Spocket and verifies sync to Square
5. **Payment Update**: Updates payment status in Square and verifies sync to Spocket
6. **Webhook Testing**: Tests webhook delivery from Square to a test endpoint
7. **Cleanup**: Removes all test resources created during testing

### Example Test Output

A successful test run will look like this:

```
[2025-05-15 08:15:22] Loading environment variables from .env file
[2025-05-15 08:15:22] Authenticating with Spocket API...
[2025-05-15 08:15:23] ✅ Successfully authenticated with Spocket
[2025-05-15 08:15:23] Verifying Square authentication...
[2025-05-15 08:15:24] ✅ Successfully authenticated with Square
[2025-05-15 08:15:24] Creating test order in Spocket...
[2025-05-15 08:15:25] ✅ Created Spocket order with ID: spkt_1a2b3c4d
[2025-05-15 08:15:25] Waiting for order to sync to Square...
[2025-05-15 08:15:35] ✅ Found synced order in Square with ID: sq_5e6f7g8h
[2025-05-15 08:15:35] Updating fulfillment status in Spocket...
[2025-05-15 08:15:36] ✅ Updated Spocket order fulfillment
[2025-05-15 08:15:36] Verifying fulfillment sync to Square...
[2025-05-15 08:15:41] ✅ Fulfillment updated successfully in Square
[2025-05-15 08:15:41] Updating payment status in Square...
[2025-05-15 08:15:42] ✅ Updated Square payment status to COMPLETED
[2025-05-15 08:15:42] Verifying payment sync to Spocket...
[2025-05-15 08:15:47] ✅ Payment status updated successfully in Spocket
[2025-05-15 08:15:47] Testing webhook delivery...
[2025-05-15 08:15:48] Created webhook testing endpoint: https://webhook.site/abc123
[2025-05-15 08:15:49] ✅ Created Square webhook subscription with ID: wh_9i8j7k6l
[2025-05-15 08:15:49] ✅ Sent test webhook event
[2025-05-15 08:15:49] Waiting for webhook to be delivered...
[2025-05-15 08:15:52] ✅ Webhook delivered successfully! Received 1 requests.
[2025-05-15 08:15:52] Cleaning up test resources...
[2025-05-15 08:15:52] Deleting Square webhook subscription...
[2025-05-15 08:15:53] ✅ Deleted Square webhook subscription
[2025-05-15 08:15:53] Cancelling Spocket test order...
[2025-05-15 08:15:54] ✅ Cancelled Spocket test order
[2025-05-15 08:15:54] Cancelling Square test order...
[2025-05-15 08:15:55] ✅ Cancelled Square test order
[2025-05-15 08:15:55] ✅ All test resources cleaned up successfully

=====================================
     INTEGRATION TEST SUMMARY       
=====================================

Spocket Authentication: SUCCESS
Spocket Order Creation: SUCCESS (ID: spkt_1a2b3c4d)
Order Sync to Square: SUCCESS (ID: sq_5e6f7g8h)
Fulfillment Update: SUCCESS (Tracking: TEST20250515081535)
Payment Update: SUCCESS (ID: pay_3m2n1o0p)
Webhook Testing: SUCCESS (ID: wh_9i8j7k6l)

=====================================
```

## Common Issues and Troubleshooting

### Authentication Issues

**Spocket Authentication Failure:**
```
[2025-05-15 08:15:22] ❌ Failed to authenticate with Spocket. Response: {"error":"invalid_client"}
```

**Solution:** Double-check your `SPOCKET_CLIENT_ID` and `SPOCKET_CLIENT_SECRET` values. Ensure they are valid and have API access permissions.

**Square Authentication Failure:**
```
[2025-05-15 08:15:23] ❌ Failed to authenticate with Square. Response: {"errors":[{"category":"AUTHENTICATION_ERROR"}]}
```

**Solution:** Verify your `SQUARE_ACCESS_TOKEN` and ensure it has the required permissions for Orders API.

### Synchronization Issues

**Order Sync Failure:**
```
[2025-05-15 08:15:25] Waiting for order to sync to Square...
[2025-05-15 08:16:05] ❌ Order did not sync to Square within expected time.
```

**Solution:** 
1. Check if your Spocket-Square integration is properly configured
2. Verify that your Square location ID is correct
3. Increase the `MAX_ATTEMPTS` and `WAIT_TIME` variables in the script for slower environments

### Webhook Issues

**Webhook Creation Failure:**
```
[2025-05-15 08:15:47] ⚠️ Failed to create webhook subscription. Response: {"errors":[{"category":"INVALID_REQUEST_ERROR"}]}
```

**Solution:**
1. Ensure your Square account has permissions to create webhooks
2. Verify that webhook.site is accessible from your environment
3. Try using a different webhook endpoint service

## Advanced Usage

### Testing Specific Integration Scenarios

**Test Only Authentication:**

Edit the script to exit after authentication:

```bash
# Add after authentication section
if [ "$TEST_AUTH" = true ]; then
    log_success "Authentication tests passed. Exiting as requested."
    exit 0
fi
```

**Test Only Order Creation:**

Run the script with a modified `main()` function:

```bash
main() {
    # Set up trap to ensure cleanup on script exit
    trap cleanup_resources EXIT
    
    # Check required environment variables
    check_env_vars
    
    # Authenticate
    authenticate_spocket
    verify_square_auth
    
    # Create test order in Spocket
    create_spocket_order
    
    # Print summary and exit
    log_success "Order creation test completed"
    exit 0
}
```

## API Debugging Commands

For detailed API debugging commands, see [api-debug-commands.md](./api-debug-commands.md).

## Further Customization

The integration test script can be extended for additional scenarios:

- Test order cancellation flow
- Test order refund processing
- Test product synchronization
- Test inventory updates

To add these scenarios, create new functions in the script and modify the `main()` function to include them in your test flow.

