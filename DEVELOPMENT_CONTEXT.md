# PersonalPod Development Context

## Current State Summary

The PersonalPod project is a fully-featured personal journal and knowledge management system with the following components completed:

1. **Backend API** - Serverless Node.js/Express on AWS Lambda
2. **Web Application** - React 19 with Material-UI
3. **Mobile Application** - React Native 0.80.1 for iOS/Android
4. **Infrastructure** - AWS CDK with complete cloud architecture

## Key Files & Locations

### Configuration Files
- `/package.json` - Root monorepo configuration
- `/pnpm-workspace.yaml` - Workspace definitions
- `/docker-compose.yml` - Local development services

### API (Backend)
- `/api/src/index.ts` - Main Express application
- `/api/src/routes/` - All API route definitions
- `/api/src/controllers/` - Request handlers
- `/api/src/services/` - Business logic
- `/api/src/models/` - Database models
- `/api/migrations/` - Database migrations

### Web Frontend
- `/web/src/App.tsx` - Main React application
- `/web/src/pages/` - Page components
- `/web/src/components/` - Reusable UI components
- `/web/src/features/` - Feature modules
- `/web/src/store/` - Redux store configuration
- `/web/src/services/` - API client services

### Mobile Application
- `/mobile/src/App.tsx` - Root React Native component
- `/mobile/src/screens/` - Screen components
- `/mobile/src/navigation/` - Navigation configuration
- `/mobile/src/components/` - Shared components
- `/mobile/src/database/` - WatermelonDB setup
- `/mobile/src/services/` - Native services & API

### Infrastructure
- `/infrastructure/lib/personalpod-stack.ts` - Main CDK stack
- `/infrastructure/lib/constructs/` - Reusable CDK constructs
- `/infrastructure/bin/personalpod.ts` - CDK app entry

## Critical Implementation Details

### Authentication Flow
1. **Web/Mobile** → POST `/auth/login` with credentials
2. **API** → Validate credentials, generate JWT + refresh token
3. **Client** → Store tokens securely (localStorage/Keychain)
4. **Subsequent Requests** → Include JWT in Authorization header
5. **Token Refresh** → Automatic refresh when JWT expires

### Data Sync Architecture
1. **Mobile** → All data stored in local SQLite (WatermelonDB)
2. **Sync Manager** → Monitors network connectivity
3. **Queue System** → Offline changes queued for sync
4. **Conflict Resolution** → Server timestamp wins
5. **Background Sync** → Automatic sync on app resume

### File Upload Process
1. **Client** → Request presigned S3 URL from API
2. **API** → Generate presigned URL with permissions
3. **Client** → Direct upload to S3
4. **Client** → Notify API of successful upload
5. **API** → Create attachment record in database

### Encryption Implementation
- **Sensitive Entries**: Client-side AES-256 encryption before storage
- **Encryption Keys**: Derived from user password + salt
- **File Encryption**: S3 server-side encryption (SSE-S3)
- **Transport Security**: TLS 1.3 for all communications

## Environment Setup Requirements

### Local Development
```bash
# Required services (via Docker)
- PostgreSQL 15
- Redis 7
- LocalStack (S3, SQS)

# Environment files needed
- /api/.env
- /web/.env
- /mobile/.env
```

### AWS Resources Required
- VPC with public/private subnets
- RDS Aurora PostgreSQL Serverless v2
- Lambda functions with API Gateway
- S3 buckets for files and static hosting
- CloudFront distributions
- Cognito User Pool
- ElastiCache Redis cluster

## Common Development Tasks

### Adding a New API Endpoint
1. Create route in `/api/src/routes/`
2. Add controller in `/api/src/controllers/`
3. Implement service logic in `/api/src/services/`
4. Add validation in `/api/src/validators/`
5. Update API documentation

### Adding a New Screen (Mobile)
1. Create screen component in `/mobile/src/screens/`
2. Add to navigation in `/mobile/src/navigation/`
3. Create slice in `/mobile/src/store/slices/`
4. Add offline support in database models
5. Implement sync logic

### Database Changes
1. Create migration: `pnpm knex migrate:make <name>`
2. Write up() and down() functions
3. Run migration: `pnpm migrate:latest`
4. Update TypeScript models
5. Update API endpoints if needed

## Testing Approach

### Unit Tests
- Jest + React Testing Library
- Mock external dependencies
- Test business logic isolation
- Snapshot tests for components

### Integration Tests
- Supertest for API endpoints
- Test database transactions
- Mock AWS services
- Test authentication flows

### E2E Tests
- Cypress for web app
- Detox for mobile apps
- Test critical user paths
- Run against staging environment

## Deployment Process

### API Deployment
```bash
cd api
pnpm build
pnpm test
pnpm deploy:prod
pnpm migrate:prod
```

### Web Deployment
```bash
cd web
pnpm build
pnpm test
pnpm deploy:prod
# CloudFront invalidation happens automatically
```

### Mobile Deployment
```bash
cd mobile
# iOS
cd ios && fastlane release
# Android
cd android && fastlane release
```

### Infrastructure Updates
```bash
cd infrastructure
pnpm build
cdk diff
cdk deploy --all
```

## Performance Considerations

### API Performance
- Lambda cold starts: ~500ms (use provisioned concurrency for critical endpoints)
- Database connections: Connection pooling with 10 max connections
- Average response time: <200ms for most endpoints
- File uploads: Direct to S3, bypassing Lambda

### Web Performance
- Initial bundle: ~250KB gzipped
- Code splitting by route
- Service worker for offline support
- Lazy loading for images and components

### Mobile Performance
- App size: ~45MB (iOS), ~35MB (Android)
- Startup time: <2s on modern devices
- Memory usage: ~150MB average
- Offline database: Optimized SQLite queries

## Security Checklist

- [ ] All inputs validated with Joi
- [ ] SQL injection prevented via parameterized queries
- [ ] XSS protection with React's built-in escaping
- [ ] CSRF tokens for state-changing operations
- [ ] Rate limiting on all endpoints
- [ ] Sensitive data encrypted at rest
- [ ] Audit logs for security events
- [ ] Regular dependency updates

## Troubleshooting Guide

### Common Issues

1. **"Cannot connect to database"**
   - Check Docker is running
   - Verify DATABASE_URL in .env
   - Check PostgreSQL logs

2. **"Authentication failed"**
   - Verify JWT_SECRET matches
   - Check token expiration
   - Clear browser/app storage

3. **"File upload failed"**
   - Check S3 bucket permissions
   - Verify CORS configuration
   - Check file size limits

4. **"Sync not working"**
   - Check network connectivity
   - Verify API endpoint accessibility
   - Check sync queue for errors

5. **"Build fails"**
   - Clear node_modules and reinstall
   - Check Node.js version (18+)
   - Verify all env variables set

## Next Steps & Future Features

### Immediate Priorities
1. Implement OpenSearch for advanced search
2. Add collaborative features
3. Improve mobile app performance
4. Add more AI-powered features
5. Implement data export options

### Technical Improvements
1. Migrate to GraphQL API
2. Implement event sourcing
3. Add real-time collaboration
4. Improve test coverage to 90%+
5. Implement API versioning

### Feature Roadmap
1. Web clipper browser extension
2. Desktop applications (Electron)
3. Apple Watch app
4. Voice transcription
5. OCR for image text extraction

## Contact & Support

- **GitHub**: [PersonalPod Repository]
- **Documentation**: /docs folder
- **Issues**: GitHub Issues
- **Email**: dev@personalpod.com

---

This context document should be provided to any developer continuing work on the PersonalPod project. It contains all essential information needed to understand the current state and continue development effectively.