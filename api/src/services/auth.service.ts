import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto, User, LoginDto, AuthTokens, UserResponse } from '../models/user';
import { LoginResponse } from '../models/mfa';
import { jwtService, JWTService } from './jwt.service';
import { passwordService } from './password.service';
import { refreshTokenService } from './refreshToken.service';
import { userRepository } from '../repositories/user.repository';
import { verificationTokenService } from './verificationToken.service';
import { emailService } from './email.service';
import { MFAService } from './mfa.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { db } from './database.service';
import { config } from '../config';

export class AuthService {
  static async getUserById(userId: string): Promise<User | null> {
    const userRecord = await userRepository.findById(userId);
    if (!userRecord) {
      return null;
    }
    
    // Get password hash
    const passwordHash = await passwordService.getPasswordHash(userId);
    
    return {
      id: userRecord.id,
      email: userRecord.email,
      password: passwordHash,
      username: userRecord.username,
      firstName: userRecord.first_name,
      lastName: userRecord.last_name,
      fullName: userRecord.full_name,
      avatarUrl: userRecord.avatar_url,
      isEmailVerified: userRecord.email_verified ?? userRecord.is_verified,
      isActive: userRecord.is_active,
      cognitoSub: userRecord.cognito_sub,
      createdAt: userRecord.created_at,
      updatedAt: userRecord.updated_at,
      lastLoginAt: userRecord.last_login_at,
      metadata: userRecord.metadata,
    };
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return passwordService.verifyPassword(password, hashedPassword);
  }

  static async generateTokens(user: User): Promise<AuthTokens> {
    return jwtService.generateTokens({
      id: user.id,
      email: user.email,
    });
  }

  static sanitizeUser(user: User): UserResponse {
    const { password, refreshToken, ...sanitizedUser } = user;
    return sanitizedUser as UserResponse;
  }
  async register(dto: CreateUserDto): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    // Check if user already exists
    const existingUser = await userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    // Use transaction to ensure atomicity
    return await db.transaction(async (client) => {
      // Create user
      const username = dto.username || dto.email.split('@')[0];
      const fullName = dto.firstName || dto.lastName 
        ? `${dto.firstName || ''} ${dto.lastName || ''}`.trim()
        : null;

      const userRecord = await userRepository.create({
        email: dto.email,
        username,
        fullName,
        isVerified: false,
      });

      // Store password hash separately
      await passwordService.storePassword(userRecord.id, dto.password);

      // Generate tokens
      const tokens = jwtService.generateTokens({
        id: userRecord.id,
        email: userRecord.email,
      });

      // Store refresh token
      await refreshTokenService.create(userRecord.id, tokens.refreshToken);

      // Create and send email verification token
      const verificationToken = await verificationTokenService.createToken(
        userRecord.id,
        'email_verification'
      );
      
      // Send verification email (async, don't wait)
      emailService.sendEmailVerification(
        userRecord.email,
        verificationToken.token,
        userRecord.full_name?.split(' ')[0]
      ).catch(err => {
        logger.error('Failed to send verification email:', err);
      });

      // Send welcome email (async, don't wait)
      emailService.sendWelcomeEmail(
        userRecord.email,
        userRecord.full_name?.split(' ')[0] || ''
      ).catch(err => {
        logger.error('Failed to send welcome email:', err);
      });

      logger.info(`User registered: ${userRecord.email}`);

      const userResponse = userRepository.mapToUserResponse(userRecord);
      return {
        user: userResponse,
        tokens,
      };
    });
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    // Find user by email
    const userRecord = await userRepository.findByEmail(dto.email);
    if (!userRecord) {
      throw new AppError('Invalid credentials', 401);
    }

    // Verify password
    const isPasswordValid = await passwordService.verifyUserPassword(userRecord.id, dto.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if email verification is required
    const isEmailVerified = (userRecord as any).email_verified ?? userRecord.is_verified;
    if (config.email.blockUnverifiedLogin && !isEmailVerified) {
      throw new AppError('Please verify your email before logging in', 403);
    }

    // Check if MFA is enabled
    const mfaStatus = await MFAService.getMFAStatus(userRecord.id);
    if (mfaStatus.enabled) {
      // Generate MFA session token
      const mfaSessionToken = JWTService.generateMFASessionToken(userRecord.id);
      
      logger.info(`MFA required for user: ${userRecord.email}`);
      
      return {
        requiresMFA: true,
        mfaSessionToken,
      };
    }

    // Update last login
    await userRepository.updateLastLogin(userRecord.id);

    // Generate tokens
    const tokens = jwtService.generateTokens({
      id: userRecord.id,
      email: userRecord.email,
    });

    // Store refresh token
    await refreshTokenService.create(userRecord.id, tokens.refreshToken);

    logger.info(`User logged in: ${userRecord.email}`);

    const userResponse = userRepository.mapToUserResponse(userRecord);
    return {
      user: userResponse,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      requiresMFA: false,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token format
      const payload = jwtService.verifyRefreshToken(refreshToken);
      
      // Validate refresh token in database
      const tokenValidation = await refreshTokenService.validate(refreshToken);
      if (!tokenValidation.isValid || tokenValidation.userId !== payload.id) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Get user
      const userRecord = await userRepository.findById(payload.id);
      if (!userRecord || !userRecord.is_active) {
        throw new AppError('User not found or inactive', 404);
      }

      // Generate new tokens
      const tokens = jwtService.generateTokens({
        id: userRecord.id,
        email: userRecord.email,
      });

      // Rotate refresh token
      await refreshTokenService.rotate(refreshToken, userRecord.id, tokens.refreshToken);

      return tokens;
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw new AppError('Invalid refresh token', 401);
    }
  }

  async logout(refreshToken: string): Promise<void> {
    // Revoke refresh token
    await refreshTokenService.revoke(refreshToken);
    logger.info('User logged out');
  }

  async logoutAll(userId: string): Promise<void> {
    // Revoke all refresh tokens for the user
    const count = await refreshTokenService.revokeAllForUser(userId);
    logger.info(`User logged out from ${count} sessions`);
  }

  async getUser(userId: string): Promise<UserResponse> {
    const userRecord = await userRepository.findById(userId);
    if (!userRecord) {
      throw new AppError('User not found', 404);
    }

    return userRepository.mapToUserResponse(userRecord);
  }

  async updateUser(userId: string, data: Partial<{
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl: string;
  }>): Promise<UserResponse> {
    const fullName = data.firstName || data.lastName 
      ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
      : undefined;

    const userRecord = await userRepository.update(userId, {
      username: data.username,
      fullName,
      avatarUrl: data.avatarUrl,
    });

    if (!userRecord) {
      throw new AppError('User not found', 404);
    }

    return userRepository.mapToUserResponse(userRecord);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const userRecord = await userRepository.findById(userId);
    if (!userRecord) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isPasswordValid = await passwordService.verifyUserPassword(userId, currentPassword);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Update password
    await passwordService.updatePassword(userId, newPassword);
    
    // Optionally revoke all refresh tokens to force re-login
    await refreshTokenService.revokeAllForUser(userId);

    // Send password changed notification
    emailService.sendPasswordChangedNotification(userRecord.email).catch(err => {
      logger.error('Failed to send password change notification:', err);
    });

    logger.info(`Password changed for user: ${userRecord.email}`);
  }

  async verifyEmailByToken(token: string): Promise<UserResponse> {
    // Validate token
    const verificationToken = await verificationTokenService.validateToken(token, 'email_verification');
    
    // Verify user email
    const userRecord = await userRepository.verifyEmail(verificationToken.userId);
    if (!userRecord) {
      throw new AppError('User not found', 404);
    }
    
    // Mark token as used
    await verificationTokenService.markTokenAsUsed(verificationToken.id);
    
    logger.info(`Email verified for user: ${userRecord.email}`);
    return userRepository.mapToUserResponse(userRecord);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const userRecord = await userRepository.findByEmail(email);
    if (!userRecord) {
      // Don't reveal if user exists
      return;
    }

    const isEmailVerified = (userRecord as any).email_verified ?? userRecord.is_verified;
    if (isEmailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    // Check if there's already a valid token
    const hasValidToken = await verificationTokenService.hasValidEmailVerificationToken(userRecord.id);
    if (hasValidToken) {
      throw new AppError('A verification email was recently sent. Please check your email or try again later.', 429);
    }

    // Create new verification token
    const verificationToken = await verificationTokenService.createToken(
      userRecord.id,
      'email_verification'
    );
    
    // Send verification email
    await emailService.sendEmailVerification(
      userRecord.email,
      verificationToken.token,
      userRecord.full_name?.split(' ')[0]
    );
    
    logger.info(`Verification email resent for: ${userRecord.email}`);
  }

  async verifyEmail(userId: string): Promise<void> {
    const userRecord = await userRepository.update(userId, { isVerified: true });
    if (!userRecord) {
      throw new AppError('User not found', 404);
    }
    logger.info(`Email verified for user: ${userRecord.email}`);
  }

  async deleteUser(userId: string): Promise<void> {
    // Soft delete user
    const success = await userRepository.delete(userId);
    if (!success) {
      throw new AppError('User not found', 404);
    }

    // Revoke all refresh tokens
    await refreshTokenService.revokeAllForUser(userId);

    logger.info(`User deleted: ${userId}`);
  }

  async getUserByEmail(email: string): Promise<UserResponse | null> {
    const userRecord = await userRepository.findByEmail(email);
    if (!userRecord) {
      return null;
    }
    return userRepository.mapToUserResponse(userRecord);
  }

  async getUserByUsername(username: string): Promise<UserResponse | null> {
    const userRecord = await userRepository.findByUsername(username);
    if (!userRecord) {
      return null;
    }
    return userRepository.mapToUserResponse(userRecord);
  }

  async checkEmailExists(email: string): Promise<boolean> {
    return await userRepository.existsByEmail(email);
  }

  async checkUsernameExists(username: string): Promise<boolean> {
    return await userRepository.existsByUsername(username);
  }

  async forgotPassword(email: string): Promise<void> {
    const userRecord = await userRepository.findByEmail(email);
    if (!userRecord) {
      // Don't reveal if user exists - simulate delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      return;
    }

    // Check if user has recent password reset tokens to prevent abuse
    const recentTokenCount = await verificationTokenService.getRecentTokenCount(
      userRecord.id,
      'password_reset',
      60 * 60 * 1000 // 1 hour
    );

    if (recentTokenCount >= 3) {
      // Log potential abuse but don't reveal to user
      logger.warn(`Excessive password reset attempts for user: ${userRecord.email}`);
      return;
    }

    // Create password reset token
    const resetToken = await verificationTokenService.createToken(
      userRecord.id,
      'password_reset'
    );
    
    // Send password reset email
    await emailService.sendPasswordResetEmail(
      userRecord.email,
      resetToken.token
    );
    
    logger.info(`Password reset email sent for: ${userRecord.email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate token
    const resetToken = await verificationTokenService.validateToken(token, 'password_reset');
    
    // Get user details for notification
    const userRecord = await userRepository.findById(resetToken.userId);
    if (!userRecord) {
      throw new AppError('User not found', 404);
    }
    
    // Update password
    await passwordService.updatePassword(resetToken.userId, newPassword);
    
    // Mark token as used
    await verificationTokenService.markTokenAsUsed(resetToken.id);
    
    // Revoke all refresh tokens to force re-login
    await refreshTokenService.revokeAllForUser(resetToken.userId);
    
    // Send password reset notification
    emailService.sendPasswordChangedNotification(userRecord.email).catch(err => {
      logger.error('Failed to send password reset notification:', err);
    });
    
    logger.info(`Password reset completed for user ID: ${resetToken.userId}`);
  }

  async validateResetToken(token: string): Promise<boolean> {
    try {
      // Validate token without marking it as used
      await verificationTokenService.validateToken(token, 'password_reset');
      return true;
    } catch (error) {
      // Token is invalid or expired
      return false;
    }
  }

  async changeEmail(userId: string, newEmail: string, password: string): Promise<void> {
    const userRecord = await userRepository.findById(userId);
    if (!userRecord) {
      throw new AppError('User not found', 404);
    }

    // Verify password
    const isPasswordValid = await passwordService.verifyUserPassword(userId, password);
    if (!isPasswordValid) {
      throw new AppError('Invalid password', 401);
    }

    // Check if new email is already in use
    const emailExists = await userRepository.existsByEmail(newEmail);
    if (emailExists) {
      throw new AppError('Email already in use', 409);
    }

    const oldEmail = userRecord.email;

    // Update email and mark as unverified
    await userRepository.update(userId, {
      email: newEmail,
      isVerified: false,
    });

    // Send notification to old email
    emailService.sendEmailChangeNotification(oldEmail, newEmail).catch(err => {
      logger.error('Failed to send email change notification:', err);
    });

    // Create and send verification token to new email
    const verificationToken = await verificationTokenService.createToken(
      userId,
      'email_verification'
    );
    
    await emailService.sendEmailVerification(
      newEmail,
      verificationToken.token,
      userRecord.full_name?.split(' ')[0]
    );

    logger.info(`Email changed from ${oldEmail} to ${newEmail}`);
  }

  // Method to run periodic cleanup of expired tokens
  async cleanupExpiredTokens(): Promise<void> {
    const refreshCount = await refreshTokenService.cleanupExpired();
    if (refreshCount > 0) {
      logger.info(`Cleaned up ${refreshCount} expired refresh tokens`);
    }
    
    const verificationCount = await verificationTokenService.cleanupExpiredTokens();
    if (verificationCount > 0) {
      logger.info(`Cleaned up ${verificationCount} expired verification tokens`);
    }
  }
}

export const authService = new AuthService();