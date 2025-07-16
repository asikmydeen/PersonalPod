#!/bin/bash

# Deploy script for PersonalPod CDK infrastructure
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-dev}

echo -e "${YELLOW}Deploying PersonalPod infrastructure to ${ENVIRONMENT} environment${NC}"

# Check if AWS credentials are configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Run tests
echo -e "${YELLOW}Running tests...${NC}"
npm test

# Build the project
echo -e "${YELLOW}Building project...${NC}"
npm run build

# Bootstrap CDK if needed
echo -e "${YELLOW}Checking CDK bootstrap...${NC}"
npx cdk bootstrap

# Synthesize the stack
echo -e "${YELLOW}Synthesizing stack...${NC}"
npx cdk synth -c environment=$ENVIRONMENT

# Deploy the stack
echo -e "${YELLOW}Deploying stack...${NC}"
npx cdk deploy -c environment=$ENVIRONMENT --require-approval never

echo -e "${GREEN}Deployment complete!${NC}"