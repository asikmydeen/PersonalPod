export interface WebSocketMessage {
  id: string;
  type: WebSocketMessageType;
  action: WebSocketAction;
  payload: any;
  timestamp: Date;
  userId?: string;
  correlationId?: string;
}

export type WebSocketMessageType = 
  | 'entry'
  | 'category'
  | 'tag'
  | 'file'
  | 'notification'
  | 'sync'
  | 'presence'
  | 'system';

export type WebSocketAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'lock'
  | 'unlock'
  | 'sync'
  | 'presence'
  | 'subscribe'
  | 'unsubscribe'
  | 'ping'
  | 'pong'
  | 'error'
  | 'ack';

export interface WebSocketClient {
  id: string;
  userId: string;
  connectionId: string;
  deviceId?: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    platform?: string;
  };
}

export interface SyncState {
  userId: string;
  lastSyncTimestamp: Date;
  pendingChanges: SyncChange[];
  syncInProgress: boolean;
  deviceId: string;
}

export interface SyncChange {
  id: string;
  entityType: 'entry' | 'category' | 'tag';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  timestamp: Date;
  data?: any;
  conflictResolution?: 'client' | 'server' | 'merge';
}

export interface PresenceUpdate {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  activeDevices: number;
  currentActivity?: {
    type: 'viewing' | 'editing' | 'creating';
    entityType: string;
    entityId: string;
  };
}

export interface RealtimeNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: Date;
  expiresAt?: Date;
  actions?: NotificationAction[];
}

export type NotificationType =
  | 'entry_shared'
  | 'comment_added'
  | 'mention'
  | 'sync_conflict'
  | 'quota_warning'
  | 'security_alert'
  | 'system_update'
  | 'achievement';

export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: string;
  data?: any;
}

export interface WebSocketRoom {
  id: string;
  type: 'user' | 'entry' | 'category' | 'global';
  members: Set<string>; // Client IDs
  createdAt: Date;
  metadata?: any;
}

export interface ConnectionOptions {
  reconnect: boolean;
  reconnectDelay: number;
  reconnectMaxAttempts: number;
  heartbeatInterval: number;
  messageQueueSize: number;
  compression: boolean;
}