# PersonalPod - Your Personal Life Journal & Knowledge Management System

<div align="center">
  <img src="docs/logo.png" alt="PersonalPod Logo" width="200" />
  
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
  [![React Native](https://img.shields.io/badge/react--native-0.80.1-61dafb)](https://reactnative.dev)
  [![TypeScript](https://img.shields.io/badge/typescript-5.0.4-blue)](https://www.typescriptlang.org)
</div>

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Deployment](#deployment)
- [Testing](#testing)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Mobile App](#mobile-app)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

PersonalPod is a comprehensive personal journal and knowledge management system designed to help you capture, organize, and reflect on your thoughts, experiences, and learnings. It provides a secure, private space for personal growth with powerful features for organizing and searching your content.

### Key Capabilities

- **Multi-format Entries**: Create notes, journal entries, voice memos, and more
- **Smart Organization**: Categories, tags, and full-text search
- **Secure & Private**: End-to-end encryption, MFA, biometric authentication
- **Offline-First**: Full functionality without internet connection
- **Cross-Platform**: Web app and native mobile apps (iOS/Android)
- **AI-Powered**: Smart insights and content suggestions
- **Data Export**: Your data is always yours - export anytime

## ✨ Features

### Core Features

#### 📝 Entry Management
- Multiple entry types (journal, note, voice, bookmark, task)
- Rich text editor with markdown support
- File attachments (images, documents, audio)
- Entry templates for quick creation
- Version history and drafts
- Bulk operations (export, delete, move)

#### 🏷️ Organization
- Hierarchical categories
- Flexible tagging system
- Smart collections and filters
- Custom fields and metadata
- Timeline and calendar views
- Full-text search with filters

#### 🔒 Security & Privacy
- End-to-end encryption for sensitive entries
- Multi-factor authentication (TOTP)
- Biometric authentication (mobile)
- Session management
- Audit logs
- Secure password recovery

#### 📱 Mobile Features
- Offline-first architecture
- Background sync
- Push notifications
- Biometric unlock
- Voice recording
- Camera integration
- Share extension

#### 🔄 Sync & Backup
- Real-time synchronization
- Conflict resolution
- Automatic backups
- Data export (JSON, CSV, PDF)
- Import from other apps
- Cloud storage integration

#### 📊 Analytics & Insights
- Writing statistics
- Mood tracking
- Tag clouds
- Activity heatmaps
- Personal growth metrics
- AI-powered insights

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   Web Client    │────▶│   API Gateway   │────▶│  Lambda Funcs   │
│  (React + TS)   │     │  (API Gateway)  │     │  (Node.js)      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
┌─────────────────┐                                      │
│                 │                                      ▼
│  Mobile Client  │                             ┌─────────────────┐
│  (React Native) │                             │                 │
│                 │                             │   PostgreSQL    │
└─────────────────┘                             │   (RDS Aurora)  │
         │                                      │                 │
         │                                      └─────────────────┘
         ▼                                               ▲
┌─────────────────┐                                      │
│                 │                                      │
│  Local SQLite   │──────────────────────────────────────┘
│  (WatermelonDB) │          (Sync)
│                 │
└─────────────────┘
```

### Technology Stack

#### Backend (AWS Serverless)
- **Runtime**: Node.js 18.x with TypeScript
- **API**: AWS API Gateway (REST)
- **Functions**: AWS Lambda
- **Database**: Aurora PostgreSQL Serverless v2
- **Auth**: AWS Cognito
- **Storage**: S3 for file attachments
- **Queue**: SQS for async processing
- **Cache**: ElastiCache (Redis)
- **Search**: OpenSearch
- **CDN**: CloudFront
- **IaC**: AWS CDK v2

#### Frontend (Web)
- **Framework**: React 19 with TypeScript
- **State**: Redux Toolkit + RTK Query
- **UI**: Material-UI v6
- **Routing**: React Router v7
- **Forms**: React Hook Form + Yup
- **Editor**: Lexical (Rich text)
- **Charts**: Recharts
- **Build**: Vite

#### Mobile (React Native)
- **Framework**: React Native 0.80.1
- **Navigation**: React Navigation v6
- **State**: Redux Toolkit + Redux Persist
- **UI**: React Native Paper (MD3)
- **Database**: WatermelonDB (SQLite)
- **Auth**: Biometrics + Keychain
- **Notifications**: Firebase Cloud Messaging

## 📋 Prerequisites

### Required Software

1. **Node.js**: v18.0.0 or higher
   ```bash
   # Check version
   node --version
   
   # Install via nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

2. **pnpm**: v8.0.0 or higher
   ```bash
   # Install pnpm
   npm install -g pnpm
   
   # Check version
   pnpm --version
   ```

3. **AWS CLI**: v2.x
   ```bash
   # macOS
   brew install awscli
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

4. **Docker**: For local development
   ```bash
   # Install Docker Desktop from https://www.docker.com/products/docker-desktop
   ```

### Mobile Development

#### iOS Development
- **macOS**: 13.0 or higher
- **Xcode**: 15.0 or higher
- **CocoaPods**: 1.12.0 or higher
  ```bash
  sudo gem install cocoapods
  ```

#### Android Development
- **Android Studio**: Hedgehog or higher
- **JDK**: 17 or higher
- **Android SDK**: API 34 (Android 14)

### AWS Account Setup

1. Create an AWS account at https://aws.amazon.com
2. Configure AWS CLI:
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Default region: us-east-1
   # Default output format: json
   ```

## 📁 Project Structure

```
PersonalPod/
├── api/                      # Backend API (Lambda functions)
│   ├── src/
│   │   ├── functions/       # Lambda function handlers
│   │   ├── services/        # Business logic
│   │   ├── models/          # Database models
│   │   ├── middleware/      # Express middleware
│   │   ├── utils/           # Utilities
│   │   └── types/           # TypeScript types
│   ├── tests/               # API tests
│   └── package.json
│
├── web/                      # Web frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── features/       # Feature modules
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API services
│   │   ├── store/          # Redux store
│   │   ├── utils/          # Utilities
│   │   └── types/          # TypeScript types
│   ├── public/             # Static assets
│   └── package.json
│
├── mobile/                   # React Native app
│   ├── src/
│   │   ├── components/     # React Native components
│   │   ├── screens/        # Screen components
│   │   ├── navigation/     # Navigation setup
│   │   ├── services/       # Services & API
│   │   ├── store/          # Redux store
│   │   ├── database/       # WatermelonDB models
│   │   └── utils/          # Utilities
│   ├── ios/                # iOS specific code
│   ├── android/            # Android specific code
│   └── package.json
│
├── infrastructure/           # AWS CDK infrastructure
│   ├── lib/
│   │   ├── stacks/         # CDK stacks
│   │   ├── constructs/     # Reusable constructs
│   │   └── config/         # Environment configs
│   └── package.json
│
├── shared/                   # Shared code
│   ├── types/              # Shared TypeScript types
│   └── constants/          # Shared constants
│
├── docs/                     # Documentation
├── scripts/                  # Build & deployment scripts
└── docker-compose.yml        # Local development setup
```

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/PersonalPod.git
cd PersonalPod
```

### 2. Install Dependencies

```bash
# Install all dependencies
pnpm install

# Install specific workspace dependencies
pnpm install --filter @personalpod/api
pnpm install --filter @personalpod/web
pnpm install --filter @personalpod/mobile
pnpm install --filter @personalpod/infrastructure
```

### 3. Environment Configuration

#### Create Environment Files

```bash
# API environment
cp api/.env.example api/.env

# Web environment
cp web/.env.example web/.env

# Mobile environment
cp mobile/.env.example mobile/.env
```

#### API Environment Variables (.env)

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/personalpod
DATABASE_SSL=false

# Auth
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# AWS (for local development)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# S3
S3_BUCKET_NAME=personalpod-attachments-dev
S3_REGION=us-east-1

# Redis
REDIS_URL=redis://localhost:6379

# Email (SES)
EMAIL_FROM=noreply@personalpod.com
EMAIL_REPLY_TO=support@personalpod.com

# MFA
MFA_APP_NAME=PersonalPod

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# API Keys
OPENAI_API_KEY=your-openai-api-key  # Optional: for AI features
```

#### Web Environment Variables (.env)

```env
# API
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# Auth
VITE_AUTH_DOMAIN=personalpod.auth.region.amazoncognito.com
VITE_AUTH_CLIENT_ID=your-cognito-client-id

# Features
VITE_ENABLE_AI_INSIGHTS=true
VITE_ENABLE_VOICE_NOTES=true

# Analytics (optional)
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

#### Mobile Environment Variables (.env)

```env
# API
API_URL=http://localhost:3001
WS_URL=ws://localhost:3001

# Auth
AUTH_DOMAIN=personalpod.auth.region.amazoncognito.com
AUTH_CLIENT_ID=your-cognito-client-id

# Push Notifications
FCM_SENDER_ID=your-fcm-sender-id

# Deep Linking
APP_SCHEME=personalpod
UNIVERSAL_LINK_DOMAIN=personalpod.com
```

### 4. Local Development Setup

#### Start Docker Services

```bash
# Start PostgreSQL, Redis, and LocalStack
docker-compose up -d

# Verify services are running
docker-compose ps
```

#### Initialize Database

```bash
# Run migrations
cd api
pnpm migrate:latest

# Seed development data (optional)
pnpm seed:dev
```

#### Start Development Servers

```bash
# Terminal 1: Start API server
cd api
pnpm dev

# Terminal 2: Start web client
cd web
pnpm dev

# Terminal 3: Start mobile metro bundler
cd mobile
pnpm start
```

### 5. Mobile App Setup

#### iOS Setup

```bash
cd mobile/ios
pod install

# Open in Xcode
open PersonalPod.xcworkspace

# Or run from terminal
cd ..
pnpm ios
```

#### Android Setup

```bash
cd mobile

# Start Android emulator first, then:
pnpm android

# Or open in Android Studio
open -a "Android Studio" android
```

#### Physical Device Setup

1. **iOS**: 
   - Enable Developer Mode on device
   - Trust computer in device settings
   - Select device in Xcode and run

2. **Android**:
   - Enable Developer Options
   - Enable USB Debugging
   - Connect device and accept debugging prompt

## 🚢 Deployment

### Prerequisites for Deployment

1. **AWS Account** with appropriate permissions
2. **Domain Name** (optional but recommended)
3. **SSL Certificates** (managed by AWS Certificate Manager)

### Infrastructure Deployment

#### 1. Configure CDK

```bash
cd infrastructure

# Install CDK CLI
npm install -g aws-cdk

# Bootstrap CDK (first time only)
cdk bootstrap aws://ACCOUNT-ID/REGION
```

#### 2. Deploy Infrastructure

```bash
# Deploy all stacks
pnpm deploy

# Or deploy specific stacks
pnpm deploy:network
pnpm deploy:database
pnpm deploy:api
pnpm deploy:web
```

#### 3. Infrastructure Stacks

- **Network Stack**: VPC, subnets, security groups
- **Database Stack**: Aurora PostgreSQL Serverless
- **Auth Stack**: Cognito User Pool
- **API Stack**: API Gateway, Lambda functions
- **Storage Stack**: S3 buckets, CloudFront
- **Web Stack**: S3 static hosting, CloudFront

### API Deployment

```bash
cd api

# Build the API
pnpm build

# Deploy to AWS
pnpm deploy:prod

# Run post-deployment tasks
pnpm migrate:prod
```

### Web Deployment

```bash
cd web

# Build for production
pnpm build

# Deploy to S3
pnpm deploy:prod

# Invalidate CloudFront cache
pnpm invalidate:cache
```

### Mobile Deployment

#### iOS Deployment

1. **Configure in Xcode**:
   - Set bundle identifier
   - Configure signing certificates
   - Update version and build numbers

2. **Build and Archive**:
   ```bash
   cd mobile/ios
   
   # Clean build
   xcodebuild clean
   
   # Archive
   xcodebuild archive \
     -workspace PersonalPod.xcworkspace \
     -scheme PersonalPod \
     -configuration Release \
     -archivePath ./build/PersonalPod.xcarchive
   ```

3. **Upload to App Store Connect**:
   - Use Xcode Organizer
   - Or use Fastlane (recommended)

#### Android Deployment

1. **Configure signing**:
   ```bash
   cd mobile/android
   
   # Create keystore
   keytool -genkey -v -keystore personalpod.keystore \
     -alias personalpod -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Build APK/AAB**:
   ```bash
   # Build AAB for Play Store
   ./gradlew bundleRelease
   
   # Build APK for testing
   ./gradlew assembleRelease
   ```

3. **Upload to Play Console**

### Environment-Specific Configurations

#### Development
- Uses LocalStack for AWS services
- SQLite for mobile offline storage
- Hot reload enabled
- Debug logging

#### Staging
- Separate AWS account/region
- Reduced instance sizes
- Basic monitoring
- Test data

#### Production
- Multi-region deployment
- Auto-scaling enabled
- Full monitoring and alerts
- Backup and disaster recovery

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific workspace tests
pnpm test:api
pnpm test:web
pnpm test:mobile

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

### Test Structure

#### API Tests
```bash
api/tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── fixtures/      # Test data
```

#### Web Tests
```bash
web/tests/
├── components/    # Component tests
├── hooks/        # Hook tests
├── pages/        # Page tests
└── e2e/          # Cypress tests
```

#### Mobile Tests
```bash
mobile/tests/
├── components/   # Component tests
├── screens/      # Screen tests
├── services/     # Service tests
└── e2e/          # Detox tests
```

### E2E Testing

#### Web E2E (Cypress)
```bash
cd web

# Open Cypress UI
pnpm cypress:open

# Run headless
pnpm cypress:run
```

#### Mobile E2E (Detox)
```bash
cd mobile

# Build for testing
pnpm detox:build:ios
pnpm detox:build:android

# Run tests
pnpm detox:test:ios
pnpm detox:test:android
```

## 🛠️ Development

### Development Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test locally**

3. **Run linting and formatting**:
   ```bash
   pnpm lint
   pnpm format
   ```

4. **Run tests**:
   ```bash
   pnpm test
   ```

5. **Commit with conventional commits**:
   ```bash
   git commit -m "feat: add new feature"
   ```

6. **Push and create PR**

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Auto-formatting
- **Husky**: Pre-commit hooks

### Debugging

#### API Debugging
```bash
# Enable debug logs
DEBUG=personalpod:* pnpm dev

# Use VS Code debugger
# Launch configuration in .vscode/launch.json
```

#### Web Debugging
- React Developer Tools
- Redux DevTools
- Chrome DevTools

#### Mobile Debugging
- React Native Debugger
- Flipper
- Chrome DevTools (for JS debugging)
- Xcode/Android Studio (for native debugging)

### Performance Profiling

#### Web Performance
```bash
# Build with profiling
pnpm build:profile

# Analyze bundle
pnpm analyze
```

#### Mobile Performance
- Use React DevTools Profiler
- Systrace for Android
- Instruments for iOS

## 📖 API Documentation

### Base URL
- Development: `http://localhost:3001`
- Production: `https://api.personalpod.com`

### Authentication

All API requests require authentication except for public endpoints.

```bash
# Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# Response
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { ... }
}
```

Include the access token in subsequent requests:
```bash
Authorization: Bearer eyJ...
```

### Core Endpoints

#### Entries
```bash
# List entries
GET /entries?page=1&limit=20&type=journal&categoryId=123

# Get entry
GET /entries/:id

# Create entry
POST /entries
{
  "title": "My Entry",
  "content": "Content here",
  "type": "journal",
  "categoryId": "123",
  "tags": ["personal", "thoughts"]
}

# Update entry
PUT /entries/:id
{ ... }

# Delete entry
DELETE /entries/:id
```

#### Categories
```bash
# List categories
GET /categories

# Create category
POST /categories
{
  "name": "Personal",
  "description": "Personal entries",
  "color": "#6366f1",
  "icon": "folder"
}
```

#### Search
```bash
# Search entries
GET /search?q=keyword&type=journal&from=2024-01-01

# Advanced search
POST /search/advanced
{
  "query": "keyword",
  "filters": {
    "types": ["journal", "note"],
    "categories": ["123", "456"],
    "tags": ["important"],
    "dateRange": {
      "from": "2024-01-01",
      "to": "2024-12-31"
    }
  }
}
```

### WebSocket Events

Connect to WebSocket for real-time updates:
```javascript
const ws = new WebSocket('ws://localhost:3001');

// Subscribe to events
ws.send(JSON.stringify({
  type: 'subscribe',
  events: ['entry.created', 'entry.updated']
}));

// Receive updates
ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event);
});
```

## 📱 Mobile App

### Features

#### Offline-First Architecture
- WatermelonDB for local storage
- Automatic sync when online
- Conflict resolution
- Queue for offline changes

#### Biometric Authentication
- Face ID / Touch ID support
- Secure keychain storage
- App lock with PIN fallback

#### Push Notifications
- Daily journal reminders
- Sync completion alerts
- Custom notification scheduling

#### Platform-Specific Features

**iOS**:
- Share extension
- Widgets
- Siri shortcuts
- iCloud backup

**Android**:
- Material You theming
- Quick tiles
- Google Drive backup

### Building for Release

#### iOS Release Build
```bash
cd mobile

# Update version
npm version patch

# Build release
cd ios
fastlane release
```

#### Android Release Build
```bash
cd mobile/android

# Update version in build.gradle

# Build release
fastlane release
```

## 🔒 Security

### Security Features

1. **Encryption**
   - At-rest encryption for database
   - In-transit encryption (TLS 1.3)
   - Client-side encryption for sensitive entries
   - Encrypted file storage

2. **Authentication**
   - JWT with refresh tokens
   - Multi-factor authentication (TOTP)
   - Biometric authentication (mobile)
   - Session management

3. **Authorization**
   - Role-based access control
   - Resource-level permissions
   - API rate limiting
   - IP allowlisting (optional)

4. **Audit & Compliance**
   - Audit logs for all actions
   - GDPR compliance tools
   - Data retention policies
   - Right to deletion

### Security Best Practices

1. **API Security**
   ```typescript
   // Input validation
   app.use(helmet());
   app.use(cors({ origin: process.env.ALLOWED_ORIGINS }));
   app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
   ```

2. **Database Security**
   - Parameterized queries
   - Connection pooling
   - Least privilege principle
   - Regular backups

3. **Mobile Security**
   - Certificate pinning
   - Jailbreak/root detection
   - Secure storage
   - Code obfuscation

### Vulnerability Reporting

Found a security issue? Please email security@personalpod.com

## 🔧 Troubleshooting

### Common Issues

#### Installation Issues

**Issue**: `pnpm install` fails
```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install
```

**Issue**: PostgreSQL connection failed
```bash
# Check if Docker is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

#### Development Issues

**Issue**: API not starting
```bash
# Check port availability
lsof -i :3001

# Kill process using port
kill -9 <PID>

# Check environment variables
env | grep DATABASE_URL
```

**Issue**: Mobile app won't connect to API
```bash
# For iOS simulator
# Use http://localhost:3001

# For Android emulator
# Use http://10.0.2.2:3001

# For physical device
# Use your computer's IP address
ifconfig | grep inet
```

#### Build Issues

**Issue**: iOS build fails
```bash
# Clean build
cd ios
rm -rf build/
pod deintegrate
pod install
cd ..
pnpm ios --reset-cache
```

**Issue**: Android build fails
```bash
# Clean build
cd android
./gradlew clean
cd ..
pnpm android --reset-cache
```

### Debug Mode

Enable detailed logging:

```bash
# API
DEBUG=* pnpm dev

# Web
VITE_DEBUG=true pnpm dev

# Mobile
REACT_NATIVE_DEBUG=true pnpm start
```

### Getting Help

1. Check the [documentation](docs/)
2. Search [existing issues](https://github.com/yourusername/PersonalPod/issues)
3. Join our [Discord community](https://discord.gg/personalpod)
4. Contact support: support@personalpod.com

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup for Contributors

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Run tests
6. Submit a pull request

### Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 📄 License

PersonalPod is open source software licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with ❤️ by the PersonalPod team
- Thanks to all our contributors
- Special thanks to the open source community

## 📞 Contact

- **Website**: https://personalpod.com
- **Email**: hello@personalpod.com
- **Twitter**: [@PersonalPod](https://twitter.com/PersonalPod)
- **Discord**: [Join our community](https://discord.gg/personalpod)

---

<div align="center">
  Made with ❤️ by developers, for everyone who values their thoughts
</div>