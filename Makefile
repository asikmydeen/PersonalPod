.PHONY: help install dev dev-logs dev-down dev-clean test lint format deploy-local check-services reset-db backup-db

# Default target
help:
	@echo "PersonalPod Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install        - Install dependencies"
	@echo "  make dev           - Start development environment"
	@echo ""
	@echo "Development:"
	@echo "  make dev-logs      - View logs"
	@echo "  make dev-down      - Stop containers"
	@echo "  make dev-clean     - Stop and remove volumes"
	@echo "  make check-services - Check service health"
	@echo ""
	@echo "Database:"
	@echo "  make reset-db      - Reset database"
	@echo "  make backup-db     - Backup database"
	@echo "  make seed-db       - Seed database"
	@echo ""
	@echo "Code Quality:"
	@echo "  make test          - Run tests"
	@echo "  make lint          - Run linter"
	@echo "  make format        - Format code"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-local  - Full local deployment"
	@echo "  make deploy-dev    - Deploy to development"
	@echo "  make deploy-prod   - Deploy to production"

# Install dependencies
install:
	npm install

# Start development environment
dev:
	docker-compose up -d
	@echo "Waiting for services to start..."
	@sleep 10
	./scripts/localstack/setup.sh
	@echo ""
	@echo "Services started! Access at:"
	@echo "  - API: https://localhost:3000"
	@echo "  - PostgreSQL: localhost:5432"
	@echo "  - Redis: localhost:6379"
	@echo "  - Elasticsearch: http://localhost:9200"
	@echo "  - LocalStack: http://localhost:4566"

# View logs
dev-logs:
	docker-compose logs -f

# Stop containers
dev-down:
	docker-compose down

# Stop containers and remove volumes
dev-clean:
	docker-compose down -v

# Run tests
test:
	npm test

# Run linter
lint:
	npm run lint

# Format code
format:
	npm run format

# Full local deployment
deploy-local:
	./scripts/deploy-local.sh

# Check service health
check-services:
	./scripts/dev-utils.sh check

# Reset database
reset-db:
	./scripts/dev-utils.sh reset-db

# Backup database
backup-db:
	./scripts/dev-utils.sh backup-db

# Seed database
seed-db:
	npm run db:seed

# Deploy to development
deploy-dev:
	cd infrastructure && npm run deploy -- PersonalPod-dev-Stack

# Deploy to production (requires confirmation)
deploy-prod:
	@echo "⚠️  WARNING: This will deploy to production!"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read confirm
	cd infrastructure && npm run deploy -- PersonalPod-prod-Stack