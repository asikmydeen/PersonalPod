import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';

export interface DatabaseConstructProps {
  vpc: ec2.Vpc;
  environment: string;
}

export class DatabaseConstruct extends Construct {
  public readonly instance: rds.DatabaseInstance;
  public readonly secret: secretsmanager.Secret;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly endpoint: string;
  public readonly port: string;

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const { vpc, environment } = props;

    // Create KMS key for encryption
    const encryptionKey = new kms.Key(this, 'DatabaseEncryptionKey', {
      alias: `personalpod-db-key-${environment}`,
      description: 'KMS key for PersonalPod RDS encryption',
      enableKeyRotation: true,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create security group for RDS
    this.securityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Security group for PersonalPod RDS instance',
      allowAllOutbound: false,
    });

    // Allow PostgreSQL traffic from within VPC
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL traffic from VPC'
    );

    // Create database credentials secret
    this.secret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `personalpod-db-secret-${environment}`,
      description: 'RDS PostgreSQL credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'dbadmin' }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
        passwordLength: 32,
      },
    });

    // Create subnet group for RDS (using private subnets)
    const subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc,
      description: 'Subnet group for PersonalPod RDS',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create parameter group for performance tuning
    const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_1,
      }),
      description: 'Custom parameter group for PersonalPod PostgreSQL',
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements',
        'log_statement': 'all',
        'log_duration': 'on',
        'log_min_duration_statement': '1000', // Log queries taking more than 1 second
        'max_connections': '200',
        'random_page_cost': '1.1', // Optimized for SSD
        'effective_cache_size': '3GB',
        'work_mem': '16MB',
        'maintenance_work_mem': '256MB',
        'checkpoint_completion_target': '0.9',
        'wal_buffers': '16MB',
        'default_statistics_target': '100',
        'effective_io_concurrency': '200', // For SSD
      },
    });

    // Create RDS instance
    this.instance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_1,
      }),
      instanceType: environment === 'prod'
        ? ec2.InstanceType.of(ec2.InstanceClass.M7G, ec2.InstanceSize.LARGE)
        : ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      subnetGroup,
      securityGroups: [this.securityGroup],
      credentials: rds.Credentials.fromSecret(this.secret),
      databaseName: 'personalpod',
      allocatedStorage: environment === 'prod' ? 100 : 20,
      maxAllocatedStorage: environment === 'prod' ? 1000 : 100,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      storageEncryptionKey: encryptionKey,
      multiAz: environment === 'prod',
      autoMinorVersionUpgrade: true,
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      backupRetention: cdk.Duration.days(7),
      deletionProtection: environment === 'prod',
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      monitoringInterval: cdk.Duration.seconds(60),
      monitoringRole: new cdk.aws_iam.Role(this, 'DatabaseMonitoringRole', {
        assumedBy: new cdk.aws_iam.ServicePrincipal('monitoring.rds.amazonaws.com'),
        managedPolicies: [
          cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonRDSEnhancedMonitoringRole'),
        ],
      }),
      parameterGroup,
      cloudwatchLogsExports: ['postgresql'],
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.SNAPSHOT,
    });

    // Store endpoint and port for output
    this.endpoint = this.instance.dbInstanceEndpointAddress;
    this.port = this.instance.dbInstanceEndpointPort;

    // Add CloudWatch alarms for production
    if (environment === 'prod') {
      // CPU utilization alarm
      new cdk.aws_cloudwatch.Alarm(this, 'HighCPUAlarm', {
        metric: this.instance.metricCPUUtilization(),
        threshold: 80,
        evaluationPeriods: 2,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
      });

      // Database connections alarm
      new cdk.aws_cloudwatch.Alarm(this, 'HighConnectionsAlarm', {
        metric: this.instance.metricDatabaseConnections(),
        threshold: 180, // 90% of max_connections (200)
        evaluationPeriods: 2,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
      });

      // Free storage space alarm
      new cdk.aws_cloudwatch.Alarm(this, 'LowStorageAlarm', {
        metric: this.instance.metricFreeStorageSpace(),
        threshold: 10 * 1024 * 1024 * 1024, // 10 GB in bytes
        evaluationPeriods: 1,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.BREACHING,
      });
    }
  }
}