# Multi-Factor Authentication (MFA) Implementation

## Overview

PersonalPod implements Time-based One-Time Password (TOTP) authentication using industry-standard RFC 6238 specification. Users can enable MFA to add an extra layer of security to their accounts.

## Features

- **TOTP Support**: Compatible with Google Authenticator, Authy, Microsoft Authenticator, and other TOTP apps
- **Backup Codes**: 10 single-use backup codes for account recovery
- **QR Code Generation**: Easy setup with QR code scanning
- **Manual Entry**: Secret key provided for manual entry
- **Graceful Degradation**: Login allowed without MFA if not enabled
- **Session Management**: Temporary MFA session tokens for multi-step authentication

## Database Schema

### Tables

1. **user_mfa**: Stores MFA settings and secrets
   - `user_id`: Reference to users table
   - `secret`: Encrypted TOTP secret
   - `enabled`: Whether MFA is active
   - `backup_codes_generated_at`: Timestamp of last backup code generation
   - `last_used_at`: Last successful MFA verification

2. **backup_codes**: Stores hashed backup codes
   - `user_id`: Reference to users table
   - `code_hash`: SHA-256 hash of backup code
   - `used`: Whether code has been used
   - `used_at`: Timestamp when used

3. **users** (additional fields):
   - `mfa_enabled`: Quick check for MFA status
   - `mfa_enforced`: Admin can enforce MFA (future feature)

## API Endpoints

### MFA Management (Authenticated)

- `GET /api/mfa/status` - Get MFA status for current user
- `POST /api/mfa/setup` - Initialize MFA setup, returns QR code
- `POST /api/mfa/verify-setup` - Verify TOTP code and enable MFA
- `POST /api/mfa/disable` - Disable MFA (requires password)
- `GET /api/mfa/backup-codes` - Get backup codes count
- `POST /api/mfa/regenerate-backup-codes` - Generate new backup codes

### Authentication Flow

- `POST /api/auth/login` - Returns `requiresMFA: true` if MFA enabled
- `POST /api/mfa/verify` - Verify MFA code after password authentication

## Authentication Flow

### Standard Login
1. User submits email/password
2. Server validates credentials
3. If MFA disabled: Return access/refresh tokens
4. If MFA enabled: Return MFA session token and `requiresMFA: true`

### MFA Verification
1. Client receives MFA requirement
2. User enters TOTP code or backup code
3. Server verifies code with 60-second window
4. On success: Return access/refresh tokens
5. On failure: Return error (rate limited)

## Security Considerations

1. **Secret Storage**: TOTP secrets stored encrypted in database
2. **Backup Codes**: Hashed with SHA-256, single-use only
3. **Rate Limiting**: MFA attempts are rate-limited to prevent brute force
4. **Time Window**: ±60 seconds tolerance for clock skew
5. **Session Tokens**: MFA session tokens expire in 5 minutes
6. **Secure Transport**: All MFA operations require HTTPS

## Setup Instructions

### For Users

1. **Enable MFA**:
   ```
   POST /api/mfa/setup
   Response: { qr_code, manual_entry_key }
   ```

2. **Scan QR Code**: Use authenticator app to scan the QR code

3. **Verify Setup**:
   ```
   POST /api/mfa/verify-setup
   Body: { token: "123456" }
   Response: { backup_codes: [...] }
   ```

4. **Save Backup Codes**: Store the provided backup codes securely

### For Developers

1. **Install Dependencies**:
   ```bash
   npm install speakeasy qrcode
   npm install --save-dev @types/speakeasy @types/qrcode
   ```

2. **Run Migrations**:
   ```bash
   npm run migrate:up
   ```

3. **Environment Variables**:
   ```env
   # Optional MFA settings
   MFA_APP_NAME=PersonalPod
   MFA_ENFORCE_FOR_ADMINS=false
   MFA_BACKUP_CODE_COUNT=10
   ```

## Testing MFA

### Manual Testing

1. Register a new user
2. Enable MFA via `/api/mfa/setup`
3. Use Google Authenticator to scan QR code
4. Verify with 6-digit code
5. Log out and log in again
6. Verify MFA is required

### Using Backup Codes

1. During MFA verification, use:
   ```json
   {
     "userId": "...",
     "code": "ABCD-EFGH",
     "type": "backup"
   }
   ```

### Debugging

- Current TOTP code: `mfaService.getCurrentToken(secret)`
- Verify secret validity: `mfaService.isValidSecret(secret)`
- Check time sync: Ensure server time is accurate

## Common Issues

1. **Invalid Code**: Check device time synchronization
2. **QR Code Not Scanning**: Use manual entry key
3. **Lost Device**: Use backup codes or contact admin
4. **Backup Codes Used**: Regenerate via API

## Future Enhancements

1. SMS/Email OTP as fallback
2. WebAuthn/FIDO2 support
3. Admin enforcement policies
4. Risk-based authentication
5. Remember trusted devices
6. Push notifications for approval