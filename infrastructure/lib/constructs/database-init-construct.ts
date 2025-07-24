import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export interface DatabaseInitConstructProps {
  vpc: ec2.Vpc;
  database: rds.DatabaseInstance;
  databaseSecret: secretsmanager.Secret;
  securityGroup: ec2.SecurityGroup;
  environment: string;
}

export class DatabaseInitConstruct extends Construct {
  constructor(scope: Construct, id: string, props: DatabaseInitConstructProps) {
    super(scope, id);

    const { vpc, database, databaseSecret, securityGroup, environment } = props;

    // Create Lambda function for database initialization
    const initFunction = new lambda.Function(this, 'DatabaseInitFunction', {
      functionName: `PersonalPod-DatabaseInit-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { Client } = require('pg');
        const AWS = require('aws-sdk');
        
        const secretsManager = new AWS.SecretsManager();
        
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          // Only run on Create or Update events
          if (event.RequestType === 'Delete') {
            return { PhysicalResourceId: event.PhysicalResourceId || 'db-init' };
          }
          
          try {
            // Get database credentials from Secrets Manager
            const secret = await secretsManager.getSecretValue({ 
              SecretId: process.env.DB_SECRET_ARN 
            }).promise();
            
            const credentials = JSON.parse(secret.SecretString);
            
            // Connect to database
            const client = new Client({
              host: process.env.DB_ENDPOINT,
              port: parseInt(process.env.DB_PORT),
              database: process.env.DB_NAME,
              user: credentials.username,
              password: credentials.password,
              ssl: {
                rejectUnauthorized: false
              }
            });
            
            await client.connect();
            console.log('Connected to database');
            
            // Create schema
            const schemaSQL = \`
              -- Enable extensions
              CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
              CREATE EXTENSION IF NOT EXISTS "pgcrypto";
              
              -- Create tables
              CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email_verified BOOLEAN DEFAULT FALSE,
                mfa_enabled BOOLEAN DEFAULT FALSE,
                mfa_secret VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP WITH TIME ZONE,
                account_status VARCHAR(50) DEFAULT 'active',
                metadata JSONB DEFAULT '{}'::jsonb
              );
              
              CREATE TABLE IF NOT EXISTS refresh_tokens (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                revoked_at TIMESTAMP WITH TIME ZONE,
                device_info JSONB DEFAULT '{}'::jsonb
              );
              
              CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                used_at TIMESTAMP WITH TIME ZONE
              );
              
              CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                used_at TIMESTAMP WITH TIME ZONE
              );
              
              CREATE TABLE IF NOT EXISTS mfa_backup_codes (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code_hash VARCHAR(255) NOT NULL,
                used_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
              
              CREATE TABLE IF NOT EXISTS user_sessions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                session_token_hash VARCHAR(255) UNIQUE NOT NULL,
                ip_address INET,
                user_agent TEXT,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
              
              CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(100),
                entity_id UUID,
                ip_address INET,
                user_agent TEXT,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
              
              -- Create indexes
              CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
              CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
              CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
              CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
              CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
              CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
              CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
              CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user_id ON mfa_backup_codes(user_id);
              CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
              CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
              CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
              CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
              CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
              
              -- Create update trigger for updated_at
              CREATE OR REPLACE FUNCTION update_updated_at_column()
              RETURNS TRIGGER AS $$
              BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
              END;
              $$ language 'plpgsql';
              
              CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            \`;
            
            await client.query(schemaSQL);
            console.log('Schema created successfully');
            
            await client.end();
            
            return {
              PhysicalResourceId: 'db-init-' + Date.now(),
              Data: {
                Status: 'SUCCESS',
                Message: 'Database initialized successfully'
              }
            };
          } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
          }
        };
      `),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [securityGroup],
      environment: {
        DB_SECRET_ARN: databaseSecret.secretArn,
        DB_ENDPOINT: database.dbInstanceEndpointAddress,
        DB_PORT: database.dbInstanceEndpointPort,
        DB_NAME: 'personalpod',
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions
    databaseSecret.grantRead(initFunction);
    
    // Install pg module in Lambda environment
    // Note: In production, you would create a proper Lambda layer with the pg module
    // For now, we'll use the AWS SDK v2 which is available in Lambda runtime
    initFunction.addEnvironment('NODE_PATH', '/opt/nodejs/node_modules');

    // Create custom resource to trigger initialization
    const provider = new cr.Provider(this, 'DatabaseInitProvider', {
      onEventHandler: initFunction,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    new cdk.CustomResource(this, 'DatabaseInitResource', {
      serviceToken: provider.serviceToken,
      properties: {
        // Change this to force re-initialization
        Version: '1.0.0',
        Timestamp: Date.now(),
      },
    });

    // Ensure initialization happens after database is created
    provider.node.addDependency(database);
  }
}