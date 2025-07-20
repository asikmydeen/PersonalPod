#!/bin/bash

# Docker Installation Check Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Docker Installation Check${NC}"
echo "========================="

# Check for Docker
echo -n "Checking for Docker... "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}Found${NC}"
    docker --version
else
    echo -e "${RED}Not found${NC}"
    echo -e "\n${YELLOW}Docker is not installed. Please install Docker Desktop for Mac:${NC}"
    echo "1. Visit: https://www.docker.com/products/docker-desktop"
    echo "2. Download Docker Desktop for Mac"
    echo "3. Install and start Docker Desktop"
    echo "4. Run this script again"
    exit 1
fi

# Check for Docker Compose
echo -n "Checking for Docker Compose... "
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}Found (standalone)${NC}"
    docker-compose --version
elif docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}Found (plugin)${NC}"
    docker compose version
else
    echo -e "${RED}Not found${NC}"
    echo -e "\n${YELLOW}Docker Compose is not available${NC}"
    exit 1
fi

# Check if Docker daemon is running
echo -n "Checking Docker daemon... "
if docker ps &> /dev/null; then
    echo -e "${GREEN}Running${NC}"
else
    echo -e "${RED}Not running${NC}"
    echo -e "\n${YELLOW}Docker daemon is not running. Please:${NC}"
    echo "1. Open Docker Desktop application"
    echo "2. Wait for Docker to start"
    echo "3. Run this script again"
    exit 1
fi

# Check Docker resources
echo -e "\n${BLUE}Docker System Information:${NC}"
docker system df

echo -e "\n${GREEN}✓ Docker is properly installed and running!${NC}"
echo -e "\nYou can now run: ${YELLOW}make dev${NC} to start the development environment"