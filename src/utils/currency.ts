/**
 * Currency conversion utilities
 */

/**
 * Currency conversion rates (for demonstration purposes)
 * In a production environment, use a currency conversion API
 */
const CURRENCY_CONVERSION_RATES: Record<string, Record<string, number>> = {
  'USD': {
    'EUR': 0.92,
    'GBP': 0.79,
    'CAD': 1.37,
    'USD': 1.0
  },
  'EUR': {
    'USD': 1.09,
    'GBP': 0.86,
    'CAD': 1.49,
    'EUR': 1.0
  },
  'GBP': {
    'USD': 1.27,
    'EUR': 1.16,
    'CAD': 1.74,
    'GBP': 1.0
  },
  'CAD': {
    'USD': 0.73,
    'EUR': 0.67,
    'GBP': 0.57,
    'CAD': 1.0
  }
};

/**
 * Convert currency from one type to another
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Converted amount
 */
export function convertCurrency(
  amount: number, 
  fromCurrency: string, 
  toCurrency: string
): number {
  // Same currency, no conversion needed
  if (fromCurrency === toCurrency) return amount;
  
  // Check if we have conversion rates for this currency
  const rates = CURRENCY_CONVERSION_RATES[fromCurrency];
  if (!rates) {
    throw new Error(`No conversion rates found for ${fromCurrency}`);
  }
  
  // Check if we have a direct conversion rate
  const rate = rates[toCurrency];
  if (!rate) {
    throw new Error(`No conversion rate found from ${fromCurrency} to ${toCurrency}`);
  }
  
  // Apply conversion
  return amount * rate;
}

/**
 * Convert a decimal price to smallest currency unit (e.g., cents)
 * @param amount - Decimal amount
 * @param currency - Currency code
 * @returns Amount in smallest currency unit as a whole number
 */
export function decimalToSmallestUnit(amount: number, currency: string): number {
  // Most currencies use 2 decimal places (100 cents = 1 dollar/euro/etc)
  let divisor = 100;
  
  // Some currencies have different divisors
  if (currency === 'JPY') {
    divisor = 1; // Japanese Yen doesn't use decimal places
  }
  
  return Math.round(amount * divisor);
}

/**
 * Convert an amount in smallest currency unit to decimal
 * @param amount - Amount in smallest currency unit
 * @param currency - Currency code
 * @returns Decimal amount
 */
export function smallestUnitToDecimal(amount: number, currency: string): number {
  // Most currencies use 2 decimal places (100 cents = 1 dollar/euro/etc)
  let divisor = 100;
  
  // Some currencies have different divisors
  if (currency === 'JPY') {
    divisor = 1; // Japanese Yen doesn't use decimal places
  }
  
  return amount / divisor;
}

