#!/bin/bash

# ==============================================================================
# GENERATE TEST DATA SCRIPT
# ==============================================================================
# This script generates test data for Spocket and Square integration testing
# It can create sample customers, products, orders and specific edge case scenarios
# 
# Usage:
#   ./scripts/generate-test-data.sh [options]
#
# Options:
#   --platform <spocket|square|both>   Target platform (default: both)
#   --customers <number>               Number of customers to create (default: 5)
#   --products <number>                Number of products to create (default: 10)
#   --orders <number>                  Number of orders to create (default: 8)
#   --scenario <basic|edge|all>        Type of scenarios to generate (default: basic)
#   --cleanup                          Remove previously generated test data
#   --sync-test                        Test order status synchronization
#   --help                             Display this help message
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Source common utilities if they exist
if [ -f "$SCRIPT_DIR/common.sh" ]; then
  source "$SCRIPT_DIR/common.sh"
fi

# Default values
PLATFORM="both"
CUSTOMER_COUNT=5
PRODUCT_COUNT=10
ORDER_COUNT=8
SCENARIO_TYPE="basic"
CLEANUP=false
SYNC_TEST=false

# Log file
LOG_FILE="$ROOT_DIR/logs/test-data-generation-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$ROOT_DIR/logs"

# Temporary file for storing generated resource IDs
TEMP_DATA_FILE="$ROOT_DIR/temp/generated-test-data.json"
mkdir -p "$ROOT_DIR/temp"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f "$ROOT_DIR/.env" ]; then
  source "$ROOT_DIR/.env"
else
  echo -e "${RED}Error: .env file not found in $ROOT_DIR${NC}"
  echo "Please create a .env file with the required configuration."
  exit 1
fi

# Check required environment variables
check_env_var() {
  if [ -z "${!1}" ]; then
    echo -e "${RED}Error: Environment variable $1 is not set${NC}"
    echo "Please set $1 in your .env file"
    exit 1
  fi
}

# Check required Spocket environment variables
check_spocket_env_vars() {
  check_env_var "SPOCKET_API_KEY"
  check_env_var "SPOCKET_API_URL"
}

# Check required Square environment variables
check_square_env_vars() {
  check_env_var "SQUARE_ACCESS_TOKEN"
  check_env_var "SQUARE_LOCATION_ID"
  check_env_var "SQUARE_API_URL"
}

# Display help message
show_help() {
  cat << EOF
Usage: $(basename "$0") [options]

Options:
  --platform <spocket|square|both>   Target platform (default: both)
  --customers <number>               Number of customers to create (default: 5)
  --products <number>                Number of products to create (default: 10)
  --orders <number>                  Number of orders to create (default: 8)
  --scenario <basic|edge|all>        Type of scenarios to generate (default: basic)
  --cleanup                          Remove previously generated test data
  --sync-test                        Test order status synchronization
  --help                             Display this help message

Example:
  $(basename "$0") --platform square --orders 3 --scenario edge
EOF
  exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --platform)
      PLATFORM="$2"
      if [[ ! "$PLATFORM" =~ ^(spocket|square|both)$ ]]; then
        echo -e "${RED}Error: Platform must be 'spocket', 'square', or 'both'${NC}"
        exit 1
      fi
      shift 2
      ;;
    --customers)
      CUSTOMER_COUNT="$2"
      if ! [[ "$CUSTOMER_COUNT" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Error: Customer count must be a number${NC}"
        exit 1
      fi
      shift 2
      ;;
    --products)
      PRODUCT_COUNT="$2"
      if ! [[ "$PRODUCT_COUNT" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Error: Product count must be a number${NC}"
        exit 1
      fi
      shift 2
      ;;
    --orders)
      ORDER_COUNT="$2"
      if ! [[ "$ORDER_COUNT" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Error: Order count must be a number${NC}"
        exit 1
      fi
      shift 2
      ;;
    --scenario)
      SCENARIO_TYPE="$2"
      if [[ ! "$SCENARIO_TYPE" =~ ^(basic|edge|all)$ ]]; then
        echo -e "${RED}Error: Scenario type must be 'basic', 'edge', or 'all'${NC}"
        exit 1
      fi
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
      echo -e "${RED}Error: Unknown option $1${NC}"
      show_help
      ;;
  esac
done

# Initialize JSON file for storing generated resource IDs
if [[ ! -f "$TEMP_DATA_FILE" || "$CLEANUP" == true ]]; then
  echo "{}" > "$TEMP_DATA_FILE"
fi

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

# Save generated resource ID to the temp file
save_resource() {
  local platform="$1"
  local resource_type="$2"
  local resource_id="$3"
  local name="$4"
  
  # Read existing JSON
  local json_data=$(cat "$TEMP_DATA_FILE")
  
  # Check if platform key exists, if not add it
  if ! echo "$json_data" | jq -e ".$platform" > /dev/null; then
    json_data=$(echo "$json_data" | jq ". + {\"$platform\": {}}")
  fi
  
  # Check if resource_type key exists, if not add it
  if ! echo "$json_data" | jq -e ".$platform.$resource_type" > /dev/null; then
    json_data=$(echo "$json_data" | jq ".$platform + {\"$resource_type\": []}")
  fi
  
  # Add new resource
  json_data=$(echo "$json_data" | jq ".$platform.$resource_type += [{\"id\": \"$resource_id\", \"name\": \"$name\"}]")
  
  # Write back to file
  echo "$json_data" > "$TEMP_DATA_FILE"
  
  log "INFO" "Saved $platform $resource_type: $name (ID: $resource_id)"
}

# Get a random resource ID from the temp file
get_random_resource() {
  local platform="$1"
  local resource_type="$2"
  
  local resource_ids=$(jq -r ".$platform.$resource_type[].id" "$TEMP_DATA_FILE" 2>/dev/null)
  
  if [[ -z "$resource_ids" ]]; then
    echo ""
    return 1
  fi
  
  # Convert newline-separated list to array and get random element
  readarray -t id_array <<< "$resource_ids"
  local random_index=$((RANDOM % ${#id_array[@]}))
  echo "${id_array[$random_index]}"
}

# Cleanup generated test data
cleanup_data() {
  log "INFO" "Starting cleanup of generated test data..."
  
  if [[ ! -f "$TEMP_DATA_FILE" ]]; then
    log "WARN" "No generated data file found. Nothing to clean up."
    return
  fi
  
  local json_data=$(cat "$TEMP_DATA_FILE")
  
  # Cleanup Spocket data
  if [[ "$PLATFORM" == "spocket" || "$PLATFORM" == "both" ]]; then
    check_spocket_env_vars
    
    log "INFO" "Cleaning up Spocket data..."
    
    # Delete orders
    for order_id in $(jq -r '.spocket.orders[].id' "$TEMP_DATA_FILE" 2>/dev/null); do
      log "DEBUG" "Deleting Spocket order: $order_id"
      curl -s -X DELETE "$SPOCKET_API_URL/orders/$order_id" \
        -H "Authorization: Bearer $SPOCKET_API_KEY" \
        -H "Content-Type: application/json" > /dev/null
    done
    
    # Delete products
    for product_id in $(jq -r '.spocket.products[].id' "$TEMP_DATA_FILE" 2>/dev/null); do
      log "DEBUG" "Deleting Spocket product: $product_id"
      curl -s -X DELETE "$SPOCKET_API_URL/products/$product_id" \
        -H "Authorization: Bearer $SPOCKET_API_KEY" \
        -H "Content-Type: application/json" > /dev/null
    done
    
    # Delete customers
    for customer_id in $(jq -r '.spocket.customers[].id' "$TEMP_DATA_FILE" 2>/dev/null); do
      log "DEBUG" "Deleting Spocket customer: $customer_id"
      curl -s -X DELETE "$SPOCKET_API_URL/customers/$customer_id" \
        -H "Authorization: Bearer $SPOCKET_API_KEY" \
        -H "Content-Type: application/json" > /dev/null
    done
  fi
  
  # Cleanup Square data
  if [[ "$PLATFORM" == "square" || "$PLATFORM" == "both" ]]; then
    check_square_env_vars
    
    log "INFO" "Cleaning up Square data..."
    
    # Delete orders
    for order_id in $(jq -r '.square.orders[].id' "$TEMP_DATA_FILE" 2>/dev/null); do
      log "DEBUG" "Deleting Square order: $order_id"
      curl -s -X DELETE "$SQUARE_API_URL/v2/orders/$order_id" \
        -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" > /dev/null
    done
    
    # Delete items (products)
    for item_id in $(jq -r '.square.products[].id' "$TEMP_DATA_FILE" 2>/dev/null); do
      log "DEBUG" "Deleting Square item: $item_id"
      curl -s -X DELETE "$SQUARE_API_URL/v2/catalog/object/$item_id" \
        -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" > /dev/null
    done
    
    # Delete customers
    for customer_id in $(jq -r '.square.customers[].id' "$TEMP_DATA_FILE" 2>/dev/null); do
      log "DEBUG" "Deleting Square customer: $customer_id"
      curl -s -X DELETE "$SQUARE_API_URL/v2/customers/$customer_id" \
        -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" > /dev/null
    done
  fi
  
  # Clear the temp file
  echo "{}" > "$TEMP_DATA_FILE"
  
  log "INFO" "Cleanup completed successfully."
}

# Create a test customer in Spocket
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

# Create a test product in Spocket
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

# Create a test order in Spocket
create_spocket_order() {
  local status_type="${1:-normal}" # normal, edge, error
  
  # Get a random customer
  local customer_id=$(get_random_resource "spocket" "customers")
  if [[ -z "$customer_id" ]]; then
    log "ERROR" "No Spocket customers found. Please create customers first."
    return 1
  fi
  
  # Get up to 3 random products
  local product_count=$(( RANDOM % 3 + 1 ))
  local product_ids=()
  local product_names=()
  local product_quantities=()
  local product_prices=()
  
  for ((i=0; i<$product_count; i++)); do
    local product_id=$(get_random_resource "spocket" "products")
    if [[ -n "$product_id" ]]; then
      product_ids+=("$product_id")
      
      # Generate random quantity and price
      local quantity=$(( RANDOM % 3 + 1 ))
      local price=$(( RANDOM % 5000 + 1000 )) # Price between $10.00 and $60.00
      
      product_quantities+=($quantity)
      product_prices+=($price)
    fi
  done
  
  if [[ ${#product_ids[@]} -eq 0 ]]; then
    log "ERROR" "No Spocket products found. Please create products first."
    return 1
  fi
  
  # Order status based on scenario type
  local status
  if [[ "$status_type" == "normal" ]]; then
    # Normal statuses: pending, processing, shipped, delivered, completed
    status_array=("pending" "processing" "shipped" "delivered" "completed")
    status=${status_array[$(( RANDOM % ${#status_array[@]} ))]}
  elif [[ "$status_type" == "edge" ]]; then
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
  if [[ "$status_type" == "error" ]]; then
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
        "note": "Test order created by script ('"$status_type"' scenario)"
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

# Create a test customer in Square
create_square_customer() {
  local name="Test Customer $(date +%s)"
  local email="test.customer.$(date +%s)@example.com"
  
  log "INFO" "Creating Square customer: $name"
  
  local first_name=$(echo "$name" | awk '{print $1}')
  local last_name=$(echo "$name" | awk '{print $2, $3}')
  
  local response=$(curl -s -X POST "$SQUARE_API_URL/v2/customers" \
    -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "given_name": "'"$first_name"'",
      "family_name": "'"$last_name"'",
      "email_address": "'"$email"'",
      "phone_number": "+1'"$(printf '%010d' $RANDOM)"'",
      "address": {
        "address_line_1": "'"$(( RANDOM % 999 + 1 ))"' Test St",
        "locality": "Test City",
        "administrative_district_level_1": "TS",
        "postal_code": "'"$(printf '%05d' $((RANDOM % 99999)))"'",
        "country": "US"
      },
      "reference_id": "TEST-CUST-'"$(date +%s)"'"
    }')
  
  local customer_id=$(echo "$response" | jq -r '.customer.id')
  
  if [[ "$customer_id" == "null" || -z "$customer_id" ]]; then
    log "ERROR" "Failed to create Square customer: $(echo "$response" | jq -c)"
    return 1
  fi
  
  save_resource "square" "customers" "$customer_id" "$name"
  return 0
}

# Create a test product in Square
create_square_product() {
  local name="Test Product $(date +%s)"
  local price=$(( RANDOM % 10000 + 500 )) # Price between $5.00 and $105.00
  
  log "INFO" "Creating Square product: $name"
  
  local idempotency_key=$(uuidgen || date +%s)
  
  local response=$(curl -s -X POST "$SQUARE_API_URL/v2/catalog/object" \
    -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "idempotency_key": "'"$idempotency_key"'",
      "object": {
        "type": "ITEM",
        "item_data": {
          "name": "'"$name"'",
          "description": "Test product created by script",
          "variations": [
            {
              "type": "ITEM_VARIATION",
              "item_variation_data": {
                "name": "Regular",
                "pricing_type": "FIXED_PRICING",
                "price_money": {
                  "amount": '"$price"',
                  "currency": "USD"
                },
                "sku": "TST-SQ-'"$(printf '%06d' $RANDOM)"'"
              }
            }
          ]
        }
      }
    }')
  
  local product_id=$(echo "$response" | jq -r '.catalog_object.id')
  
  if [[ "$product_id" == "null" || -z "$product_id" ]]; then
    log "ERROR" "Failed to create Square product: $(echo "$response" | jq -c)"
    return 1
  fi
  
  save_resource "square" "products" "$product_id" "$name"
  
  # Also save the variation ID for orders
  local variation_id=$(echo "$response" | jq -r '.catalog_object.item_data.variations[0].id')
  save_resource "square" "variations" "$variation_id" "$name Variation"
  
  return 0
}

# Create a test order in Square
create_square_order() {
  local status_type="${1:-normal}" # normal, edge, error
  
  # Get a random customer
  local customer_id=$(get_random_resource "square" "customers")
  if [[ -z "$customer_id" ]]; then
    log "ERROR" "No Square customers found. Please create customers first."
    return 1
  fi
  
  # Get up to 3 random product variations
  local product_count=$(( RANDOM % 3 + 1 ))
  local variation_ids=()
  local variation_quantities=()
  local variation_notes=()
  
  for ((i=0; i<$product_count; i++)); do
    local variation_id=$(get_random_resource "square" "variations")
    if [[ -n "$variation_id" ]]; then
      variation_ids+=("$variation_id")
      variation_quantities+=("$(( RANDOM % 3 + 1 ))")
      variation_notes+=("Test note for item $i")
    fi
  done
  
  if [[ ${#variation_ids[@]} -eq 0 ]]; then
    log "ERROR" "No Square product variations found. Please create products first."
    return 1
  fi
  
  # Order status based on scenario type
  local status
  if [[ "$status_type" == "normal" ]]; then
    # Normal statuses: PENDING, COMPLETED, IN_PROGRESS
    status_array=("OPEN" "IN_PROGRESS" "COMPLETED")
    status=${status_array[$(( RANDOM % ${#status_array[@]} ))]}
  elif [[ "$status_type" == "edge" ]]; then
    # Edge case status: DELAYED
    status="DELAYED"
  else
    # Error case status: CANCELED, FAILED
    status_array=("CANCELED" "FAILED")
    status=${status_array[$(( RANDOM % ${#status_array[@]} ))]}
  fi
  
  # Build line items JSON
  local line_items="["
  for ((i=0; i<${#variation_ids[@]}; i++)); do
    if [[ $i -gt 0 ]]; then
      line_items+=","
    fi
    
    line_items+='{'
    line_items+='"quantity":"'${variation_quantities[$i]}'",'
    line_items+='"catalog_object_id":"'${variation_ids[$i]}'",'
    line_items+='"note":"'${variation_notes[$i]}'"'
    line_items+='}'
  done
  line_items+="]"
  
  log "INFO" "Creating Square order with status: $status"
  
  # Create a unique idempotency key
  local idempotency_key=$(uuidgen || date +%s)
  local order_reference="SQ-$(date +%s)-$(printf '%04d' $RANDOM)"
  
  local fulfillment_json=""
  if [[ "$status" == "COMPLETED" || "$status" == "IN_PROGRESS" ]]; then
    fulfillment_json='"fulfillments": [{"type": "PICKUP", "state": "PROPOSED", "pickup_details": {"recipient": {"customer_id": "'"$customer_id"'"}, "pickup_at": "'"$(date -v +2d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -d "+2 days" +"%Y-%m-%dT%H:%M:%SZ")"'"}}],'
  fi
  
  # Add error fields for error scenarios
  local error_json=""
  if [[ "$status_type" == "error" ]]; then
    if [[ "$status" == "CANCELED" ]]; then
      error_json='"canceled_reason": "SELLER_CANCELED", "canceled_note": "Test cancellation",'
    fi
  fi
  
  local response=$(curl -s -X POST "$SQUARE_API_URL/v2/orders" \
    -H "Authorization: Bearer $SQUARE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "idempotency_key": "'"$idempotency_key"'",
      "order": {
        "location_id": "'"$SQUARE_LOCATION_ID"'",
        "customer_id": "'"$customer_id"'",
        "reference_id": "'"$order_reference"'",
        "state": "'"$status"'",
        '"$error_json"'
        '"$fulfillment_json"'
        "line_items": '"$line_items"',
        "source": {
          "name": "Test Script"
        },
        "metadata": {
          "scenario_type": "'"$status_type"'"
        }
      }
    }')
  
  local order_id=$(echo "$response" | jq -r '.order.id')
  
  if [[ "$order_id" == "null" || -z "$order_id" ]]; then
    log "ERROR" "Failed to create Square order: $(echo "$response" | jq -c)"
    return 1
  fi
  
  save_resource "square" "orders" "$order_id" "$order_reference"
  return 0
}

# Test synchron

#!/bin/bash
#
# Test Data Generator for Spocket-Square Integration
#
# This script generates test data for the Spocket-Square integration, including:
# - Test orders with different statuses and configurations
# - Test products in both platforms
# - Test customer data
# - Edge case scenarios
# - Error condition scenarios
#
# Usage: ./generate-test-data.sh [--platform spocket|square|both] [--count N] [--scenario normal|edge|error]
#

# Exit on any error
set -e

# Set terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
PLATFORM="both"
COUNT=3
SCENARIO="normal"
CLEANUP=false

# Parse command line arguments
for arg in "$@"
do
    case $arg in
        --platform=*)
        PLATFORM="${arg#*=}"
        shift
        ;;
        --count=*)
        COUNT="${arg#*=}"
        shift
        ;;
        --scenario=*)
        SCENARIO="${arg#*=}"
        shift
        ;;
        --cleanup)
        CLEANUP=true
        shift
        ;;
        --help)
        echo "Usage: ./generate-test-data.sh [--platform=spocket|square|both] [--count=N] [--scenario=normal|edge|error] [--cleanup]"
        echo ""
        echo "Options:"
        echo "  --platform=PLATFORM  Target platform (spocket, square, or both)"
        echo "  --count=N            Number of items to generate (default: 3)"
        echo "  --scenario=TYPE      Type of scenario (normal, edge, or error)"
        echo "  --cleanup            Remove generated test data after creation"
        echo "  --help               Display this help message"
        exit 0
        ;;
        *)
        # Unknown option
        echo "Unknown option: $arg"
        echo "Use --help for usage information"
        exit 1
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
    
    if [ "$PLATFORM" = "spocket" ] || [ "$PLATFORM" = "both" ]; then
        if [ -z "$SPOCKET_CLIENT_ID" ] || [ -z "$SPOCKET_CLIENT_SECRET" ]; then
            echo -e "${RED}Missing Spocket credentials. Please set SPOCKET_CLIENT_ID and SPOCKET_CLIENT_SECRET.${NC}"
            missing_vars=true
        fi
    fi
    
    if [ "$PLATFORM" = "square" ] || [ "$PLATFORM" = "both" ]; then
        if [ -z "$SQUARE_ACCESS_TOKEN" ] || [ -z "$SQUARE_LOCATION_ID" ]; then
            echo -e "${RED}Missing Square credentials. Please set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.${NC}"
            missing_vars=true
        fi
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

# Create data directories if they don't exist
create_data_dirs() {
    mkdir -p test-data/orders
    mkdir -p test-data/products
    mkdir -p test-data/customers
    log "Created test data directories"
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

# Generate random customer data
generate_customer_data() {
    local count=$1
    
    log "Generating $count customer records..."
    
    # Array of sample first names
    FIRST_NAMES=("John" "Jane" "Michael" "Emily" "David" "Sarah" "Robert" "Lisa" "James" "Amy" "Lee" "Sofia" "Omar" "Wei" "Aisha" "Jose")
    
    # Array of sample last names
    LAST_NAMES=("Smith" "Johnson" "Williams" "Brown" "Jones" "Garcia" "Miller" "Davis" "Rodriguez" "Martinez" "Lee" "Kim" "Patel" "Singh" "Wang" "Nguyen")
    
    # Array of sample domains
    DOMAINS=("gmail.com" "yahoo.com" "outlook.com" "hotmail.com" "example.com" "test.com" "company.com")
    
    # Array of sample cities
    CITIES=("New York" "Los Angeles" "Chicago" "Houston" "Phoenix" "Philadelphia" "San Antonio" "San Diego" "Dallas" "San Jose")
    
    # Array of sample states
    STATES=("NY" "CA" "IL" "TX" "AZ" "PA" "FL" "OH" "GA" "NC")
    
    # Generate customer data
    for ((i=1; i<=count; i++)); do
        # Generate random indices
        FIRST_INDEX=$((RANDOM % ${#FIRST_NAMES[@]}))
        LAST_INDEX=$((RANDOM % ${#LAST_NAMES[@]}))
        DOMAIN_INDEX=$((RANDOM % ${#DOMAINS[@]}))
        CITY_INDEX=$((RANDOM % ${#CITIES[@]}))
        STATE_INDEX=$((RANDOM % ${#STATES[@]}))
        
        # Create customer data
        FIRST_NAME="${FIRST_NAMES[$FIRST_INDEX]}"
        LAST_NAME="${LAST_NAMES[$LAST_INDEX]}"
        EMAIL=$(echo "$FIRST_NAME.$LAST_NAME$i@${DOMAINS[$DOMAIN_INDEX]}" | tr '[:upper:]' '[:lower:]')
        PHONE="555-$((100 + RANDOM % 900))-$((1000 + RANDOM % 9000))"
        ADDRESS="$((100 + RANDOM % 1000)) Main St"
        CITY="${CITIES[$CITY_INDEX]}"
        STATE="${STATES[$STATE_INDEX]}"
        ZIP="$((10000 + RANDOM % 90000))"
        
        # Save customer data to JSON file
        cat > "test-data/customers/customer_$i.json" << EOF
{
  "first_name": "$FIRST_NAME",
  "last_name": "$LAST_NAME",
  "email": "$EMAIL",
  "phone": "$PHONE",
  "address": {
    "address1": "$ADDRESS",
    "city": "$CITY",
    "state": "$STATE",
    "country": "US",
    "zip_code": "$ZIP"
  }
}
EOF
        
        log_success "Generated customer_$i.json"
    done
    
    log_success "Generated $count customer records"
}

# Generate test products for Spocket
generate_spocket_products() {
    local count=$1
    
    log "Generating $count Spocket products..."
    
    # Array of sample product names
    PRODUCT_NAMES=("Classic T-Shirt" "Slim Fit Jeans" "Leather Wallet" "Cotton Socks" "Wool Sweater" "Canvas Backpack" "Silk Scarf" "Stainless Water Bottle" "Wireless Earbuds" "Ceramic Mug")
    
    # Generate products
    for ((i=1; i<=count; i++)); do
        # Generate random index and price
        PRODUCT_INDEX=$((RANDOM % ${#PRODUCT_NAMES[@]}))
        PRICE=$(( (RANDOM % 5000 + 500) ))
        PRICE_STR=$(printf "%.2f" $(echo "$PRICE/100" | bc -l))
        SKU="SP-$((1000 + i))"
        
        # Create product data
        PRODUCT_NAME="${PRODUCT_NAMES[$PRODUCT_INDEX]} - $i"
        DESCRIPTION="A high-quality ${PRODUCT_NAMES[$PRODUCT_INDEX]} for everyday use."
        
        # Save product data to JSON file
        cat > "test-data/products/spocket_product_$i.json" << EOF
{
  "name": "$PRODUCT_NAME",
  "sku": "$SKU",
  "description": "$DESCRIPTION",
  "price": $PRICE_STR,
  "variants": [
    {
      "id": "variant-$i-1",
      "name": "Small",
      "price": $PRICE_STR
    },
    {
      "id": "variant-$i-2",
      "name": "Medium",
      "price": $(echo "$PRICE_STR + 2" | bc)
    },
    {
      "id": "variant-$i-3",
      "name": "Large",
      "price": $(echo "$PRICE_STR + 4" | bc)
    }
  ]
}
EOF
        
        log_success "Generated spocket_product_$i.json"
    done
    
    log_success "Generated $count Spocket products"
}

# Generate test products for Square
generate_square_products() {
    local count=$1
    
    log "Generating $count Square products..."
    
    # Array of sample product names
    PRODUCT_NAMES=("Premium T-Shirt" "Designer Jeans" "Leather Wallet" "Athletic Socks" "Cashmere Sweater" "Travel Backpack" "Designer Scarf" "Insulated Water Bottle" "Bluetooth Earbuds" "Coffee Mug")
    
    # Generate products
    for ((i=1; i<=count; i++)); do
        # Generate random index and price
        PRODUCT_INDEX=$((RANDOM % ${#PRODUCT_NAMES[@]}))
        PRICE=$(( (RANDOM % 5000 + 500) ))
        SKU="SQ-$((1000 + i))"
        
        # Create product data
        PRODUCT_NAME="${PRODUCT_NAMES[$PRODUCT_INDEX]} - $i"
        DESCRIPTION="A premium ${PRODUCT_NAMES[$PRODUCT_INDEX]} for every occasion."
        
        # Save product data to JSON file
        cat > "test-data/products/square_product_$i.json" << EOF
{
  "idempotency_key": "$(uuidgen)",
  "object": {
    "type": "ITEM",
    "id": "#item$i",
    "item_data": {
      "name": "$PRODUCT_NAME",
      "description": "$DESCRIPTION",
      "abbreviation": "${PRODUCT_NAME:0:10}",
      "variations": [
        {
          "type": "ITEM_VARIATION",
          "id": "#small$i",
          "item_variation_data": {
            "item_id": "#item$i",
            "name": "Small",
            "sku": "$SKU-S",
            "pricing_type": "FIXED_PRICING",
            "price_money": {
              "amount": $PRICE,
              "currency": "USD"
            }
          }
        },
        {
          "type": "ITEM_VARIATION",
          "id": "#medium$i",
          "item_variation_data": {
            "item_id": "#item$i",
            "name": "Medium",
            "sku": "$SKU-M",
            "pricing_type": "FIXED_PRICING",
            "price_money": {
              "amount": $(($PRICE + 200)),
              "currency": "USD"
            }
          }
        },
        {
          "type": "ITEM_VARIATION",
          "id": "#large$i",
          "item_variation_data": {
            "item_id": "#item$i",
            "name": "Large",
            "sku": "$SKU-L",
            "pricing_type": "FIXED_PRICING",
            "price_money": {
              "amount": $(($PRICE + 400)),
              "currency": "USD"
            }
          }
        }
      ]
    }
  }
}
EOF
        
        log_success "Generated square_product_$i.json"
    done
    
    log_success "Generated $count Square products"
}

# Generate test orders for Spocket
generate_spocket_orders() {
    local count=$1
    local scenario=$2
    
    log "Generating $count Spocket orders with scenario: $scenario..."
    
    # Load a random customer for each order
    customer_count=$(ls test-data/customers/ | wc -l | tr -d ' ')
    
    # Array of order statuses
    if [ "$scenario" = "normal" ]; then
        STATUSES=("pending" "processing" "fulfilled" "completed")
    elif [ "$scenario" = "edge" ]; then
        STATUSES=("pending" "back_ordered" "partially_fulfilled" "returned")
    else
        STATUSES=("canceled" "failed" "payment_failed" "refunded")
    fi
    
    # Generate orders
    for ((i=1; i<=count; i++)); do
        # Select random customer and status
        CUSTOMER_INDEX=$((1 + RANDOM % customer_count))
        STATUS_INDEX=$((

