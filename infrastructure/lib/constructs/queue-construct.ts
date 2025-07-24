import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface QueueConstructProps {
  environment: string;
}

export class QueueConstruct extends Construct {
  public readonly jobQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly notificationTopic: sns.Topic;
  public readonly emailProcessingQueue: sqs.Queue;
  public readonly fileProcessingQueue: sqs.Queue;
  public readonly searchIndexingQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: QueueConstructProps) {
    super(scope, id);

    const { environment } = props;

    // Create Dead Letter Queue
    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `PersonalPod-DLQ-${environment}`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Create main job queue with DLQ
    this.jobQueue = new sqs.Queue(this, 'JobQueue', {
      queueName: `PersonalPod-JobQueue-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Create email processing queue
    this.emailProcessingQueue = new sqs.Queue(this, 'EmailProcessingQueue', {
      queueName: `PersonalPod-EmailQueue-${environment}`,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Create file processing queue for larger timeout
    this.fileProcessingQueue = new sqs.Queue(this, 'FileProcessingQueue', {
      queueName: `PersonalPod-FileQueue-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(15), // Longer timeout for file processing
      retentionPeriod: cdk.Duration.days(2),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 2,
      },
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    // Create search indexing queue
    this.searchIndexingQueue = new sqs.Queue(this, 'SearchIndexingQueue', {
      queueName: `PersonalPod-SearchIndexQueue-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(2),
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      // Batch settings for efficient indexing
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
    });

    // Create SNS topic for notifications
    this.notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      topicName: `PersonalPod-Notifications-${environment}`,
      displayName: 'PersonalPod Notifications',
      // Enable encryption for production
      ...(environment === 'prod' && {
        masterKey: new cdk.aws_kms.Key(this, 'NotificationTopicKey', {
          enableKeyRotation: true,
          description: 'KMS key for PersonalPod notification topic',
        }),
      }),
    });

    // Subscribe queues to topic for fan-out pattern
    this.notificationTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(this.emailProcessingQueue, {
        rawMessageDelivery: true,
        filterPolicy: {
          notificationType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['email', 'welcome', 'password-reset', 'verification'],
          }),
        },
      })
    );

    // Add CloudWatch alarms for production
    if (environment === 'prod') {
      // Alarm for DLQ
      new cdk.aws_cloudwatch.Alarm(this, 'DLQAlarm', {
        metric: this.deadLetterQueue.metricNumberOfMessagesReceived(),
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: 'Messages in dead letter queue',
      });

      // Alarm for job queue age
      new cdk.aws_cloudwatch.Alarm(this, 'JobQueueAgeAlarm', {
        metric: this.jobQueue.metricApproximateAgeOfOldestMessage(),
        threshold: 300, // 5 minutes
        evaluationPeriods: 2,
        alarmDescription: 'Old messages in job queue',
      });

      // Alarm for file processing queue size
      new cdk.aws_cloudwatch.Alarm(this, 'FileQueueSizeAlarm', {
        metric: this.fileProcessingQueue.metricNumberOfMessagesVisible(),
        threshold: 100,
        evaluationPeriods: 2,
        alarmDescription: 'Too many messages in file processing queue',
      });
    }

    // Output queue URLs
    new cdk.CfnOutput(this, 'JobQueueUrl', {
      value: this.jobQueue.queueUrl,
      description: 'Job queue URL',
    });

    new cdk.CfnOutput(this, 'EmailQueueUrl', {
      value: this.emailProcessingQueue.queueUrl,
      description: 'Email processing queue URL',
    });

    new cdk.CfnOutput(this, 'FileQueueUrl', {
      value: this.fileProcessingQueue.queueUrl,
      description: 'File processing queue URL',
    });

    new cdk.CfnOutput(this, 'SearchIndexQueueUrl', {
      value: this.searchIndexingQueue.queueUrl,
      description: 'Search indexing queue URL',
    });

    new cdk.CfnOutput(this, 'NotificationTopicArn', {
      value: this.notificationTopic.topicArn,
      description: 'Notification topic ARN',
    });
  }

  /**
   * Grant send message permissions to a Lambda function
   */
  grantSendMessages(fn: lambda.IFunction): void {
    this.jobQueue.grantSendMessages(fn);
    this.emailProcessingQueue.grantSendMessages(fn);
    this.fileProcessingQueue.grantSendMessages(fn);
    this.searchIndexingQueue.grantSendMessages(fn);
    this.notificationTopic.grantPublish(fn);
  }

  /**
   * Grant consume message permissions to a Lambda function
   */
  grantConsumeMessages(fn: lambda.IFunction): void {
    this.jobQueue.grantConsumeMessages(fn);
    this.emailProcessingQueue.grantConsumeMessages(fn);
    this.fileProcessingQueue.grantConsumeMessages(fn);
    this.searchIndexingQueue.grantConsumeMessages(fn);
  }

  /**
   * Create queue processor Lambda function
   */
  createQueueProcessor(
    name: string,
    queue: sqs.Queue,
    handler: lambda.Function,
    options?: {
      batchSize?: number;
      maxBatchingWindow?: cdk.Duration;
      concurrency?: number;
    }
  ): lambda.EventSourceMapping {
    return new lambda.EventSourceMapping(this, `${name}EventSource`, {
      target: handler,
      eventSourceArn: queue.queueArn,
      batchSize: options?.batchSize || 10,
      maxBatchingWindowInSeconds: options?.maxBatchingWindow?.toSeconds() || 5,
      ...(options?.concurrency && {
        maxConcurrency: options.concurrency,
      }),
    });
  }
}