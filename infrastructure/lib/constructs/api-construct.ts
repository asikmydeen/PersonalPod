import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface ApiConstructProps {
  environment: string;
  apiFunction: lambda.Function;
}

export class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const { environment, apiFunction } = props;

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'PersonalPodApi', {
      restApiName: `PersonalPod-API-${environment}`,
      description: 'PersonalPod API Gateway',
      deployOptions: {
        stageName: environment,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: environment !== 'prod',
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(
          new logs.LogGroup(this, 'ApiAccessLogs', {
            retention: logs.RetentionDays.ONE_WEEK
          })
        ),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields()
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
        allowCredentials: true
      }
    });

    // Create Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(apiFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    });

    // Add API routes
    const apiV1 = this.api.root.addResource('api').addResource('v1');
    
    // Health check endpoint
    const health = apiV1.addResource('health');
    health.addMethod('GET', lambdaIntegration);

    // User endpoints
    const users = apiV1.addResource('users');
    users.addMethod('GET', lambdaIntegration);
    users.addMethod('POST', lambdaIntegration);
    
    const user = users.addResource('{userId}');
    user.addMethod('GET', lambdaIntegration);
    user.addMethod('PUT', lambdaIntegration);
    user.addMethod('DELETE', lambdaIntegration);

    // Data endpoints
    const data = apiV1.addResource('data');
    data.addMethod('GET', lambdaIntegration);
    data.addMethod('POST', lambdaIntegration);
    
    const dataItem = data.addResource('{dataId}');
    dataItem.addMethod('GET', lambdaIntegration);
    dataItem.addMethod('PUT', lambdaIntegration);
    dataItem.addMethod('DELETE', lambdaIntegration);

    // Add catch-all proxy
    apiV1.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true
    });

    // Add usage plan
    const plan = this.api.addUsagePlan('PersonalPodUsagePlan', {
      name: `PersonalPod-${environment}-UsagePlan`,
      throttle: {
        rateLimit: environment === 'prod' ? 1000 : 100,
        burstLimit: environment === 'prod' ? 2000 : 200
      },
      quota: {
        limit: environment === 'prod' ? 1000000 : 10000,
        period: apigateway.Period.MONTH
      }
    });

    plan.addApiStage({
      stage: this.api.deploymentStage
    });

    this.apiUrl = this.api.url;
  }
}