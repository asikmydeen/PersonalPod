#!/bin/bash

# Deployment validation script for PersonalPod
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
VALIDATION_LOG="${INFRA_DIR}/logs/validation-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).log"
FAILED_CHECKS=0
TOTAL_CHECKS=0

# Create logs directory if it doesn't exist
mkdir -p "${INFRA_DIR}/logs"

# Logging function
log() {
    echo -e "${1}" | tee -a "${VALIDATION_LOG}"
}

# Check function
check() {
    local check_name="$1"
    local check_command="$2"
    local expected_result="${3:-}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    log "${BLUE}Checking: ${check_name}...${NC}"
    
    if eval "$check_command"; then
        log "${GREEN}✓ ${check_name} - PASSED${NC}"
        return 0
    else
        log "${RED}✗ ${check_name} - FAILED${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Get stack output value
get_stack_output() {
    local output_key="$1"
    aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --query "Stacks[0].Outputs[?OutputKey=='${output_key}'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

# Validation functions
validate_stack_exists() {
    aws cloudformation describe-stacks --stack-name "${STACK_NAME}" &> /dev/null
}

validate_stack_status() {
    local status=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null)
    
    if [[ "$status" == "CREATE_COMPLETE" ]] || [[ "$status" == "UPDATE_COMPLETE" ]]; then
        log "  Stack Status: ${status}"
        return 0
    else
        log "  Stack Status: ${status} (Expected: CREATE_COMPLETE or UPDATE_COMPLETE)"
        return 1
    fi
}

validate_api_gateway() {
    local api_url=$(get_stack_output "ApiUrl")
    
    if [[ -z "$api_url" ]]; then
        log "  API URL not found in stack outputs"
        return 1
    fi
    
    log "  API URL: ${api_url}"
    
    # Test health endpoint
    local response=$(curl -s -o /dev/null -w "%{http_code}" "${api_url}health" || echo "000")
    
    if [[ "$response" == "200" ]] || [[ "$response" == "404" ]]; then
        log "  API Response Code: ${response}"
        return 0
    else
        log "  API Response Code: ${response} (Expected: 200 or 404)"
        return 1
    fi
}

validate_dynamodb_table() {
    local table_name="PersonalPod-UserData-${ENVIRONMENT}"
    
    if aws dynamodb describe-table --table-name "${table_name}" &> /dev/null; then
        local status=$(aws dynamodb describe-table \
            --table-name "${table_name}" \
            --query 'Table.TableStatus' \
            --output text)
        
        if [[ "$status" == "ACTIVE" ]]; then
            log "  Table Status: ${status}"
            
            # Check indices
            local gsi_count=$(aws dynamodb describe-table \
                --table-name "${table_name}" \
                --query 'Table.GlobalSecondaryIndexes | length(@)' \
                --output text)
            
            log "  Global Secondary Indexes: ${gsi_count}"
            return 0
        else
            log "  Table Status: ${status} (Expected: ACTIVE)"
            return 1
        fi
    else
        return 1
    fi
}

validate_s3_bucket() {
    local bucket_name=$(get_stack_output "AssetsBucketName")
    
    if [[ -z "$bucket_name" ]]; then
        log "  Bucket name not found in stack outputs"
        return 1
    fi
    
    log "  Bucket Name: ${bucket_name}"
    
    # Check bucket exists
    if aws s3api head-bucket --bucket "${bucket_name}" &> /dev/null; then
        # Check versioning
        local versioning=$(aws s3api get-bucket-versioning \
            --bucket "${bucket_name}" \
            --query 'Status' \
            --output text 2>/dev/null || echo "Not Set")
        
        log "  Versioning: ${versioning}"
        
        # Check encryption
        if aws s3api get-bucket-encryption --bucket "${bucket_name}" &> /dev/null; then
            log "  Encryption: Enabled"
        else
            log "  Encryption: Not configured"
        fi
        
        return 0
    else
        return 1
    fi
}

validate_cognito_user_pool() {
    local user_pool_id=$(get_stack_output "UserPoolId")
    
    if [[ -z "$user_pool_id" ]]; then
        log "  User Pool ID not found in stack outputs"
        return 1
    fi
    
    log "  User Pool ID: ${user_pool_id}"
    
    if aws cognito-idp describe-user-pool --user-pool-id "${user_pool_id}" &> /dev/null; then
        local status=$(aws cognito-idp describe-user-pool \
            --user-pool-id "${user_pool_id}" \
            --query 'UserPool.Status' \
            --output text)
        
        if [[ "$status" == "Enabled" ]]; then
            log "  User Pool Status: ${status}"
            
            # Check MFA configuration
            local mfa_config=$(aws cognito-idp describe-user-pool \
                --user-pool-id "${user_pool_id}" \
                --query 'UserPool.MfaConfiguration' \
                --output text)
            
            log "  MFA Configuration: ${mfa_config}"
            return 0
        else
            log "  User Pool Status: ${status} (Expected: Enabled)"
            return 1
        fi
    else
        return 1
    fi
}

validate_lambda_function() {
    local function_name="PersonalPod-Api-${ENVIRONMENT}"
    
    if aws lambda get-function --function-name "${function_name}" &> /dev/null; then
        local state=$(aws lambda get-function \
            --function-name "${function_name}" \
            --query 'Configuration.State' \
            --output text)
        
        if [[ "$state" == "Active" ]]; then
            log "  Function State: ${state}"
            
            # Check last update status
            local last_update=$(aws lambda get-function \
                --function-name "${function_name}" \
                --query 'Configuration.LastUpdateStatus' \
                --output text)
            
            log "  Last Update Status: ${last_update}"
            
            # Check runtime
            local runtime=$(aws lambda get-function \
                --function_name "${function_name}" \
                --query 'Configuration.Runtime' \
                --output text)
            
            log "  Runtime: ${runtime}"
            return 0
        else
            log "  Function State: ${state} (Expected: Active)"
            return 1
        fi
    else
        return 1
    fi
}

validate_cloudfront_distribution() {
    local dist_domain=$(get_stack_output "DistributionUrl")
    
    if [[ -z "$dist_domain" ]]; then
        log "  Distribution domain not found in stack outputs"
        return 1
    fi
    
    log "  Distribution Domain: ${dist_domain}"
    
    # Get distribution ID
    local dist_id=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?DomainName=='${dist_domain}'].Id" \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$dist_id" ]]; then
        local status=$(aws cloudfront get-distribution \
            --id "${dist_id}" \
            --query 'Distribution.Status' \
            --output text)
        
        if [[ "$status" == "Deployed" ]]; then
            log "  Distribution Status: ${status}"
            
            # Test distribution
            local response=$(curl -s -o /dev/null -w "%{http_code}" "https://${dist_domain}" || echo "000")
            log "  Distribution Response: ${response}"
            
            return 0
        else
            log "  Distribution Status: ${status} (Expected: Deployed)"
            return 1
        fi
    else
        log "  Could not find distribution"
        return 1
    fi
}

validate_cloudwatch_logs() {
    # Check Lambda log group
    local log_group="/aws/lambda/PersonalPod-Api-${ENVIRONMENT}"
    
    if aws logs describe-log-groups --log-group-name-prefix "${log_group}" \
        --query "logGroups[?logGroupName=='${log_group}'].logGroupName" \
        --output text &> /dev/null; then
        log "  Lambda Log Group: Exists"
        
        # Check for recent logs
        local log_streams=$(aws logs describe-log-streams \
            --log-group-name "${log_group}" \
            --order-by LastEventTime \
            --descending \
            --max-items 1 \
            --query 'logStreams[0].lastEventTimestamp' \
            --output text 2>/dev/null || echo "0")
        
        if [[ "$log_streams" != "0" ]] && [[ -n "$log_streams" ]]; then
            log "  Recent Logs: Found"
        else
            log "  Recent Logs: None"
        fi
        
        return 0
    else
        log "  Lambda Log Group: Not found"
        return 1
    fi
}

# Performance check
check_api_performance() {
    local api_url=$(get_stack_output "ApiUrl")
    
    if [[ -z "$api_url" ]]; then
        return 1
    fi
    
    log "${BLUE}Running performance check...${NC}"
    
    # Make 5 requests and calculate average response time
    local total_time=0
    local successful_requests=0
    
    for i in {1..5}; do
        local start_time=$(date +%s%N)
        if curl -s -o /dev/null "${api_url}health"; then
            local end_time=$(date +%s%N)
            local response_time=$((($end_time - $start_time) / 1000000))
            total_time=$((total_time + response_time))
            successful_requests=$((successful_requests + 1))
            log "  Request $i: ${response_time}ms"
        else
            log "  Request $i: Failed"
        fi
        sleep 1
    done
    
    if [[ $successful_requests -gt 0 ]]; then
        local avg_time=$((total_time / successful_requests))
        log "  Average Response Time: ${avg_time}ms"
        log "  Successful Requests: ${successful_requests}/5"
        
        if [[ $avg_time -lt 1000 ]]; then
            log "${GREEN}✓ Performance check - PASSED${NC}"
            return 0
        else
            log "${YELLOW}⚠ Performance check - SLOW (>1000ms)${NC}"
            return 0
        fi
    else
        log "${RED}✗ Performance check - FAILED${NC}"
        return 1
    fi
}

# Main validation
main() {
    log "${YELLOW}========================================${NC}"
    log "${YELLOW}PersonalPod Deployment Validation${NC}"
    log "${YELLOW}========================================${NC}"
    log "Environment: ${ENVIRONMENT}"
    log "Stack Name: ${STACK_NAME}"
    log "Timestamp: $(date)"
    log ""
    
    # Check if stack exists
    if ! check "CloudFormation Stack Exists" "validate_stack_exists"; then
        log "${RED}Stack ${STACK_NAME} does not exist. Please deploy first.${NC}"
        exit 1
    fi
    
    # Run validation checks
    check "CloudFormation Stack Status" "validate_stack_status"
    check "API Gateway" "validate_api_gateway"
    check "DynamoDB Table" "validate_dynamodb_table"
    check "S3 Bucket" "validate_s3_bucket"
    check "Cognito User Pool" "validate_cognito_user_pool"
    check "Lambda Function" "validate_lambda_function"
    check "CloudFront Distribution" "validate_cloudfront_distribution"
    check "CloudWatch Logs" "validate_cloudwatch_logs"
    
    # Performance check (optional)
    check_api_performance
    
    # Summary
    log ""
    log "${YELLOW}========================================${NC}"
    log "${YELLOW}Validation Summary${NC}"
    log "${YELLOW}========================================${NC}"
    log "Total Checks: ${TOTAL_CHECKS}"
    log "Passed: $((TOTAL_CHECKS - FAILED_CHECKS))"
    log "Failed: ${FAILED_CHECKS}"
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        log ""
        log "${GREEN}All validation checks passed!${NC}"
        log ""
        
        # Display access information
        log "${BLUE}Access Information:${NC}"
        log "  API URL: $(get_stack_output 'ApiUrl')"
        log "  CloudFront URL: https://$(get_stack_output 'DistributionUrl')"
        log "  User Pool ID: $(get_stack_output 'UserPoolId')"
        log "  User Pool Client ID: $(get_stack_output 'UserPoolClientId')"
        
        exit 0
    else
        log ""
        log "${RED}Validation failed with ${FAILED_CHECKS} errors${NC}"
        log "Check the log file for details: ${VALIDATION_LOG}"
        exit 1
    fi
}

# Run main function
main "$@"