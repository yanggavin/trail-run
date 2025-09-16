# TrailRun 🏃‍♂️

A comprehensive React Native mobile application designed specifically for trail runners to track GPS routes, capture geotagged photos, and generate detailed activity summaries called "Routine Records."

## ✨ Features

### Core Functionality
- **Precision GPS Tracking:** High-accuracy location tracking with background support
- **Smart Photo Capture:** Automatic geotagging and EXIF data management
- **Routine Records:** Comprehensive activity summaries with maps, photos, and statistics
- **Offline-First:** Full functionality without internet connection
- **Cross-Platform:** Native iOS and Android support

### Advanced Features
- **Auto-Pause Detection:** Intelligent pause/resume based on movement patterns
- **Privacy-Focused:** Local encryption, EXIF stripping, and granular privacy controls
- **Cloud Sync:** Secure synchronization across devices with AWS backend
- **Performance Monitoring:** Real-time analytics and crash reporting
- **Battery Optimization:** Efficient background processing for long trail runs

## 🛠 Tech Stack

### Frontend
- **Framework:** React Native with Expo managed workflow
- **Navigation:** React Navigation 6
- **State Management:** Zustand
- **UI Components:** Custom React Native components
- **Maps:** Mapbox GL Native
- **Camera:** Expo Camera with custom native modules

### Backend & Infrastructure
- **Database:** SQLite (local) + AWS RDS (cloud)
- **Backend:** AWS Serverless (Lambda, API Gateway, S3)
- **Authentication:** AWS Cognito
- **File Storage:** AWS S3 with CloudFront CDN
- **Infrastructure:** AWS CDK for deployment

### Development & Quality
- **Language:** TypeScript
- **Testing:** Jest + React Native Testing Library
- **Linting:** ESLint + Prettier
- **CI/CD:** GitHub Actions + EAS Build
- **Monitoring:** Sentry + Amplitude Analytics

## 📁 Project Structure

```
TrailRun/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/         # Generic components (ErrorBoundary, ElevationChart)
│   │   ├── map/           # Map-related components (MapView)
│   │   ├── photo/         # Photo components (PhotoGallery, PhotoLightbox)
│   │   ├── stats/         # Statistics components (StatsCard)
│   │   ├── activity/      # Activity components (ActivityEditModal)
│   │   ├── history/       # History components (FilterModal, SearchBar)
│   │   ├── privacy/       # Privacy components (PrivacySettingsModal)
│   │   ├── feedback/      # Feedback components (FeedbackModal)
│   │   ├── recovery/      # Recovery components (CrashRecoveryModal)
│   │   └── legal/         # Legal components (PrivacyPolicy, Terms)
│   ├── screens/            # Screen components
│   │   ├── Home/          # Main tracking screen
│   │   ├── Camera/        # Photo capture screen
│   │   ├── ActivityDetail/ # Activity detail and sharing
│   │   ├── History/       # Activity history and search
│   │   └── Settings/      # App settings and preferences
│   ├── services/          # Business logic services
│   │   ├── location/      # GPS tracking and location services
│   │   ├── photo/         # Photo capture and storage
│   │   ├── activity/      # Activity management and statistics
│   │   ├── tracking/      # GPS data processing and auto-pause
│   │   ├── sync/          # Cloud synchronization
│   │   ├── auth/          # Authentication services
│   │   ├── cloud/         # Cloud storage services
│   │   ├── security/      # Security and encryption services
│   │   ├── monitoring/    # Analytics and performance monitoring
│   │   ├── background/    # Background task management
│   │   ├── history/       # Activity history management
│   │   ├── map/           # Map configuration and utilities
│   │   ├── database/      # Database services
│   │   └── repositories/  # Data access layer
│   ├── store/             # Zustand state management
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── hooks/             # Custom React hooks
│   ├── contexts/          # React contexts
│   ├── config/            # Configuration files
│   └── __tests__/         # Test files
│       ├── integration/   # Integration tests
│       └── performance/   # Performance tests
├── modules/               # Custom native modules
│   └── expo-location-tracker/ # Custom GPS tracking module
├── infrastructure/        # AWS CDK infrastructure code
├── assets/               # App icons and images
├── .github/              # GitHub workflows and templates
└── scripts/              # Build and deployment scripts
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0+
- **npm** or **yarn**
- **Expo CLI** (`npm install -g @expo/cli`)
- **EAS CLI** (`npm install -g @expo/eas-cli`)
- **iOS Simulator** (for iOS development)
- **Android Studio/Emulator** (for Android development)

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yanggavin/trail-run.git
   cd trail-run/TrailRun
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Start the development server:**
   ```bash
   npm start
   ```

5. **Run on specific platform:**
   ```bash
   npm run ios     # iOS simulator
   npm run android # Android emulator
   npm run web     # Web browser (limited functionality)
   ```

## 🛠 Development

### Code Quality

The project includes comprehensive code quality tools:

```bash
# Linting and formatting
npm run lint        # Check for linting errors
npm run lint:fix    # Fix linting errors
npm run format      # Format code with Prettier
npm run type-check  # TypeScript type checking

# Testing
npm run test        # Run unit tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Security
npm run security:audit # Run security audit
```

### Pre-commit Hooks

The project uses pre-commit hooks to ensure code quality:

```bash
# Install pre-commit hooks
npm install -g pre-commit
pre-commit install
```

### Building and Deployment

```bash
# Development builds
npm run build:development

# Preview builds (for testing)
npm run build:preview

# Production builds
npm run build:production

# Deploy to app stores
npm run deploy:production
```

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 🏗 Architecture

### Data Flow
1. **GPS Tracking:** Custom native module captures high-precision location data
2. **Local Storage:** SQLite database with encryption for offline-first functionality
3. **Photo Processing:** Automatic geotagging with privacy-aware EXIF handling
4. **Cloud Sync:** Secure synchronization with AWS backend infrastructure
5. **Analytics:** Privacy-focused monitoring with Sentry and Amplitude

### Security & Privacy
- **Local Encryption:** AES-256 encryption for local database and storage
- **EXIF Stripping:** Automatic removal of sensitive metadata from exported photos
- **Privacy Controls:** Granular user controls for data sharing and analytics
- **Secure Communication:** TLS 1.2+ with certificate pinning for API calls

## 📊 Implementation Status

### ✅ Completed Features

1. **✅ Project Structure & Development Environment**
   - Expo managed workflow setup
   - TypeScript configuration
   - ESLint, Prettier, and testing framework

2. **✅ Core Data Models & Local Storage**
   - SQLite database with encrypted storage
   - Repository pattern for data access
   - Type-safe data models

3. **✅ Native GPS Tracking Module**
   - Custom Expo module for high-precision tracking
   - Background location support
   - Battery-optimized implementation

4. **✅ GPS Tracking Business Logic**
   - Auto-pause detection algorithms
   - GPS data processing and filtering
   - Route analysis and statistics

5. **✅ Photo Capture Functionality**
   - Camera integration with geotagging
   - Photo storage and management
   - Privacy-aware EXIF handling

6. **✅ Core UI Components & Screens**
   - Navigation structure
   - Home, Camera, History, and Settings screens
   - Reusable component library

7. **✅ Map Integration & Visualization**
   - Mapbox integration
   - Interactive route visualization
   - Photo markers on maps

8. **✅ Routine Record Generation**
   - Activity summary creation
   - Statistics calculation
   - Shareable content generation

9. **✅ History & Browsing Functionality**
   - Activity history with search and filtering
   - Detailed activity views
   - Photo galleries and lightbox

10. **✅ Cloud Sync & Backend Integration**
    - AWS serverless backend
    - Authentication with Cognito
    - S3 storage for photos and data

11. **✅ Background Processing & App Lifecycle**
    - Background task management
    - App state handling
    - Crash recovery mechanisms

12. **✅ Security & Privacy Features**
    - End-to-end encryption
    - Privacy settings and controls
    - Secure communication protocols

13. **✅ Performance Monitoring & Analytics**
    - Sentry integration for crash reporting
    - Amplitude for user analytics
    - Performance monitoring dashboard

14. **✅ Comprehensive Testing Suite**
    - Unit tests for all services
    - Integration tests for workflows
    - Performance tests for GPS accuracy

15. **✅ App Configuration & Deployment Setup**
    - CI/CD pipeline with GitHub Actions
    - EAS Build configuration
    - App store metadata and submission

## 📱 App Store Information

- **Bundle ID:** `com.trailrun.app`
- **Version:** 1.0.0
- **Category:** Health & Fitness
- **Platforms:** iOS 14.0+, Android API 26+
- **Privacy Policy:** [https://trailrun.app/privacy](https://trailrun.app/privacy)

## 🤝 Contributing

This project follows a structured development process:

1. **Issues:** Use GitHub issues for bug reports and feature requests
2. **Pull Requests:** All changes must go through PR review
3. **Code Quality:** Pre-commit hooks ensure code standards
4. **Testing:** All new features require comprehensive tests

## 📄 Documentation

- **[Deployment Guide](./DEPLOYMENT.md)** - Complete deployment instructions
- **[Infrastructure README](./infrastructure/README.md)** - AWS infrastructure setup
- **[API Documentation](./docs/api.md)** - Backend API reference (coming soon)

## 📞 Support

For questions, issues, or contributions:
- **GitHub Issues:** [https://github.com/yanggavin/trail-run/issues](https://github.com/yanggavin/trail-run/issues)
- **Email:** support@trailrun.app

## 📄 License

This project is private and proprietary. All rights reserved.
