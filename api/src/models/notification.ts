export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: any;
  readAt?: Date;
  deliveredAt?: Date;
  expiresAt?: Date;
  actions?: NotificationAction[];
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType =
  | 'entry_reminder'
  | 'entry_shared'
  | 'comment_added'
  | 'mention'
  | 'achievement_unlocked'
  | 'backup_completed'
  | 'backup_failed'
  | 'storage_warning'
  | 'security_alert'
  | 'password_expiry'
  | 'mfa_reminder'
  | 'sync_conflict'
  | 'system_update'
  | 'subscription_renewal'
  | 'weekly_summary'
  | 'monthly_insights';

export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';

export type NotificationStatus = 'pending' | 'delivered' | 'read' | 'failed' | 'expired';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: string;
  data?: any;
}

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: any;
  expiresAt?: Date;
  actions?: NotificationAction[];
  scheduledFor?: Date;
}

export interface NotificationPreferences {
  userId: string;
  email: {
    enabled: boolean;
    frequency: 'instant' | 'hourly' | 'daily' | 'weekly';
    types: NotificationType[];
  };
  push: {
    enabled: boolean;
    types: NotificationType[];
    quietHours?: {
      start: string; // HH:mm format
      end: string;   // HH:mm format
      timezone: string;
    };
  };
  sms: {
    enabled: boolean;
    types: NotificationType[];
    phoneNumber?: string;
  };
  inApp: {
    enabled: boolean;
    types: NotificationType[];
  };
  doNotDisturb: {
    enabled: boolean;
    schedule?: Array<{
      dayOfWeek: number; // 0-6
      startTime: string;  // HH:mm
      endTime: string;    // HH:mm
    }>;
  };
}

export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  template: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationBatch {
  id: string;
  type: NotificationType;
  userIds: string[];
  channels: NotificationChannel[];
  template: string;
  data: Record<string, any>;
  scheduledFor?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stats?: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    read: number;
  };
  createdAt: Date;
  completedAt?: Date;
}

export interface NotificationLog {
  id: string;
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  error?: string;
  metadata?: {
    messageId?: string;
    provider?: string;
    deviceToken?: string;
    email?: string;
    phoneNumber?: string;
  };
  sentAt: Date;
  deliveredAt?: Date;
  failedAt?: Date;
}