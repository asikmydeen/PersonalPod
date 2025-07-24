import * as WebSocket from 'ws';
import { Server as HTTPServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { verify } from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  WebSocketMessage,
  WebSocketClient,
  WebSocketRoom,
  SyncState,
  SyncChange,
  PresenceUpdate,
  RealtimeNotification,
  WebSocketMessageType,
  WebSocketAction
} from '../models/websocket';
import { userRepository } from '../repositories/user.repository';
import * as AWS from 'aws-sdk';

export class WebSocketService {
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocketClient> = new Map();
  private rooms: Map<string, WebSocketRoom> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set of client IDs
  private syncStates: Map<string, SyncState> = new Map();
  private sns: AWS.SNS;
  private sqs: AWS.SQS;
  private heartbeatInterval: NodeJS.Timer;

  constructor(server: HTTPServer) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this),
    });

    this.sns = new AWS.SNS({ region: config.aws.region });
    this.sqs = new AWS.SQS({ region: config.aws.region });

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  /**
   * Verify WebSocket client connection
   */
  private async verifyClient(
    info: { origin: string; secure: boolean; req: any },
    callback: (res: boolean, code?: number, message?: string) => void
  ): Promise<void> {
    try {
      const token = this.extractToken(info.req);
      if (!token) {
        callback(false, 401, 'Unauthorized');
        return;
      }

      const decoded = verify(token, config.jwt.accessSecret) as any;
      info.req.userId = decoded.userId;
      callback(true);
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      callback(false, 401, 'Unauthorized');
    }
  }

  /**
   * Extract token from request
   */
  private extractToken(req: any): string | null {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      return auth.substring(7);
    }

    // Check query parameters for token
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('token');
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', async (ws: WebSocket, req: any) => {
      const clientId = uuidv4();
      const userId = req.userId;

      // Create client object
      const client: WebSocketClient = {
        id: clientId,
        userId,
        connectionId: uuidv4(),
        connectedAt: new Date(),
        lastActivity: new Date(),
        subscriptions: new Set(),
        metadata: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.socket.remoteAddress,
        },
      };

      // Store client
      this.clients.set(clientId, client);

      // Add to user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(clientId);

      // Join user's personal room
      this.joinRoom(clientId, `user:${userId}`);

      // Send welcome message
      this.sendToClient(clientId, {
        id: uuidv4(),
        type: 'system',
        action: 'ack',
        payload: {
          clientId,
          connectionId: client.connectionId,
          message: 'Connected to PersonalPod WebSocket',
        },
        timestamp: new Date(),
      });

      // Notify presence update
      await this.broadcastPresenceUpdate(userId);

      // Setup client event handlers
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          await this.handleMessage(clientId, message);
        } catch (error) {
          logger.error('Error handling WebSocket message:', error);
          this.sendError(clientId, 'Invalid message format');
        }
      });

      ws.on('close', async () => {
        await this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
      });

      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastActivity = new Date();
        }
      });

      // Store WebSocket reference
      (ws as any).clientId = clientId;
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    switch (message.action) {
      case 'subscribe':
        await this.handleSubscribe(clientId, message);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribe(clientId, message);
        break;

      case 'sync':
        await this.handleSync(clientId, message);
        break;

      case 'presence':
        await this.handlePresence(clientId, message);
        break;

      case 'create':
      case 'update':
      case 'delete':
        await this.handleDataChange(clientId, message);
        break;

      case 'ping':
        this.sendToClient(clientId, {
          id: uuidv4(),
          type: 'system',
          action: 'pong',
          payload: { timestamp: new Date() },
          timestamp: new Date(),
          correlationId: message.id,
        });
        break;

      default:
        this.sendError(clientId, `Unknown action: ${message.action}`);
    }
  }

  /**
   * Handle subscription requests
   */
  private async handleSubscribe(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = message.payload;
    if (!channel) {
      this.sendError(clientId, 'Channel required for subscription');
      return;
    }

    // Validate subscription permission
    if (!this.canSubscribe(client.userId, channel)) {
      this.sendError(clientId, 'Unauthorized subscription');
      return;
    }

    client.subscriptions.add(channel);
    this.joinRoom(clientId, channel);

    this.sendToClient(clientId, {
      id: uuidv4(),
      type: 'system',
      action: 'ack',
      payload: {
        action: 'subscribe',
        channel,
        success: true,
      },
      timestamp: new Date(),
      correlationId: message.id,
    });
  }

  /**
   * Handle unsubscribe requests
   */
  private async handleUnsubscribe(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channel } = message.payload;
    if (!channel) {
      this.sendError(clientId, 'Channel required for unsubscription');
      return;
    }

    client.subscriptions.delete(channel);
    this.leaveRoom(clientId, channel);

    this.sendToClient(clientId, {
      id: uuidv4(),
      type: 'system',
      action: 'ack',
      payload: {
        action: 'unsubscribe',
        channel,
        success: true,
      },
      timestamp: new Date(),
      correlationId: message.id,
    });
  }

  /**
   * Handle sync requests
   */
  private async handleSync(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { lastSyncTimestamp, changes } = message.payload;

    // Get or create sync state
    let syncState = this.syncStates.get(client.userId);
    if (!syncState) {
      syncState = {
        userId: client.userId,
        lastSyncTimestamp: new Date(lastSyncTimestamp || 0),
        pendingChanges: [],
        syncInProgress: false,
        deviceId: message.payload.deviceId || clientId,
      };
      this.syncStates.set(client.userId, syncState);
    }

    // Process incoming changes
    if (changes && Array.isArray(changes)) {
      for (const change of changes) {
        await this.processSyncChange(client.userId, change);
      }
    }

    // Send pending changes back to client
    const pendingChanges = await this.getPendingChanges(client.userId, syncState.lastSyncTimestamp);

    this.sendToClient(clientId, {
      id: uuidv4(),
      type: 'sync',
      action: 'sync',
      payload: {
        changes: pendingChanges,
        lastSyncTimestamp: new Date(),
        syncComplete: true,
      },
      timestamp: new Date(),
      correlationId: message.id,
    });

    // Update sync state
    syncState.lastSyncTimestamp = new Date();
  }

  /**
   * Handle presence updates
   */
  private async handlePresence(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { status, currentActivity } = message.payload;

    const presenceUpdate: PresenceUpdate = {
      userId: client.userId,
      status: status || 'online',
      lastSeen: new Date(),
      activeDevices: this.userConnections.get(client.userId)?.size || 1,
      currentActivity,
    };

    // Broadcast to user's connections
    await this.broadcastToUser(client.userId, {
      id: uuidv4(),
      type: 'presence',
      action: 'presence',
      payload: presenceUpdate,
      timestamp: new Date(),
    });
  }

  /**
   * Handle data changes
   */
  private async handleDataChange(clientId: string, message: WebSocketMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Queue change for processing
    await this.sqs.sendMessage({
      QueueUrl: process.env.JOB_QUEUE_URL || '',
      MessageBody: JSON.stringify({
        type: 'websocket_data_change',
        userId: client.userId,
        message,
      }),
    }).promise();

    // Broadcast change to other devices
    const otherClients = Array.from(this.userConnections.get(client.userId) || [])
      .filter(id => id !== clientId);

    for (const otherClientId of otherClients) {
      this.sendToClient(otherClientId, {
        ...message,
        userId: client.userId,
      });
    }

    // Send acknowledgment
    this.sendToClient(clientId, {
      id: uuidv4(),
      type: 'system',
      action: 'ack',
      payload: {
        action: message.action,
        entityId: message.payload.id,
        success: true,
      },
      timestamp: new Date(),
      correlationId: message.id,
    });
  }

  /**
   * Handle client disconnect
   */
  private async handleDisconnect(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    for (const [roomId, room] of this.rooms) {
      room.members.delete(clientId);
      if (room.members.size === 0 && room.type !== 'global') {
        this.rooms.delete(roomId);
      }
    }

    // Remove from user connections
    const userClients = this.userConnections.get(client.userId);
    if (userClients) {
      userClients.delete(clientId);
      if (userClients.size === 0) {
        this.userConnections.delete(client.userId);
      }
    }

    // Remove client
    this.clients.delete(clientId);

    // Notify presence update
    await this.broadcastPresenceUpdate(client.userId);

    logger.info(`Client ${clientId} disconnected`);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const ws = this.getWebSocket(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  private sendError(clientId: string, error: string): void {
    this.sendToClient(clientId, {
      id: uuidv4(),
      type: 'system',
      action: 'error',
      payload: { error },
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast message to all clients of a user
   */
  async broadcastToUser(userId: string, message: WebSocketMessage): Promise<void> {
    const clientIds = this.userConnections.get(userId) || new Set();
    for (const clientId of clientIds) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Broadcast message to a room
   */
  async broadcastToRoom(roomId: string, message: WebSocketMessage, excludeClient?: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const clientId of room.members) {
      if (clientId !== excludeClient) {
        this.sendToClient(clientId, message);
      }
    }
  }

  /**
   * Send notification to user
   */
  async sendNotification(userId: string, notification: RealtimeNotification): Promise<void> {
    const message: WebSocketMessage = {
      id: uuidv4(),
      type: 'notification',
      action: 'create',
      payload: notification,
      timestamp: new Date(),
      userId,
    };

    await this.broadcastToUser(userId, message);

    // Also send via SNS for offline delivery
    await this.sns.publish({
      TopicArn: process.env.NOTIFICATION_TOPIC_ARN,
      Message: JSON.stringify(notification),
      MessageAttributes: {
        userId: { DataType: 'String', StringValue: userId },
        notificationType: { DataType: 'String', StringValue: notification.type },
      },
    }).promise();
  }

  /**
   * Join a room
   */
  private joinRoom(clientId: string, roomId: string): void {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        type: roomId.startsWith('user:') ? 'user' : 'entry',
        members: new Set(),
        createdAt: new Date(),
      };
      this.rooms.set(roomId, room);
    }
    room.members.add(clientId);
  }

  /**
   * Leave a room
   */
  private leaveRoom(clientId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.members.delete(clientId);
      if (room.members.size === 0 && room.type !== 'global') {
        this.rooms.delete(roomId);
      }
    }
  }

  /**
   * Check if user can subscribe to channel
   */
  private canSubscribe(userId: string, channel: string): boolean {
    // User can subscribe to their own channels
    if (channel === `user:${userId}`) return true;
    
    // Check if user has access to specific entity channels
    // This would involve checking permissions in the database
    
    return true; // Simplified for now
  }

  /**
   * Get WebSocket instance for client
   */
  private getWebSocket(clientId: string): WebSocket | null {
    for (const client of this.wss.clients) {
      if ((client as any).clientId === clientId) {
        return client as WebSocket;
      }
    }
    return null;
  }

  /**
   * Broadcast presence update
   */
  private async broadcastPresenceUpdate(userId: string): Promise<void> {
    const activeDevices = this.userConnections.get(userId)?.size || 0;
    const status = activeDevices > 0 ? 'online' : 'offline';

    const presenceUpdate: PresenceUpdate = {
      userId,
      status,
      lastSeen: new Date(),
      activeDevices,
    };

    // Broadcast to all user's connections
    await this.broadcastToUser(userId, {
      id: uuidv4(),
      type: 'presence',
      action: 'presence',
      payload: presenceUpdate,
      timestamp: new Date(),
    });
  }

  /**
   * Process sync change
   */
  private async processSyncChange(userId: string, change: SyncChange): Promise<void> {
    // Queue change for processing
    await this.sqs.sendMessage({
      QueueUrl: process.env.JOB_QUEUE_URL || '',
      MessageBody: JSON.stringify({
        type: 'sync_change',
        userId,
        change,
      }),
    }).promise();
  }

  /**
   * Get pending changes for sync
   */
  private async getPendingChanges(userId: string, since: Date): Promise<SyncChange[]> {
    // This would query the database for changes since the last sync
    // For now, return empty array
    return [];
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        const ws = this.getWebSocket(clientId);
        if (!ws) continue;

        const timeSinceLastActivity = Date.now() - client.lastActivity.getTime();
        
        // Disconnect inactive clients
        if (timeSinceLastActivity > 60000) { // 1 minute
          ws.terminate();
          continue;
        }

        // Send ping
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Shutdown WebSocket service
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const client of this.wss.clients) {
      client.close(1001, 'Server shutting down');
    }

    this.wss.close();
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalClients: number;
    totalRooms: number;
    activeUsers: number;
    clientsByUser: Map<string, number>;
  } {
    const clientsByUser = new Map<string, number>();
    for (const [userId, clients] of this.userConnections) {
      clientsByUser.set(userId, clients.size);
    }

    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      activeUsers: this.userConnections.size,
      clientsByUser,
    };
  }
}

// Export singleton instance (initialized in server setup)
export let websocketService: WebSocketService;