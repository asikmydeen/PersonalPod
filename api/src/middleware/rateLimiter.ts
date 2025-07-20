import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { AppError } from './errorHandler';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes by default
  max: config.rateLimit.maxRequests, // 100 requests by default
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw new AppError('Too many requests, please try again later.', 429);
  },
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    throw new AppError('Too many authentication attempts, please try again later.', 429);
  },
});

// Password reset rate limiter (prevent abuse)
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset requests per hour
  message: 'Too many password reset requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests to prevent enumeration
  keyGenerator: (req) => {
    // Use both IP and email for rate limiting to prevent abuse
    const email = req.body?.email || '';
    return `${req.ip}-${email.toLowerCase()}`;
  },
  handler: (req, res) => {
    throw new AppError('Too many password reset requests. Please try again in an hour.', 429);
  },
});

// Email verification rate limiter
export const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 verification email requests per hour
  message: 'Too many verification email requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw new AppError('Too many verification email requests. Please try again later.', 429);
  },
});

// Login rate limiter
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per window
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => {
    // Use both IP and email for rate limiting
    const email = req.body?.email || '';
    return `${req.ip}-${email.toLowerCase()}`;
  },
  handler: (req, res) => {
    throw new AppError('Too many login attempts. Please try again later.', 429);
  },
});

// Registration rate limiter
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour per IP
  message: 'Too many registration attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    throw new AppError('Too many registration attempts. Please try again later.', 429);
  },
});