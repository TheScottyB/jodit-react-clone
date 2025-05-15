#!/bin/bash

# ==============================================================================
# GENERATE TEST DATA SCRIPT (VERSION 2)
# ==============================================================================
# This script generates test data for Spocket and Square integration testing
# It focuses on creating orders with different statuses and scenarios
# 
# Usage:
#   ./scripts/generate-test-data-v2.sh [options]
#
# Options:
#   --platform <spocket|square|both>   Target platform (default: both)
#   --orders <number>                  Number of orders to create (default: 5)
#   --scenario <normal|edge|error|all> Type of scenarios to generate (default: normal)
#   --cleanup                          Remove previously generated test data
#   --sync-test                        Test order status synchronization
#   --help                             Display this help message
# ==============================================================================

set -e

# Directory setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
mkdir -p "$ROOT_DIR/logs"
mkdir -p "$ROOT_DIR/temp"

# Log file
LOG_FILE="$ROOT_DIR/logs/test-data-$(date +%Y%m%d-%H%M%S).log"

# Temporary file for resource tracking
RESOURCE_FILE="$ROOT_DIR/temp/test-resources.json"

# Set initial resource tracking if not exists or cleanup requested
if [[ ! -f "$RESOURCE_FILE" ]]; then
  echo "{\"spocket\":{\"customers\":[],\"products\":[],\"orders\":[]},\"square\":{\"customers\":[],\"products\":[],\"orders\":[],\"variations\":[]}}" > "$RESOURCE_FILE"
fi

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
PLATFORM="both"
ORDER_COUNT=5
SCENARIO="normal"
CLEANUP=false
SYNC_TEST=false

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Display help message
show_help() {
  cat << EOF
Usage: $(basename "$0") [options]

Options:
  --platform <spocket|square|both>   Target platform (default: both)
  --orders <number>                  Number of orders to create (default: 5)
  --scenario <normal|edge|error|all> Type of scenarios to generate (default: normal)
  --cleanup                          Remove previously generated test data
  --sync-test                        Test order status synchronization
  --help                             Display this help message

Example:
  $(basename "$0") --platform square --orders 3 --scenario edge
EOF
  exit 0
}

# Logging function
log() {
  local level="$1"
  local message="$2"
  local color="${NC}"
  
  case "$level" in
    "INFO") color="${GREEN}" ;;
    "WARN") color="${YELLOW}" ;;
    "ERROR") color="${RED}" ;;
    "DEBUG") color="${BLUE}" ;;
  esac
  
  echo -e "${color}[$level] $message${NC}"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
}

# Track progress with a spinner
show_spinner() {
  local pid=$1
  local delay=0.1
  local spinstr='|/-\'
  
  echo -n "Processing "
  
  while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
    local temp=${spinstr#?}
    printf " [%c]  " "$spinstr"
    local spinstr=$temp${spinstr%"$temp"}
    sleep $delay
    printf "\b\b\b\b\b\b"
  done
  
  printf "    \b\b\b\b"
  echo -e "Done!"
}

# Save generated resource ID to tracking file
save_resource() {
  local platform="$1"
  local resource_type="$2"
  local resource_id="$3"
  local resource_name="$4"
  
  # Read current tracking data
  local json_data=$(cat "$RESOURCE_FILE")
  
  # Add new resource
  json_data=$(echo "$json_data" | jq ".$platform.$resource_type += [{\"id\": \"$resource_id\", \"name\": \"$resource_name\"}]")
  
  # Save updated data
  echo "$json_data" > "$RESOURCE_FILE"
  
  log "INFO" "Added $platform $resource_type: $resource_name (ID: $resource_id)"
}

# Get random resource from tracking file
get_random_resource() {
  local platform="$1"
  local resource_type="$2"
  
  local ids=$(jq -r ".$platform.$resource_type[].id" "$RESOURCE_FILE" 2>/dev/null)
  if [[ -z "$ids" ]]; then
    echo ""
    return 1
  fi
  
  # Convert to array and select random element
  readarray -t id_array <<< "$ids"
  local random_index=$((RANDOM % ${#id_array[@]}))
  echo "${id_array[$random_index]}"
}

# Check if required environment variables are set
check_env_vars() {
  local platform="$1"
  local missing=false
  
  if [[ "$platform" == "spocket" || "$platform" == "both" ]]; then
    if [[ -z "$SPOCKET_API_KEY" || -z "$SPOCKET_API_URL" ]]; then
      log "ERROR" "Spocket environment variables not set. Please define SPOCKET_API_KEY and SPOCKET_API_URL."
      missing=true
    fi
  fi
  
  if [[ "$platform" == "square" || "$platform" == "both" ]]; then
    if [[ -z "$SQUARE_ACCESS_TOKEN" || -z "$SQUARE_LOCATION_ID" || -z "$SQUARE_API_URL" ]]; then
      log "ERROR" "Square environment variables not set. Please define SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and SQUARE_API_URL."
      missing=true
    fi
  fi
  
  if [[ "$missing" == true ]]; then
    exit 1
  fi
}

# =============================================================================
# DATA GENERATION FUNCTIONS
# =============================================================================

# Create test customer in Spocket
create_spocket_customer() {
  local name="Test Customer $(date +%s)"
  local email="test.customer.$(date +%s)@example.com"
  
  log "INFO" "Creating Spocket customer: $name"
  
  local response=$(curl -s -X POST "$SPOCKET_API_URL/customers" \
    -H "Authorization: Bearer $SPOCKET_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "customer": {
        "name": "'"$name"'",
        "email": "'"$email"'",
        "phone": "+1'"$(printf '%010d' $RANDOM)"'",
        "address": {
          "line1": "'"$(( RANDOM % 999 + 1 ))"' Test St",
          "city": "Test City",
          "state": "TS",
          "postal_code": "'"$(printf '%05d' $((RANDOM % 99999)))"'",
          "country": "US"
        }
      }
    }')
  
  local customer_id=$(echo "$response" | jq -r '.id')
  
  if [[ "$customer_id" == "null" || -z "$customer_id" ]]; then
    log "ERROR" "Failed to create Spocket customer: $(echo "$response" | jq -c)"
    return 1
  fi
  
  save_resource "spocket" "customers" "$customer_id" "$name"
  return 0
}

# Create test product in Spocket
create_spocket_product() {
  local name="Test Product $(date +%s)"
  local price=$(( RANDOM % 10000 + 500 )) # Price between $5.00 and $105.00
  
  log "INFO" "Creating Spocket product: $name"
  
  local response=$(curl -s -X POST "$SPOCKET_API_URL/products" \
    -H "Authorization: Bearer $SPOCKET_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "product": {
        "name": "'"$name"'",
        "description": "Test product created by script",
        "price": '"$(echo "scale=2; $price / 100" | bc)"',
        "sku": "TST-'"$(printf '%06d' $RANDOM)"'",
        "inventory_quantity": '"$(( RANDOM % 50 + 5 ))"'
      }
    }')
  
  local product_id=$(echo "$response" | jq -r '.id')
  
  if [[ "$product_id" == "null" || -z "$product_id" ]]; then
    log "ERROR" "Failed to create Spocket product: $(echo "$response" | jq -c)"
    return 1
  fi
  
  save_resource "spocket" "products" "$product_id" "$name"
  return 0
}

# Create test order in Spocket
create_spocket_order() {
  local scenario_type="${1:-normal}"
  
  # Get a random customer or create one if none exists
  local customer_id=$(get_random_resource "spocket" "customers")
  if [[ -z "$customer_id" ]]; then
    log "INFO" "No Spocket customers found. Creating one..."
    create_spocket_customer
    customer_id=$(get_random_resource "spocket" "customers")
    if [[ -z "$customer_id" ]]; then
      log "ERROR" "Failed to create a Spocket customer"
      return 1
    fi
  fi
  
  # Get random products or create some if none exist
  local product_ids=()
  local product_quantities=()
  local product_prices=()
  
  # Use between 1-3 products per order
  local product_count=$(( RANDOM % 3 + 1 ))
  
  # Try to get existing products
  for ((i=0; i<$product_count; i++)); do
    local product_id=$(get_random_resource "spocket" "products")
    if [[ -n "$product_id" ]]; then
      product_ids+=("$product_id")
      product_quantities+=($((RANDOM % 3 + 1)))
      product_prices+=($((RANDOM % 5000 + 1000))) # $10-$60
    fi
  done
  
  # If no products found, create some
  if [[ ${#product_ids[@]} -eq 0 ]]; then
    log "INFO" "No Spocket products found. Creating some..."
    for ((i=0; i<2; i++)); do
      create_spocket_product
    done
    
    # Try again to get products
    for ((i=0; i<$product_count; i++)); do
      local product_id=$(get_random_resource "spocket" "products")
      if [[ -n "$product_id" ]]; then
        product_ids+=("$product_id")
        product_quantities+=($((RANDOM % 3 + 1)))
        product_prices+=($((RANDOM % 5000 + 1000))) # $10-$60
      fi
    done
    
    if [[ ${#product_ids[@]} -eq 0 ]]; then
      log "ERROR" "Failed to create Spocket products"
      return 1
    fi
  fi
  
  # Set order status based on scenario type
  local status
  if [[ "$scenario_type" == "normal" ]]; then
    # Normal statuses: pending, processing, shipped, delivered, completed
    status_array=("pending" "processing" "shipped" "delivered" "completed")
    status=${status_array[$(( RANDOM % ${#status_array[@]} ))]}
  elif [[ "$scenario_type" == "edge" ]]; then
    # Edge case statuses: back_ordered, partially_shipped, on_hold
    status_array=("back_ordered" "partially_shipped" "on_hold")
    status=${status_array[$(( RANDOM % ${#status_array[@]} ))]}
  else
    # Error case statuses: cancelled, refunded, failed
    status_array=("cancelled" "refunded" "failed")
    status=${status_array[$(( RANDOM % ${#status_array[@]} ))]}
  fi
  
  # Generate order date (within last 30 days)
  local days_ago=$(( RANDOM % 30 ))
  local order_date=$(date -v -${days_ago}d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -d "-${days_ago} days" +"%Y-%m-%dT%H:%M:%SZ")
  local order_number="SP-$(date +%s)-$(printf '%04d' $RANDOM)"
  
  # Build line items JSON
  local line_items="["
  for ((i=0; i<${#product_ids[@]}; i++)); do
    if [[ $i -gt 0 ]]; then
      line_items+=","
    fi
    
    line_items+='{'
    line_items+='"product_id":"'${product_ids[$i]}'",'
    line_items+='"quantity":'${product_quantities[$i]}','
    line_items+='"price_per_item":'$(echo "scale=2; ${product_prices[$i]} / 100" | bc)''
    line_items+='}'
  done
  line_items+="]"
  
  log "INFO" "Creating Spocket order with status: $status"
  
  # Add special error condition for error scenarios
  local error_json=""
  if [[ "$scenario_type" == "error" ]]; then
    error_json='"payment_error": "Payment processing failed",'
  fi
  
  local response=$(curl -s -X POST "$SPOCKET_API_URL/orders" \
    -H "Authorization: Bearer $SPOCKET_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "order": {
        "customer_id": "'"$customer_id"'",
        "order_number": "'"$order_number"'",
        "status": "'"$status"'",
        "order_date": "'"$order_date"'",
        "line_items": '"$line_items"',
        '"$error_json"'
        "note": "Test order created by script ('"$scenario_type"' scenario)"
      }
    }')
  
  local order_id=$(echo "$response" | jq -r '.id')
  
  if [[ "$order_id" == "null" || -z "$order_id" ]]; then
    log "ERROR" "Failed to create Spocket order: $(echo "$response" | jq -c)"
    return 1
  fi
  
  save_resource "spocket" "orders" "$order_id" "$order_number"
  return 0
}

# Create test customer in Square
create_square_customer() {
  local name="Test Customer $(date +%s)"
  local email="test.customer.$(date +%s)@example.com"
  
  log "INFO" "Creating Square customer: $name"
  
  local response=$(curl -s -X POST "$SQUARE_API_URL/v2/customers" \
    -H "Square-Version: 2023-12-13" \
    -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "given_name": "'"${name%% *}"'",
      "family_name": "'"${name#* }"'",
      "email_address": "'"$email"'",
      "phone_number": "+1'"$(printf '%010d' $RANDOM)"'",
      "address": {
        "address_line_1": "'"$(( RANDOM % 999 + 1 ))"' Test St",
        "locality": "Test City",
        "administrative_district_level_1": "TS",
        "postal_code": "'"$(printf '%05d' $((RANDOM % 99999)))"'",
        "country": "US"
      },
      "reference_id": "TEST-'"$(date +%s)"'"
    }')
  
  local customer_id=$(echo "$response" | jq -r '.customer.id')
  
  if [[ "$customer_id" == "null" || -z "$customer_id" ]]; then
    log "ERROR" "Failed to create Square customer: $(echo "$response" | jq -c)"
    return 1
  fi
  
  save_resource "square" "customers" "$customer_id" "$name"
  return 0
}

# Create test product (catalog item) in Square
create_square_product() {
  local name="Test Product $(date +%s)"
  local price=$(( RANDOM % 10000 + 500 )) # Price between $5.00 and $105.00
  local sku="TST-$(printf '%06d' $RANDOM)"
  
  log "INFO" "Creating Square product: $name"
  
  # Create a unique ID for the catalog object
  local unique_id="test_$(date +%s)_$(printf '%04d' $RANDOM)"
  
  local response=$(curl -s -X POST "$SQUARE_API_URL/v2/catalog/object" \
    -H "Square-Version: 2023-12-13" \
    -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "idempotency_key": "'"$unique_id"'",
      "object": {
        "type": "ITEM",
        "id": "#'"$unique_id"'",
        "item_data": {
          "name": "'"$name"'",
          "description": "Test product created by script",
          "variations": [
            {
              "type": "ITEM_VARIATION",
              "id": "#'"$unique_id"'_var",
              "item_variation_data": {
                "name": "Regular",
                "sku": "'"$sku"'",
                "pricing_type": "FIXED_PRICING",
                "price_money": {
                  "amount": '"$price"',
                  "currency": "USD"
                },
                "location_overrides": [
                  {
                    "location_id": "'"$SQUARE_LOCATION_ID"'",
                    "track_inventory": true,
                    "inventory_alert_type": "NONE"
                  }
                ]
              }
            }
          ]
        }
      }
    }')
  
  local catalog_object_id=$(echo "$response" | jq -r '.catalog_object.id')
  
  if [[ "$catalog_object_id" == "null" || -z "$catalog_object_id" ]]; then
    log "ERROR" "Failed to create Square product: $(echo "$response" | jq -c)"
    return 1
  fi
  
  # Save the product ID
  save_resource "square" "products" "$catalog_object_id" "$name"
  
  # Also save the variation ID
  local variation_id=$(echo "$response" | jq -r '.catalog_object.item_data.variations[0].id')
  if [[ "$variation_id" != "null" && -n "$variation_id" ]]; then
    save_resource "square" "variations" "$variation_id" "${name} - Regular"
  fi
  
  return 0
}

# Create test order in Square
create_square_order() {
  local scenario_type="${1:-normal}"
  
  # Get a random customer or create one if none exists
  local customer_id=$(get_random_resource "square" "customers")
  if [[ -z "$customer_id" ]]; then
    log "INFO" "No Square customers found. Creating one..."
    create_square_customer
    customer_id=$(get_random_resource "square" "customers")
    if [[ -z "$customer_id" ]]; then
      log "ERROR" "Failed to create a Square customer"
      return 1
    fi
  fi
  
  # Get random product variations or create some if none exist
  local variation_ids=()
  local variation_quantities=()
  local variation_notes=()
  
  # Use between 1-3 products per order
  local product_count=$(( RANDOM % 3 + 1 ))
  
  # Try to get existing variations
  for ((i=0; i<$product_count; i++)); do
    local variation_id=$(get_random_resource "square" "variations")
    if [[ -n "$variation_id" ]]; then
      variation_ids+=("$variation_id")
      variation_quantities+=($((RANDOM % 3 + 1)))
      variation_notes+=("Test item note $i")
    fi
  done
  
  # If no variations found, create some products
  if [[ ${#variation_ids[@]} -eq 0 ]]; then
    log "INFO" "No Square products found. Creating some..."
    for ((i=0; i<2; i++)); do
      create_square_product
    done
    
    # Try again to get variations
    for ((i=0; i<$product_count; i++)); do
      local variation_id=$(get_random_resource "square" "variations")
      if [[ -n "$variation_id" ]]; then
        variation_ids+=("$variation_id")
        variation_quantities+=($((RANDOM % 3 + 1)))
        variation_notes+=("Test item note $i")
      fi
    done
    
    if [[ ${#variation_ids[@]} -eq 0 ]]; then
      log "ERROR" "Failed to create Square products"
      return 1
    fi
  fi
  
  # Set order status based on scenario type
  local status
  if [[ "$scenario_type" == "normal" ]]; then
    # Normal order states in Square
    status_array=("OPEN" "COMPLETED")
    status=${status_array[$(( RANDOM % ${#status_array[@]} ))]}
  elif [[ "$scenario_type" == "edge" ]]; then
    # Edge case statuses (less common but valid)
    status="OPEN" # Square has limited status options
  else
    # Error case 
    status="CANCELED"
  fi
  
  # Generate order reference ID
  local reference_id="SQ-$(date +%s)-$(printf '%04d' $RANDOM)"
  
  # Build line items JSON
  local line_items="["
  for ((i=0; i<${#variation_ids[@]}; i++)); do
    if [[ $i -gt 0 ]]; then
      line_items+=","
    fi
    
    line_items+='{'
    line_items+='"catalog_object_id":"'${variation_ids[$i]}'",'
    line_items+='"quantity":"'${variation_quantities[$i]}'",'
    line_items+='"note":"'${variation_notes[$i]}'"'
    line_items+='}'
  done
  line_items+="]"
  
  log "INFO" "Creating Square order with status: $status"
  
  # Create idempotency key for the request
  local idempotency_key="order_$(date +%s)_$(printf '%04d' $RANDOM)"
  
  local response=$(curl -s -X POST "$SQUARE_API_URL/v2/orders" \
    -H "Square-Version: 2023-12-13" \
    -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "idempotency_key": "'"$idempotency_key"'",
      "order": {
        "location_id": "'"$SQUARE_LOCATION_ID"'",
        "customer_id": "'"$customer_id"'",
        "reference_id": "'"$reference_id"'",
        "state": "'"$status"'",
        "line_items": '"$line_items"',
        "source": {
          "name": "Test Script"
        },
        "metadata": {
          "scenario_type": "'"$scenario_type"'",
          "created_by": "test_script"
        }
      }
    }')
  
  local order_id=$(echo "$response" | jq -r '.order.id')
  
  if [[ "$order_id" == "null" || -z "$order_id" ]]; then
    log "ERROR" "Failed to create Square order: $(echo "$response" | jq -c)"
    return 1
  fi
  
  save_resource "square" "orders" "$order_id" "$reference_id"
  
  # For COMPLETED orders, create a payment
  if [[ "$status" == "COMPLETED" ]]; then
    log "INFO" "Creating payment for completed order: $order_id"
    
    # Get order total from the response
    local total_amount=$(echo "$response" | jq -r '.order.total_money.amount // 1000')
    local source_id="CASH"
    local idempotency_key="payment_$(date +%s)_$(printf '%04d' $RANDOM)"
    
    local payment_response=$(curl -s -X POST "$SQUARE_API_URL/v2/payments" \
      -H "Square-Version: 2023-12-13" \
      -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "idempotency_key": "'"$idempotency_key"'",
        "source_id": "'"$source_id"'",
        "order_id": "'"$order_id"'",
        "amount_money": {
          "amount": '"$total_amount"',
          "currency": "USD"
        },
        "location_id": "'"$SQUARE_LOCATION_ID"'"
      }')
    
    local payment_id=$(echo "$payment_response" | jq -r '.payment.id')
    if [[ "$payment_id" == "null" || -z "$payment_id" ]]; then
      log "WARN" "Failed to create payment for order $order_id: $(echo "$payment_response" | jq -c)"
    else
      log "INFO" "Created payment $payment_id for order $order_id"
    fi
  fi
  
  return 0
}

# Clean up previously generated resources
cleanup_resources() {
  local platform="$1"
  
  if [[ ! -f "$RESOURCE_FILE" ]]; then
    log "WARN" "No resource file found at $RESOURCE_FILE"
    return 1
  fi
  
  log "INFO" "Cleaning up previously generated $platform resources..."
  
  # Handle Spocket cleanup
  if [[ "$platform" == "spocket" || "$platform" == "both" ]]; then
    # Delete orders first
    local order_ids=$(jq -r '.spocket.orders[].id' "$RESOURCE_FILE" 2>/dev/null)
    if [[ -n "$order_ids" ]]; then
      log "INFO" "Deleting Spocket orders..."
      while read -r order_id; do
        if [[ -n "$order_id" ]]; then
          local response=$(curl -s -X DELETE "$SPOCKET_API_URL/orders/$order_id" \
            -H "Authorization: Bearer $SPOCKET_API_KEY")
          log "DEBUG" "Deleted Spocket order $order_id: $(echo "$response" | jq -c '.status')"
        fi
      done <<< "$order_ids"
    fi
    
    # Delete products
    local product_ids=$(jq -r '.spocket.products[].id' "$RESOURCE_FILE" 2>/dev/null)
    if [[ -n "$product_ids" ]]; then
      log "INFO" "Deleting Spocket products..."
      while read -r product_id; do
        if [[ -n "$product_id" ]]; then
          curl -s -X DELETE "$SPOCKET_API_URL/products/$product_id" \
            -H "Authorization: Bearer $SPOCKET_API_KEY" > /dev/null
          log "DEBUG" "Deleted Spocket product $product_id"
        fi
      done <<< "$product_ids"
    fi
    
    # Delete customers
    local customer_ids=$(jq -r '.spocket.customers[].id' "$RESOURCE_FILE" 2>/dev/null)
    if [[ -n "$customer_ids" ]]; then
      log "INFO" "Deleting Spocket customers..."
      while read -r customer_id; do
        if [[ -n "$customer_id" ]]; then
          curl -s -X DELETE "$SPOCKET_API_URL/customers/$customer_id" \
            -H "Authorization: Bearer $SPOCKET_API_KEY" > /dev/null
          log "DEBUG" "Deleted Spocket customer $customer_id"
        fi
      done <<< "$customer_ids"
    fi
  fi
  
  # Handle Square cleanup
  if [[ "$platform" == "square" || "$platform" == "both" ]]; then
    # Delete orders (no direct API to delete orders in Square, but we'll mark as CANCELED)
    local order_ids=$(jq -r '.square.orders[].id' "$RESOURCE_FILE" 2>/dev/null)
    if [[ -n "$order_ids" ]]; then
      log "INFO" "Marking Square orders as canceled..."
      while read -r order_id; do
        if [[ -n "$order_id" ]]; then
          # Square doesn't have a direct delete, so just update to CANCELED if possible
          curl -s -X POST "$SQUARE_API_URL/v2/orders/$order_id" \
            -H "Square-Version: 2023-12-13" \
            -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"order":{"state":"CANCELED"}}' > /dev/null
          log "DEBUG" "Marked Square order $order_id as canceled"
        fi
      done <<< "$order_ids"
    fi
    
    # Delete catalog items (products and variations)
    local product_ids=$(jq -r '.square.products[].id' "$RESOURCE_FILE" 2>/dev/null)
    if [[ -n "$product_ids" ]]; then
      log "INFO" "Deleting Square catalog items..."
      while read -r product_id; do
        if [[ -n "$product_id" ]]; then
          curl -s -X DELETE "$SQUARE_API_URL/v2/catalog/object/$product_id" \
            -H "Square-Version: 2023-12-13" \
            -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" > /dev/null
          log "DEBUG" "Deleted Square catalog object $product_id"
        fi
      done <<< "$product_ids"
    fi
    
    # Delete customers
    local customer_ids=$(jq -r '.square.customers[].id' "$RESOURCE_FILE" 2>/dev/null)
    if [[ -n "$customer_ids" ]]; then
      log "INFO" "Deleting Square customers..."
      while read -r customer_id; do
        if [[ -n "$customer_id" ]]; then
          curl -s -X DELETE "$SQUARE_API_URL/v2/customers/$customer_id" \
            -H "Square-Version: 2023-12-13" \
            -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" > /dev/null
          log "DEBUG" "Deleted Square customer $customer_id"
        fi
      done <<< "$customer_ids"
    fi
  fi
  
  # Reset resource file
  if [[ "$platform" == "both" ]]; then
    echo "{\"spocket\":{\"customers\":[],\"products\":[],\"orders\":[]},\"square\":{\"customers\":[],\"products\":[],\"orders\":[],\"variations\":[]}}" > "$RESOURCE_FILE"
    log "INFO" "Reset resource tracking file"
  elif [[ "$platform" == "spocket" ]]; then
    jq '.spocket = {customers:[],products:[],orders:[]}' "$RESOURCE_FILE" > "${RESOURCE_FILE}.tmp" && mv "${RESOURCE_FILE}.tmp" "$RESOURCE_FILE"
    log "INFO" "Reset Spocket resources in tracking file"
  elif [[ "$platform" == "square" ]]; then
    jq '.square = {customers:[],products:[],orders:[],variations:[]}' "$RESOURCE_FILE" > "${RESOURCE_FILE}.tmp" && mv "${RESOURCE_FILE}.tmp" "$RESOURCE_FILE"
    log "INFO" "Reset Square resources in tracking file"
  fi
  
  log "INFO" "Cleanup completed"
  return 0
}

# Test synchronization between platforms
test_synchronization() {
  log "INFO" "Testing order synchronization between Spocket and Square..."
  
  # Create a Spocket order with predictable status
  local spocket_order_id
  local order_number="SYNC-TEST-$(date +%s)"
  
  log "INFO" "Creating a test order in Spocket with order number: $order_number"
  # First create a customer
  create_spocket_customer
  local customer_id=$(get_random_resource "spocket" "customers")
  
  # Then create a product
  create_spocket_product
  local product_id=$(get_random_resource "spocket" "products")
  
  # Create the order with status 'pending'
  if [[ -n "$customer_id" && -n "$product_id" ]]; then
    local response=$(curl -s -X POST "$SPOCKET_API_URL/orders" \
      -H "Authorization: Bearer $SPOCKET_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "order": {
          "customer_id": "'"$customer_id"'",
          "order_number": "'"$order_number"'",
          "status": "pending",
          "order_date": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'",
          "line_items": [
            {
              "product_id": "'"$product_id"'",
              "quantity": 1,
              "price_per_item": 19.99
            }
          ],
          "note": "Sync test order"
        }
      }')
    
    spocket_order_id=$(echo "$response" | jq -r '.id')
    if [[ "$spocket_order_id" != "null" && -n "$spocket_order_id" ]]; then
      save_resource "spocket" "orders" "$spocket_order_id" "$order_number"
      log "INFO" "Successfully created Spocket order $spocket_order_id with order number $order_number"
      
      # Wait for synchronization to occur
      log "INFO" "Waiting for order synchronization (30 seconds)..."
      sleep 30
      
      # Check if order was created in Square
      log "INFO" "Checking for matching order in Square with reference $order_number"
      local search_response=$(curl -s -X GET "$SQUARE_API_URL/v2/orders/search" \
        -H "Square-Version: 2023-12-13" \
        -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
          "location_ids": ["'"$SQUARE_LOCATION_ID"'"],
          "query": {
            "filter": {
              "state": {
                "states": ["OPEN", "COMPLETED"]
              }
            }
          }
        }')
      
      local matching_orders=$(echo "$search_response" | jq -r '.orders[] | select(.reference_id=="'"$order_number"'") | .id' 2>/dev/null)
      if [[ -n "$matching_orders" ]]; then
        log "INFO" "SUCCESS: Found matching Square order for Spocket order $order_number"
        return 0
      else
        log "ERROR" "Synchronization test FAILED: No matching Square order found for Spocket order $order_number"
        return 1
      fi
    else
      log "ERROR" "Failed to create Spocket test order for synchronization test"
      return 1
    fi
  else
    log "ERROR" "Failed to create customer or product for synchronization test"
    return 1
  fi
}

# Main function to run the data generation
generate_test_data() {
  local platform="$1"
  local order_count="$2"
  local scenario_type="$3"
  
  # Check environment variables
  check_env_vars "$platform"
  
  log "INFO" "Generating test data for platform: $platform"
  log "INFO" "Orders to create: $order_count"
  log "INFO" "Scenario type: $scenario_type"
  
  # Track success counts
  local spocket_success=0
  local square_success=0
  
  # Generate Spocket test data
  if [[ "$platform" == "spocket" || "$platform" == "both" ]]; then
    log "INFO" "==== GENERATING SPOCKET TEST DATA ===="
    
    # Create customer
    log "INFO" "Creating Spocket test customers..."
    create_spocket_customer
    
    # Create products
    log "INFO" "Creating Spocket test products..."
    for ((i=0; i<2; i++)); do
      create_spocket_product
    done
    
    # Create orders
    log "INFO" "Creating Spocket test orders..."
    for ((i=1; i<=$order_count; i++)); do
      log "INFO" "Creating Spocket order $i of $order_count..."
      
      if [[ "$scenario_type" == "all" ]]; then
        # Generate a mix of scenarios
        case $(($i % 3)) in
          0) current_scenario="normal" ;;
          1) current_scenario="edge" ;;
          2) current_scenario="error" ;;
        esac
      else
        current_scenario="$scenario_type"
      fi
      
      if create_spocket_order "$current_scenario"; then
        spocket_success=$((spocket_success + 1))
      fi
    done
    
    log "INFO" "Successfully created $spocket_success/$order_count Spocket orders"
  fi
  
  # Generate Square test data
  if [[ "$platform" == "square" || "$platform" == "both" ]]; then
    log "INFO" "==== GENERATING SQUARE TEST DATA ===="
    
    # Create customer
    log "INFO" "Creating Square test customers..."
    create_square_customer
    
    # Create products
    log "INFO" "Creating Square test products..."
    for ((i=0; i<2; i++)); do
      create_square_product
    done
    
    # Create orders
    log "INFO" "Creating Square test orders..."
    for ((i=1; i<=$order_count; i++)); do
      log "INFO" "Creating Square order $i of $order_count..."
      
      if [[ "$scenario_type" == "all" ]]; then
        # Generate a mix of scenarios
        case $(($i % 3)) in
          0) current_scenario="normal" ;;
          1) current_scenario="edge" ;;
          2) current_scenario="error" ;;
        esac
      else
        current_scenario="$scenario_type"
      fi
      
      if create_square_order "$current_scenario"; then
        square_success=$((square_success + 1))
      fi
    done
    
    log "INFO" "Successfully created $square_success/$order_count Square orders"
  fi
  
  # Print summary
  log "INFO" "==== TEST DATA GENERATION SUMMARY ===="
  if [[ "$platform" == "spocket" || "$platform" == "both" ]]; then
    log "INFO" "Spocket orders: $spocket_success/$order_count created successfully"
  fi
  if [[ "$platform" == "square" || "$platform" == "both" ]]; then
    log "INFO" "Square orders: $square_success/$order_count created successfully"
  fi
  
  # Return success if at least one order was created
  if [[ "$spocket_success" -gt 0 || "$square_success" -gt 0 ]]; then
    return 0
  else
    return 1
  fi
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --orders)
      ORDER_COUNT="$2"
      shift 2
      ;;
    --scenario)
      SCENARIO="$2"
      shift 2
      ;;
    --cleanup)
      CLEANUP=true
      shift
      ;;
    --sync-test)
      SYNC_TEST=true
      shift
      ;;
    --help)
      show_help
      ;;
    *)
      log "ERROR" "Unknown option: $1"
      show_help
      ;;
  esac
done

# Validate arguments
if [[ "$PLATFORM" != "spocket" && "$PLATFORM" != "square" && "$PLATFORM" != "both" ]]; then
  log "ERROR" "Invalid platform: $PLATFORM. Must be 'spocket', 'square', or 'both'"
  exit 1
fi

if ! [[ "$ORDER_COUNT" =~ ^[0-9]+$ ]]; then
  log "ERROR" "Invalid order count: $ORDER_COUNT. Must be a number"
  exit 1
fi

if [[ "$SCENARIO" != "normal" && "$SCENARIO" != "edge" && "$SCENARIO" != "error" && "$SCENARIO" != "all" ]]; then
  log "ERROR" "Invalid scenario: $SCENARIO. Must be 'normal', 'edge', 'error', or 'all'"
  exit 1
fi

# Print script banner
echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}GENERATE TEST DATA SCRIPT (VERSION 2)${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "Platform: ${GREEN}$PLATFORM${NC}"
echo -e "Orders: ${GREEN}$ORDER_COUNT${NC}"
echo -e "Scenario: ${GREEN}$SCENARIO${NC}"
echo -e "Cleanup: ${GREEN}$CLEANUP${NC}"
echo -e "Sync Test: ${GREEN}$SYNC_TEST${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# Confirm cleanup if requested
if [[ "$CLEANUP" == true ]]; then
  log "WARN" "You are about to delete all previously generated test resources for $PLATFORM"
  read -p "Are you sure you want to continue? (y/n): " confirm
  
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    log "INFO" "Cleanup canceled"
    CLEANUP=false
  fi
fi

# Main execution
log "INFO" "Starting test data generation process"
log "INFO" "Log file: $LOG_FILE"

SCRIPT_START_TIME=$(date +%s)

# Execute cleanup if requested
if [[ "$CLEANUP" == true ]]; then
  if cleanup_resources "$PLATFORM"; then
    log "INFO" "Cleanup completed successfully"
  else
    log "ERROR" "Cleanup failed"
    # Continue with script as this is non-fatal
  fi
fi

# Execute sync test if requested
if [[ "$SYNC_TEST" == true ]]; then
  log "INFO" "Starting synchronization test"
  
  if test_synchronization; then
    log "INFO" "Synchronization test completed successfully"
  else
    log "ERROR" "Synchronization test failed"
    exit 1
  fi
  
  # If only sync test was requested, exit
  if [[ "$ORDER_COUNT" -eq 0 ]]; then
    log "INFO" "No orders requested, exiting after sync test"
    exit 0
  fi
fi

# Skip data generation if order count is 0
if [[ "$ORDER_COUNT" -gt 0 ]]; then
  # Generate test data
  log "INFO" "Generating test data"
  
  if generate_test_data "$PLATFORM" "$ORDER_COUNT" "$SCENARIO"; then
    log "INFO" "Test data generation completed successfully"
  else
    log "ERROR" "Test data generation failed"
    exit 1
  fi
fi

# Calculate execution time
SCRIPT_END_TIME=$(date +%s)
EXECUTION_TIME=$((SCRIPT_END_TIME - SCRIPT_START_TIME))

# Print summary
echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}TEST DATA GENERATION COMPLETED${NC}"
echo -e "${BLUE}======================================================${NC}"
echo -e "Platform: ${GREEN}$PLATFORM${NC}"
echo -e "Execution time: ${GREEN}$EXECUTION_TIME seconds${NC}"
echo -e "Log file: ${GREEN}$LOG_FILE${NC}"
echo -e "${BLUE}======================================================${NC}"

if [[ -f "$RESOURCE_FILE" ]]; then
  echo -e "${YELLOW}Resource summary:${NC}"
  
  if [[ "$PLATFORM" == "spocket" || "$PLATFORM" == "both" ]]; then
    SPOCKET_CUSTOMERS=$(jq '.spocket.customers | length' "$RESOURCE_FILE")
    SPOCKET_PRODUCTS=$(jq '.spocket.products | length' "$RESOURCE_FILE")
    SPOCKET_ORDERS=$(jq '.spocket.orders | length' "$RESOURCE_FILE")
    
    echo -e "Spocket customers: ${GREEN}$SPOCKET_CUSTOMERS${NC}"
    echo -e "Spocket products: ${GREEN}$SPOCKET_PRODUCTS${NC}"
    echo -e "Spocket orders: ${GREEN}$SPOCKET_ORDERS${NC}"
  fi
  
  if [[ "$PLATFORM" == "square" || "$PLATFORM" == "both" ]]; then
    SQUARE_CUSTOMERS=$(jq '.square.customers | length' "$RESOURCE_FILE")
    SQUARE_PRODUCTS=$(jq '.square.products | length' "$RESOURCE_FILE")
    SQUARE_ORDERS=$(jq '.square.orders | length' "$RESOURCE_FILE")
    
    echo -e "Square customers: ${GREEN}$SQUARE_CUSTOMERS${NC}"
    echo -e "Square products: ${GREEN}$SQUARE_PRODUCTS${NC}"
    echo -e "Square orders: ${GREEN}$SQUARE_ORDERS${NC}"
  fi
  
  echo -e "${BLUE}======================================================${NC}"
  echo -e "${YELLOW}Resource tracking file: ${GREEN}$RESOURCE_FILE${NC}"
  echo -e "${YELLOW}To clean up these resources, run:${NC}"
  echo -e "${GREEN}$0 --cleanup --platform $PLATFORM${NC}"
  echo -e "${BLUE}======================================================${NC}"
fi

log "INFO" "Script execution completed"
exit 0
