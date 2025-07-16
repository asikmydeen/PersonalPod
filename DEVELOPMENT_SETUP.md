# PersonalPod Development Environment Setup

This guide provides comprehensive instructions for setting up the PersonalPod development environment.

## Prerequisites

- Docker Desktop (latest version)
- Node.js 18+ and npm 9+
- Git
- AWS CLI (optional, for deployment)
- VS Code (recommended)

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/PersonalPod.git
   cd PersonalPod
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Copy environment files:**
   ```bash
   cp .env.example .env.development
   ```

4. **Start the development environment:**
   ```bash
   ./scripts/deploy-local.sh
   ```

This will:
- Generate SSL certificates
- Start all Docker containers
- Set up LocalStack resources
- Run database migrations
- Seed the database with test data

## Architecture Overview

### Services

1. **API Service** (Port 3000)
   - Node.js/TypeScript application
   - RESTful API with JWT authentication
   - WebSocket support

2. **PostgreSQL** (Port 5432)
   - Primary database
   - Extensions: uuid-ossp, pgcrypto, pg_trgm

3. **Redis** (Port 6379)
   - Session storage
   - Caching layer
   - Real-time features

4. **Elasticsearch** (Port 9200)
   - Full-text search
   - Log aggregation

5. **LocalStack** (Port 4566)
   - AWS service emulation
   - S3, DynamoDB, SQS, SNS, SES

6. **Nginx** (Ports 80, 443)
   - Reverse proxy
   - SSL termination
   - Load balancing

## Development Workflow

### Running Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Stop all services
docker-compose down

# Reset everything (including volumes)
docker-compose down -v
```

### Database Management

```bash
# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Reset database
./scripts/dev-utils.sh reset-db

# Backup database
./scripts/dev-utils.sh backup-db

# Restore database
./scripts/dev-utils.sh restore-db backup_20231215_120000.sql
```

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Git Workflow

The project uses conventional commits enforced by commitlint:

```bash
# Valid commit types
feat: New feature
fix: Bug fix
docs: Documentation changes
style: Code style changes
refactor: Code refactoring
perf: Performance improvements
test: Test changes
build: Build system changes
ci: CI/CD changes
chore: Other changes
```

Example:
```bash
git commit -m "feat: add user authentication endpoint"
```

## Environment Variables

### Application Settings
- `NODE_ENV`: Environment (development/test/production)
- `APP_PORT`: Application port
- `APP_URL`: Application URL
- `API_PREFIX`: API route prefix

### Database
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name

### Redis
- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port
- `REDIS_PASSWORD`: Redis password (optional)

### AWS/LocalStack
- `AWS_REGION`: AWS region
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_ENDPOINT`: LocalStack endpoint (development only)

## VS Code Setup

1. Install recommended extensions:
   ```bash
   code --install-extension dbaeumer.vscode-eslint
   code --install-extension esbenp.prettier-vscode
   # ... (see .vscode/extensions.json for full list)
   ```

2. The project includes:
   - ESLint configuration
   - Prettier configuration
   - Debug configurations
   - Workspace settings

## Debugging

### API Debugging

1. Set breakpoints in your TypeScript code
2. Press F5 or go to Run > Start Debugging
3. Select "Debug API" configuration

### Test Debugging

1. Set breakpoints in test files
2. Press F5 and select "Debug Jest Tests"
3. Or debug current test file with "Debug Current Test File"

## Utilities

The `dev-utils.sh` script provides helpful commands:

```bash
# Check service health
./scripts/dev-utils.sh check

# Tail logs for specific service
./scripts/dev-utils.sh logs api

# Reset database
./scripts/dev-utils.sh reset-db

# Backup database
./scripts/dev-utils.sh backup-db

# Restore database
./scripts/dev-utils.sh restore-db backup_file.sql

# Clean up Docker resources
./scripts/dev-utils.sh cleanup
```

## SSL Certificates

Local development uses self-signed SSL certificates:

```bash
# Generate new certificates
./scripts/ssl/generate-certs.sh
```

The certificates are valid for:
- localhost
- *.localhost
- personalpod.local
- *.personalpod.local

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- user.test.ts

# Run tests in watch mode
npm run test:watch
```

## Deployment

### Development Deployment

Automatic deployment via GitHub Actions when pushing to `develop` branch.

### Production Deployment

1. Merge to `main` branch
2. GitHub Actions will:
   - Run tests
   - Build Docker images
   - Push to ECR
   - Deploy to ECS

### Manual Deployment

```bash
# Deploy infrastructure
cd infrastructure
npm run deploy

# Deploy specific stack
npm run deploy -- PersonalPod-dev-Stack
```

## Troubleshooting

### Port Conflicts

If you get port binding errors:

```bash
# Find process using port
lsof -i :5432

# Kill process
kill -9 <PID>
```

### Docker Issues

```bash
# Reset Docker
docker system prune -a --volumes

# Rebuild containers
docker-compose build --no-cache
```

### Database Connection Issues

1. Check if PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   ```

2. Check logs:
   ```bash
   docker-compose logs postgres
   ```

3. Test connection:
   ```bash
   docker-compose exec postgres pg_isready
   ```

### LocalStack Issues

1. Check LocalStack health:
   ```bash
   curl http://localhost:4566/_localstack/health
   ```

2. Re-run setup script:
   ```bash
   ./scripts/localstack/setup.sh
   ```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Elasticsearch Documentation](https://www.elastic.co/guide/)