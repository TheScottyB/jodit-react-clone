/**
 * Common mapping utilities for Spocket-Square integration
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a unique ID with a prefix
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 */
export function createUniqueId(prefix?: string): string {
  const uuid = uuidv4();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

/**
 * Extract Spocket ID from Square ID (reverse of the ID mapping process)
 * @param squareId - Square ID to extract from
 * @returns Extracted Spocket ID
 */
export function extractSpocketIdFromSquareId(squareId: string): string {
  // If the ID starts with "#spocket:" or "spkt_", extract the original Spocket ID
  if (squareId.startsWith('#spocket:')) {
    return squareId.replace(/^#spocket:(?:variation:)?/, '').split(':')[0];
  }
  
  if (squareId.startsWith('spkt_')) {
    return squareId;
  }
  
  // If not a mapped ID, generate a placeholder Spocket ID
  return `square_${squareId}`;
}

/**
 * Extract Square ID from Spocket ID (reverse of the ID mapping process)
 * @param spocketId - Spocket ID to extract from
 * @returns Extracted Square ID
 */
export function extractSquareIdFromSpocketId(spocketId: string): string {
  // If the ID starts with "#square:" or "sq_", extract the original Square ID
  if (spocketId.startsWith('#square:')) {
    return spocketId.replace(/^#square:(?:variation:)?/, '').split(':')[0];
  }
  
  if (spocketId.startsWith('sq_')) {
    return spocketId;
  }
  
  // If not a mapped ID, generate a placeholder Square ID
  return `spocket_${spocketId}`;
}

