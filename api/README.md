# PersonalPod API

Authentication backend service for PersonalPod application with email verification, password reset, and secure user management.

## Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 13+
- AWS Account (optional, for SES email service and Cognito integration)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Key environment variables:

- `EMAIL_FROM`: Sender email address for system emails
- `EMAIL_VERIFICATION_REQUIRED`: Enable/disable email verification requirement
- `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: AWS credentials for SES (optional for development)
- `FRONTEND_URL`: URL of your frontend application

### 3. Email Service Configuration

Copy the example environment file and update with your values:

```bash
cp .env.example .env
```

Update the following in your `.env` file:
- Database credentials
- JWT secret
- AWS Cognito configuration

### 3. Database Setup

#### Option 1: Automatic Setup (Recommended)

Run the initialization script:

```bash
npm run db:init
```

This will:
- Create the database if it doesn't exist
- Run all migrations

#### Option 2: Manual Setup

1. Create the database:
```sql
CREATE DATABASE personalpod;
```

2. Run migrations:
```bash
npm run migrate:up
```

### 4. Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## Email Verification System

The API includes a comprehensive email verification system with the following features:

### Features

- **Email Verification**: New users receive a verification email upon registration
- **Password Reset**: Secure password reset via email tokens
- **Email Change Notifications**: Users are notified when their email address changes
- **Configurable Requirements**: Email verification can be required or optional

### Email Service

The system supports two modes:

1. **Production Mode**: Uses AWS SES for reliable email delivery
2. **Development Mode**: Logs emails to console for testing

### Configuration

Configure email settings in your `.env` file:

```env
# Email Configuration
EMAIL_FROM=noreply@yourdomain.com
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_VERIFICATION_EXPIRY=86400  # 24 hours
PASSWORD_RESET_EXPIRY=3600       # 1 hour

# AWS SES (for production)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
```

### API Endpoints

- `POST /auth/register` - Register and send verification email
- `GET /auth/verify-email?token=xxx` - Verify email address
- `POST /auth/resend-verification` - Resend verification email
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token

## Database Management

### Migrations

Create a new migration:
```bash
npm run migrate:create -- my_migration_name
```

Run pending migrations:
```bash
npm run migrate:up
```

Rollback last migration:
```bash
npm run migrate:down
```

Reset database (rollback all and re-run):
```bash
npm run db:reset
```

### Database Connection

The application uses PostgreSQL with the following connection options:

1. **Using DATABASE_URL** (recommended for production):
   ```
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

2. **Using individual settings**:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=personalpod
   DB_USER=postgres
   DB_PASSWORD=password
   ```

## API Endpoints

### Health Check
- `GET /health` - Check API and database status

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update user profile
- `PUT /api/auth/change-password` - Change password

## Architecture

### Services
- **AuthService**: Handles authentication logic
- **DatabaseService**: Manages database connections and queries
- **JWTService**: Token generation and validation
- **PasswordService**: Password hashing and verification
- **RefreshTokenService**: Refresh token management

### Repositories
- **UserRepository**: User data access layer

### Database Schema
- **users**: User accounts
- **user_passwords**: Password hashes (separate table for security)
- **refresh_tokens**: JWT refresh tokens

## Security Features

- Password hashing with Argon2
- JWT tokens with refresh token rotation
- Rate limiting
- CORS protection
- SQL injection prevention
- Automatic cleanup of expired tokens

## Development

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building
```bash
npm run build
```

## Troubleshooting

### Database Connection Issues
1. Ensure PostgreSQL is running
2. Check database credentials in `.env`
3. Verify database exists: `psql -U postgres -c "\l"`

### Migration Issues
1. Check migration status: `npm run migrate -- status`
2. Review migration files in `/migrations`
3. Check pgmigrations table in database

## License

ISC