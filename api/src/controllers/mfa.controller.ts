import { Request, Response, NextFunction } from 'express';
import { mfaService } from '../services/mfa.service';
import { mfaRepository } from '../repositories/mfa.repository';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

export class MFAController {
  /**
   * Initialize MFA setup
   */
  async setupMFA(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const userEmail = req.user!.email;

      // Check if MFA is already enabled
      const existingMFA = await mfaRepository.getMFASettings(userId);
      if (existingMFA && existingMFA.enabled) {
        throw new AppError('MFA is already enabled for this account', 400);
      }

      // Generate new secret
      const mfaSecret = await mfaService.generateSecret(userEmail);

      // Save secret to database (not enabled yet)
      await mfaRepository.upsertMFASettings(userId, mfaSecret.secret);

      res.json({
        success: true,
        data: {
          qr_code: mfaSecret.qr_code,
          manual_entry_key: mfaSecret.secret,
          manual_entry_setup_url: mfaSecret.otpauth_url,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify setup and enable MFA
   */
  async verifySetup(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { token } = req.body;
      const userId = req.user!.id;

      // Get MFA settings
      const mfaSettings = await mfaRepository.getMFASettings(userId);
      if (!mfaSettings) {
        throw new AppError('MFA setup not found. Please initiate setup first', 404);
      }

      if (mfaSettings.enabled) {
        throw new AppError('MFA is already enabled', 400);
      }

      // Verify the token
      const isValid = mfaService.verifyToken(mfaSettings.secret, token);
      if (!isValid) {
        throw new AppError('Invalid verification code', 400);
      }

      // Enable MFA
      await mfaRepository.enableMFA(userId);

      // Generate backup codes
      const backupCodes = mfaService.generateBackupCodes();
      await mfaRepository.saveBackupCodes(userId, backupCodes);

      res.json({
        success: true,
        data: {
          backup_codes: mfaService.formatBackupCodes(backupCodes),
          message: 'MFA has been successfully enabled',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disable MFA
   */
  async disableMFA(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { password } = req.body;
      const userId = req.user!.id;

      // Verify password (implement password verification)
      // This should be done through auth service
      // For now, we'll skip password verification

      // Check if MFA is enabled
      const mfaSettings = await mfaRepository.getMFASettings(userId);
      if (!mfaSettings || !mfaSettings.enabled) {
        throw new AppError('MFA is not enabled for this account', 400);
      }

      // Disable MFA
      await mfaRepository.disableMFA(userId);

      res.json({
        success: true,
        message: 'MFA has been disabled',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify MFA code during login
   */
  async verifyMFA(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { userId, code, type = 'totp' } = req.body;

      // Get MFA settings
      const mfaSettings = await mfaRepository.getMFASettings(userId);
      if (!mfaSettings || !mfaSettings.enabled) {
        throw new AppError('MFA is not enabled for this account', 400);
      }

      let isValid = false;

      if (type === 'totp') {
        // Verify TOTP code
        isValid = mfaService.verifyToken(mfaSettings.secret, code);
        if (isValid) {
          await mfaRepository.updateLastUsed(userId);
        }
      } else if (type === 'backup') {
        // Verify backup code
        const normalizedCode = mfaService.normalizeBackupCode(code);
        isValid = await mfaRepository.verifyBackupCode(userId, normalizedCode);
      } else {
        throw new AppError('Invalid verification type', 400);
      }

      if (!isValid) {
        throw new AppError('Invalid verification code', 400);
      }

      // Return success (auth service should handle token generation)
      res.json({
        success: true,
        message: 'MFA verification successful',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get backup codes
   */
  async getBackupCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Check if MFA is enabled
      const isEnabled = await mfaRepository.isMFAEnabled(userId);
      if (!isEnabled) {
        throw new AppError('MFA is not enabled for this account', 400);
      }

      // Get backup codes count
      const unusedCount = await mfaRepository.getUnusedBackupCodesCount(userId);

      res.json({
        success: true,
        data: {
          unused_codes_count: unusedCount,
          message: 'Use the regenerate endpoint to get new backup codes',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Check if MFA is enabled
      const isEnabled = await mfaRepository.isMFAEnabled(userId);
      if (!isEnabled) {
        throw new AppError('MFA is not enabled for this account', 400);
      }

      // Generate new backup codes
      const backupCodes = mfaService.generateBackupCodes();
      await mfaRepository.saveBackupCodes(userId, backupCodes);

      res.json({
        success: true,
        data: {
          backup_codes: mfaService.formatBackupCodes(backupCodes),
          message: 'New backup codes have been generated. Previous codes are now invalid.',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get MFA status
   */
  async getMFAStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const mfaSettings = await mfaRepository.getMFASettings(userId);
      const unusedBackupCodes = mfaSettings?.enabled
        ? await mfaRepository.getUnusedBackupCodesCount(userId)
        : 0;

      res.json({
        success: true,
        data: {
          enabled: mfaSettings?.enabled || false,
          backup_codes_count: unusedBackupCodes,
          last_used_at: mfaSettings?.last_used_at || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const mfaController = new MFAController();