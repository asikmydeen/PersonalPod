#!/bin/bash

# Enhanced deployment script for PersonalPod Dev Environment
set -euo pipefail

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$INFRA_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="dev"
STACK_NAME="PersonalPod-${ENVIRONMENT}-Stack"
LOG_FILE="${INFRA_DIR}/logs/deploy-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p "${INFRA_DIR}/logs"

# Logging function
log() {
    echo -e "${1}" | tee -a "${LOG_FILE}"
}

# Error handler
error_exit() {
    log "${RED}Error: $1${NC}"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "${BLUE}Checking prerequisites...${NC}"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error_exit "AWS CLI is not installed. Please install it first."
    fi
    log "${GREEN}✓ AWS CLI found: $(aws --version)${NC}"
    
    # Check CDK CLI
    if ! command -v cdk &> /dev/null; then
        error_exit "AWS CDK is not installed. Please run: npm install -g aws-cdk"
    fi
    log "${GREEN}✓ CDK found: $(cdk --version)${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed."
    fi
    log "${GREEN}✓ Node.js found: $(node --version)${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed. It's required for Lambda builds."
    fi
    log "${GREEN}✓ Docker found: $(docker --version)${NC}"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error_exit "AWS credentials not configured. Please run: aws configure"
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local region=$(aws configure get region || echo "eu-west-1")
    log "${GREEN}✓ AWS credentials configured${NC}"
    log "  Account: ${account_id}"
    log "  Region: ${region}"
}

# Build API
build_api() {
    log "${BLUE}Building API...${NC}"
    
    cd "${PROJECT_ROOT}/api"
    
    # Install dependencies
    if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
        log "Installing API dependencies..."
        npm ci || npm install
    fi
    
    # Build TypeScript
    log "Compiling TypeScript..."
    npm run build
    
    # Verify build
    if [ ! -d "dist" ]; then
        error_exit "API build failed - dist directory not found"
    fi
    
    log "${GREEN}✓ API build completed${NC}"
    cd "${INFRA_DIR}"
}

# Install infrastructure dependencies
install_dependencies() {
    log "${BLUE}Installing infrastructure dependencies...${NC}"
    
    cd "${INFRA_DIR}"
    
    if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
        npm ci || npm install
    fi
    
    log "${GREEN}✓ Dependencies installed${NC}"
}

# Run tests
run_tests() {
    log "${BLUE}Running tests...${NC}"
    
    cd "${INFRA_DIR}"
    
    if npm test; then
        log "${GREEN}✓ All tests passed${NC}"
    else
        error_exit "Tests failed. Please fix before deploying."
    fi
}

# Bootstrap CDK
bootstrap_cdk() {
    log "${BLUE}Checking CDK bootstrap...${NC}"
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local region=$(aws configure get region || echo "eu-west-1")
    
    # Check if already bootstrapped
    if aws cloudformation describe-stacks --stack-name CDKToolkit --region ${region} &> /dev/null; then
        log "${GREEN}✓ CDK already bootstrapped${NC}"
    else
        log "Bootstrapping CDK..."
        cdk bootstrap "aws://${account_id}/${region}" || error_exit "CDK bootstrap failed"
        log "${GREEN}✓ CDK bootstrap completed${NC}"
    fi
}

# Synthesize stack
synthesize_stack() {
    log "${BLUE}Synthesizing CloudFormation template...${NC}"
    
    cd "${INFRA_DIR}"
    
    # Clean previous synthesis
    rm -rf cdk.out
    
    # Synthesize
    if ! cdk synth -c environment=${ENVIRONMENT} --quiet; then
        error_exit "CDK synthesis failed"
    fi
    
    # Check output
    if [ ! -f "cdk.out/${STACK_NAME}.template.json" ]; then
        error_exit "CloudFormation template not generated"
    fi
    
    log "${GREEN}✓ Stack synthesized successfully${NC}"
    
    # Show resource summary
    log "${BLUE}Resources to be created:${NC}"
    jq -r '.Resources | to_entries | group_by(.value.Type) | .[] | "\(.[0].value.Type): \(length)"' \
        "cdk.out/${STACK_NAME}.template.json" | sort | while read line; do
        log "  $line"
    done
}

# Deploy stack
deploy_stack() {
    log "${BLUE}Deploying stack to AWS...${NC}"
    
    cd "${INFRA_DIR}"
    
    # Deploy with progress
    if cdk deploy -c environment=${ENVIRONMENT} \
        --require-approval never \
        --outputs-file "cdk.out/${ENVIRONMENT}-outputs.json"; then
        log "${GREEN}✓ Stack deployed successfully${NC}"
    else
        error_exit "Stack deployment failed"
    fi
}

# Display outputs
display_outputs() {
    log "${BLUE}Stack Outputs:${NC}"
    
    local outputs_file="${INFRA_DIR}/cdk.out/${ENVIRONMENT}-outputs.json"
    
    if [ -f "$outputs_file" ]; then
        # Parse and display outputs
        jq -r --arg stack "$STACK_NAME" \
            '.[$stack] | to_entries | .[] | "  \(.key): \(.value)"' \
            "$outputs_file" | while read line; do
            log "$line"
        done
        
        # Save outputs to separate file
        cp "$outputs_file" "${INFRA_DIR}/logs/${ENVIRONMENT}-outputs-latest.json"
    else
        log "${YELLOW}Warning: Outputs file not found${NC}"
    fi
}

# Main deployment flow
main() {
    log "${YELLOW}========================================${NC}"
    log "${YELLOW}PersonalPod Dev Environment Deployment${NC}"
    log "${YELLOW}========================================${NC}"
    log "Timestamp: $(date)"
    log "Environment: ${ENVIRONMENT}"
    log "Stack Name: ${STACK_NAME}"
    log ""
    
    # Run deployment steps
    check_prerequisites
    build_api
    install_dependencies
    run_tests
    bootstrap_cdk
    synthesize_stack
    
    # Confirm deployment
    log ""
    log "${YELLOW}Ready to deploy. This will create AWS resources that may incur costs.${NC}"
    read -p "Continue with deployment? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "${RED}Deployment cancelled${NC}"
        exit 0
    fi
    
    deploy_stack
    display_outputs
    
    log ""
    log "${GREEN}========================================${NC}"
    log "${GREEN}Deployment completed successfully!${NC}"
    log "${GREEN}========================================${NC}"
    log ""
    log "Log file: ${LOG_FILE}"
    log "Outputs saved to: ${INFRA_DIR}/logs/${ENVIRONMENT}-outputs-latest.json"
    log ""
    log "Next steps:"
    log "  1. Run validation: ./validate-deployment.sh ${ENVIRONMENT}"
    log "  2. Check CloudWatch logs for any errors"
    log "  3. Test the API endpoints"
}

# Run main function
main "$@"