import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export interface OpenSearchConstructProps {
  vpc: ec2.IVpc;
  environment: string;
  userPool?: cognito.IUserPool;
}

export class OpenSearchConstruct extends Construct {
  public readonly domain: opensearch.Domain;
  public readonly domainEndpoint: string;

  constructor(scope: Construct, id: string, props: OpenSearchConstructProps) {
    super(scope, id);

    const { vpc, environment } = props;

    // Create security group for OpenSearch
    const securityGroup = new ec2.SecurityGroup(this, 'OpenSearchSecurityGroup', {
      vpc,
      description: 'Security group for OpenSearch domain',
      allowAllOutbound: true,
    });

    // Allow HTTPS access from within VPC
    securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'Allow HTTPS from VPC'
    );

    // Select private subnets for OpenSearch
    const subnets = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    });

    // Create OpenSearch domain
    this.domain = new opensearch.Domain(this, 'PersonalPodSearch', {
      version: opensearch.EngineVersion.OPENSEARCH_2_11,
      domainName: `personalpod-search-${environment}`,
      
      capacity: {
        // Use small instances for development, larger for production
        masterNodes: environment === 'prod' ? 3 : undefined,
        masterNodeInstanceType: environment === 'prod' ? 'r5.large.search' : undefined,
        dataNodes: environment === 'prod' ? 3 : 1,
        dataNodeInstanceType: environment === 'prod' ? 'r5.large.search' : 't3.small.search',
        // Enable warm nodes for production
        ...(environment === 'prod' && {
          warmNodes: 2,
          warmInstanceType: 'ultrawarm1.medium.search',
        }),
      },

      ebs: {
        volumeSize: environment === 'prod' ? 100 : 10,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
        encrypted: true,
      },

      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },

      vpcOptions: {
        subnets: subnets.subnets,
        securityGroups: [securityGroup],
      },

      logging: {
        slowSearchLogEnabled: true,
        appLogEnabled: true,
        slowIndexLogEnabled: true,
      },

      fineGrainedAccessControl: {
        masterUserArn: new iam.Role(this, 'OpenSearchMasterRole', {
          assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
          managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
          ],
        }).roleArn,
      },

      // Enable advanced features for production
      advancedOptions: {
        'rest.action.multi.allow_explicit_index': 'true',
        'override_main_response_version': 'true',
        ...(environment === 'prod' && {
          'indices.fielddata.cache.size': '40%',
          'indices.query.bool.max_clause_count': '2048',
        }),
      },

      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create indices on deployment
    const indexInitializer = new cdk.CustomResource(this, 'IndexInitializer', {
      serviceToken: new cdk.aws_lambda.Function(this, 'IndexInitializerFunction', {
        runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: cdk.aws_lambda.Code.fromInline(`
          const https = require('https');
          const aws4 = require('aws4');
          
          exports.handler = async (event) => {
            if (event.RequestType !== 'Create') {
              return { PhysicalResourceId: 'opensearch-indices' };
            }
            
            const endpoint = event.ResourceProperties.DomainEndpoint;
            const indices = [
              {
                name: 'entries',
                mappings: {
                  properties: {
                    id: { type: 'keyword' },
                    userId: { type: 'keyword' },
                    type: { type: 'keyword' },
                    title: { type: 'text', analyzer: 'standard' },
                    content: { type: 'text', analyzer: 'standard' },
                    tags: { type: 'keyword' },
                    status: { type: 'keyword' },
                    createdAt: { type: 'date' },
                    updatedAt: { type: 'date' },
                    suggest: {
                      type: 'completion',
                      analyzer: 'simple'
                    }
                  }
                },
                settings: {
                  number_of_shards: 1,
                  number_of_replicas: event.ResourceProperties.Environment === 'prod' ? 1 : 0,
                  analysis: {
                    analyzer: {
                      autocomplete: {
                        tokenizer: 'autocomplete',
                        filter: ['lowercase']
                      }
                    },
                    tokenizer: {
                      autocomplete: {
                        type: 'edge_ngram',
                        min_gram: 2,
                        max_gram: 10,
                        token_chars: ['letter', 'digit']
                      }
                    }
                  }
                }
              }
            ];
            
            for (const index of indices) {
              const options = {
                hostname: endpoint.replace('https://', ''),
                path: '/' + index.name,
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                }
              };
              
              const signed = aws4.sign(options, {
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                sessionToken: process.env.AWS_SESSION_TOKEN,
                service: 'es',
                region: process.env.AWS_REGION
              });
              
              await new Promise((resolve, reject) => {
                const req = https.request(signed, (res) => {
                  res.on('data', () => {});
                  res.on('end', resolve);
                });
                req.on('error', reject);
                req.write(JSON.stringify(index));
                req.end();
              });
            }
            
            return { PhysicalResourceId: 'opensearch-indices' };
          };
        `),
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [securityGroup],
        environment: {
          DOMAIN_ENDPOINT: this.domain.domainEndpoint,
          ENVIRONMENT: environment,
        },
        timeout: cdk.Duration.minutes(5),
      }).functionArn,
      properties: {
        DomainEndpoint: this.domain.domainEndpoint,
        Environment: environment,
      },
    });

    // Grant Lambda functions access to OpenSearch
    const opensearchAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'es:ESHttpGet',
        'es:ESHttpPost',
        'es:ESHttpPut',
        'es:ESHttpDelete',
        'es:ESHttpHead',
      ],
      resources: [`${this.domain.domainArn}/*`],
    });

    // Output
    this.domainEndpoint = this.domain.domainEndpoint;

    new cdk.CfnOutput(this, 'OpenSearchDomainEndpoint', {
      value: this.domain.domainEndpoint,
      description: 'OpenSearch domain endpoint',
    });

    new cdk.CfnOutput(this, 'OpenSearchDomainArn', {
      value: this.domain.domainArn,
      description: 'OpenSearch domain ARN',
    });
  }

  /**
   * Grant read access to OpenSearch domain
   */
  grantRead(grantee: iam.IGrantable): void {
    this.domain.grantRead(grantee);
  }

  /**
   * Grant write access to OpenSearch domain
   */
  grantWrite(grantee: iam.IGrantable): void {
    this.domain.grantWrite(grantee);
  }

  /**
   * Grant read/write access to OpenSearch domain
   */
  grantReadWrite(grantee: iam.IGrantable): void {
    this.domain.grantReadWrite(grantee);
  }

  /**
   * Get access policy statement for Lambda functions
   */
  getAccessPolicy(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'es:ESHttpGet',
        'es:ESHttpPost',
        'es:ESHttpPut',
        'es:ESHttpDelete',
        'es:ESHttpHead',
      ],
      resources: [`${this.domain.domainArn}/*`],
    });
  }
}