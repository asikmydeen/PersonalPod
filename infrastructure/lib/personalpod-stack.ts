import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export interface PersonalPodStackProps extends cdk.StackProps {
  environment?: string;
}

export class PersonalPodStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: PersonalPodStackProps) {
    super(scope, id, props);

    const environment = props?.environment || 'dev';

    // S3 Bucket for static assets and user uploads
    const assetsBucket = new s3.Bucket(this, 'PersonalPodAssets', {
      bucketName: `personalpod-assets-${environment}-${cdk.Stack.of(this).account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
      cors: [{
        allowedHeaders: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
        allowedOrigins: ['*'],
        maxAge: 3000
      }]
    });

    // DynamoDB table for user data
    const userDataTable = new dynamodb.Table(this, 'PersonalPodUserData', {
      tableName: `PersonalPod-UserData-${environment}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dataType', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // Add GSI for querying by data type
    userDataTable.addGlobalSecondaryIndex({
      indexName: 'dataTypeIndex',
      partitionKey: { name: 'dataType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Cognito User Pool for authentication
    const userPool = new cognito.UserPool(this, 'PersonalPodUserPool', {
      userPoolName: `PersonalPod-UserPool-${environment}`,
      selfSignUpEnabled: true,
      userVerification: {
        emailSubject: 'Verify your PersonalPod account',
        emailBody: 'Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      signInAliases: {
        email: true,
        username: true
      },
      autoVerify: {
        email: true
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
    });

    // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'PersonalPodUserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true
      },
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE, cognito.OAuthScope.EMAIL],
        callbackUrls: environment === 'prod' 
          ? ['https://personalpod.com/callback']
          : ['http://localhost:3000/callback'],
        logoutUrls: environment === 'prod' 
          ? ['https://personalpod.com/logout']
          : ['http://localhost:3000/logout']
      }
    });

    // Lambda function for API
    const apiFunction = new lambda.Function(this, 'PersonalPodApiFunction', {
      functionName: `PersonalPod-Api-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../api/dist'),
      environment: {
        TABLE_NAME: userDataTable.tableName,
        BUCKET_NAME: assetsBucket.bucketName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        ENVIRONMENT: environment
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      tracing: lambda.Tracing.ACTIVE
    });

    // Grant permissions
    userDataTable.grantReadWriteData(apiFunction);
    assetsBucket.grantReadWrite(apiFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'PersonalPodApi', {
      restApiName: `PersonalPod-API-${environment}`,
      description: 'PersonalPod API Gateway',
      deployOptions: {
        stageName: environment,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: environment !== 'prod',
        metricsEnabled: true
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
      }
    });

    // API Gateway Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(apiFunction);
    
    // API routes
    const apiV1 = api.root.addResource('api').addResource('v1');
    apiV1.addMethod('ANY', lambdaIntegration);
    apiV1.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true
    });

    // CloudFront distribution for static content
    const distribution = new cloudfront.Distribution(this, 'PersonalPodDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(assetsBucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        compress: true
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(api),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY
        }
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0)
        }
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID'
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution URL'
    });

    new cdk.CfnOutput(this, 'AssetsBucketName', {
      value: assetsBucket.bucketName,
      description: 'S3 Assets Bucket Name'
    });
  }
}