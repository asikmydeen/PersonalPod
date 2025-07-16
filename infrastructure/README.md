# PersonalPod Infrastructure

This directory contains the AWS CDK infrastructure code for the PersonalPod application.

## Overview

The infrastructure is built using AWS CDK (Cloud Development Kit) with TypeScript and includes:

- **S3 Bucket**: For static assets and user uploads
- **DynamoDB**: For storing user data with global secondary indexes
- **Cognito**: User authentication and authorization
- **Lambda**: Serverless compute for API logic
- **API Gateway**: RESTful API endpoints
- **CloudFront**: CDN for global content delivery

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Project Structure

```
infrastructure/
├── bin/                    # CDK app entry point
│   └── personalpod.ts     # Main CDK application
├── lib/                    # CDK stack definitions
│   └── personalpod-stack.ts # Main infrastructure stack
├── test/                   # Infrastructure tests
│   └── personalpod.test.ts # Stack unit tests
├── config/                 # Environment configurations
│   ├── dev.json           # Development environment config
│   └── prod.json          # Production environment config
├── scripts/                # Deployment scripts
│   └── deploy.sh          # Automated deployment script
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Jest test configuration
├── .eslintrc.json         # ESLint configuration
└── cdk.json              # CDK configuration
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Run tests:
```bash
npm test
```

## Deployment

### Using the deployment script:
```bash
./scripts/deploy.sh [environment]
```

### Manual deployment:

1. Bootstrap CDK (first time only):
```bash
npx cdk bootstrap
```

2. Deploy to development:
```bash
npx cdk deploy -c environment=dev
```

3. Deploy to production:
```bash
npx cdk deploy -c environment=prod
```

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run deploy` - Build and deploy the stack
- `npm run destroy` - Destroy the deployed stack
- `npm run synth` - Synthesize CloudFormation template
- `npm run diff` - Compare deployed stack with current code

## Environment Variables

The following environment variables are used:

- `CDK_DEFAULT_ACCOUNT` - AWS account ID
- `CDK_DEFAULT_REGION` - AWS region

## Configuration

Environment-specific configurations are stored in the `config/` directory:

- `dev.json` - Development environment settings
- `prod.json` - Production environment settings

## Testing

Run all tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Useful CDK Commands

- `cdk ls` - List all stacks in the app
- `cdk synth` - Synthesize CloudFormation template
- `cdk diff` - Compare deployed stack with current state
- `cdk deploy` - Deploy stack to AWS
- `cdk destroy` - Remove stack from AWS
- `cdk metadata` - Display metadata about the app
- `cdk context` - Manage cached context values

## Security Considerations

- All S3 buckets have encryption enabled
- DynamoDB tables use AWS managed encryption
- API Gateway has CORS configured
- Cognito enforces strong password policies
- CloudFront uses HTTPS only for API calls
- IAM roles follow least privilege principle

## Cost Optimization

- DynamoDB uses on-demand billing for development
- Lambda functions are right-sized for memory
- CloudFront uses PriceClass 100 for cost efficiency
- S3 lifecycle policies can be added for old data

## Monitoring

The infrastructure includes:
- CloudWatch Logs for all Lambda functions
- API Gateway access logging
- DynamoDB stream for change tracking
- CloudFront access logs (optional)

## Troubleshooting

1. **CDK Bootstrap Error**: Run `npx cdk bootstrap aws://ACCOUNT-NUMBER/REGION`
2. **Permission Denied**: Check AWS credentials with `aws sts get-caller-identity`
3. **Stack Already Exists**: Use `cdk destroy` before redeploying
4. **Resource Limit**: Check AWS service quotas in your account