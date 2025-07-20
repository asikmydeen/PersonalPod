import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { databaseService } from './database.service';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface VerificationToken {
  id: string;
  userId: string;
  token: string;
  type: 'email_verification' | 'password_reset';
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}

export class VerificationTokenService {
  private pool: Pool;

  constructor() {
    this.pool = databaseService.getPool();
  }

  /**
   * Generate a secure random token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a verification token
   */
  async createToken(
    userId: string,
    type: 'email_verification' | 'password_reset'
  ): Promise<VerificationToken> {
    const token = this.generateToken();
    const expirySeconds = type === 'email_verification' 
      ? config.email.verificationTokenExpiry 
      : config.email.passwordResetTokenExpiry;
    
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    try {
      // Invalidate any existing tokens of the same type for this user
      await this.invalidateUserTokens(userId, type);

      const query = `
        INSERT INTO email_verifications (user_id, token, type, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const result = await this.pool.query(query, [userId, token, type, expiresAt]);
      const row = result.rows[0];

      return {
        id: row.id,
        userId: row.user_id,
        token: row.token,
        type: row.type,
        expiresAt: row.expires_at,
        usedAt: row.used_at,
        createdAt: row.created_at,
      };
    } catch (error) {
      logger.error('Failed to create verification token:', error);
      throw new AppError('Failed to create verification token', 500);
    }
  }

  /**
   * Validate a verification token
   */
  async validateToken(
    token: string,
    type: 'email_verification' | 'password_reset'
  ): Promise<VerificationToken> {
    try {
      const query = `
        SELECT * FROM email_verifications
        WHERE token = $1 
          AND type = $2 
          AND expires_at > NOW() 
          AND used_at IS NULL
      `;

      const result = await this.pool.query(query, [token, type]);

      if (result.rows.length === 0) {
        throw new AppError('Invalid or expired token', 400);
      }

      const row = result.rows[0];

      return {
        id: row.id,
        userId: row.user_id,
        token: row.token,
        type: row.type,
        expiresAt: row.expires_at,
        usedAt: row.used_at,
        createdAt: row.created_at,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to validate verification token:', error);
      throw new AppError('Failed to validate token', 500);
    }
  }

  /**
   * Mark a token as used
   */
  async markTokenAsUsed(tokenId: string): Promise<void> {
    try {
      const query = `
        UPDATE email_verifications
        SET used_at = NOW()
        WHERE id = $1
      `;

      await this.pool.query(query, [tokenId]);
    } catch (error) {
      logger.error('Failed to mark token as used:', error);
      throw new AppError('Failed to update token', 500);
    }
  }

  /**
   * Invalidate all tokens of a specific type for a user
   */
  async invalidateUserTokens(
    userId: string,
    type: 'email_verification' | 'password_reset'
  ): Promise<void> {
    try {
      const query = `
        UPDATE email_verifications
        SET used_at = NOW()
        WHERE user_id = $1 
          AND type = $2 
          AND used_at IS NULL
      `;

      await this.pool.query(query, [userId, type]);
    } catch (error) {
      logger.error('Failed to invalidate user tokens:', error);
      // Don't throw here, as this is a cleanup operation
    }
  }

  /**
   * Clean up expired tokens (for maintenance)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const query = `
        DELETE FROM email_verifications
        WHERE expires_at < NOW() OR used_at IS NOT NULL
        RETURNING id
      `;

      const result = await this.pool.query(query);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }

  /**
   * Check if a user has a valid email verification token
   */
  async hasValidEmailVerificationToken(userId: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM email_verifications
        WHERE user_id = $1 
          AND type = 'email_verification' 
          AND expires_at > NOW() 
          AND used_at IS NULL
      `;

      const result = await this.pool.query(query, [userId]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error('Failed to check for valid email verification token:', error);
      return false;
    }
  }

  /**
   * Get count of recent tokens for rate limiting
   */
  async getRecentTokenCount(
    userId: string,
    type: 'email_verification' | 'password_reset',
    windowMs: number
  ): Promise<number> {
    try {
      const sinceDate = new Date(Date.now() - windowMs);
      const query = `
        SELECT COUNT(*) as count
        FROM email_verifications
        WHERE user_id = $1 
          AND type = $2 
          AND created_at > $3
      `;

      const result = await this.pool.query(query, [userId, type, sinceDate]);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('Failed to get recent token count:', error);
      return 0;
    }
  }
}

export const verificationTokenService = new VerificationTokenService();