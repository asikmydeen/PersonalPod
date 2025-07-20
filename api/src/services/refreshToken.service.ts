import { v4 as uuidv4 } from 'uuid';
import { db } from './database.service';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export class RefreshTokenService {
  private tableName = 'refresh_tokens';
  private expirationDays = 30; // Default 30 days

  /**
   * Create a new refresh token for a user
   */
  async create(userId: string, token: string): Promise<RefreshTokenRecord> {
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

    const query = `
      INSERT INTO ${this.tableName} (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await db.queryOne<RefreshTokenRecord>(query, [userId, token, expiresAt]);
    if (!result) {
      throw new Error('Failed to create refresh token');
    }

    logger.info(`Refresh token created for user: ${userId}`);
    return result;
  }

  /**
   * Find a refresh token
   */
  async findByToken(token: string): Promise<RefreshTokenRecord | null> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP
    `;
    return await db.queryOne<RefreshTokenRecord>(query, [token]);
  }

  /**
   * Find all refresh tokens for a user
   */
  async findByUserId(userId: string): Promise<RefreshTokenRecord[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `;
    return await db.queryMany<RefreshTokenRecord>(query, [userId]);
  }

  /**
   * Revoke a refresh token
   */
  async revoke(token: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE token = $1 RETURNING id`;
    const result = await db.queryOne<{ id: string }>(query, [token]);
    if (result) {
      logger.info('Refresh token revoked');
    }
    return result !== null;
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const query = `DELETE FROM ${this.tableName} WHERE user_id = $1`;
    const result = await db.query(query, [userId]);
    const count = result.rowCount || 0;
    if (count > 0) {
      logger.info(`Revoked ${count} refresh tokens for user: ${userId}`);
    }
    return count;
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpired(): Promise<number> {
    const query = `DELETE FROM ${this.tableName} WHERE expires_at <= CURRENT_TIMESTAMP`;
    const result = await db.query(query);
    const count = result.rowCount || 0;
    if (count > 0) {
      logger.info(`Cleaned up ${count} expired refresh tokens`);
    }
    return count;
  }

  /**
   * Rotate refresh token (create new, revoke old)
   */
  async rotate(oldToken: string, userId: string, newToken: string): Promise<RefreshTokenRecord> {
    return await db.transaction(async (client) => {
      // Revoke old token
      await client.query(
        `DELETE FROM ${this.tableName} WHERE token = $1`,
        [oldToken]
      );

      // Create new token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

      const result = await client.query<RefreshTokenRecord>(
        `INSERT INTO ${this.tableName} (user_id, token, expires_at)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, newToken, expiresAt]
      );

      if (!result.rows[0]) {
        throw new Error('Failed to create new refresh token');
      }

      logger.info(`Refresh token rotated for user: ${userId}`);
      return result.rows[0];
    });
  }

  /**
   * Validate refresh token
   */
  async validate(token: string): Promise<{ isValid: boolean; userId?: string }> {
    const record = await this.findByToken(token);
    if (!record) {
      return { isValid: false };
    }

    // Check if token is expired
    if (new Date(record.expires_at) <= new Date()) {
      await this.revoke(token);
      return { isValid: false };
    }

    return { isValid: true, userId: record.user_id };
  }
}

// Export singleton instance
export const refreshTokenService = new RefreshTokenService();