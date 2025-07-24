# Phase 2: Core Backend Services Implementation Plan

## Overview
This phase focuses on implementing the core diary functionality that makes PersonalPod usable as a personal diary application.

## Implementation Order & Timeline

### Week 1: Infrastructure & Core APIs
**Day 1-2: Infrastructure Updates**
- [ ] Add RDS PostgreSQL to CDK
- [ ] Add OpenSearch to CDK
- [ ] Add SQS/SNS for background jobs
- [ ] Update Lambda configuration

**Day 3-4: Entry Management**
- [ ] Create Entry model and repository
- [ ] Implement CRUD endpoints for entries
- [ ] Add entry validation and sanitization
- [ ] Implement entry versioning

**Day 5: Categories & Tags**
- [ ] Create Category model and repository
- [ ] Implement category CRUD endpoints
- [ ] Create Tag model and repository
- [ ] Implement tag CRUD endpoints
- [ ] Add tag suggestions feature

### Week 2: Advanced Features
**Day 1-2: File Management**
- [ ] Create file upload service
- [ ] Implement S3 integration
- [ ] Add image processing (thumbnails)
- [ ] Implement file attachment to entries

**Day 3-4: Search Implementation**
- [ ] Create search service
- [ ] Integrate with OpenSearch
- [ ] Implement full-text search
- [ ] Add search filters and facets

**Day 5: Real-time & Background Jobs**
- [ ] Add WebSocket support
- [ ] Implement real-time sync
- [ ] Create job queue service
- [ ] Add background processing

## Detailed Task Breakdown

### 1. Infrastructure Updates

#### RDS PostgreSQL Addition
```typescript
// infrastructure/lib/constructs/database-construct.ts
- VPC configuration
- RDS instance with Multi-AZ
- Security groups
- Parameter groups
- Backup configuration
```

#### OpenSearch Addition
```typescript
// infrastructure/lib/constructs/search-construct.ts
- OpenSearch domain
- Fine-grained access control
- VPC configuration
- Index templates
```

#### SQS/SNS Configuration
```typescript
// infrastructure/lib/constructs/queue-construct.ts
- SQS queues for jobs
- DLQ configuration
- SNS topics for notifications
- Lambda triggers
```

### 2. Core API Implementation

#### Entry Management
```
POST   /api/entries          - Create entry
GET    /api/entries          - List entries (paginated)
GET    /api/entries/:id      - Get entry
PUT    /api/entries/:id      - Update entry
DELETE /api/entries/:id      - Delete entry
POST   /api/entries/:id/lock - Lock entry
GET    /api/entries/search   - Search entries
```

#### Categories Management
```
POST   /api/categories       - Create category
GET    /api/categories       - List categories (tree)
GET    /api/categories/:id   - Get category
PUT    /api/categories/:id   - Update category
DELETE /api/categories/:id   - Delete category
POST   /api/categories/move  - Move category
```

#### Tags Management
```
POST   /api/tags            - Create tag
GET    /api/tags            - List tags
GET    /api/tags/:id        - Get tag
PUT    /api/tags/:id        - Update tag
DELETE /api/tags/:id        - Delete tag
GET    /api/tags/popular    - Popular tags
GET    /api/tags/suggest    - Tag suggestions
```

#### File Management
```
POST   /api/files/upload     - Upload file
GET    /api/files/:id        - Get file
DELETE /api/files/:id        - Delete file
POST   /api/files/batch      - Batch upload
GET    /api/files/:id/thumb  - Get thumbnail
```

### 3. Service Architecture

#### Entry Service
- CRUD operations
- Version control
- Encryption for sensitive entries
- Rich text processing
- Attachment handling

#### Search Service
- Index management
- Query building
- Result ranking
- Faceted search
- Autocomplete

#### File Service
- Upload to S3
- Image processing
- Video thumbnail generation
- Document preview
- Virus scanning

#### Notification Service
- Email notifications
- Push notifications (future)
- In-app notifications
- Notification preferences

### 4. Security Implementations

- Entry-level encryption
- File access control
- Search result filtering
- Rate limiting per feature
- Audit logging

### 5. Performance Optimizations

- Database query optimization
- Caching strategy
- CDN for media files
- Lazy loading
- Pagination

## Success Metrics

- All core CRUD operations working
- File upload < 10MB in < 5 seconds
- Search results < 500ms
- 99.9% uptime for core features
- Zero data loss

## Testing Requirements

- Unit tests for all services
- Integration tests for APIs
- Load testing for file uploads
- Security testing for access control
- E2E tests for critical paths