import jwt from 'jsonwebtoken';
import { config } from '../config';
import { TokenPayload, AuthTokens } from '../models/user';
import { v4 as uuidv4 } from 'uuid';

export class JWTService {
  static generateMFASessionToken(userId: string): string {
    return jwtService.generateMFASessionToken(userId);
  }

  static verifyMFASessionToken(token: string): { userId: string; type: string } | null {
    return jwtService.verifyMFASessionToken(token);
  }
}

export class JwtService {
  private readonly secret: string;
  private readonly expiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor() {
    this.secret = config.jwt.secret;
    this.expiresIn = config.jwt.expiresIn;
    this.refreshExpiresIn = config.jwt.refreshExpiresIn;
  }

  generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: this.getExpiresInSeconds(this.expiresIn),
    };
  }

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
    });
  }

  generateRefreshToken(payload: TokenPayload): string {
    const refreshPayload = {
      ...payload,
      tokenId: uuidv4(), // Unique ID for refresh token
      type: 'refresh',
    };

    return jwt.sign(refreshPayload, this.secret, {
      expiresIn: this.refreshExpiresIn,
    });
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.secret) as TokenPayload;
  }

  verifyRefreshToken(token: string): TokenPayload & { tokenId: string; type: string } {
    const payload = jwt.verify(token, this.secret) as TokenPayload & { tokenId: string; type: string };
    
    if (payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }
    
    return payload;
  }  private getExpiresInSeconds(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (!match) {
      throw new Error('Invalid expiresIn format');
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60;
      case 'h':
        return value * 60 * 60;
      case 'm':
        return value * 60;
      case 's':
        return value;
      default:
        throw new Error('Invalid time unit');
    }
  }

  decodeToken(token: string): any {
    return jwt.decode(token);
  }

  generateMFASessionToken(userId: string): string {
    return jwt.sign(
      { 
        userId, 
        type: 'mfa_session',
        timestamp: Date.now() 
      },
      this.secret,
      { 
        expiresIn: '5m' // MFA session tokens expire in 5 minutes
      }
    );
  }

  verifyMFASessionToken(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, this.secret) as any;
      
      if (payload.type !== 'mfa_session') {
        throw new Error('Invalid MFA session token');
      }
      
      return { userId: payload.userId };
    } catch (error) {
      throw new Error('Invalid or expired MFA session token');
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token) as any;
      if (!decoded || !decoded.exp) {
        return true;
      }
      
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }

  generateMFASessionToken(userId: string): string {
    const payload = {
      userId,
      type: 'mfa-session',
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: '10m', // MFA session expires in 10 minutes
    });
  }

  verifyMFASessionToken(token: string): { userId: string; type: string } | null {
    try {
      const payload = jwt.verify(token, this.secret) as { userId: string; type: string };
      
      if (payload.type !== 'mfa-session') {
        return null;
      }
      
      return payload;
    } catch {
      return null;
    }
  }
}

export const jwtService = new JwtService();

// Export JWTService for compatibility
export const JWTService = {
  generateMFASessionToken: (userId: string) => jwtService.generateMFASessionToken(userId),
  verifyMFASessionToken: (token: string) => jwtService.verifyMFASessionToken(token),
};