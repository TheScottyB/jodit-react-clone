#!/bin/bash
#
# Integration Test Script for Spocket-Square Integration
#
# This script tests the complete flow of order synchronization between
# Spocket and Square, including order creation, fulfillment, payment updates,
# and webhook delivery validation.
#
# Usage: ./test-integration.sh [--no-auth-test] [--no-webhook-test]
#

# Exit on any error
set -e

# Set terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default script flags
TEST_AUTH=true
TEST_WEBHOOK=true

# Parse command line arguments
for arg in "$@"
do
    case $arg in
        --no-auth-test)
        TEST_AUTH=false
        shift
        ;;
        --no-webhook-test)
        TEST_WEBHOOK=false
        shift
        ;;
        *)
        # Unknown option
        ;;
    esac
done

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo -e "${BLUE}Loading environment variables from .env file${NC}"
    source .env
fi

# Check required environment variables
check_env_vars() {
    missing_vars=false
    
    if [ -z "$SPOCKET_CLIENT_ID" ] || [ -z "$SPOCKET_CLIENT_SECRET" ]; then
        echo -e "${RED}Missing Spocket credentials. Please set SPOCKET_CLIENT_ID and SPOCKET_CLIENT_SECRET.${NC}"
        missing_vars=true
    fi
    
    if [ -z "$SQUARE_ACCESS_TOKEN" ] || [ -z "$SQUARE_LOCATION_ID" ]; then
        echo -e "${RED}Missing Square credentials. Please set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.${NC}"
        missing_vars=true
    fi
    
    if [ "$missing_vars" = true ]; then
        exit 1
    fi
}

# Log message to console with timestamp
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Log success message
log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

# Log error message
log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Log warning message
log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️ $1${NC}"
}

# Authenticate with Spocket API
authenticate_spocket() {
    log "Authenticating with Spocket API..."
    
    # Call Spocket authentication endpoint
    SPOCKET_AUTH_RESPONSE=$(curl -s -X POST https://api.spocket.co/oauth/token \
        -H "Content-Type: application/json" \
        -d '{
            "client_id": "'"$SPOCKET_CLIENT_ID"'",
            "client_secret": "'"$SPOCKET_CLIENT_SECRET"'",
            "grant_type": "client_credentials"
        }')
    
    # Extract access token from response
    SPOCKET_ACCESS_TOKEN=$(echo "$SPOCKET_AUTH_RESPONSE" | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')
    
    if [ -z "$SPOCKET_ACCESS_TOKEN" ]; then
        log_error "Failed to authenticate with Spocket. Response: $SPOCKET_AUTH_RESPONSE"
        exit 1
    fi
    
    log_success "Successfully authenticated with Spocket"
    
    # Export token for use in subsequent API calls
    export SPOCKET_ACCESS_TOKEN
}

# Verify Square Authentication
verify_square_auth() {
    log "Verifying Square authentication..."
    
    # Call Square locations API to verify token
    SQUARE_AUTH_RESPONSE=$(curl -s -X GET "https://connect.squareup.com/v2/locations" \
        -H "Square-Version: 2023-12-13" \
        -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
        -H "Content-Type: application/json")
    
    # Check if response contains locations
    if echo "$SQUARE_AUTH_RESPONSE" | grep -q '"locations":'; then
        log_success "Successfully authenticated with Square"
    else
        log_error "Failed to authenticate with Square. Response: $SQUARE_AUTH_RESPONSE"
        exit 1
    fi
}

# Create test order in Spocket
create_spocket_order() {
    log "Creating test order in Spocket..."
    
    # Generate a unique order reference
    ORDER_REF="test-$(date +%Y%m%d%H%M%S)"
    
    # Call Spocket API to create order
    SPOCKET_ORDER_RESPONSE=$(curl -s -X POST "https://api.spocket.co/v1/orders" \
        -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "shipping_address": {
                "first_name": "Test",
                "last_name": "Customer",
                "address1": "123 Test St",
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
            "external_id": "'"$ORDER_REF"'",
            "note": "Integration test order"
        }')
    
    # Extract order ID from response
    SPOCKET_ORDER_ID=$(echo "$SPOCKET_ORDER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
    
    if [ -z "$SPOCKET_ORDER_ID" ]; then
        log_error "Failed to create Spocket order. Response: $SPOCKET_ORDER_RESPONSE"
        exit 1
    fi
    
    log_success "Created Spocket order with ID: $SPOCKET_ORDER_ID"
    
    # Export order ID for use in subsequent steps
    export SPOCKET_ORDER_ID
    export ORDER_REF
}

# Wait for order to sync to Square
wait_for_square_order() {
    log "Waiting for order to sync to Square..."
    
    # Maximum number of attempts
    MAX_ATTEMPTS=10
    # Wait time between attempts in seconds
    WAIT_TIME=5
    
    for ((i=1; i<=MAX_ATTEMPTS; i++)); do
        # Search for order in Square by reference ID
        SQUARE_ORDER_RESPONSE=$(curl -s -X POST "https://connect.squareup.com/v2/orders/search" \
            -H "Square-Version: 2023-12-13" \
            -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "location_ids": ["'"$SQUARE_LOCATION_ID"'"],
                "query": {
                    "filter": {
                        "source_filter": {
                            "source_names": ["Spocket"]
                        }
                    }
                },
                "limit": 100
            }')
        
        # Check if response contains our reference ID
        if echo "$SQUARE_ORDER_RESPONSE" | grep -q "$ORDER_REF"; then
            # Extract Square order ID
            SQUARE_ORDER_ID=$(echo "$SQUARE_ORDER_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
            log_success "Found synced order in Square with ID: $SQUARE_ORDER_ID"
            export SQUARE_ORDER_ID
            return 0
        fi
        
        log "Attempt $i/$MAX_ATTEMPTS: Order not found in Square yet. Waiting ${WAIT_TIME}s..."
        sleep $WAIT_TIME
    done
    
    log_error "Order did not sync to Square within expected time."
    exit 1
}

# Update order fulfillment in Spocket
update_spocket_fulfillment() {
    log "Updating fulfillment status in Spocket..."
    
    # Generate tracking number
    TRACKING_NUMBER="TEST$(date +%Y%m%d%H%M%S)"
    
    # Call Spocket API to update fulfillment
    FULFILLMENT_RESPONSE=$(curl -s -X PATCH "https://api.spocket.co/v1/orders/$SPOCKET_ORDER_ID/fulfillments" \
        -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "tracking_number": "'"$TRACKING_NUMBER"'",
            "tracking_company": "USPS",
            "status": "shipped"
        }')
    
    if echo "$FULFILLMENT_RESPONSE" | grep -q "success"; then
        log_success "Updated Spocket order fulfillment"
        export TRACKING_NUMBER
    else
        log_error "Failed to update Spocket fulfillment. Response: $FULFILLMENT_RESPONSE"
    fi
}

# Verify fulfillment sync to Square
verify_square_fulfillment() {
    log "Verifying fulfillment sync to Square..."
    
    # Maximum number of attempts
    MAX_ATTEMPTS=10
    # Wait time between attempts in seconds
    WAIT_TIME=5
    
    for ((i=1; i<=MAX_ATTEMPTS; i++)); do
        # Get order details from Square
        SQUARE_ORDER_RESPONSE=$(curl -s -X GET "https://connect.squareup.com/v2/orders/$SQUARE_ORDER_ID" \
            -H "Square-Version: 2023-12-13" \
            -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
            -H "Content-Type: application/json")
        
        # Check if response contains our tracking number
        if echo "$SQUARE_ORDER_RESPONSE" | grep -q "$TRACKING_NUMBER"; then
            log_success "Fulfillment updated successfully in Square"
            return 0
        fi
        
        log "Attempt $i/$MAX_ATTEMPTS: Fulfillment update not synced to Square yet. Waiting ${WAIT_TIME}s..."
        sleep $WAIT_TIME
    done
    
    log_warning "Fulfillment sync to Square could not be verified within expected time."
}

# Update payment status in Square
update_square_payment() {
    log "Updating payment status in Square..."
    
    # First, get the payment ID for the order
    PAYMENT_RESPONSE=$(curl -s -X GET "https://connect.squareup.com/v2/payments?order_id=$SQUARE_ORDER_ID" \
        -H "Square-Version: 2023-12-13" \
        -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
        -H "Content-Type: application/json")
    
    # Extract payment ID
    PAYMENT_ID=$(echo "$PAYMENT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
    
    if [ -z "$PAYMENT_ID" ]; then
        log_warning "No payment found for Square order. Unable to test payment update."
        return 1
    fi
    
    # Complete the payment
    COMPLETE_RESPONSE=$(curl -s -X POST "https://connect.squareup.com/v2/payments/$PAYMENT_ID/complete" \
        -H "Square-Version: 2023-12-13" \
        -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "idempotency_key": "'"$(uuidgen)"'"
        }')
    
    if echo "$COMPLETE_RESPONSE" | grep -q '"status":"COMPLETED"'; then
        log_success "Updated Square payment status to COMPLETED"
        export PAYMENT_ID
    else
        log_warning "Failed to update Square payment. Response: $COMPLETE_RESPONSE"
    fi
}

# Verify payment status sync to Spocket
verify_spocket_payment() {
    log "Verifying payment sync to Spocket..."
    
    # Maximum number of attempts
    MAX_ATTEMPTS=10
    # Wait time between attempts in seconds
    WAIT_TIME=5
    
    for ((i=1; i<=MAX_ATTEMPTS; i++)); do
        # Get order details from Spocket
        SPOCKET_ORDER_RESPONSE=$(curl -s -X GET "https://api.spocket.co/v1/orders/$SPOCKET_ORDER_ID" \
            -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
            -H "Content-Type: application/json")
        
        # Check if payment status is updated
        if echo "$SPOCKET_ORDER_RESPONSE" | grep -q '"payment_status":"paid"'; then
            log_success "Payment status updated successfully in Spocket"
            return 0
        fi
        
        log "Attempt $i/$MAX_ATTEMPTS: Payment update not synced to Spocket yet. Waiting ${WAIT_TIME}s..."
        sleep $WAIT_TIME
    done
    
    log_warning "Payment sync to Spocket could not be verified within expected time."
}

# Test webhook delivery
test_webhook_delivery() {
    if [ "$TEST_WEBHOOK" = false ]; then
        log_warning "Skipping webhook testing as requested"
        return 0
    fi
    
    log "Testing webhook delivery..."
    
    # Create webhook.site endpoint for testing
    WEBHOOK_RESPONSE=$(curl -s -X POST https://webhook.site/token \
        -H "Content-Type: application/json")
    
    WEBHOOK_UUID=$(echo "$WEBHOOK_RESPONSE" | grep -o '"uuid":"[^"]*' | sed 's/"uuid":"//')
    WEBHOOK_URL="https://webhook.site/$WEBHOOK_UUID"
    
    if [ -z "$WEBHOOK_UUID" ]; then
        log_warning "Failed to create webhook.site endpoint. Skipping webhook test."
        return 1
    fi
    
    log "Created webhook testing endpoint: $WEBHOOK_URL"
    
    # Register webhook with Square
    SUBSCRIPTION_RESPONSE=$(curl -s -X POST "https://connect.squareup.com/v2/webhooks/subscriptions" \
        -H "Square-Version: 2023-12-13" \
        -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "subscription": {
                "name": "Integration Test",
                "event_types": [
                    "order.created",
                    "order.updated",
                    "payment.updated"
                ],
                "notification_url": "'"$WEBHOOK_URL"'",
                "api_version": "2023-12-13"
            },
            "idempotency_key": "'"$(uuidgen)"'"
        }')
    
    # Extract subscription ID
    SUBSCRIPTION_ID=$(echo "$SUBSCRIPTION_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
    
    if [ -z "$SUBSCRIPTION_ID" ]; then
        log_warning "Failed to create webhook subscription. Response: $SUBSCRIPTION_RESPONSE"
        return 1
    fi
    
    log_success "Created Square webhook subscription with ID: $SUBSCRIPTION_ID"
    export SUBSCRIPTION_ID
    
    # Test webhook by sending a test event
    TEST_RESPONSE=$(curl -s -X POST "https://connect.squareup.com/v2/webhooks/subscriptions/$SUBSCRIPTION_ID/test" \
        -H "Square-Version: 2023-12-13" \
        -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "event_type": "order.updated"
        }')
    
    if echo "$TEST_RESPONSE" | grep -q '"success":true'; then
        log_success "Sent test webhook event"
    else
        log_warning "Failed to send test webhook event. Response: $TEST_RESPONSE"
    fi
    
    # Wait for webhook to be delivered and check webhook.site for receipt
    log "Waiting for webhook to be delivered..."
    MAX_ATTEMPTS=5
    WAIT_TIME=3
    
    for ((i=1; i<=MAX_ATTEMPTS; i++)); do
        # Check webhook.site for received requests
        WEBHOOK_CHECK=$(curl -s "https://webhook.site/token/$WEBHOOK_UUID/requests?sorting=newest" \
            -H "Content-Type: application/json")
        
        # Count received requests
        REQUEST_COUNT=$(echo "$WEBHOOK_CHECK" | grep -o '"count":' | wc -l)
        
        if [ "$REQUEST_COUNT" -gt 0 ]; then
            log_success "Webhook delivered successfully! Received $REQUEST_COUNT requests."
            return 0
        fi
        
        log "Attempt $i/$MAX_ATTEMPTS: No webhook delivery detected yet. Waiting ${WAIT_TIME}s..."
        sleep $WAIT_TIME
    done
    
    log_warning "Could not verify webhook delivery within expected time."
    return 1
}

# Cleanup resources created during testing
cleanup_resources() {
    log "Cleaning up test resources..."
    cleanup_failures=0

    # Delete Square webhook subscription if created
    if [ -n "$SUBSCRIPTION_ID" ]; then
        log "Deleting Square webhook subscription..."
        DELETE_RESPONSE=$(curl -s -X DELETE "https://connect.squareup.com/v2/webhooks/subscriptions/$SUBSCRIPTION_ID" \
            -H "Square-Version: 2023-12-13" \
            -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN")
        
        if [ -z "$DELETE_RESPONSE" ] || [ "$DELETE_RESPONSE" = "{}" ]; then
            log_success "Deleted Square webhook subscription"
        else
            log_warning "Failed to delete Square webhook subscription: $DELETE_RESPONSE"
            cleanup_failures=$((cleanup_failures + 1))
        fi
    fi
    
    # Cancel Spocket order if created
    if [ -n "$SPOCKET_ORDER_ID" ]; then
        log "Cancelling Spocket test order..."
        CANCEL_RESPONSE=$(curl -s -X PATCH "https://api.spocket.co/v1/orders/$SPOCKET_ORDER_ID" \
            -H "Authorization: Bearer $SPOCKET_ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "status": "cancelled",
                "cancellation_reason": "test order"
            }')
        
        if echo "$CANCEL_RESPONSE" | grep -q "success"; then
            log_success "Cancelled Spocket test order"
        else
            log_warning "Failed to cancel Spocket test order: $CANCEL_RESPONSE"
            cleanup_failures=$((cleanup_failures + 1))
        fi
    fi
    
    # Cancel Square order if created
    if [ -n "$SQUARE_ORDER_ID" ]; then
        log "Cancelling Square test order..."
        CANCEL_RESPONSE=$(curl -s -X POST "https://connect.squareup.com/v2/orders/$SQUARE_ORDER_ID/cancel" \
            -H "Square-Version: 2023-12-13" \
            -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "idempotency_key": "'"$(uuidgen)"'"
            }')
        
        if echo "$CANCEL_RESPONSE" | grep -q "order"; then
            log_success "Cancelled Square test order"
        else
            log_warning "Failed to cancel Square test order: $CANCEL_RESPONSE"
            cleanup_failures=$((cleanup_failures + 1))
        fi
    fi
    
    if [ "$cleanup_failures" -eq 0 ]; then
        log_success "All test resources cleaned up successfully"
    else
        log_warning "$cleanup_failures resources could not be cleaned up"
    fi
}

# Print test summary
print_summary() {
    echo ""
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}     INTEGRATION TEST SUMMARY       ${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""
    
    if [ "$SPOCKET_ACCESS_TOKEN" ]; then
        echo -e "Spocket Authentication: ${GREEN}SUCCESS${NC}"
    else
        echo -e "Spocket Authentication: ${RED}FAILED${NC}"
    fi
    
    if [ "$SPOCKET_ORDER_ID" ]; then
        echo -e "Spocket Order Creation: ${GREEN}SUCCESS${NC} (ID: $SPOCKET_ORDER_ID)"
    else
        echo -e "Spocket Order Creation: ${RED}FAILED${NC}"
    fi
    
    if [ "$SQUARE_ORDER_ID" ]; then
        echo -e "Order Sync to Square: ${GREEN}SUCCESS${NC} (ID: $SQUARE_ORDER_ID)"
    else
        echo -e "Order Sync to Square: ${RED}FAILED${NC}"
    fi
    
    if [ "$TRACKING_NUMBER" ]; then
        echo -e "Fulfillment Update: ${GREEN}SUCCESS${NC} (Tracking: $TRACKING_NUMBER)"
    else
        echo -e "Fulfillment Update: ${RED}FAILED${NC}"
    fi
    
    if [ "$PAYMENT_ID" ]; then
        echo -e "Payment Update: ${GREEN}SUCCESS${NC} (ID: $PAYMENT_ID)"
    else
        echo -e "Payment Update: ${YELLOW}SKIPPED${NC}"
    fi
    
    if [ "$SUBSCRIPTION_ID" ]; then
        echo -e "Webhook Testing: ${GREEN}SUCCESS${NC} (ID: $SUBSCRIPTION_ID)"
    else
        echo -e "Webhook Testing: ${TEST_WEBHOOK == true ? RED"FAILED"NC : YELLOW"SKIPPED"NC}"
    fi
    
    echo ""
    echo -e "${BLUE}=====================================${NC}"
    echo ""
}

# Main script execution
main() {
    # Set up trap to ensure cleanup on script exit
    trap cleanup_resources EXIT
    
    # Check required environment variables
    check_env_vars
    
    # Step 1: Authenticate
    if [ "$TEST_AUTH" = true ]; then
        authenticate_spocket
        verify_square_auth
    else
        log_warning "Skipping authentication tests as requested"
    fi
    
    # Step 2: Create test order in Spocket
    create_spocket_order
    
    # Step 3: Wait for order to sync to Square
    wait_for_square_order
    
    # Step 4: Update fulfillment in Spocket
    update_spocket_fulfillment
    
    # Step 5: Verify fulfillment sync to Square
    verify_square_fulfillment
    
    # Step 6: Update payment in Square
    update_square_payment
    
    # Step 7: Verify payment sync to Spocket
    if [ -n "$PAYMENT_ID" ]; then
        verify_spocket_payment
    fi
    
    # Step 8: Test webhook delivery
    test_webhook_delivery
    
    # Print test summary
    print_summary
}

# Execute main function
main
