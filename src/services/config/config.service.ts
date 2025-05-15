import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import winston from 'winston';

// Initialize dotenv
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'config-service' },
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
 * Configuration service for managing environment variables
 * and credential storage for the Spocket-Square integration
 */
class ConfigService {
  private static instance: ConfigService;
  private envCache: { [key: string]: string | undefined } = {};

  private constructor() {
    // Validate required environment variables on startup
    this.validateEnv();
  }

  /**
   * Get singleton instance of ConfigService
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Get an environment variable with validation
   * @param key - Environment variable name
   * @param required - Whether the variable is required (throws error if missing)
   * @returns The environment variable value or undefined if not required
   */
  public getEnv(key: string, required = false): string | undefined {
    // Return from cache if already fetched
    if (this.envCache[key] !== undefined) {
      return this.envCache[key];
    }

    const value = process.env[key];
    
    // Throw error if required but missing
    if (required && !value) {
      const error = `Required environment variable ${key} is missing`;
      logger.error(error);
      throw new Error(error);
    }

    // Cache the result to avoid repeated lookups
    this.envCache[key] = value;
    return value;
  }

  /**
   * Check if all required environment variables are present
   */
  private validateEnv(): void {
    // List of required environment variables for the integration
    const requiredVars = [
      'SPOCKET_API_KEY',
      'SQUARE_ACCESS_TOKEN',
    ];

    // Verify each required variable
    const missingVars = requiredVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      const error = `Missing required environment variables: ${missingVars.join(', ')}`;
      logger.error(error);
      
      // In development, check if .env file exists
      if (process.env.NODE_ENV !== 'production') {
        const envPath = join(process.cwd(), '.env');
        if (!existsSync(envPath)) {
          logger.warn(`No .env file found at ${envPath}. Please create one using .env.template as a guide.`);
        }
      }
      
      // Only throw in production to enable development without all variables
      if (process.env.NODE_ENV === 'production') {
        throw new Error(error);
      }
    }
  }

  /**
   * Get Spocket API Key
   */
  public getSpocketApiKey(): string {
    return this.getEnv('SPOCKET_API_KEY', true) as string;
  }

  /**
   * Get Spocket API Secret (if applicable)
   */
  public getSpocketApiSecret(): string | undefined {
    return this.getEnv('SPOCKET_API_SECRET');
  }

  /**
   * Get Square Access Token
   */
  public getSquareAccessToken(): string {
    return this.getEnv('SQUARE_ACCESS_TOKEN', true) as string;
  }

  /**
   * Get Square Refresh Token (if applicable)
   */
  public getSquareRefreshToken(): string | undefined {
    return this.getEnv('SQUARE_REFRESH_TOKEN');
  }

  /**
   * Get Square Environment (sandbox or production)
   */
  public getSquareEnvironment(): 'sandbox' | 'production' {
    return (this.getEnv('SQUARE_ENVIRONMENT') || 'sandbox') as 'sandbox' | 'production';
  }
}

// Export singleton instance
export const configService = ConfigService.getInstance();
export default configService;

