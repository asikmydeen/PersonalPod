export interface User {
  id: string;
  email: string;
  password?: string; // Optional because we won't always return it
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  isEmailVerified: boolean;
  isActive?: boolean;
  cognitoSub?: string; // AWS Cognito user ID
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
  refreshToken?: string;
  metadata?: Record<string, any>;
}

export interface CreateUserDto {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface TokenPayload {
  id: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserResponse {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  isEmailVerified: boolean;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
  metadata?: Record<string, any>;
}