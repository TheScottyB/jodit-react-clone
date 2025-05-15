/**
 * Type definitions for the synchronization process between Spocket and Square
 */

/**
 * Synchronization direction
 */
export enum SyncDirection {
  SPOCKET_TO_SQUARE = 'spocket_to_square',
  SQUARE_TO_SPOCKET = 'square_to_spocket',
  BIDIRECTIONAL = 'bidirectional'
}

/**
 * Synchronization entity types
 */
export enum SyncEntityType {
  PRODUCT = 'product',
  INVENTORY = 'inventory',
  ORDER = 'order',
  CATEGORY = 'category',
  CUSTOMER = 'customer'
}

/**
 * Synchronization status
 */
export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIALLY_COMPLETED = 'partially_completed',
  CANCELLED = 'cancelled'
}

/**
 * Conflict resolution strategy
 */
export enum ConflictResolutionStrategy {
  SPOCKET_WINS = 'spocket_wins',
  SQUARE_WINS = 'square_wins',
  NEWEST_WINS = 'newest_wins',
  MANUAL_RESOLUTION = 'manual_resolution',
  SKIP = 'skip'
}

/**
 * Error severity levels
 */
export enum SyncErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Entity mapping between Spocket and Square
 */
export interface EntityMapping {
  spocketId: string;
  squareId: string;
  entityType: SyncEntityType;
  lastSynced?: Date;
}

/**
 * Synchronization error
 */
export interface SyncError {
  code: string;
  message: string;
  severity: SyncErrorSeverity;
  entityId?: string;
  entityType?: SyncEntityType;
  retryable: boolean;
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Conflict data
 */
export interface SyncConflict {
  entityId: string;
  entityType: SyncEntityType;
  spocketData?: any;
  squareData?: any;
  conflictFields: string[];
  resolutionStrategy?: ConflictResolutionStrategy;
  resolved: boolean;
  resolvedData?: any;
  timestamp: Date;
}

/**
 * Base synchronization task
 */
export interface SyncTask {
  id: string;
  entityType: SyncEntityType;
  direction: SyncDirection;
  status: SyncStatus;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  conflictResolutionStrategy: ConflictResolutionStrategy;
  errors: SyncError[];
  conflicts: SyncConflict[];
  entityCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  skipCount: number;
}

/**
 * Product synchronization task
 */
export interface ProductSyncTask extends SyncTask {
  entityType: SyncEntityType.PRODUCT;
  productMappings: EntityMapping[];
}

/**
 * Inventory synchronization task
 */
export interface InventorySyncTask extends SyncTask {
  entityType: SyncEntityType.INVENTORY;
  inventoryMappings: EntityMapping[];
}

/**
 * Order synchronization task
 */
export interface OrderSyncTask extends SyncTask {
  entityType: SyncEntityType.ORDER;
  orderMappings: EntityMapping[];
}

/**
 * Result of a single entity synchronization
 */
export interface SyncResult {
  entityId: string;
  entityType: SyncEntityType;
  success: boolean;
  sourceId?: string;
  targetId?: string;
  error?: SyncError;
  conflict?: SyncConflict;
  timestamp: Date;
}

/**
 * Summary of a completed synchronization task
 */
export interface SyncSummary {
  taskId: string;
  entityType: SyncEntityType;
  direction: SyncDirection;
  status: SyncStatus;
  startTime: Date;
  endTime: Date;
  duration: number; // in milliseconds
  totalEntities: number;
  successCount: number;
  failureCount: number;
  skipCount: number;
  errorCount: number;
  conflictCount: number;
  resolvedConflictCount: number;
}

/**
 * Sync operation options
 */
export interface SyncOptions {
  direction: SyncDirection;
  entityTypes: SyncEntityType[];
  conflictResolutionStrategy: ConflictResolutionStrategy;
  batchSize?: number;
  rateLimitPerMinute?: number;
  timeout?: number; // in milliseconds
  retryCount?: number;
  retryDelay?: number; // in milliseconds
  skipExisting?: boolean;
  filters?: Record<string, any>; // Entity-specific filters
}

/**
 * Sync webhook event type
 */
export enum SyncWebhookEvent {
  TASK_CREATED = 'task_created',
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  CONFLICT_DETECTED = 'conflict_detected',
  ERROR_OCCURRED = 'error_occurred'
}

/**
 * Webhook payload for synchronization events
 */
export interface SyncWebhookPayload {
  event: SyncWebhookEvent;
  taskId: string;
  entityType: SyncEntityType;
  timestamp: Date;
  data: any;
}

/**
 * Repository interface for sync data persistence
 */
export interface SyncRepository {
  saveTask(task: SyncTask): Promise<SyncTask>;
  getTaskById(id: string): Promise<SyncTask | null>;
  updateTaskStatus(id: string, status: SyncStatus): Promise<void>;
  saveError(taskId: string, error: SyncError): Promise<void>;
  saveConflict(taskId: string, conflict: SyncConflict): Promise<void>;
  saveResult(taskId: string, result: SyncResult): Promise<void>;
  getSummary(taskId: string): Promise<SyncSummary>;
  saveMapping(mapping: EntityMapping): Promise<void>;
  getMappingBySpocketId(entityType: SyncEntityType, spocketId: string): Promise<EntityMapping | null>;
  getMappingBySquareId(entityType: SyncEntityType, squareId: string): Promise<EntityMapping | null>;
}
