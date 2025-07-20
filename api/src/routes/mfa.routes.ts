import { Router } from 'express';
import { mfaController } from '../controllers/mfa.controller';
import { authenticate } from '../middleware/auth.middleware';
import { body } from 'express-validator';

const router = Router();

// All MFA routes require authentication
router.use(authenticate);

// Get MFA status
router.get('/status', mfaController.getMFAStatus);

// Setup MFA
router.post('/setup', mfaController.setupMFA);

// Verify setup and enable MFA
router.post(
  '/verify-setup',
  [
    body('token')
      .notEmpty()
      .withMessage('Verification code is required')
      .isLength({ min: 6, max: 6 })
      .withMessage('Verification code must be 6 digits')
      .matches(/^\d+$/)
      .withMessage('Verification code must contain only digits'),
  ],
  mfaController.verifySetup
);

// Disable MFA
router.post(
  '/disable',
  [
    body('password')
      .notEmpty()
      .withMessage('Password is required for security verification'),
  ],
  mfaController.disableMFA
);

// Get backup codes info
router.get('/backup-codes', mfaController.getBackupCodes);

// Regenerate backup codes
router.post('/regenerate-backup-codes', mfaController.regenerateBackupCodes);

// Verify MFA code (used during login - doesn't require auth middleware)
router.post(
  '/verify',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('code').notEmpty().withMessage('Verification code is required'),
    body('type')
      .optional()
      .isIn(['totp', 'backup'])
      .withMessage('Invalid verification type'),
  ],
  mfaController.verifyMFA
);

export default router;