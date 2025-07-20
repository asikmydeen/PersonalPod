export interface UserMFA {
  id: string;
  userId: string;
  secret: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date | null;
}

export interface BackupCode {
  id: string;
  userId: string;
  code: string;
  used: boolean;
  usedAt?: Date | null;
  createdAt: Date;
}

export interface MFASetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAVerifyRequest {
  token: string;
}

export interface MFALoginRequest {
  userId: string;
  token: string;
}

export interface MFAStatus {
  enabled: boolean;
  lastUsedAt?: Date | null;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  requiresMFA?: boolean;
  mfaSessionToken?: string;
  user?: any;
}