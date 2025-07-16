/**
 * DynamoDB Table Definitions for PersonalPod
 * 
 * These tables are designed for high-performance operations:
 * - Search indices for fast lookups
 * - Session management for user sessions
 * - Cache for frequently accessed data
 * - Real-time sync queue for data synchronization
 */

import { AttributeType, BillingMode, ProjectionType, StreamViewType } from 'aws-cdk-lib/aws-dynamodb';

export const dynamoTableDefinitions = {
  /**
   * Search Indices Table
   * Purpose: Store pre-computed search indices for ultra-fast search operations
   * Access patterns:
   * - Get search results by user and query
   * - Update indices when entries change
   * - Batch get multiple search results
   */
  searchIndices: {
    tableName: 'PersonalPod-SearchIndices',
    partitionKey: {
      name: 'pk',
      type: AttributeType.STRING, // Format: USER#{userId}
    },
    sortKey: {
      name: 'sk',
      type: AttributeType.STRING, // Format: SEARCH#{searchType}#{searchTerm}
    },
    billingMode: BillingMode.PAY_PER_REQUEST,
    globalSecondaryIndexes: [
      {
        indexName: 'GSI1',
        partitionKey: {
          name: 'gsi1pk',
          type: AttributeType.STRING, // Format: SEARCHTYPE#{searchType}
        },
        sortKey: {
          name: 'gsi1sk',
          type: AttributeType.STRING, // Format: TIMESTAMP#{timestamp}
        },
        projectionType: ProjectionType.ALL,
      },
    ],
    stream: StreamViewType.NEW_AND_OLD_IMAGES,
    attributes: {
      pk: 'Partition key - USER#{userId}',
      sk: 'Sort key - SEARCH#{searchType}#{searchTerm}',
      gsi1pk: 'GSI1 partition key - SEARCHTYPE#{searchType}',
      gsi1sk: 'GSI1 sort key - TIMESTAMP#{timestamp}',
      entryIds: 'Array of matching entry IDs',
      searchType: 'Type of search (title, content, tag, etc.)',
      searchTerm: 'The search term',
      resultCount: 'Number of results',
      metadata: 'Additional search metadata',
      ttl: 'Time to live for cache expiration',
      createdAt: 'ISO 8601 timestamp',
      updatedAt: 'ISO 8601 timestamp',
    },
  },

  /**
   * Session Management Table
   * Purpose: Manage user sessions across devices
   * Access patterns:
   * - Get active sessions by user
   * - Get session by session ID
   * - Update session activity
   * - Delete expired sessions
   */
  sessionManagement: {
    tableName: 'PersonalPod-Sessions',
    partitionKey: {
      name: 'pk',
      type: AttributeType.STRING, // Format: SESSION#{sessionId}
    },
    sortKey: {
      name: 'sk',
      type: AttributeType.STRING, // Format: USER#{userId}
    },
    billingMode: BillingMode.PAY_PER_REQUEST,
    globalSecondaryIndexes: [
      {
        indexName: 'UserSessionsIndex',
        partitionKey: {
          name: 'userId',
          type: AttributeType.STRING,
        },
        sortKey: {
          name: 'lastActivityAt',
          type: AttributeType.STRING, // ISO 8601 timestamp
        },
        projectionType: ProjectionType.ALL,
      },
      {
        indexName: 'DeviceSessionsIndex',
        partitionKey: {
          name: 'deviceId',
          type: AttributeType.STRING,
        },
        sortKey: {
          name: 'createdAt',
          type: AttributeType.STRING,
        },
        projectionType: ProjectionType.KEYS_ONLY,
      },
    ],
    stream: StreamViewType.NEW_AND_OLD_IMAGES,
    attributes: {
      pk: 'Partition key - SESSION#{sessionId}',
      sk: 'Sort key - USER#{userId}',
      sessionId: 'Unique session identifier',
      userId: 'User ID from Cognito',
      deviceId: 'Device identifier',
      deviceName: 'Human-readable device name',
      deviceType: 'Device type (mobile, desktop, tablet)',
      ipAddress: 'IP address of the session',
      userAgent: 'User agent string',
      isActive: 'Boolean indicating if session is active',
      lastActivityAt: 'ISO 8601 timestamp of last activity',
      expiresAt: 'ISO 8601 timestamp when session expires',
      createdAt: 'ISO 8601 timestamp',
      metadata: 'Additional session metadata',
      ttl: 'Time to live for automatic deletion',
    },
  },

  /**
   * Cache Table
   * Purpose: Cache frequently accessed data for performance
   * Access patterns:
   * - Get cached data by key
   * - Store computed results
   * - Invalidate cache entries
   */
  cache: {
    tableName: 'PersonalPod-Cache',
    partitionKey: {
      name: 'pk',
      type: AttributeType.STRING, // Format: CACHE#{cacheType}#{cacheKey}
    },
    sortKey: {
      name: 'sk',
      type: AttributeType.STRING, // Format: VERSION#{version} or METADATA
    },
    billingMode: BillingMode.PAY_PER_REQUEST,
    globalSecondaryIndexes: [
      {
        indexName: 'CacheTypeIndex',
        partitionKey: {
          name: 'cacheType',
          type: AttributeType.STRING,
        },
        sortKey: {
          name: 'lastAccessedAt',
          type: AttributeType.STRING,
        },
        projectionType: ProjectionType.KEYS_ONLY,
      },
    ],
    attributes: {
      pk: 'Partition key - CACHE#{cacheType}#{cacheKey}',
      sk: 'Sort key - VERSION#{version} or METADATA',
      cacheType: 'Type of cache (user_stats, category_tree, etc.)',
      cacheKey: 'Unique key for the cached item',
      data: 'Cached data (JSON)',
      compressionType: 'Compression type if data is compressed',
      sizeBytes: 'Size of cached data in bytes',
      hitCount: 'Number of cache hits',
      lastAccessedAt: 'ISO 8601 timestamp of last access',
      expiresAt: 'ISO 8601 timestamp when cache expires',
      ttl: 'Time to live in seconds',
      createdAt: 'ISO 8601 timestamp',
      metadata: 'Additional cache metadata',
    },
  },

  /**
   * Real-time Sync Queue Table
   * Purpose: Queue for syncing data changes across devices
   * Access patterns:
   * - Get pending sync items by user
   * - Add new sync items
   * - Mark items as synced
   * - Retry failed sync items
   */
  syncQueue: {
    tableName: 'PersonalPod-SyncQueue',
    partitionKey: {
      name: 'pk',
      type: AttributeType.STRING, // Format: USER#{userId}
    },
    sortKey: {
      name: 'sk',
      type: AttributeType.STRING, // Format: TIMESTAMP#{timestamp}#{syncId}
    },
    billingMode: BillingMode.PAY_PER_REQUEST,
    globalSecondaryIndexes: [
      {
        indexName: 'StatusIndex',
        partitionKey: {
          name: 'syncStatus',
          type: AttributeType.STRING, // pending, processing, completed, failed
        },
        sortKey: {
          name: 'createdAt',
          type: AttributeType.STRING,
        },
        projectionType: ProjectionType.ALL,
      },
      {
        indexName: 'DeviceSyncIndex',
        partitionKey: {
          name: 'deviceId',
          type: AttributeType.STRING,
        },
        sortKey: {
          name: 'syncSequence',
          type: AttributeType.NUMBER,
        },
        projectionType: ProjectionType.ALL,
      },
    ],
    stream: StreamViewType.NEW_AND_OLD_IMAGES,
    attributes: {
      pk: 'Partition key - USER#{userId}',
      sk: 'Sort key - TIMESTAMP#{timestamp}#{syncId}',
      syncId: 'Unique sync operation identifier',
      userId: 'User ID',
      deviceId: 'Device that initiated the sync',
      syncType: 'Type of sync (create, update, delete)',
      entityType: 'Type of entity being synced',
      entityId: 'ID of the entity being synced',
      syncData: 'Data to be synced (JSON)',
      syncStatus: 'Status (pending, processing, completed, failed)',
      syncSequence: 'Sequence number for ordering',
      retryCount: 'Number of retry attempts',
      lastError: 'Last error message if failed',
      processedAt: 'ISO 8601 timestamp when processed',
      completedAt: 'ISO 8601 timestamp when completed',
      createdAt: 'ISO 8601 timestamp',
      ttl: 'Time to live for cleanup',
      metadata: 'Additional sync metadata',
    },
  },
};

/**
 * DynamoDB Table Access Patterns Documentation
 * 
 * 1. Search Indices Table:
 *    - Primary: Get search results for a user by search term
 *    - GSI1: Get all searches of a specific type ordered by time
 *    - Use case: Pre-computed search results for instant search
 * 
 * 2. Session Management Table:
 *    - Primary: Get session details by session ID
 *    - UserSessionsIndex: Get all sessions for a user ordered by activity
 *    - DeviceSessionsIndex: Get all sessions from a device
 *    - Use case: Multi-device session management
 * 
 * 3. Cache Table:
 *    - Primary: Get cached data by cache key
 *    - CacheTypeIndex: Find least recently used items by type
 *    - Use case: Performance optimization for expensive operations
 * 
 * 4. Sync Queue Table:
 *    - Primary: Get sync items for a user in chronological order
 *    - StatusIndex: Get all items by status for processing
 *    - DeviceSyncIndex: Get sync history for a specific device
 *    - Use case: Reliable cross-device data synchronization
 */

export default dynamoTableDefinitions;