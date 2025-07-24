import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import {
  Notification,
  CreateNotificationDto,
  NotificationPreferences,
  NotificationTemplate,
  NotificationBatch,
  NotificationLog,
  NotificationChannel,
  NotificationType,
  NotificationStatus,
  NotificationPriority
} from '../models/notification';
import { userRepository } from '../repositories/user.repository';
import { emailService } from './email.service';
import { websocketService } from './websocket.service';
import { RealtimeNotification } from '../models/websocket';
import * as handlebars from 'handlebars';

export class NotificationService {
  private sns: AWS.SNS;
  private sqs: AWS.SQS;
  private ses: AWS.SES;
  private dynamodb: AWS.DynamoDB.DocumentClient;
  private notificationTableName: string;
  private preferencesTableName: string;
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor() {
    this.sns = new AWS.SNS({ region: config.aws.region });
    this.sqs = new AWS.SQS({ region: config.aws.region });
    this.ses = new AWS.SES({ region: config.aws.region });
    this.dynamodb = new AWS.DynamoDB.DocumentClient({ region: config.aws.region });
    this.notificationTableName = `PersonalPod-Notifications-${process.env.ENVIRONMENT || 'dev'}`;
    this.preferencesTableName = `PersonalPod-NotificationPreferences-${process.env.ENVIRONMENT || 'dev'}`;
    
    this.loadTemplates();
  }

  /**
   * Send notification to user
   */
  async sendNotification(dto: CreateNotificationDto): Promise<Notification> {
    // Get user preferences
    const preferences = await this.getUserPreferences(dto.userId);
    
    // Check if user wants this type of notification
    const enabledChannels = this.getEnabledChannels(preferences, dto.type, dto.channels);
    
    if (enabledChannels.length === 0) {
      logger.info(`No enabled channels for notification type ${dto.type} for user ${dto.userId}`);
      return this.createNotificationRecord(dto, 'expired');
    }

    // Check Do Not Disturb
    if (this.isInDoNotDisturb(preferences)) {
      // Schedule for later if not urgent
      if (dto.priority !== 'urgent') {
        const scheduledFor = this.getNextAvailableTime(preferences);
        return await this.scheduleNotification({ ...dto, scheduledFor });
      }
    }

    // Create notification record
    const notification = await this.createNotificationRecord(dto, 'pending');

    // Send through each enabled channel
    const sendPromises = enabledChannels.map(channel => 
      this.sendThroughChannel(notification, channel, preferences)
    );

    await Promise.allSettled(sendPromises);

    return notification;
  }

  /**
   * Send notification through specific channel
   */
  private async sendThroughChannel(
    notification: Notification,
    channel: NotificationChannel,
    preferences: NotificationPreferences
  ): Promise<void> {
    try {
      switch (channel) {
        case 'in_app':
          await this.sendInAppNotification(notification);
          break;
          
        case 'email':
          await this.sendEmailNotification(notification, preferences);
          break;
          
        case 'push':
          await this.sendPushNotification(notification, preferences);
          break;
          
        case 'sms':
          await this.sendSMSNotification(notification, preferences);
          break;
      }

      // Log successful delivery
      await this.logNotificationDelivery(notification.id, channel, 'delivered');
    } catch (error) {
      logger.error(`Failed to send notification through ${channel}:`, error);
      await this.logNotificationDelivery(notification.id, channel, 'failed', error);
    }
  }

  /**
   * Send in-app notification via WebSocket
   */
  private async sendInAppNotification(notification: Notification): Promise<void> {
    const realtimeNotification: RealtimeNotification = {
      id: notification.id,
      userId: notification.userId,
      type: notification.type as any,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      timestamp: notification.createdAt,
      expiresAt: notification.expiresAt,
      actions: notification.actions,
    };

    await websocketService.sendNotification(notification.userId, realtimeNotification);
    
    // Update notification status
    await this.updateNotificationStatus(notification.id, 'delivered');
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<void> {
    // Get user email
    const user = await userRepository.findById(notification.userId);
    if (!user || !user.email) {
      throw new Error('User email not found');
    }

    // Get email template
    const template = this.getTemplate(notification.type, 'email');
    if (!template) {
      throw new Error(`No email template found for ${notification.type}`);
    }

    // Compile template
    const compiledTemplate = handlebars.compile(template.template);
    const html = compiledTemplate({
      title: notification.title,
      message: notification.message,
      ...notification.data,
      actions: notification.actions,
      year: new Date().getFullYear(),
    });

    // Send email
    await emailService.sendEmail({
      to: user.email,
      subject: template.subject || notification.title,
      html,
      text: notification.message,
    });

    // Update notification status
    await this.updateNotificationStatus(notification.id, 'delivered');
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<void> {
    // Get user's device tokens from DynamoDB
    const deviceTokens = await this.getUserDeviceTokens(notification.userId);
    
    if (deviceTokens.length === 0) {
      logger.info(`No device tokens found for user ${notification.userId}`);
      return;
    }

    // Create platform-specific messages
    const messages = deviceTokens.map(token => ({
      token: token.token,
      platform: token.platform,
      message: {
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: {
          notificationId: notification.id,
          type: notification.type,
          ...notification.data,
        },
        ...(token.platform === 'ios' && {
          apns: {
            payload: {
              aps: {
                alert: {
                  title: notification.title,
                  body: notification.message,
                },
                badge: 1,
                sound: 'default',
                'mutable-content': 1,
              },
            },
          },
        }),
        ...(token.platform === 'android' && {
          android: {
            priority: notification.priority === 'urgent' ? 'high' : 'normal',
            notification: {
              icon: 'ic_notification',
              color: '#1976D2',
            },
          },
        }),
      },
    }));

    // Send through SNS
    const sendPromises = messages.map(msg => 
      this.sns.publish({
        Message: JSON.stringify(msg.message),
        MessageAttributes: {
          platform: { DataType: 'String', StringValue: msg.platform },
        },
        TargetArn: msg.token,
      }).promise()
    );

    await Promise.allSettled(sendPromises);
    
    // Update notification status
    await this.updateNotificationStatus(notification.id, 'delivered');
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(
    notification: Notification,
    preferences: NotificationPreferences
  ): Promise<void> {
    if (!preferences.sms.phoneNumber) {
      logger.info(`No phone number found for user ${notification.userId}`);
      return;
    }

    // Create SMS message
    const message = `PersonalPod: ${notification.title}\n${notification.message}`;

    // Send through SNS
    await this.sns.publish({
      Message: message.substring(0, 160), // SMS limit
      PhoneNumber: preferences.sms.phoneNumber,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: notification.priority === 'urgent' ? 'Transactional' : 'Promotional',
        },
      },
    }).promise();

    // Update notification status
    await this.updateNotificationStatus(notification.id, 'delivered');
  }

  /**
   * Schedule notification for later
   */
  async scheduleNotification(dto: CreateNotificationDto & { scheduledFor: Date }): Promise<Notification> {
    const notification = await this.createNotificationRecord(dto, 'pending');
    
    // Calculate delay
    const delay = Math.max(0, dto.scheduledFor.getTime() - Date.now());
    
    // Send to SQS with delay
    await this.sqs.sendMessage({
      QueueUrl: process.env.EMAIL_QUEUE_URL || '',
      MessageBody: JSON.stringify({
        type: 'scheduled_notification',
        notification,
        dto,
      }),
      DelaySeconds: Math.min(Math.floor(delay / 1000), 900), // Max 15 minutes SQS delay
    }).promise();

    return notification;
  }

  /**
   * Send batch notifications
   */
  async sendBatchNotification(
    userIds: string[],
    template: string,
    data: Record<string, any>,
    options?: {
      type?: NotificationType;
      channels?: NotificationChannel[];
      priority?: NotificationPriority;
      scheduledFor?: Date;
    }
  ): Promise<NotificationBatch> {
    const batchId = uuidv4();
    
    // Create batch record
    const batch: NotificationBatch = {
      id: batchId,
      type: options?.type || 'system_update',
      userIds,
      channels: options?.channels || ['in_app', 'email'],
      template,
      data,
      scheduledFor: options?.scheduledFor,
      status: 'pending',
      stats: {
        total: userIds.length,
        sent: 0,
        delivered: 0,
        failed: 0,
        read: 0,
      },
      createdAt: new Date(),
    };

    // Save batch record
    await this.dynamodb.put({
      TableName: this.notificationTableName,
      Item: {
        ...batch,
        pk: `BATCH#${batchId}`,
        sk: 'METADATA',
      },
    }).promise();

    // Queue notifications for each user
    const chunks = this.chunkArray(userIds, 25); // Process in chunks
    
    for (const chunk of chunks) {
      await this.sqs.sendMessage({
        QueueUrl: process.env.JOB_QUEUE_URL || '',
        MessageBody: JSON.stringify({
          type: 'batch_notification',
          batchId,
          userIds: chunk,
          template,
          data,
          options,
        }),
      }).promise();
    }

    return batch;
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const result = await this.dynamodb.get({
        TableName: this.preferencesTableName,
        Key: {
          userId,
        },
      }).promise();

      return result.Item as NotificationPreferences || this.getDefaultPreferences(userId);
    } catch (error) {
      logger.error('Error getting notification preferences:', error);
      return this.getDefaultPreferences(userId);
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const current = await this.getUserPreferences(userId);
    const updated = { ...current, ...preferences, userId };

    await this.dynamodb.put({
      TableName: this.preferencesTableName,
      Item: updated,
    }).promise();

    return updated;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.updateNotificationStatus(notificationId, 'read');
    
    // Send real-time update
    await websocketService.broadcastToUser(userId, {
      id: uuidv4(),
      type: 'notification',
      action: 'update',
      payload: {
        notificationId,
        status: 'read',
        readAt: new Date(),
      },
      timestamp: new Date(),
    });
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    options?: {
      status?: NotificationStatus;
      type?: NotificationType;
      limit?: number;
      lastEvaluatedKey?: any;
    }
  ): Promise<{
    notifications: Notification[];
    lastEvaluatedKey?: any;
  }> {
    const params: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: this.notificationTableName,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
      },
      ScanIndexForward: false, // Newest first
      Limit: options?.limit || 20,
    };

    if (options?.lastEvaluatedKey) {
      params.ExclusiveStartKey = options.lastEvaluatedKey;
    }

    if (options?.status || options?.type) {
      const filterExpressions: string[] = [];
      
      if (options.status) {
        filterExpressions.push('#status = :status');
        params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#status': 'status' };
        params.ExpressionAttributeValues![':status'] = options.status;
      }
      
      if (options.type) {
        filterExpressions.push('#type = :type');
        params.ExpressionAttributeNames = { ...params.ExpressionAttributeNames, '#type': 'type' };
        params.ExpressionAttributeValues![':type'] = options.type;
      }
      
      params.FilterExpression = filterExpressions.join(' AND ');
    }

    const result = await this.dynamodb.query(params).promise();

    return {
      notifications: (result.Items || []) as Notification[],
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
    byChannel: Record<NotificationChannel, number>;
  }> {
    // This would typically be optimized with aggregation
    const { notifications } = await this.getUserNotifications(userId, { limit: 1000 });
    
    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => n.status === 'pending' || n.status === 'delivered').length,
      byType: {} as Record<NotificationType, number>,
      byChannel: {} as Record<NotificationChannel, number>,
    };

    notifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      stats.byChannel[n.channel] = (stats.byChannel[n.channel] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // This would be implemented as a batch job
    let deleted = 0;
    
    // Query and delete old notifications
    // Implementation would scan and batch delete
    
    logger.info(`Cleaned up ${deleted} old notifications`);
    return deleted;
  }

  /**
   * Create notification record
   */
  private async createNotificationRecord(
    dto: CreateNotificationDto,
    status: NotificationStatus
  ): Promise<Notification> {
    const notification: Notification = {
      id: uuidv4(),
      userId: dto.userId,
      type: dto.type,
      channel: dto.channels[0], // Primary channel
      status,
      priority: dto.priority || 'medium',
      title: dto.title,
      message: dto.message,
      data: dto.data,
      expiresAt: dto.expiresAt,
      actions: dto.actions,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.dynamodb.put({
      TableName: this.notificationTableName,
      Item: {
        ...notification,
        pk: `USER#${dto.userId}`,
        sk: `NOTIFICATION#${notification.createdAt.toISOString()}#${notification.id}`,
      },
    }).promise();

    return notification;
  }

  /**
   * Update notification status
   */
  private async updateNotificationStatus(
    notificationId: string,
    status: NotificationStatus
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (status === 'read') {
      updateData.readAt = new Date();
    }

    // Update would be implemented based on actual table structure
    logger.info(`Updated notification ${notificationId} status to ${status}`);
  }

  /**
   * Log notification delivery
   */
  private async logNotificationDelivery(
    notificationId: string,
    channel: NotificationChannel,
    status: 'sent' | 'delivered' | 'failed' | 'bounced',
    error?: any
  ): Promise<void> {
    const log: NotificationLog = {
      id: uuidv4(),
      notificationId,
      userId: '', // Would be fetched from notification
      channel,
      status,
      error: error?.message,
      sentAt: new Date(),
      ...(status === 'delivered' && { deliveredAt: new Date() }),
      ...(status === 'failed' && { failedAt: new Date() }),
    };

    await this.dynamodb.put({
      TableName: this.notificationTableName,
      Item: {
        ...log,
        pk: `LOG#${notificationId}`,
        sk: `${channel}#${log.sentAt.toISOString()}`,
      },
    }).promise();
  }

  /**
   * Get enabled channels based on preferences
   */
  private getEnabledChannels(
    preferences: NotificationPreferences,
    type: NotificationType,
    requestedChannels: NotificationChannel[]
  ): NotificationChannel[] {
    return requestedChannels.filter(channel => {
      const channelPrefs = preferences[channel];
      if (!channelPrefs?.enabled) return false;
      
      // Check if this notification type is enabled for this channel
      if (channelPrefs.types && !channelPrefs.types.includes(type)) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Check if user is in Do Not Disturb mode
   */
  private isInDoNotDisturb(preferences: NotificationPreferences): boolean {
    if (!preferences.doNotDisturb?.enabled) return false;
    
    if (!preferences.doNotDisturb.schedule?.length) {
      return true; // Always DND if enabled without schedule
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return preferences.doNotDisturb.schedule.some(schedule => 
      schedule.dayOfWeek === currentDay &&
      currentTime >= schedule.startTime &&
      currentTime <= schedule.endTime
    );
  }

  /**
   * Get next available time after DND
   */
  private getNextAvailableTime(preferences: NotificationPreferences): Date {
    // Simplified - would calculate based on DND schedule
    const next = new Date();
    next.setHours(next.getHours() + 1);
    return next;
  }

  /**
   * Get user device tokens
   */
  private async getUserDeviceTokens(userId: string): Promise<Array<{
    token: string;
    platform: 'ios' | 'android';
  }>> {
    // Would fetch from database
    return [];
  }

  /**
   * Get notification template
   */
  private getTemplate(type: NotificationType, channel: NotificationChannel): NotificationTemplate | undefined {
    return this.templates.get(`${type}:${channel}`);
  }

  /**
   * Load notification templates
   */
  private loadTemplates(): void {
    // Would load from database or config
    // For now, create some default templates
    
    this.templates.set('entry_reminder:email', {
      id: '1',
      type: 'entry_reminder',
      channel: 'email',
      subject: 'PersonalPod Reminder: {{title}}',
      template: `
        <h2>{{title}}</h2>
        <p>{{message}}</p>
        {{#if actions}}
          <div>
            {{#each actions}}
              <a href="{{this.data.url}}" style="...">{{this.label}}</a>
            {{/each}}
          </div>
        {{/if}}
      `,
      variables: ['title', 'message', 'actions'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      email: {
        enabled: true,
        frequency: 'instant',
        types: ['security_alert', 'password_expiry', 'backup_failed'],
      },
      push: {
        enabled: true,
        types: ['entry_reminder', 'mention', 'security_alert'],
      },
      sms: {
        enabled: false,
        types: ['security_alert'],
      },
      inApp: {
        enabled: true,
        types: [], // All types
      },
      doNotDisturb: {
        enabled: false,
      },
    };
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();