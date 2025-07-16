# PersonalPod Database Schema Documentation

## Overview

PersonalPod uses a hybrid database architecture combining PostgreSQL for relational data and DynamoDB for high-performance operations. This design provides the best of both worlds: ACID compliance and complex relationships in PostgreSQL, with the scalability and performance of DynamoDB for specific use cases.

## Architecture

### PostgreSQL (Amazon RDS)
- **Purpose**: Primary data storage for user content, relationships, and metadata
- **Use Cases**: 
  - User management and authentication
  - Content storage (notes, passwords, documents, etc.)
  - Complex queries and relationships
  - Full-text search
  - Transactional operations

### DynamoDB
- **Purpose**: High-performance operations and caching
- **Use Cases**:
  - Search index caching
  - Session management
  - Frequently accessed data caching
  - Real-time sync queue

## PostgreSQL Schema

### Core Tables

#### 1. Users Table
Stores user account information synchronized with AWS Cognito.

**Key Fields**:
- `id`: UUID primary key
- `cognito_user_id`: Unique identifier from AWS Cognito
- `email`: User's email address
- `username`: Unique username
- `metadata`: JSONB field for extensible user data

**Indexes**:
- `cognito_user_id` (unique)
- `email` (unique)
- `username` (unique)

#### 2. Entries Table
Polymorphic table storing all types of user content.

**Entry Types**:
- `note`: Text notes and documents
- `password`: Encrypted password entries
- `document`: File references and documents
- `bookmark`: Web bookmarks
- `task`: To-do items and tasks
- `contact`: Contact information

**Key Features**:
- Supports both plain and encrypted content
- Flexible metadata storage using JSONB
- Status tracking (active, archived, deleted, draft)
- Expiration support for temporary content

#### 3. Categories Table
Hierarchical categorization system for entries.

**Features**:
- Self-referential for nested categories
- Custom colors and icons
- System categories support
- User-specific categorization

#### 4. Tags Table
Flexible tagging system with usage tracking.

**Features**:
- Automatic slug generation
- Usage count tracking
- Color customization
- Many-to-many relationship with entries

#### 5. Attachments Table
Manages file attachments stored in S3.

**Features**:
- S3 integration for file storage
- Thumbnail support for images
- Checksum verification
- Metadata storage

#### 6. Search Metadata Table
Optimized full-text search using PostgreSQL's tsvector.

**Features**:
- Automatic search vector generation
- Language-specific indexing
- Keyword extraction
- GIN index for performance

#### 7. Sharing Table
Manages entry sharing between users.

**Features**:
- Permission levels (read, write, admin)
- Token-based sharing for external users
- Expiration support
- Access tracking

#### 8. Activity Logs Table
Comprehensive audit trail for user actions.

**Actions Tracked**:
- Create, update, delete operations
- Sharing activities
- Export operations
- View tracking

### Database Triggers

1. **Updated At Trigger**: Automatically updates `updated_at` timestamp
2. **Tag Usage Counter**: Maintains accurate tag usage counts
3. **Search Vector Update**: Keeps search index synchronized
4. **Slug Generation**: Auto-generates URL-safe slugs
5. **Activity Logging**: Automatic audit trail creation

## DynamoDB Schema

### 1. Search Indices Table

**Purpose**: Cache pre-computed search results for instant search functionality.

**Access Patterns**:
- Get search results by user and query
- Update indices when entries change
- Batch retrieve multiple search results

**Key Design**:
- PK: `USER#{userId}`
- SK: `SEARCH#{searchType}#{searchTerm}`
- GSI1: Search by type and timestamp

### 2. Session Management Table

**Purpose**: Multi-device session tracking and management.

**Access Patterns**:
- Get active sessions by user
- Track device-specific sessions
- Automatic session expiration

**Key Design**:
- PK: `SESSION#{sessionId}`
- SK: `USER#{userId}`
- GSI: UserSessionsIndex, DeviceSessionsIndex

### 3. Cache Table

**Purpose**: High-performance caching layer for expensive operations.

**Cached Data Types**:
- User statistics
- Category trees
- Recent entries
- Computed aggregations

**Key Design**:
- PK: `CACHE#{cacheType}#{cacheKey}`
- SK: `VERSION#{version}`
- TTL for automatic expiration

### 4. Sync Queue Table

**Purpose**: Reliable cross-device data synchronization.

**Features**:
- Ordered sync operations
- Retry mechanism
- Conflict resolution
- Device tracking

**Key Design**:
- PK: `USER#{userId}`
- SK: `TIMESTAMP#{timestamp}#{syncId}`
- GSI: StatusIndex, DeviceSyncIndex

## Data Flow

### Write Operations
1. Client writes to PostgreSQL (primary source of truth)
2. Triggers update search vectors
3. DynamoDB caches are invalidated
4. Sync queue entry created for other devices

### Read Operations
1. Check DynamoDB cache first
2. If cache miss, query PostgreSQL
3. Update cache with results
4. Return data to client

### Search Operations
1. Check DynamoDB search index cache
2. If cache miss, perform PostgreSQL full-text search
3. Cache results in DynamoDB
4. Return results to client

## Migration Strategy

### PostgreSQL Migrations
Located in `/database/migrations/`:
1. `001_initial_schema.sql`: Creates all tables and types
2. `002_create_indexes.sql`: Adds performance indexes
3. `003_create_triggers.sql`: Sets up automatic triggers
4. `004_sample_data.sql`: Test data (dev only)

### Running Migrations
```bash
# Development
psql -h localhost -U postgres -d personalpod_dev < migrations/001_initial_schema.sql

# Production (via RDS)
psql -h your-rds-endpoint.amazonaws.com -U postgres -d personalpod < migrations/001_initial_schema.sql
```

## Security Considerations

1. **Encryption**:
   - Passwords and sensitive content encrypted at application level
   - Encrypted content stored in `content_encrypted` field
   - Encryption keys managed via AWS KMS

2. **Access Control**:
   - Row-level security via user_id foreign keys
   - API-level authorization checks
   - Sharing permissions enforced at query level

3. **Data Privacy**:
   - Search vectors exclude encrypted content
   - Activity logs anonymize sensitive operations
   - Automatic data expiration support

## Performance Optimization

1. **Indexes**: Strategic indexes on frequently queried columns
2. **Caching**: DynamoDB cache reduces PostgreSQL load
3. **Search**: Pre-computed search vectors for fast full-text search
4. **Pagination**: Cursor-based pagination for large datasets
5. **Connection Pooling**: RDS Proxy for connection management

## Backup and Recovery

1. **PostgreSQL**:
   - Automated RDS backups
   - Point-in-time recovery
   - Multi-AZ deployment for HA

2. **DynamoDB**:
   - Continuous backups
   - Point-in-time recovery
   - Global tables for multi-region

## Monitoring

Key metrics to monitor:
- Query performance (PostgreSQL slow query log)
- Cache hit rates (DynamoDB)
- Table sizes and growth
- Connection pool utilization
- Sync queue backlog