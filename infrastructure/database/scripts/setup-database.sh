#!/bin/bash

# PersonalPod Database Setup Script
# This script helps set up the PostgreSQL database for PersonalPod

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="personalpod"
DB_USER="postgres"
ENVIRONMENT="dev"

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -h, --host       Database host (default: localhost)"
    echo "  -p, --port       Database port (default: 5432)"
    echo "  -d, --database   Database name (default: personalpod)"
    echo "  -u, --user       Database user (default: postgres)"
    echo "  -e, --env        Environment (dev/prod) (default: dev)"
    echo "  --skip-sample    Skip sample data insertion"
    echo "  --help           Show this help message"
    exit 1
}

# Parse command line arguments
SKIP_SAMPLE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            DB_HOST="$2"
            shift 2
            ;;
        -p|--port)
            DB_PORT="$2"
            shift 2
            ;;
        -d|--database)
            DB_NAME="$2"
            shift 2
            ;;
        -u|--user)
            DB_USER="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-sample)
            SKIP_SAMPLE=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    print_color $RED "Error: Environment must be 'dev' or 'prod'"
    exit 1
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

print_color $GREEN "PersonalPod Database Setup"
print_color $GREEN "========================="
echo ""
print_color $YELLOW "Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Environment: $ENVIRONMENT"
echo "  Skip Sample Data: $SKIP_SAMPLE"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    print_color $RED "Error: psql command not found. Please install PostgreSQL client."
    exit 1
fi

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    print_color $RED "Error: Migrations directory not found at $MIGRATIONS_DIR"
    exit 1
fi

# Prompt for password
print_color $YELLOW "Enter password for database user $DB_USER:"
read -s DB_PASSWORD
echo ""

# Test database connection
print_color $YELLOW "Testing database connection..."
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c '\q' 2>/dev/null; then
    print_color $GREEN "✓ Database connection successful"
else
    print_color $RED "✗ Failed to connect to database"
    exit 1
fi

# Create database if it doesn't exist
print_color $YELLOW "Creating database if it doesn't exist..."
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
    print_color $GREEN "✓ Database '$DB_NAME' already exists"
else
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME"; then
        print_color $GREEN "✓ Database '$DB_NAME' created successfully"
    else
        print_color $RED "✗ Failed to create database"
        exit 1
    fi
fi

# Function to run a migration
run_migration() {
    local migration_file=$1
    local migration_name=$(basename $migration_file)
    
    print_color $YELLOW "Running migration: $migration_name"
    
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file" > /dev/null 2>&1; then
        print_color $GREEN "✓ $migration_name completed successfully"
        return 0
    else
        print_color $RED "✗ $migration_name failed"
        return 1
    fi
}

# Run migrations in order
print_color $YELLOW "\nRunning database migrations..."

# Run core migrations
if ! run_migration "$MIGRATIONS_DIR/001_initial_schema.sql"; then
    print_color $RED "Failed to run initial schema migration. Exiting."
    exit 1
fi

if ! run_migration "$MIGRATIONS_DIR/002_create_indexes.sql"; then
    print_color $RED "Failed to create indexes. Exiting."
    exit 1
fi

if ! run_migration "$MIGRATIONS_DIR/003_create_triggers.sql"; then
    print_color $RED "Failed to create triggers. Exiting."
    exit 1
fi

# Run sample data migration only in dev and if not skipped
if [[ "$ENVIRONMENT" == "dev" && "$SKIP_SAMPLE" == false ]]; then
    print_color $YELLOW "\nInserting sample data for development..."
    if run_migration "$MIGRATIONS_DIR/004_sample_data.sql"; then
        print_color $GREEN "✓ Sample data inserted successfully"
    else
        print_color $YELLOW "⚠ Sample data insertion failed (may already exist)"
    fi
elif [[ "$ENVIRONMENT" == "dev" && "$SKIP_SAMPLE" == true ]]; then
    print_color $YELLOW "Skipping sample data insertion"
fi

# Verify installation
print_color $YELLOW "\nVerifying database setup..."

# Check tables
TABLE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
print_color $GREEN "✓ Created $TABLE_COUNT tables"

# Check if sample data was inserted (in dev mode)
if [[ "$ENVIRONMENT" == "dev" && "$SKIP_SAMPLE" == false ]]; then
    USER_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users")
    ENTRY_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM entries")
    print_color $GREEN "✓ Sample data: $USER_COUNT users, $ENTRY_COUNT entries"
fi

print_color $GREEN "\n✅ Database setup completed successfully!"

# Print connection string
print_color $YELLOW "\nConnection string for your application:"
echo "postgresql://$DB_USER:[PASSWORD]@$DB_HOST:$DB_PORT/$DB_NAME"

# Print next steps
print_color $YELLOW "\nNext steps:"
echo "1. Update your application configuration with the database connection details"
echo "2. Set up environment variables for database credentials"
if [[ "$ENVIRONMENT" == "prod" ]]; then
    echo "3. Configure database backups and monitoring"
    echo "4. Set up read replicas if needed"
fi

exit 0