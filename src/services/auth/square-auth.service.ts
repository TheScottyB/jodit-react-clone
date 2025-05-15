import winston from 'winston';
import Bottleneck from 'bottleneck';
import { ApiError, Client, Environment } from '@square/web-sdk';

import { configService } from '../config/config.service';
import { AuthService, AuthState, AuthToken, SquareAuthResponse } from './auth.types';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'square-auth-service' },
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
 * Square API Authentication Service
 * Handles token acquisition, refresh, and validation for Square API
 */
export class SquareAuthService implements AuthService {
  private static instance: SquareAuthService;
  private client: Client;
  private authState: AuthState;
  private limiter: Bottleneck;
  
  // Token refresh threshold (1 hour before expiry)
  private static readonly REFRESH_THRESHOLD_MS = 60 * 60 * 1000;

  private constructor() {
    // Initialize auth state
    this.authState = {
      isAuthenticated: false,
      token: null,
      lastUpdated: new Date()
    };
    
    // Set up rate limiter to avoid hitting API limits
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: 500 // 2 requests per second max
    });
    
    // Initialize Square client
    this.initializeClient();
  }

  /**
   * Get singleton instance of SquareAuthService
   */
  public static getInstance(): SquareAuthService {
    if (!SquareAuthService.instance) {
      SquareAuthService.instance = new SquareAuthService();
    }

