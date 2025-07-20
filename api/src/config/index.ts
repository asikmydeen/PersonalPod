import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-this',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  
  // AWS
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    cognito: {
      userPoolId: process.env.AWS_COGNITO_USER_POOL_ID || '',
      clientId: process.env.AWS_COGNITO_CLIENT_ID || '',
      clientSecret: process.env.AWS_COGNITO_CLIENT_SECRET || '',
    },
    ses: {
      from: process.env.EMAIL_FROM || 'noreply@personalpod.com',
    },
  },
  
  // Email
  email: {
    from: process.env.EMAIL_FROM || 'noreply@personalpod.com',
    verificationRequired: process.env.EMAIL_VERIFICATION_REQUIRED !== 'false',
    blockUnverifiedLogin: process.env.BLOCK_UNVERIFIED_LOGIN === 'true', // Default false for dev, should be true in production
    verificationTokenExpiry: parseInt(process.env.EMAIL_VERIFICATION_EXPIRY || '86400', 10), // 24 hours in seconds
    passwordResetTokenExpiry: parseInt(process.env.PASSWORD_RESET_EXPIRY || '3600', 10), // 1 hour in seconds
  },
  
  // Frontend
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  
  // Security
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'personalpod',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  },
};

export default config;