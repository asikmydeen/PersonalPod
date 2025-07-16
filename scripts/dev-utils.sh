#!/bin/bash

# Development utility functions

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a service is healthy
check_service() {
    local service=$1
    local url=$2
    
    echo -n "Checking $service... "
    if curl -f -s "$url" > /dev/null; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Not responding${NC}"
        return 1
    fi
}

# Function to check all services
check_all_services() {
    echo "🔍 Checking service health..."
    check_service "API" "http://localhost:3000/health"
    check_service "PostgreSQL" "localhost:5432" || docker-compose exec postgres pg_isready
    check_service "Redis" "localhost:6379" || docker-compose exec redis redis-cli ping
    check_service "Elasticsearch" "http://localhost:9200/_cluster/health"
    check_service "LocalStack" "http://localhost:4566/_localstack/health"
}

# Function to tail logs for a specific service
tail_logs() {
    local service=$1
    docker-compose logs -f "$service"
}

# Function to reset database
reset_database() {
    echo "⚠️  This will delete all data in the database!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose exec postgres psql -U personalpod -c "DROP DATABASE IF EXISTS personalpod_dev;"
        docker-compose exec postgres psql -U personalpod -c "CREATE DATABASE personalpod_dev;"
        docker-compose exec postgres psql -U personalpod -d personalpod_dev < ./scripts/db/init/01-create-extensions.sql
        npm run db:seed
        echo -e "${GREEN}✓ Database reset complete${NC}"
    fi
}

# Function to backup database
backup_database() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="backup_${timestamp}.sql"
    
    echo "📦 Creating database backup..."
    docker-compose exec -T postgres pg_dump -U personalpod personalpod_dev > "./backups/$backup_file"
    echo -e "${GREEN}✓ Backup saved to ./backups/$backup_file${NC}"
}

# Function to restore database
restore_database() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        echo "Please specify a backup file"
        echo "Available backups:"
        ls -la ./backups/*.sql
        return 1
    fi
    
    echo "⚠️  This will replace the current database!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose exec -T postgres psql -U personalpod personalpod_dev < "$backup_file"
        echo -e "${GREEN}✓ Database restored from $backup_file${NC}"
    fi
}

# Function to clean up Docker resources
cleanup_docker() {
    echo "🧹 Cleaning up Docker resources..."
    docker-compose down -v
    docker system prune -f
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Main menu
case "$1" in
    check)
        check_all_services
        ;;
    logs)
        tail_logs "$2"
        ;;
    reset-db)
        reset_database
        ;;
    backup-db)
        backup_database
        ;;
    restore-db)
        restore_database "$2"
        ;;
    cleanup)
        cleanup_docker
        ;;
    *)
        echo "PersonalPod Development Utilities"
        echo ""
        echo "Usage: $0 {check|logs|reset-db|backup-db|restore-db|cleanup}"
        echo ""
        echo "Commands:"
        echo "  check          - Check health of all services"
        echo "  logs [service] - Tail logs for a specific service"
        echo "  reset-db       - Reset the database (WARNING: deletes all data)"
        echo "  backup-db      - Create a database backup"
        echo "  restore-db [file] - Restore database from backup"
        echo "  cleanup        - Clean up Docker resources"
        ;;
esac