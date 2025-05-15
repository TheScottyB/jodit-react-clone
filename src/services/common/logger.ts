/**
 * Common logger configuration for all services
 */
import winston from 'winston';

/**
 * Create a logger instance for a specific service
 * @param serviceName - Name of the service for logs
 * @returns Winston logger instance
 */
export function createLogger(serviceName: string): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    defaultMeta: { service: serviceName },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
      // Add file transport in production
      // Add external logging service in production
    ],
  });
}

// Export default logger for general use
export const logger = createLogger('general');
export default logger;

