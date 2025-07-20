#!/bin/bash

# PersonalPod Local Environment Testing Script
# This script performs comprehensive testing of all services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to print test header
print_header() {
    echo -e "\n${BLUE}===========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===========================================${NC}"
}

# Function to print test result
test_result() {
    local test_name=$1
    local result=$2
    local message=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "pass" ]; then
        echo -e "${GREEN}✓${NC} $test_name: ${GREEN}PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗${NC} $test_name: ${RED}FAILED${NC} - $message"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to wait for service
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Waiting for $service to be ready"
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}✗${NC}"
    return 1
}

# Main testing script
main() {
    print_header "PersonalPod Local Environment Test Suite"
    echo "Test started at: $(date)"
    
    # Check Docker installation
    print_header "1. Docker Installation Check"
    if command -v docker &> /dev/null; then
        test_result "Docker installed" "pass"
        echo "Docker version: $(docker --version)"
    else
        test_result "Docker installed" "fail" "Docker not found"
        echo -e "${RED}Please install Docker before running this test${NC}"
        exit 1
    fi
    
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null 2>&1; then
        test_result "Docker Compose installed" "pass"
    else
        test_result "Docker Compose installed" "fail" "Docker Compose not found"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if docker ps &> /dev/null; then
        test_result "Docker daemon running" "pass"
    else
        test_result "Docker daemon running" "fail" "Docker daemon not responding"
        echo -e "${YELLOW}Please start Docker Desktop${NC}"
        exit 1
    fi
    
    # Generate SSL certificates if needed
    print_header "2. SSL Certificate Generation"
    if [ ! -f "./nginx/ssl/localhost.crt" ] || [ ! -f "./nginx/ssl/localhost.key" ]; then
        echo "Generating SSL certificates..."
        ./scripts/ssl/generate-certs.sh
        if [ $? -eq 0 ]; then
            test_result "SSL certificates generated" "pass"
        else
            test_result "SSL certificates generated" "fail" "Certificate generation failed"
        fi
    else
        test_result "SSL certificates exist" "pass"
    fi
    
    # Start Docker containers
    print_header "3. Starting Docker Containers"
    echo "Starting Docker containers..."
    docker-compose up -d
    if [ $? -eq 0 ]; then
        test_result "Docker containers started" "pass"
    else
        test_result "Docker containers started" "fail" "docker-compose up failed"
        exit 1
    fi
    
    # Wait for services to be ready
    print_header "4. Service Health Checks"
    
    # PostgreSQL
    echo -e "\n${YELLOW}Testing PostgreSQL...${NC}"
    if wait_for_service "PostgreSQL" "localhost:5432"; then
        # Test database connection
        docker-compose exec -T postgres pg_isready -U personalpod > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            test_result "PostgreSQL connection" "pass"
        else
            test_result "PostgreSQL connection" "fail" "pg_isready failed"
        fi
    else
        test_result "PostgreSQL availability" "fail" "Service not responding"
    fi
    
    # Redis
    echo -e "\n${YELLOW}Testing Redis...${NC}"
    docker-compose exec -T redis redis-cli ping > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        test_result "Redis connection" "pass"
        
        # Test Redis write/read
        docker-compose exec -T redis redis-cli SET test_key "test_value" > /dev/null 2>&1
        value=$(docker-compose exec -T redis redis-cli GET test_key 2>/dev/null | tr -d '\r')
        if [ "$value" = "test_value" ]; then
            test_result "Redis write/read" "pass"
        else
            test_result "Redis write/read" "fail" "Could not write/read test data"
        fi
    else
        test_result "Redis connection" "fail" "redis-cli ping failed"
    fi
    
    # Elasticsearch
    echo -e "\n${YELLOW}Testing Elasticsearch...${NC}"
    if wait_for_service "Elasticsearch" "http://localhost:9200"; then
        # Check cluster health
        health=$(curl -s http://localhost:9200/_cluster/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$health" = "yellow" ] || [ "$health" = "green" ]; then
            test_result "Elasticsearch cluster health" "pass"
        else
            test_result "Elasticsearch cluster health" "fail" "Cluster status: $health"
        fi
    else
        test_result "Elasticsearch availability" "fail" "Service not responding"
    fi
    
    # LocalStack
    echo -e "\n${YELLOW}Testing LocalStack...${NC}"
    if wait_for_service "LocalStack" "http://localhost:4566/_localstack/health"; then
        test_result "LocalStack health check" "pass"
        
        # Run LocalStack setup
        echo "Running LocalStack setup..."
        ./scripts/localstack/setup.sh > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            test_result "LocalStack setup" "pass"
            
            # Test S3
            export AWS_ACCESS_KEY_ID=test
            export AWS_SECRET_ACCESS_KEY=test
            export AWS_DEFAULT_REGION=us-east-1
            
            aws --endpoint-url=http://localhost:4566 s3 ls > /dev/null 2>&1
            if [ $? -eq 0 ]; then
                test_result "LocalStack S3 service" "pass"
            else
                test_result "LocalStack S3 service" "fail" "S3 list failed"
            fi
        else
            test_result "LocalStack setup" "fail" "Setup script failed"
        fi
    else
        test_result "LocalStack availability" "fail" "Service not responding"
    fi
    
    # API Service
    echo -e "\n${YELLOW}Testing API Service...${NC}"
    if wait_for_service "API" "http://localhost:3000/health"; then
        test_result "API health check" "pass"
    else
        test_result "API health check" "fail" "Service not responding"
    fi
    
    # Nginx
    echo -e "\n${YELLOW}Testing Nginx...${NC}"
    if wait_for_service "Nginx" "http://localhost/health"; then
        test_result "Nginx HTTP health check" "pass"
    else
        test_result "Nginx HTTP health check" "fail" "Service not responding"
    fi
    
    # Test HTTPS redirect
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/)
    if [ "$response" = "301" ]; then
        test_result "Nginx HTTPS redirect" "pass"
    else
        test_result "Nginx HTTPS redirect" "fail" "Expected 301, got $response"
    fi
    
    # Container status check
    print_header "5. Container Status"
    docker-compose ps
    
    # Log check for errors
    print_header "6. Error Log Check"
    echo "Checking for errors in container logs..."
    error_count=$(docker-compose logs | grep -i "error" | grep -v "error_log" | wc -l)
    if [ "$error_count" -eq 0 ]; then
        test_result "No errors in logs" "pass"
    else
        test_result "No errors in logs" "fail" "$error_count errors found"
        echo -e "${YELLOW}Run 'docker-compose logs' to view full logs${NC}"
    fi
    
    # Summary
    print_header "Test Summary"
    echo -e "Total tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}All tests passed! Your development environment is ready.${NC}"
        echo -e "\nYou can access:"
        echo -e "  - API: ${BLUE}https://localhost:3000${NC}"
        echo -e "  - PostgreSQL: ${BLUE}localhost:5432${NC}"
        echo -e "  - Redis: ${BLUE}localhost:6379${NC}"
        echo -e "  - Elasticsearch: ${BLUE}http://localhost:9200${NC}"
        echo -e "  - LocalStack: ${BLUE}http://localhost:4566${NC}"
    else
        echo -e "\n${RED}Some tests failed. Please check the errors above.${NC}"
        echo -e "\nTroubleshooting tips:"
        echo -e "  - Run '${YELLOW}docker-compose logs [service-name]${NC}' to view specific service logs"
        echo -e "  - Run '${YELLOW}docker-compose down${NC}' and try again"
        echo -e "  - Check if ports are already in use: ${YELLOW}lsof -i :5432,6379,9200,4566,3000,80,443${NC}"
    fi
    
    echo -e "\nTest completed at: $(date)"
}

# Run main function
main "$@"