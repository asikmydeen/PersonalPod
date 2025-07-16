# PersonalPod Database

This directory contains the complete database schema design for PersonalPod, including both PostgreSQL and DynamoDB schemas.

## Directory Structure

```
database/
├── postgresql/           # PostgreSQL schema and types
│   ├── schema.sql       # Complete schema definition
│   └── types.ts         # TypeScript type definitions
├── dynamodb/            # DynamoDB table definitions
│   ├── table-definitions.ts  # Table structure definitions
│   ├── create-tables.ts      # CDK table creation script
│   └── sample-data.json      # Sample data for testing
├── migrations/          # SQL migration files
│   ├── 001_initial_schema.sql
│   ├── 002_create_indexes.sql
│   ├── 003_create_triggers.sql
│   └── 004_sample_data.sql
├── docs/               # Documentation
│   ├── README.md       # Comprehensive documentation
│   └── relationships.md # Entity relationships
└── scripts/            # Utility scripts
    └── setup-database.sh # Database setup script
```

## Quick Start

### PostgreSQL Setup

1. **Local Development**:
   ```bash
   cd database/scripts
   ./setup-database.sh --host localhost --database personalpod_dev --user postgres --env dev
   ```

2. **Production (RDS)**:
   ```bash
   ./setup-database.sh --host your-rds-endpoint.amazonaws.com --database personalpod --user postgres --env prod --skip-sample
   ```

### DynamoDB Setup

DynamoDB tables are created automatically when you deploy the CDK stack:

```bash
cd ../.. # Go to infrastructure root
npm run deploy
```

## Database Architecture

### PostgreSQL (Primary Data Store)
- **Purpose**: Store all user data, relationships, and metadata
- **Tables**: 10 core tables with full referential integrity
- **Features**: Full-text search, triggers, automatic timestamps

### DynamoDB (Performance Layer)
- **Purpose**: High-performance caching and real-time operations
- **Tables**: 4 specialized tables
- **Features**: Millisecond latency, automatic scaling, TTL support

## Key Features

1. **Multi-tenant Architecture**: Complete data isolation per user
2. **Polymorphic Content**: Single table for all content types
3. **Hierarchical Categories**: Nested category support
4. **Full-text Search**: PostgreSQL tsvector with GIN indexes
5. **Audit Trail**: Automatic activity logging
6. **Sharing System**: Granular permissions and token-based sharing
7. **Performance Optimization**: Strategic indexes and caching layer
8. **Type Safety**: Complete TypeScript definitions

## Migration Management

Migrations are numbered and should be run in order:
1. `001_initial_schema.sql` - Creates all tables and types
2. `002_create_indexes.sql` - Adds performance indexes
3. `003_create_triggers.sql` - Sets up automatic behaviors
4. `004_sample_data.sql` - Adds test data (dev only)

## Security Considerations

- Encrypted content storage for sensitive data
- Row-level security through foreign keys
- Automatic audit logging
- Token-based sharing with expiration
- Prepared statements to prevent SQL injection

## Performance Optimization

- Strategic indexes on all foreign keys and common queries
- DynamoDB caching for frequently accessed data
- Search vector pre-computation
- Connection pooling via RDS Proxy
- Efficient pagination support

## Development Tips

1. Always run migrations in order
2. Use the provided TypeScript types for type safety
3. Test with sample data before production
4. Monitor slow queries and adjust indexes as needed
5. Use DynamoDB for read-heavy operations

## Related Documentation

- [Comprehensive Schema Documentation](./docs/README.md)
- [Entity Relationships](./docs/relationships.md)
- [API Integration Guide](../lib/constructs/api-construct.ts)