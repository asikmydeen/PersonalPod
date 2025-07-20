import argon2 from 'argon2';
import { db } from './database.service';
import { logger } from '../utils/logger';

export interface PasswordRecord {
  user_id: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export class PasswordService {
  private tableName = 'user_passwords';

  /**
   * Hash a password using Argon2
   */
  async hash(password: string): Promise<string> {
    return await argon2.hash(password);
  }

  /**
   * Verify a password against a hash
   */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      logger.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Store user password hash
   */
  async storePassword(userId: string, password: string): Promise<void> {
    const passwordHash = await this.hash(password);
    
    const query = `
      INSERT INTO ${this.tableName} (user_id, password_hash, created_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE
      SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
    `;
    
    await db.query(query, [userId, passwordHash]);
    logger.info(`Password stored for user: ${userId}`);
  }

  /**
   * Get password hash for a user
   */
  async getPasswordHash(userId: string): Promise<string | null> {
    const query = `SELECT password_hash FROM ${this.tableName} WHERE user_id = $1`;
    const result = await db.queryOne<{ password_hash: string }>(query, [userId]);
    return result?.password_hash || null;
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    await this.storePassword(userId, newPassword);
  }

  /**
   * Verify user password
   */
  async verifyUserPassword(userId: string, password: string): Promise<boolean> {
    const hash = await this.getPasswordHash(userId);
    if (!hash) {
      return false;
    }
    return await this.verify(hash, password);
  }

  /**
   * Delete user password
   */
  async deletePassword(userId: string): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE user_id = $1`;
    await db.query(query, [userId]);
  }

  /**
   * Verify a password against a hash (static version for AuthService)
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return this.verify(hash, password);
  }
}

// Export singleton instance
export const passwordService = new PasswordService();