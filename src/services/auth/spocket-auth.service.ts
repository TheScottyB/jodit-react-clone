import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import Bottleneck from 'bottleneck';

import { configService } from '../config/config.service';
import { AuthService, AuthState, AuthToken, SpocketAuthResponse } from './auth.types';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'spocket-auth-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Add file transport or external logging service in production
  ],
});

/**
 * Spocket API Authentication Service
 * Handles token acquisition, refresh, and validation for Spocket API
 */
export class SpocketAuthService implements AuthService {
  private static instance: SpocketAuthService;
  private httpClient: AxiosInstance;
  private authState: AuthState;
  private limiter: Bottleneck;
  
  // Spocket API endpoints
  private static readonly API_BASE_URL = 'https://api.spocket.co';
  private static readonly AUTH_ENDPOINT = '/oauth/token';
  
  // Token refresh threshold (5 minutes before expiry)
  private static readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

  private constructor() {
    // Initialize auth state
    this.authState = {
      isAuthenticated: false,
      token: null,
      lastUpdated: new Date()
    };
    
    // Create HTTP client
    this.httpClient = axios.create({
      baseURL: SpocketAuthService.API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Set up rate limiter to avoid hitting API limits
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: 1000 // 1 request per second max
    });
    
    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          logger.error(`Spocket API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          logger.error(`Spocket API request error: ${error.message}`);
        } else {
          logger.error(`Spocket API client error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get singleton instance of SpocketAuthService
   */
  public static getInstance(): SpocketAuthService {
    if (!SpocketAuthService.instance) {
      SpocketAuthService.instance = new SpocketAuthService();
    }
    return SpocketAuthService.instance;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  public async getAccessToken(): Promise<string> {
    await this.refreshTokenIfNeeded();
    
    if (!this.authState.token?.accessToken) {
      throw new Error('No Spocket access token available');
    }
    
    return this.authState.token.accessToken;
  }

  /**
   * Check if the current token is valid
   */
  public isTokenValid(): boolean {
    if (!this.authState.token?.accessToken) {
      return false;
    }
    
    // If token has no expiry, consider it invalid
    if (!this.authState.token.expiresAt) {
      return false;
    }
    
    // Check if token has expired
    const now = new Date();
    const expiresAt = this.authState.token.expiresAt;
    
    // Return true if token is still valid and not approaching expiry
    return expiresAt > new Date(now.getTime() + SpocketAuthService.REFRESH_THRESHOLD_MS);
  }

  /**
   * Refresh the access token if needed
   */
  public async refreshTokenIfNeeded(): Promise<void> {
    if (this.isTokenValid()) {
      return; // Token is still valid
    }
    
    try {
      // Use rate limiter to avoid exceeding API limits
      await this.limiter.schedule(() => this.authenticate());
    } catch (error) {
      logger.error('Failed to refresh Spocket token', error);
      throw new Error('Failed to authenticate with Spocket API');
    }
  }

  /**
   * Get current authentication state
   */
  public getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Authenticate with Spocket API
   * This is a private method that handles the actual API call
   */
  private async authenticate(): Promise<void> {
    try {
      const apiKey = configService.getSpocketApiKey();
      const apiSecret = configService.getSpocketApiSecret();
      
      // Note: This is a placeholder implementation as Spocket's exact auth flow may differ
      // Adjust according to Spocket's actual API documentation
      const response = await this.httpClient.post<SpocketAuthResponse>(
        SpocketAuthService.AUTH_ENDPOINT,
        {
          client_id: apiKey,
          client_secret: apiSecret,
          grant_type: 'client_credentials'
        }
      );
      
      const { data } = response;
      
      // Calculate token expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));
      
      // Update auth state
      this.authState = {
        isAuthenticated: true,
        token: {
          accessToken: data.access_token,
          tokenType: data.token_type,
          expiresAt
        },
        lastUpdated: new Date()
      };
      
      logger.info('Successfully authenticated with Spocket API');
    } catch (error: any) {
      // Update auth state with error
      this.authState = {
        isAuthenticated: false,
        token: null,
        error: error.message || 'Unknown authentication error',
        lastUpdated: new Date()
      };
      
      logger.error('Spocket authentication failed', error);
      throw error;
    }
  }
}

// Export singleton instance
export const spocketAuthService = SpocketAuthService.getInstance();
export default spocketAuthService;

