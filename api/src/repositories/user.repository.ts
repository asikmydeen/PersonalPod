import { v4 as uuidv4 } from 'uuid';
import { db, QueryResult } from '../services/database.service';
import { User, CreateUserDto, UserResponse } from '../models/user';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface UserRecord {
  id: string;
  cognito_user_id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
}

export class UserRepository {
  private tableName = 'users';

  /**
   * Create a new user
   */
  async create(data: {
    email: string;
    username: string;
    cognitoUserId?: string;
    fullName?: string;
    isVerified?: boolean;
  }): Promise<UserRecord> {
    const id = uuidv4();
    const cognitoUserId = data.cognitoUserId || id; // Use id as cognito_user_id if not provided
    const username = data.username || data.email.split('@')[0]; // Default username from email

    const query = `
      INSERT INTO ${this.tableName} (
        id, cognito_user_id, email, username, full_name, 
        is_verified, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *
    `;

    const values = [
      id,
      cognitoUserId,
      data.email.toLowerCase(),
      username,
      data.fullName || null,
      data.isVerified || false,
    ];

    try {
      const result = await db.queryOne<UserRecord>(query, values);
      if (!result) {
        throw new AppError('Failed to create user', 500);
      }
      logger.info(`User created: ${result.email}`);
      return result;
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        if (error.constraint === 'users_email_key') {
          throw new AppError('User with this email already exists', 409);
        }
        if (error.constraint === 'users_username_key') {
          throw new AppError('User with this username already exists', 409);
        }
        if (error.constraint === 'users_cognito_user_id_key') {
          throw new AppError('User with this Cognito ID already exists', 409);
        }
      }
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserRecord | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1 AND is_active = true`;
    return await db.queryOne<UserRecord>(query, [id]);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE email = $1 AND is_active = true`;
    return await db.queryOne<UserRecord>(query, [email.toLowerCase()]);
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<UserRecord | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE username = $1 AND is_active = true`;
    return await db.queryOne<UserRecord>(query, [username]);
  }

  /**
   * Find user by Cognito user ID
   */
  async findByCognitoId(cognitoUserId: string): Promise<UserRecord | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE cognito_user_id = $1 AND is_active = true`;
    return await db.queryOne<UserRecord>(query, [cognitoUserId]);
  }

  /**
   * Update user
   */
  async update(id: string, data: Partial<{
    email: string;
    username: string;
    fullName: string;
    avatarUrl: string;
    isActive: boolean;
    isVerified: boolean;
    lastLoginAt: Date;
    metadata: Record<string, any>;
  }>): Promise<UserRecord | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.email !== undefined) {
      updateFields.push(`email = $${paramCount}`);
      values.push(data.email.toLowerCase());
      paramCount++;
    }

    if (data.username !== undefined) {
      updateFields.push(`username = $${paramCount}`);
      values.push(data.username);
      paramCount++;
    }

    if (data.fullName !== undefined) {
      updateFields.push(`full_name = $${paramCount}`);
      values.push(data.fullName);
      paramCount++;
    }

    if (data.avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramCount}`);
      values.push(data.avatarUrl);
      paramCount++;
    }

    if (data.isActive !== undefined) {
      updateFields.push(`is_active = $${paramCount}`);
      values.push(data.isActive);
      paramCount++;
    }

    if (data.isVerified !== undefined) {
      updateFields.push(`is_verified = $${paramCount}`);
      values.push(data.isVerified);
      paramCount++;
    }

    if (data.lastLoginAt !== undefined) {
      updateFields.push(`last_login_at = $${paramCount}`);
      values.push(data.lastLoginAt);
      paramCount++;
    }

    if (data.metadata !== undefined) {
      updateFields.push(`metadata = $${paramCount}`);
      values.push(JSON.stringify(data.metadata));
      paramCount++;
    }

    if (updateFields.length === 0) {
      return await this.findById(id);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE ${this.tableName} 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await db.queryOne<UserRecord>(query, values);
      if (result) {
        logger.info(`User updated: ${result.email}`);
      }
      return result;
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        if (error.constraint === 'users_email_key') {
          throw new AppError('Email already in use', 409);
        }
        if (error.constraint === 'users_username_key') {
          throw new AppError('Username already in use', 409);
        }
      }
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.update(id, { lastLoginAt: new Date() });
  }

  /**
   * Delete user (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    const query = `
      UPDATE ${this.tableName} 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
      RETURNING id
    `;
    const result = await db.queryOne<{ id: string }>(query, [id]);
    return result !== null;
  }

  /**
   * Hard delete user (permanent)
   */
  async hardDelete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING id`;
    const result = await db.queryOne<{ id: string }>(query, [id]);
    return result !== null;
  }

  /**
   * Check if user exists by email
   */
  async existsByEmail(email: string): Promise<boolean> {
    return await db.exists(this.tableName, { email: email.toLowerCase() });
  }

  /**
   * Check if user exists by username
   */
  async existsByUsername(username: string): Promise<boolean> {
    return await db.exists(this.tableName, { username });
  }

  /**
   * Count total users
   */
  async count(filters?: { isActive?: boolean; isVerified?: boolean }): Promise<number> {
    const conditions: Record<string, any> = {};
    if (filters?.isActive !== undefined) {
      conditions.is_active = filters.isActive;
    }
    if (filters?.isVerified !== undefined) {
      conditions.is_verified = filters.isVerified;
    }
    return await db.count(this.tableName, conditions);
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string): Promise<UserRecord | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET email_verified = true, 
          email_verified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.queryOne<UserRecord>(query, [id]);
    if (result) {
      logger.info(`User email verified: ${result.email}`);
    }
    return result;
  }

  /**
   * Convert database record to User model
   */
  mapToUser(record: UserRecord): User {
    return {
      id: record.id,
      email: record.email,
      username: record.username,
      firstName: record.full_name?.split(' ')[0] || '',
      lastName: record.full_name?.split(' ').slice(1).join(' ') || '',
      fullName: record.full_name,
      avatarUrl: record.avatar_url,
      isEmailVerified: (record as any).email_verified ?? record.is_verified,
      isActive: record.is_active,
      lastLoginAt: record.last_login_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      metadata: record.metadata,
      // Password is handled separately in auth service
      password: '',
    };
  }

  /**
   * Convert database record to UserResponse (without sensitive data)
   */
  mapToUserResponse(record: UserRecord): UserResponse {
    const user = this.mapToUser(record);
    const { password, ...userResponse } = user;
    return userResponse;
  }
}

// Export singleton instance
export const userRepository = new UserRepository();