# AWS Credentials Configuration Guide

## Overview
This guide explains how to set up AWS credentials for deploying PersonalPod infrastructure.

## Prerequisites
- AWS Account
- IAM User with appropriate permissions
- AWS CLI installed

## Method 1: AWS CLI Configuration (Recommended)

### Step 1: Install AWS CLI
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Download and run the MSI installer from https://aws.amazon.com/cli/
```

### Step 2: Configure AWS CLI
```bash
aws configure
```

You'll be prompted for:
- **AWS Access Key ID**: Your IAM user access key
- **AWS Secret Access Key**: Your IAM user secret key
- **Default region name**: `eu-west-1` (for dev) or `us-east-1` (for prod)
- **Default output format**: `json`

### Step 3: Verify Configuration
```bash
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAI23HXD...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

## Method 2: Environment Variables

### Bash/Zsh (Linux/macOS)
```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_DEFAULT_REGION=eu-west-1
```

### PowerShell (Windows)
```powershell
$env:AWS_ACCESS_KEY_ID="your-access-key-id"
$env:AWS_SECRET_ACCESS_KEY="your-secret-access-key"
$env:AWS_DEFAULT_REGION="eu-west-1"
```

### Permanent Setup
Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):
```bash
# AWS Credentials for PersonalPod
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_DEFAULT_REGION=eu-west-1
```

## Method 3: AWS Profile Configuration

### Step 1: Create Named Profile
Edit `~/.aws/credentials`:
```ini
[default]
aws_access_key_id = your-default-access-key
aws_secret_access_key = your-default-secret-key

[personalpod-dev]
aws_access_key_id = your-dev-access-key
aws_secret_access_key = your-dev-secret-key

[personalpod-prod]
aws_access_key_id = your-prod-access-key
aws_secret_access_key = your-prod-secret-key
```

Edit `~/.aws/config`:
```ini
[default]
region = us-east-1
output = json

[profile personalpod-dev]
region = eu-west-1
output = json

[profile personalpod-prod]
region = us-east-1
output = json
```

### Step 2: Use Named Profile
```bash
# For dev deployment
export AWS_PROFILE=personalpod-dev
cdk deploy

# Or specify in command
AWS_PROFILE=personalpod-dev cdk deploy
```

## Method 4: AWS SSO Configuration (Enterprise)

### Step 1: Configure SSO
```bash
aws configure sso
```

Follow prompts to:
1. Enter SSO start URL
2. Enter SSO Region
3. Select account and role
4. Choose default region
5. Name the profile

### Step 2: Login to SSO
```bash
aws sso login --profile personalpod-sso
```

### Step 3: Use SSO Profile
```bash
export AWS_PROFILE=personalpod-sso
cdk deploy
```

## IAM Permissions Required

Create an IAM policy with these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:*",
                "s3:*",
                "dynamodb:*",
                "lambda:*",
                "apigateway:*",
                "cognito-idp:*",
                "cloudfront:*",
                "iam:*",
                "logs:*",
                "events:*",
                "cloudwatch:*",
                "ec2:DescribeAvailabilityZones",
                "ec2:DescribeVpcs",
                "ec2:DescribeSubnets",
                "ec2:DescribeSecurityGroups",
                "sts:AssumeRole"
            ],
            "Resource": "*"
        }
    ]
}
```

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use temporary credentials** when possible (AWS SSO, assume role)
3. **Rotate access keys** regularly
4. **Use least privilege** principle for IAM permissions
5. **Enable MFA** on your AWS account
6. **Use separate credentials** for dev/staging/prod

## Troubleshooting

### Issue: "Unable to locate credentials"
```bash
# Check if credentials are configured
aws configure list

# Check environment variables
env | grep AWS
```

### Issue: "Invalid credentials"
```bash
# Verify credentials are valid
aws sts get-caller-identity

# Check credential file permissions
ls -la ~/.aws/
```

### Issue: "Access Denied"
- Verify IAM permissions
- Check if MFA is required
- Ensure correct region is set

## Additional Resources
- [AWS CLI Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS CDK Prerequisites](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_prerequisites)