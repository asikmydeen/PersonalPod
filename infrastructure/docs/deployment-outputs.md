# PersonalPod Deployment Outputs

## Overview
This document contains all the important outputs from the PersonalPod infrastructure deployment. These values are needed for accessing and configuring the deployed services.

## Environment: [ENVIRONMENT]
**Deployment Date**: [DATE]  
**Stack Name**: PersonalPod-[ENVIRONMENT]-Stack  
**AWS Region**: [REGION]  
**AWS Account**: [ACCOUNT_ID]  

## Stack Outputs

### API Gateway
- **API URL**: `[API_URL]`
- **API ID**: `[API_ID]`
- **Stage**: `[ENVIRONMENT]`

**Example API Calls**:
```bash
# Health check
curl -X GET [API_URL]/health

# Authentication endpoint
curl -X POST [API_URL]/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

### CloudFront Distribution
- **Distribution URL**: `[DISTRIBUTION_URL]`
- **Distribution ID**: `[DISTRIBUTION_ID]`
- **Origin**: S3 Bucket + API Gateway

**Access URLs**:
- Frontend: `https://[DISTRIBUTION_URL]`
- API (via CDN): `https://[DISTRIBUTION_URL]/api/v1/*`

### Cognito User Pool
- **User Pool ID**: `[USER_POOL_ID]`
- **User Pool Client ID**: `[USER_POOL_CLIENT_ID]`
- **User Pool Domain**: `[USER_POOL_DOMAIN]`

**Authentication URLs**:
- Sign-up: `https://[USER_POOL_DOMAIN]/signup`
- Sign-in: `https://[USER_POOL_DOMAIN]/login`
- OAuth2 Authorize: `https://[USER_POOL_DOMAIN]/oauth2/authorize`
- OAuth2 Token: `https://[USER_POOL_DOMAIN]/oauth2/token`

### S3 Bucket
- **Bucket Name**: `[ASSETS_BUCKET_NAME]`
- **Bucket ARN**: `arn:aws:s3:::[ASSETS_BUCKET_NAME]`
- **Bucket URL**: `https://[ASSETS_BUCKET_NAME].s3.[REGION].amazonaws.com`

### DynamoDB Table
- **Table Name**: `PersonalPod-UserData-[ENVIRONMENT]`
- **Table ARN**: `arn:aws:dynamodb:[REGION]:[ACCOUNT_ID]:table/PersonalPod-UserData-[ENVIRONMENT]`
- **Primary Key**: `userId` (String) - Partition Key
- **Sort Key**: `dataType` (String)
- **GSI**: `dataTypeIndex` (dataType, timestamp)

### Lambda Function
- **Function Name**: `PersonalPod-Api-[ENVIRONMENT]`
- **Function ARN**: `arn:aws:lambda:[REGION]:[ACCOUNT_ID]:function:PersonalPod-Api-[ENVIRONMENT]`
- **Runtime**: Node.js 20.x
- **Memory**: 1024 MB
- **Timeout**: 30 seconds

### CloudWatch Logs
- **API Lambda Logs**: `/aws/lambda/PersonalPod-Api-[ENVIRONMENT]`
- **API Gateway Logs**: `/aws/apigateway/PersonalPod-API-[ENVIRONMENT]`

## Configuration Examples

### Frontend Configuration
```javascript
// config.js
export const config = {
  apiUrl: '[API_URL]',
  userPoolId: '[USER_POOL_ID]',
  userPoolClientId: '[USER_POOL_CLIENT_ID]',
  region: '[REGION]',
  bucketName: '[ASSETS_BUCKET_NAME]'
};
```

### AWS SDK Configuration
```javascript
// aws-config.js
import AWS from 'aws-sdk';

AWS.config.update({
  region: '[REGION]',
  credentials: new AWS.CognitoIdentityCredentials({
    IdentityPoolId: '[IDENTITY_POOL_ID]',
  }),
});

const s3 = new AWS.S3({
  params: { Bucket: '[ASSETS_BUCKET_NAME]' }
});

const dynamodb = new AWS.DynamoDB.DocumentClient({
  params: { TableName: 'PersonalPod-UserData-[ENVIRONMENT]' }
});
```

### Environment Variables
```bash
# .env file
REACT_APP_API_URL=[API_URL]
REACT_APP_USER_POOL_ID=[USER_POOL_ID]
REACT_APP_USER_POOL_CLIENT_ID=[USER_POOL_CLIENT_ID]
REACT_APP_REGION=[REGION]
REACT_APP_BUCKET_NAME=[ASSETS_BUCKET_NAME]
```

## Testing Commands

### Test API Endpoints
```bash
# Health check
curl -X GET [API_URL]/health

# Get API info
curl -X GET [API_URL]/api/v1/info
```

### Test S3 Access
```bash
# List bucket contents (requires AWS credentials)
aws s3 ls s3://[ASSETS_BUCKET_NAME]/

# Upload test file
aws s3 cp test.txt s3://[ASSETS_BUCKET_NAME]/test.txt
```

### Test DynamoDB
```bash
# Scan table (requires AWS credentials)
aws dynamodb scan --table-name PersonalPod-UserData-[ENVIRONMENT]

# Get item count
aws dynamodb describe-table \
  --table-name PersonalPod-UserData-[ENVIRONMENT] \
  --query 'Table.ItemCount'
```

### Test Cognito
```bash
# List users (requires admin permissions)
aws cognito-idp list-users --user-pool-id [USER_POOL_ID]

# Create test user
aws cognito-idp admin-create-user \
  --user-pool-id [USER_POOL_ID] \
  --username testuser \
  --user-attributes Name=email,Value=test@example.com \
  --temporary-password TempPass123!
```

## Monitoring Links

### CloudWatch Dashboards
- **Lambda Metrics**: https://console.aws.amazon.com/cloudwatch/home?region=[REGION]#metricsV2:graph=~();query=PersonalPod-Api-[ENVIRONMENT]
- **API Gateway Metrics**: https://console.aws.amazon.com/cloudwatch/home?region=[REGION]#metricsV2:graph=~();query=PersonalPod-API-[ENVIRONMENT]
- **DynamoDB Metrics**: https://console.aws.amazon.com/cloudwatch/home?region=[REGION]#metricsV2:graph=~();query=PersonalPod-UserData-[ENVIRONMENT]

### Direct Console Links
- **CloudFormation Stack**: https://console.aws.amazon.com/cloudformation/home?region=[REGION]#/stacks/stackinfo?stackId=PersonalPod-[ENVIRONMENT]-Stack
- **API Gateway Console**: https://console.aws.amazon.com/apigateway/home?region=[REGION]#/apis
- **Lambda Console**: https://console.aws.amazon.com/lambda/home?region=[REGION]#/functions/PersonalPod-Api-[ENVIRONMENT]
- **Cognito Console**: https://console.aws.amazon.com/cognito/users/?region=[REGION]#/pool/[USER_POOL_ID]/details
- **S3 Console**: https://s3.console.aws.amazon.com/s3/buckets/[ASSETS_BUCKET_NAME]
- **DynamoDB Console**: https://console.aws.amazon.com/dynamodbv2/home?region=[REGION]#table?name=PersonalPod-UserData-[ENVIRONMENT]

## Important Notes

1. **Security**: Keep all IDs and URLs secure. Do not commit them to public repositories.
2. **CORS**: API Gateway is configured to allow all origins in dev. Restrict in production.
3. **Costs**: Monitor AWS costs regularly, especially for CloudFront and DynamoDB.
4. **Backups**: DynamoDB point-in-time recovery is enabled only in production.
5. **Scaling**: Lambda and DynamoDB are configured for auto-scaling.

## Troubleshooting

### Common Issues
1. **API returns 403**: Check Cognito token and API Gateway authorizer
2. **S3 access denied**: Verify IAM roles and bucket policies
3. **Lambda timeout**: Check function logs in CloudWatch
4. **DynamoDB throttling**: Check provisioned capacity or switch to on-demand

### Support Contacts
- **DevOps Team**: devops@company.com
- **AWS Support**: [Support Case Link]
- **On-Call**: [PagerDuty Link]

---
*This document was generated on [DATE] for the [ENVIRONMENT] environment.*