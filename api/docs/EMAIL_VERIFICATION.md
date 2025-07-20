# Email Verification System

## Overview

PersonalPod includes a comprehensive email verification system that ensures user email addresses are valid and accessible. The system supports email verification, password reset, and email change notifications.

## Features

### 1. Email Templates
- **Welcome Email**: Sent when a user registers
- **Email Verification**: Sent to verify email address
- **Password Reset**: Sent when user requests password reset
- **Email Change Notification**: Sent to old email when email is changed
- **Password Changed Notification**: Sent when password is successfully changed

### 2. Token Management
- Secure token generation using crypto.randomBytes
- Configurable expiration times
- Token cleanup for expired tokens
- One-time use tokens

### 3. Email Service Integration
- AWS SES integration for production
- Console logging fallback for development
- HTML and plain text email support
- Responsive email templates

## Configuration

Add these environment variables to your `.env` file:

```env
# Email Configuration
EMAIL_FROM=noreply@personalpod.com
EMAIL_VERIFICATION_REQUIRED=true
BLOCK_UNVERIFIED_LOGIN=false  # Set to true in production
EMAIL_VERIFICATION_EXPIRY=86400  # 24 hours in seconds
PASSWORD_RESET_EXPIRY=3600  # 1 hour in seconds

# AWS Configuration (for production)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## API Endpoints

### Public Endpoints

#### POST /api/auth/register
Registers a new user and sends verification email.

#### GET /api/auth/verify-email?token={token}
Verifies email using the token.

#### POST /api/auth/resend-verification
```json
{
  "email": "user@example.com"
}
```
Resends verification email if not already verified.

#### POST /api/auth/forgot-password
```json
{
  "email": "user@example.com"
}
```
Sends password reset email.

#### POST /api/auth/reset-password
```json
{
  "token": "reset-token",
  "password": "newPassword123"
}
```
Resets password using the token.

### Development Only

#### POST /api/auth/admin/verify-email/:userId
Manually verifies a user's email (development only).

## Database Schema

### email_verifications table
```sql
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email_verification', 'password_reset')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### users table additions
```sql
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;
```

## Usage Examples

### 1. Registration Flow
```javascript
// Register user
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123',
    firstName: 'John',
    lastName: 'Doe'
  })
});

// User receives verification email
// User clicks verification link
// Email is verified automatically
```

### 2. Resend Verification
```javascript
await fetch('/api/auth/resend-verification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com'
  })
});
```

### 3. Password Reset Flow
```javascript
// Request password reset
await fetch('/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com'
  })
});

// User receives email with reset link
// User clicks link and enters new password
await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'token-from-email',
    password: 'newSecurePassword123'
  })
});
```

## Security Considerations

1. **Token Security**
   - Tokens are generated using crypto.randomBytes(32)
   - Stored as hex strings (64 characters)
   - One-time use with expiration

2. **Email Enumeration Prevention**
   - Forgot password always returns success
   - Resend verification doesn't reveal if user exists

3. **Rate Limiting**
   - Prevents spam on verification resend
   - Configurable rate limits

4. **Configuration Options**
   - `EMAIL_VERIFICATION_REQUIRED`: Controls if verification is needed
   - `BLOCK_UNVERIFIED_LOGIN`: Blocks login until email verified

## Development Tips

1. **Local Development**
   - Emails are logged to console in development
   - Use admin endpoint to manually verify emails
   - Set `BLOCK_UNVERIFIED_LOGIN=false` for easier testing

2. **Testing Email Templates**
   - Check console output for email content
   - Verify responsive design
   - Test with various email clients

3. **Token Testing**
   - Tokens expire based on configuration
   - Test expired token handling
   - Verify one-time use behavior

## Maintenance

### Cleanup Expired Tokens
The system includes automatic cleanup:
```javascript
// Called periodically by the auth service
await authService.cleanupExpiredTokens();
```

### Monitoring
- Log failed email sends
- Track verification rates
- Monitor token usage patterns