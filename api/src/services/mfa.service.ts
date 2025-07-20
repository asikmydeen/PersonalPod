import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { mfaRepository } from '../repositories/mfa.repository';

interface MFASecret {
  secret: string;
  otpauth_url: string;
  qr_code: string;
}

interface BackupCode {
  code: string;
  used: boolean;
}

export class MFAService {
  private readonly appName = 'PersonalPod';
  private readonly backupCodeCount = 10;
  private readonly backupCodeLength = 8;

  /**
   * Generate a new TOTP secret for a user
   */
  async generateSecret(userEmail: string): Promise<MFASecret> {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.appName} (${userEmail})`,
        length: 32,
      });

      if (!secret.otpauth_url || !secret.base32) {
        throw new AppError('Failed to generate MFA secret', 500);
      }

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url);

      return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url,
        qr_code: qrCode,
      };
    } catch (error) {
      logger.error('Error generating MFA secret:', error);
      throw new AppError('Failed to generate MFA secret', 500);
    }
  }

  /**
   * Verify a TOTP code
   */
  verifyToken(secret: string, token: string): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time steps in either direction (±60 seconds)
      });
    } catch (error) {
      logger.error('Error verifying MFA token:', error);
      return false;
    }
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < this.backupCodeCount; i++) {
      // Generate a random alphanumeric code
      const code = crypto.randomBytes(this.backupCodeLength)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, this.backupCodeLength)
        .toUpperCase();
      
      codes.push(code);
    }

    return codes;
  }

  /**
   * Format backup codes for display
   */
  formatBackupCodes(codes: string[]): string[] {
    // Format as XXXX-XXXX for better readability
    return codes.map(code => {
      if (code.length === 8) {
        return `${code.substring(0, 4)}-${code.substring(4)}`;
      }
      return code;
    });
  }

  /**
   * Verify a backup code (strips formatting)
   */
  normalizeBackupCode(code: string): string {
    return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  /**
   * Generate a recovery token for account recovery
   */
  generateRecoveryToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get current TOTP code (for testing/debugging)
   */
  getCurrentToken(secret: string): string {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
    });
  }

  /**
   * Verify if a secret is valid
   */
  isValidSecret(secret: string): boolean {
    try {
      // Try to generate a token with the secret
      speakeasy.totp({
        secret,
        encoding: 'base32',
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const mfaService = new MFAService();

// Export MFAService for compatibility with existing code
export const MFAService = {
  getMFAStatus: async (userId: string) => {
    const settings = await mfaRepository.getMFASettings(userId);
    return {
      enabled: settings?.enabled || false,
      lastUsedAt: settings?.last_used_at || null,
    };
  },
  
  verifyToken: async (userId: string, token: string) => {
    const settings = await mfaRepository.getMFASettings(userId);
    if (!settings || !settings.secret) {
      return false;
    }
    return mfaService.verifyToken(settings.secret, token);
  },
  
  verifyBackupCode: async (userId: string, code: string) => {
    const normalizedCode = mfaService.normalizeBackupCode(code);
    return await mfaRepository.verifyBackupCode(userId, normalizedCode);
  },
  
  updateLastUsed: async (userId: string) => {
    await mfaRepository.updateLastUsed(userId);
  },
};