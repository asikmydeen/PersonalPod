#!/bin/bash

# Deploy script for local development environment

set -e

echo "🚀 Starting PersonalPod local deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Generate SSL certificates if they don't exist
if [ ! -f "./nginx/ssl/localhost.crt" ]; then
    echo "🔐 Generating SSL certificates..."
    ./scripts/ssl/generate-certs.sh
fi

# Stop any running containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start containers
echo "🏗️  Building and starting containers..."
docker-compose up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run LocalStack setup
echo "☁️  Setting up LocalStack resources..."
./scripts/localstack/setup.sh

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose exec -T postgres psql -U personalpod -d personalpod_dev < ./scripts/db/init/01-create-extensions.sql

# Seed the database
echo "🌱 Seeding database..."
NODE_ENV=development npm run db:seed

echo "✅ Deployment complete!"
echo ""
echo "🌐 Application URLs:"
echo "   - API: https://localhost:3000"
echo "   - Nginx Proxy: https://localhost"
echo ""
echo "📊 Service URLs:"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo "   - Elasticsearch: http://localhost:9200"
echo "   - LocalStack: http://localhost:4566"
echo ""
echo "📝 Default credentials:"
echo "   - Admin: admin@example.com / Admin123!"
echo "   - User: user@example.com / User123!"
echo ""
echo "🔍 View logs: docker-compose logs -f"