import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export interface PostgresLayerConstructProps {
  environment: string;
}

export class PostgresLayerConstruct extends Construct {
  public readonly layer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props: PostgresLayerConstructProps) {
    super(scope, id);

    const { environment } = props;

    // Create Lambda layer with PostgreSQL client
    this.layer = new lambda.LayerVersion(this, 'PostgresLayer', {
      layerVersionName: `PersonalPod-PostgresLayer-${environment}`,
      description: 'PostgreSQL client for Lambda functions',
      compatibleRuntimes: [
        lambda.Runtime.NODEJS_18_X,
        lambda.Runtime.NODEJS_20_X,
      ],
      code: lambda.Code.fromInline(`
        // This is a placeholder. In a real implementation, you would:
        // 1. Create a directory structure: nodejs/node_modules/
        // 2. Install pg package: npm install pg
        // 3. Bundle it as a zip file
        // 4. Use lambda.Code.fromAsset() to reference the zip
        
        // For now, we'll create an inline layer that exports a mock
        exports.handler = async () => {
          console.log('PostgreSQL layer loaded');
        };
      `),
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
  }
}