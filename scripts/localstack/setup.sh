#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
until aws --endpoint-url=http://localhost:4566 s3 ls 2>/dev/null; do
  sleep 2
done

echo "LocalStack is ready. Setting up resources..."

# Set AWS CLI to use LocalStack endpoint
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566

# Create S3 buckets
echo "Creating S3 buckets..."
aws s3 mb s3://personalpod-dev-uploads
aws s3 mb s3://personalpod-dev-backups

# Create DynamoDB tables
echo "Creating DynamoDB tables..."
aws dynamodb create-table \
  --table-name personalpod-sessions \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5

# Create SQS queues
echo "Creating SQS queues..."
aws sqs create-queue --queue-name personalpod-email-queue
aws sqs create-queue --queue-name personalpod-job-queue.fifo --attributes FifoQueue=true

# Create SNS topics
echo "Creating SNS topics..."
aws sns create-topic --name personalpod-notifications

# Create Secrets Manager secrets
echo "Creating secrets..."
aws secretsmanager create-secret \
  --name personalpod/dev/database \
  --secret-string '{"username":"personalpod","password":"devpassword","host":"postgres","port":5432,"database":"personalpod_dev"}'

aws secretsmanager create-secret \
  --name personalpod/dev/jwt \
  --secret-string '{"secret":"dev-secret-key-not-for-production","refreshSecret":"dev-refresh-secret-not-for-production"}'

echo "LocalStack setup completed!"