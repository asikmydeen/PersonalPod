#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PersonalPodStack } from '../lib/personalpod-stack';

const app = new cdk.App();

// Environment configuration
const envEU = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-1' };
const envUS = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' };

// Get environment from context or use default
const environment = app.node.tryGetContext('environment') || 'dev';

// Stack configuration
const stackProps = {
  env: environment === 'prod' ? envUS : envEU,
  description: `PersonalPod ${environment} infrastructure stack`,
  tags: {
    Environment: environment,
    Application: 'PersonalPod',
    ManagedBy: 'CDK'
  }
};

// Create the main stack
new PersonalPodStack(app, `PersonalPod-${environment}-Stack`, stackProps);

// Add stack tags
cdk.Tags.of(app).add('Project', 'PersonalPod');
cdk.Tags.of(app).add('Environment', environment);