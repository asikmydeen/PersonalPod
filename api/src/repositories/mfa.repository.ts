import { db } from '../services/database.service';
import { AppError } from '../utils/errors';
import crypto from 'crypto';

export interface UserMFA {
  id: string;
  user_id: string;
  secret: string;
  enabled: boolean;
  backup_codes_generated_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BackupCode {
  id: string;
  user_id: string;
  code_hash: string;
  used: boolean;
  used_at: Date | null;
  created_at: Date;
}

export class MFARepository {
  /**
   * Create or update MFA settings for a user
   */
  async upsertMFASettings(userId: string, secret: string): Promise<UserMFA> {
    const query = `
      INSERT INTO user_mfa (user_id, secret)
      VALUES ($1, $2)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        secret = EXCLUDED.secret,
        enabled = false,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.queryOne<UserMFA>(query, [userId, secret]);
    if (!result) {
      throw new AppError('Failed to create MFA settings', 500);
    }

    return result;
  }

  /**
   * Get MFA settings for a user
   */
  async getMFASettings(userId: string): Promise<UserMFA | null> {
    const query = 'SELECT * FROM user_mfa WHERE user_id = $1';
    return db.queryOne<UserMFA>(query, [userId]);
  }

  /**
   * Enable MFA for a user
   */
  async enableMFA(userId: string): Promise<void> {
    const query = `
      UPDATE user_mfa 
      SET enabled = true, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    if (result.rowCount === 0) {
      throw new AppError('MFA settings not found', 404);
    }

    // Also update the users table
    await db.query(
      'UPDATE users SET mfa_enabled = true WHERE id = $1',
      [userId]
    );
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: string): Promise<void> {
    const query = `
      UPDATE user_mfa 
      SET enabled = false, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1
    `;

    await db.query(query, [userId]);

    // Also update the users table
    await db.query(
      'UPDATE users SET mfa_enabled = false WHERE id = $1',
      [userId]
    );

    // Delete all backup codes
    await this.deleteAllBackupCodes(userId);
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(userId: string): Promise<void> {
    const query = `
      UPDATE user_mfa 
      SET last_used_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1
    `;

    await db.query(query, [userId]);
  }

  /**
   * Save backup codes for a user
   */
  async saveBackupCodes(userId: string, codes: string[]): Promise<void> {
    // Delete existing backup codes
    await this.deleteAllBackupCodes(userId);

    // Hash and save new codes
    const values = codes.map(code => {
      const hash = crypto.createHash('sha256').update(code).digest('hex');
      return `('${userId}', '${hash}')`;
    }).join(', ');

    const query = `
      INSERT INTO backup_codes (user_id, code_hash)
      VALUES ${values}
    `;

    await db.query(query);

    // Update backup codes generated timestamp
    await db.query(
      `UPDATE user_mfa 
       SET backup_codes_generated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Verify and use a backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const hash = crypto.createHash('sha256').update(code).digest('hex');

    const query = `
      UPDATE backup_codes 
      SET used = true, used_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND code_hash = $2 AND used = false
      RETURNING id
    `;

    const result = await db.query(query, [userId, hash]);
    return result.rowCount > 0;
  }

  /**
   * Get unused backup codes count
   */
  async getUnusedBackupCodesCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM backup_codes 
      WHERE user_id = $1 AND used = false
    `;

    const result = await db.queryOne<{ count: string }>(query, [userId]);
    return parseInt(result?.count || '0', 10);
  }

  /**
   * Delete all backup codes for a user
   */
  async deleteAllBackupCodes(userId: string): Promise<void> {
    await db.query('DELETE FROM backup_codes WHERE user_id = $1', [userId]);
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId: string): Promise<boolean> {
    const query = 'SELECT enabled FROM user_mfa WHERE user_id = $1';
    const result = await db.queryOne<{ enabled: boolean }>(query, [userId]);
    return result?.enabled || false;
  }
}

export const mfaRepository = new MFARepository();