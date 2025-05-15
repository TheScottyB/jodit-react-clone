/**
 * Common authentication types for Spocket and Square integration
 */

/**
 * Generic auth token structure
 */
export interface AuthToken {
  accessToken: string;
  expiresAt?: Date;
  refreshToken?: string;
  tokenType?: string;
}

/**
 * Authentication state for tracking token validity
 */
export interface AuthState {
  isAuthenticated: boolean;
  token: AuthToken | null;
  error?: string;
  lastUpdated: Date;
}

/**
 * Spocket-specific auth token response
 */
export interface SpocketAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  // Add other Spocket-specific fields as needed
}

/**
 * Square-specific auth token response
 */
export interface SquareAuthResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  merchant_id?: string;
  refresh_token?: string;
  // Add other Square-specific fields as needed
}

/**
 * Auth service interface for common authentication operations
 */
export interface AuthService {
  /**
   * Get a valid access token
   */
  getAccessToken(): Promise<string>;
  
  /**
   * Check if current token is valid
   */
  isTokenValid(): boolean;
  
  /**
   * Refresh the current token if needed
   */
  refreshTokenIfNeeded(): Promise<void>;
  
  /**
   * Get the current authentication state
   */
  getAuthState(): AuthState;
}

