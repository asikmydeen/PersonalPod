import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';
import { userRepository } from '../repositories/user.repository';
import { config } from '../config';

/**
 * Middleware to check if user's email is verified
 * Can be used on specific routes that require email verification
 */
export const requireEmailVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    // Skip verification check if not required by config
    if (!config.email.verificationRequired) {
      return next();
    }

    // Get fresh user data to check verification status
    const user = await userRepository.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isEmailVerified = (user as any).email_verified ?? user.is_verified;
    if (!isEmailVerified) {
      throw new AppError('Email verification required. Please verify your email to access this feature.', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to optionally check email verification
 * Adds verification status to request but doesn't block
 */
export const checkEmailVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next();
    }

    // Get fresh user data to check verification status
    const user = await userRepository.findById(req.user.id);
    if (user) {
      const isEmailVerified = (user as any).email_verified ?? user.is_verified;
      req.user.isEmailVerified = isEmailVerified;
    }

    next();
  } catch (error) {
    // Don't block request on error, just log it
    console.error('Error checking email verification:', error);
    next();
  }
};