#!/bin/bash

# Cleanup script for PersonalPod AWS resources
set -euo pipefail

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-dev}"
STACK_NAME="PersonalPod-${ENVIRONMENT}-Stack"
CLEANUP_LOG="${INFRA_DIR}/logs/cleanup-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p "${INFRA_DIR}/logs"

# Logging function
log() {
    echo -e "${1}" | tee -a "${CLEANUP_LOG}"
}

# Error handler
error_exit() {
    log "${RED}Error: $1${NC}"
    exit 1
}

# Get stack output value
get_stack_output() {
    local output_key="$1"
    aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

# Check if stack exists
check_stack_exists() {
    if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Empty S3 bucket
empty_s3_bucket() {
    local bucket_name="$1"
    
    log "${BLUE}Emptying S3 bucket: ${bucket_name}...${NC}"
    
    # Check if bucket exists
    if ! aws s3api head-bucket --bucket "${bucket_name}" &> /dev/null; then
        log "${YELLOW}Bucket ${bucket_name} does not exist or is not accessible${NC}"
        return 0
    fi
    
    # Delete all objects
    log "  Deleting objects..."
    aws s3 rm "s3://${bucket_name}" --recursive 2>/dev/null || true
    
    # Delete all object versions (if versioning is enabled)
    log "  Deleting object versions..."
    local versions=$(aws s3api list-object-versions \
        --bucket "${bucket_name}" \
        --output json \
        --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
        2>/dev/null || echo '{"Objects": []}')
    
    if [[ $(echo "$versions" | jq '.Objects | length') -gt 0 ]]; then
        aws s3api delete-objects \
            --bucket "${bucket_name}" \
            --delete "$versions" \
            2>/dev/null || true
    fi
    
    # Delete all delete markers
    log "  Deleting delete markers..."
    local markers=$(aws s3api list-object-versions \
        --bucket "${bucket_name}" \
        --output json \
        --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
        2>/dev/null || echo '{"Objects": []}')
    
    if [[ $(echo "$markers" | jq '.Objects | length') -gt 0 ]]; then
        aws s3api delete-objects \
            --bucket "${bucket_name}" \
            --delete "$markers" \
            2>/dev/null || true
    fi
    
    log "${GREEN}✓ Bucket ${bucket_name} emptied${NC}"
}

# Delete Cognito users
delete_cognito_users() {
    local user_pool_id="$1"
    
    log "${BLUE}Deleting Cognito users from pool: ${user_pool_id}...${NC}"
    
    # List all users
    local users=$(aws cognito-idp list-users \
        --user-pool-id "${user_pool_id}" \
        --query 'Users[].Username' \
        --output json 2>/dev/null || echo '[]')
    
    local user_count=$(echo "$users" | jq '. | length')
    
    if [[ $user_count -gt 0 ]]; then
        log "  Found ${user_count} users to delete"
        
        # Delete each user
        echo "$users" | jq -r '.[]' | while read username; do
            log "  Deleting user: ${username}"
            aws cognito-idp admin-delete-user \
                --user-pool-id "${user_pool_id}" \
                --username "${username}" \
                2>/dev/null || true
        done
    else
        log "  No users found"
    fi
    
    log "${GREEN}✓ Cognito users deleted${NC}"
}

# Main cleanup function
cleanup_resources() {
    log "${YELLOW}========================================${NC}"
    log "${YELLOW}PersonalPod Resource Cleanup${NC}"
    log "${YELLOW}========================================${NC}"
    log "Environment: ${ENVIRONMENT}"
    log "Stack Name: ${STACK_NAME}"
    log "Timestamp: $(date)"
    log ""
    
    # Check if stack exists
    if ! check_stack_exists; then
        log "${YELLOW}Stack ${STACK_NAME} does not exist. Nothing to clean up.${NC}"
        exit 0
    fi
    
    # Get resource information before deletion
    log "${BLUE}Getting resource information...${NC}"
    local bucket_name=$(get_stack_output "AssetsBucketName")
    local user_pool_id=$(get_stack_output "UserPoolId")
    
    # Warning message
    log ""
    log "${RED}WARNING: This will permanently delete all resources!${NC}"
    log "${RED}The following resources will be deleted:${NC}"
    log "  - CloudFormation Stack: ${STACK_NAME}"
    log "  - S3 Bucket: ${bucket_name}"
    log "  - DynamoDB Table: PersonalPod-UserData-${ENVIRONMENT}"
    log "  - Lambda Function: PersonalPod-Api-${ENVIRONMENT}"
    log "  - API Gateway: PersonalPod-API-${ENVIRONMENT}"
    log "  - Cognito User Pool: ${user_pool_id}"
    log "  - CloudFront Distribution"
    log "  - All associated IAM roles and policies"
    log "  - All data in these resources"
    log ""
    
    # Confirmation
    if [[ "${FORCE:-}" != "true" ]]; then
        read -p "Are you sure you want to continue? Type 'yes' to confirm: " -r
        echo
        if [[ ! $REPLY == "yes" ]]; then
            log "${YELLOW}Cleanup cancelled${NC}"
            exit 0
        fi
        
        # Double confirmation for production
        if [[ "$ENVIRONMENT" == "prod" ]]; then
            log "${RED}This is a PRODUCTION environment!${NC}"
            read -p "Type the environment name '${ENVIRONMENT}' to confirm: " -r
            echo
            if [[ ! $REPLY == "$ENVIRONMENT" ]]; then
                log "${YELLOW}Cleanup cancelled${NC}"
                exit 0
            fi
        fi
    fi
    
    # Pre-cleanup tasks
    if [[ -n "$bucket_name" ]]; then
        empty_s3_bucket "$bucket_name"
    fi
    
    if [[ -n "$user_pool_id" ]]; then
        delete_cognito_users "$user_pool_id"
    fi
    
    # Delete the stack
    log ""
    log "${BLUE}Deleting CloudFormation stack...${NC}"
    
    if aws cloudformation delete-stack --stack-name "${STACK_NAME}"; then
        log "${GREEN}✓ Stack deletion initiated${NC}"
        
        # Wait for deletion to complete
        log "${BLUE}Waiting for stack deletion to complete...${NC}"
        log "This may take several minutes..."
        
        if aws cloudformation wait stack-delete-complete \
            --stack-name "${STACK_NAME}" \
            --no-cli-pager 2>/dev/null; then
            log "${GREEN}✓ Stack deleted successfully${NC}"
        else
            # Check if stack still exists
            if check_stack_exists; then
                log "${RED}✗ Stack deletion failed or timed out${NC}"
                
                # Get deletion errors
                log "${BLUE}Checking for deletion errors...${NC}"
                aws cloudformation describe-stack-events \
                    --stack-name "${STACK_NAME}" \
                    --query 'StackEvents[?ResourceStatus==`DELETE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
                    --output table
                
                error_exit "Stack deletion failed. Check CloudFormation console for details."
            else
                log "${GREEN}✓ Stack deleted successfully${NC}"
            fi
        fi
    else
        error_exit "Failed to initiate stack deletion"
    fi
    
    # Post-cleanup verification
    log ""
    log "${BLUE}Verifying cleanup...${NC}"
    
    # Check if resources still exist
    local remaining_resources=0
    
    if [[ -n "$bucket_name" ]] && aws s3api head-bucket --bucket "${bucket_name}" &> /dev/null; then
        log "${YELLOW}⚠ S3 bucket ${bucket_name} still exists${NC}"
        remaining_resources=$((remaining_resources + 1))
    fi
    
    if aws dynamodb describe-table --table-name "PersonalPod-UserData-${ENVIRONMENT}" &> /dev/null; then
        log "${YELLOW}⚠ DynamoDB table still exists${NC}"
        remaining_resources=$((remaining_resources + 1))
    fi
    
    if aws lambda get-function --function-name "PersonalPod-Api-${ENVIRONMENT}" &> /dev/null; then
        log "${YELLOW}⚠ Lambda function still exists${NC}"
        remaining_resources=$((remaining_resources + 1))
    fi
    
    if [[ $remaining_resources -eq 0 ]]; then
        log "${GREEN}✓ All resources cleaned up successfully${NC}"
    else
        log "${YELLOW}⚠ Some resources may still exist. Check AWS console.${NC}"
    fi
    
    # Cleanup complete
    log ""
    log "${GREEN}========================================${NC}"
    log "${GREEN}Cleanup completed${NC}"
    log "${GREEN}========================================${NC}"
    log ""
    log "Log file: ${CLEANUP_LOG}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        *)
            ENVIRONMENT="$1"
            shift
            ;;
    esac
done

# Run cleanup
cleanup_resources