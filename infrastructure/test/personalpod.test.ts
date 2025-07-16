import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { PersonalPodStack } from '../lib/personalpod-stack';

describe('PersonalPodStack', () => {
  test('Stack creates required resources', () => {
    const app = new cdk.App();
    const stack = new PersonalPodStack(app, 'TestStack', {
      environment: 'test'
    });
    const template = Template.fromStack(stack);

    // Test S3 bucket creation
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [{
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256'
          }
        }]
      },
      VersioningConfiguration: {
        Status: 'Enabled'
      }
    });

    // Test DynamoDB table creation
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        {
          AttributeName: 'userId',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'dataType',
          KeyType: 'RANGE'
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    });

    // Test Cognito User Pool creation
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'PersonalPod-UserPool-test',
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
          RequireUppercase: true
        }
      }
    });

    // Test Lambda function creation
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      Handler: 'index.handler',
      Timeout: 30
    });

    // Test API Gateway creation
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'PersonalPod-API-test'
    });

    // Test CloudFront distribution creation
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'index.html'
      }
    });
  });

  test('Stack has correct outputs', () => {
    const app = new cdk.App();
    const stack = new PersonalPodStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // Check for expected outputs
    template.hasOutput('UserPoolId', {});
    template.hasOutput('UserPoolClientId', {});
    template.hasOutput('ApiUrl', {});
    template.hasOutput('DistributionUrl', {});
    template.hasOutput('AssetsBucketName', {});
  });

  test('Production environment has retention policies', () => {
    const app = new cdk.App();
    const stack = new PersonalPodStack(app, 'ProdStack', {
      environment: 'prod'
    });
    const template = Template.fromStack(stack);

    // Test S3 bucket retention
    template.hasResource('AWS::S3::Bucket', {
      UpdateReplacePolicy: 'Retain',
      DeletionPolicy: 'Retain'
    });

    // Test DynamoDB table retention and point-in-time recovery
    template.hasResource('AWS::DynamoDB::Table', {
      UpdateReplacePolicy: 'Retain',
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true
        }
      })
    });

    // Test Cognito User Pool retention
    template.hasResource('AWS::Cognito::UserPool', {
      UpdateReplacePolicy: 'Retain',
      DeletionPolicy: 'Retain'
    });
  });
});