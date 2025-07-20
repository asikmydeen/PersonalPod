# PersonalPod AWS Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Pre-Deployment Setup](#pre-deployment-setup)
4. [Deployment Process](#deployment-process)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Resource Cleanup](#resource-cleanup)

## Overview

This guide provides step-by-step instructions for deploying PersonalPod infrastructure to AWS using AWS CDK (Cloud Development Kit). The infrastructure includes:

- **S3 Bucket**: For static assets and user uploads
- **DynamoDB Table**: For user data storage
- **Lambda Functions**: For API backend
- **API Gateway**: RESTful API endpoints
- **Cognito User Pool**: User authentication
- **CloudFront Distribution**: CDN for global content delivery

## Prerequisites

### Required Tools

1. **AWS CLI** (v2.x or higher)
   ```bash
   # Install on macOS
   brew install awscli
   
   # Install on Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Verify installation
   aws --version
   ```

2. **AWS CDK CLI** (v2.x or higher)
   ```bash
   # Install globally
   npm install -g aws-cdk
   
   # Verify installation
   cdk --version
   ```

3. **Node.js** (v20.x or higher)
   ```bash
   # Install using nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 20
   nvm use 20
   
   # Verify installation
   node --version
   npm --version
   ```

4. **Docker** (for Lambda builds)
   ```bash
   # Download from https://www.docker.com/get-started
   # Verify installation
   docker --version
   ```

### AWS Account Setup

1. **Create IAM User** with programmatic access
2. **Attach Policy** with required permissions (see aws-credentials-setup.md)
3. **Configure Credentials**:
   ```bash
   aws configure
   # Enter your Access Key ID, Secret Access Key, and preferred region
   ```

## Pre-Deployment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/PersonalPod.git
cd PersonalPod
```

### 2. Build API
```bash
cd api
npm install
npm run build
cd ..
```

### 3. Install Infrastructure Dependencies
```bash
cd infrastructure
npm install
```

### 4. Configure Environment
Review and update configuration if needed:
```bash
# Check dev configuration
cat config/dev.json

# Update if necessary
vi config/dev.json
```

### 5. Bootstrap CDK
First-time setup for your AWS account/region:
```bash
# Get your account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Bootstrap CDK (only needed once per account/region)
cdk bootstrap aws://${AWS_ACCOUNT_ID}/eu-west-1
```

## Deployment Process

### Option 1: Using Deployment Script (Recommended)

```bash
cd infrastructure/scripts
./deploy-dev.sh
```

The script will:
1. Verify prerequisites
2. Build the API
3. Run tests
4. Synthesize CloudFormation template
5. Deploy stack to AWS
6. Display outputs

### Option 2: Manual Deployment

1. **Synthesize Stack**
   ```bash
   cd infrastructure
   cdk synth -c environment=dev
   ```

2. **Review Changes** (if updating existing stack)
   ```bash
   cdk diff -c environment=dev
   ```

3. **Deploy Stack**
   ```bash
   cdk deploy -c environment=dev
   ```

4. **Save Outputs**
   ```bash
   # Outputs are displayed after deployment
   # Save them for future reference
   ```

## Verification

### 1. Check CloudFormation Stack
```bash
# List all stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Get stack details
aws cloudformation describe-stacks --stack-name PersonalPod-dev-Stack
```

### 2. Verify Resources

#### API Gateway
```bash
# Get API Gateway ID from stack outputs
API_ID=$(aws cloudformation describe-stacks \
  --stack-name PersonalPod-dev-Stack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Test API endpoint
curl -X GET "${API_ID}/health"
```

#### DynamoDB Table
```bash
# List tables
aws dynamodb list-tables

# Describe table
aws dynamodb describe-table --table-name PersonalPod-UserData-dev
```

#### S3 Bucket
```bash
# List buckets
aws s3 ls | grep personalpod-assets-dev

# Check bucket configuration
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name PersonalPod-dev-Stack \
  --query 'Stacks[0].Outputs[?OutputKey==`AssetsBucketName`].OutputValue' \
  --output text)

aws s3api get-bucket-versioning --bucket $BUCKET_NAME
```

#### Cognito User Pool
```bash
# Get User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name PersonalPod-dev-Stack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

# Describe user pool
aws cognito-idp describe-user-pool --user-pool-id $USER_POOL_ID
```

### 3. Run Validation Script
```bash
cd infrastructure/scripts
./validate-deployment.sh dev
```

## Common Issues and Troubleshooting

### Issue: "Stack already exists"
```bash
# Option 1: Update existing stack
cdk deploy -c environment=dev

# Option 2: Delete and recreate
cdk destroy -c environment=dev
cdk deploy -c environment=dev
```

### Issue: "Credentials not found"
```bash
# Check AWS configuration
aws configure list

# Verify credentials work
aws sts get-caller-identity
```

### Issue: "CDK bootstrap required"
```bash
# Bootstrap the environment
cdk bootstrap
```

### Issue: "Lambda build failed"
```bash
# Ensure Docker is running
docker ps

# Check API build
cd ../api
npm run build
```

### Issue: "CloudFormation rollback"
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name PersonalPod-dev-Stack \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

## Resource Cleanup

### Remove All Resources
```bash
cd infrastructure

# Destroy stack (will prompt for confirmation)
cdk destroy -c environment=dev

# Force destroy without confirmation
cdk destroy -c environment=dev --force
```

### Manual Cleanup (if needed)
```bash
# Delete S3 bucket contents first
BUCKET_NAME=$(aws s3 ls | grep personalpod-assets-dev | awk '{print $3}')
aws s3 rm s3://${BUCKET_NAME} --recursive

# Then delete CloudFormation stack
aws cloudformation delete-stack --stack-name PersonalPod-dev-Stack
```

## Post-Deployment Configuration

### 1. Create Test User
```bash
# Create user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com \
  --temporary-password TempPass123!
```

### 2. Configure CloudWatch Alarms
See `monitoring-setup.md` for detailed monitoring configuration.

### 3. Set Up CI/CD
See `pipeline-setup.md` for continuous deployment configuration.

## Security Considerations

1. **Enable MFA** for production deployments
2. **Review IAM Roles** created by CDK
3. **Enable AWS CloudTrail** for audit logging
4. **Configure AWS Config** for compliance monitoring
5. **Set up AWS GuardDuty** for threat detection

## Cost Optimization

1. **Use AWS Cost Explorer** to monitor spending
2. **Set up billing alerts**
3. **Review and adjust resource sizing**
4. **Enable S3 lifecycle policies** for old data
5. **Use DynamoDB on-demand pricing** for variable workloads

## Next Steps

1. **Test the deployment** using the validation script
2. **Set up monitoring** and alerts
3. **Configure backup** strategies
4. **Document any customizations**
5. **Plan for production deployment**

## Support

For issues or questions:
1. Check CloudFormation events for deployment errors
2. Review CloudWatch logs for runtime errors
3. Consult AWS CDK documentation
4. Contact the development team