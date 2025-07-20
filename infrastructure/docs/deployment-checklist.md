# PersonalPod AWS Deployment Preparation Checklist

## Pre-Deployment Checklist

### 1. Environment Prerequisites
- [ ] **AWS Account**: Ensure you have an AWS account with appropriate permissions
- [ ] **AWS CLI**: Installed and configured (version 2.x or higher)
  ```bash
  aws --version
  ```
- [ ] **AWS CDK CLI**: Installed globally (version 2.x or higher)
  ```bash
  npm install -g aws-cdk
  cdk --version
  ```
- [ ] **Node.js**: Version 20.x or higher installed
  ```bash
  node --version
  ```
- [ ] **Docker**: Installed and running (for Lambda builds)
  ```bash
  docker --version
  ```

### 2. AWS Permissions
Ensure your AWS IAM user/role has the following permissions:
- [ ] CloudFormation (full access)
- [ ] S3 (create/manage buckets)
- [ ] DynamoDB (create/manage tables)
- [ ] Lambda (create/manage functions)
- [ ] API Gateway (create/manage APIs)
- [ ] Cognito (create/manage user pools)
- [ ] CloudFront (create/manage distributions)
- [ ] IAM (create roles and policies)
- [ ] CloudWatch (logs and metrics)

### 3. Code Preparation
- [ ] **API Build**: Ensure the API is built
  ```bash
  cd ../api
  npm install
  npm run build
  cd ../infrastructure
  ```
- [ ] **Environment Variables**: Set up required environment variables
- [ ] **Configuration Files**: Review and update `config/dev.json` if needed

### 4. AWS Configuration
- [ ] **Region Selection**: Confirm deployment region (default: eu-west-1 for dev)
- [ ] **Account ID**: Verify correct AWS account
  ```bash
  aws sts get-caller-identity
  ```
- [ ] **CDK Bootstrap**: Ensure CDK is bootstrapped in target region
  ```bash
  cdk bootstrap aws://ACCOUNT-ID/REGION
  ```

### 5. Security Review
- [ ] **Secrets Management**: No hardcoded secrets in code
- [ ] **Access Controls**: Review IAM permissions and policies
- [ ] **Network Security**: Review security groups and network ACLs
- [ ] **Data Encryption**: Verify encryption settings for S3 and DynamoDB

### 6. Cost Considerations
- [ ] **Resource Sizing**: Review Lambda memory and timeout settings
- [ ] **Storage Costs**: Understand S3 and DynamoDB pricing
- [ ] **Data Transfer**: Review CloudFront pricing
- [ ] **Monitoring Costs**: CloudWatch logs retention period

### 7. Pre-Deployment Testing
- [ ] **Unit Tests**: Run infrastructure tests
  ```bash
  npm test
  ```
- [ ] **CDK Synth**: Generate CloudFormation template
  ```bash
  cdk synth -c environment=dev
  ```
- [ ] **CDK Diff**: Review changes (if updating existing stack)
  ```bash
  cdk diff -c environment=dev
  ```

### 8. Documentation Review
- [ ] **README**: Updated with latest changes
- [ ] **API Documentation**: Current and accurate
- [ ] **Architecture Diagram**: Reflects current design
- [ ] **Runbook**: Emergency procedures documented

### 9. Backup and Recovery
- [ ] **State Backup**: Backup any existing infrastructure state
- [ ] **Database Backup**: If migrating data, ensure backups exist
- [ ] **Rollback Plan**: Document rollback procedures

### 10. Communication
- [ ] **Team Notification**: Inform team of deployment schedule
- [ ] **Maintenance Window**: If production, schedule appropriately
- [ ] **Stakeholder Updates**: Notify relevant stakeholders

## Post-Deployment Checklist

### 1. Verification
- [ ] All CloudFormation stacks created successfully
- [ ] API Gateway endpoints responding
- [ ] CloudFront distribution active
- [ ] Cognito user pool accessible

### 2. Testing
- [ ] Run smoke tests
- [ ] Verify authentication flow
- [ ] Test API endpoints
- [ ] Check CloudWatch logs

### 3. Documentation
- [ ] Update deployment notes
- [ ] Record output values (URLs, IDs)
- [ ] Update environment documentation

### 4. Monitoring
- [ ] Set up CloudWatch alarms
- [ ] Configure notification channels
- [ ] Verify logging is working

## Rollback Procedures
If deployment fails or issues are discovered:
1. Use `cdk destroy` to remove stack
2. Restore from backups if needed
3. Review CloudFormation events for failure reasons
4. Fix issues and retry deployment