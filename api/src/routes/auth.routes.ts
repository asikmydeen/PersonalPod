import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  validateResetTokenValidation,
} from '../utils/validators';
import {
  loginLimiter,
  registrationLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
} from '../middleware/rateLimiter';

const router = Router();

// Public routes
router.post('/register', registrationLimiter, registerValidation, authController.register);
router.post('/login', loginLimiter, loginValidation, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/forgot-password', passwordResetLimiter, forgotPasswordValidation, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPasswordValidation, authController.resetPassword);
router.post('/validate-reset-token', validateResetTokenValidation, authController.validateResetToken);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', emailVerificationLimiter, forgotPasswordValidation, authController.resendVerificationEmail);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.post('/change-password', authenticate, changePasswordValidation, authController.changePassword);

// Admin routes (development only)
if (process.env.NODE_ENV !== 'production') {
  router.post('/admin/verify-email/:userId', authenticate, authController.adminVerifyEmail);
}

export default router;