# TrailRun Deployment Guide

This document outlines the deployment process for the TrailRun mobile application.

## Prerequisites

1. **EAS CLI**: Install the Expo Application Services CLI
   ```bash
   npm install -g @expo/eas-cli
   ```

2. **Expo Account**: Create an account at [expo.dev](https://expo.dev)

3. **App Store Credentials**: 
   - Apple Developer Account for iOS deployment
   - Google Play Console account for Android deployment

## Environment Setup

### Required Environment Variables

Create a `.env` file in the project root with:

```env
EXPO_TOKEN=your_expo_token
MAPBOX_ACCESS_TOKEN=your_mapbox_token
SENTRY_DSN=your_sentry_dsn
AMPLITUDE_API_KEY=your_amplitude_key
```

### GitHub Secrets

Configure the following secrets in your GitHub repository:

- `EXPO_TOKEN`: Your Expo access token
- `EXPO_APPLE_ID`: Apple ID for App Store submissions
- `EXPO_ASC_APP_ID`: App Store Connect app ID
- `EXPO_APPLE_TEAM_ID`: Apple Developer Team ID
- `EXPO_GOOGLE_SERVICE_ACCOUNT_KEY_PATH`: Path to Google service account key
- `SONAR_TOKEN`: SonarCloud token for code quality analysis

## Build Profiles

### Development
For internal testing and development:
```bash
npm run build:development
```

### Preview
For stakeholder reviews and testing:
```bash
npm run build:preview
```

### Production
For app store releases:
```bash
npm run build:production
```

## Deployment Process

### Automated Deployment (Recommended)

1. **Pull Request**: Create a PR to trigger preview builds
2. **Merge to Main**: Merging to main triggers production builds
3. **Release**: Create a GitHub release to trigger app store submissions

### Manual Deployment

Use the deployment script:
```bash
./scripts/deploy.sh [environment]
```

Where environment is one of: `development`, `preview`, `production`

## App Store Submission

### Quick Reference
For detailed step-by-step instructions, see:
- **[Complete App Store Guide](./APP_STORE_DEPLOYMENT.md)** - Comprehensive deployment instructions
- **[Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)** - Quick reference checklist

### iOS App Store

1. **Prerequisites**: Apple Developer Account ($99/year)
2. **Build**: `eas build --platform ios --profile production`
3. **Submit**: `eas submit --platform ios --latest`
4. **Review**: Complete App Store Connect metadata and submit for review

### Google Play Store

1. **Prerequisites**: Google Play Console Account ($25 one-time)
2. **Build**: `eas build --platform android --profile production`
3. **Submit**: `eas submit --platform android --latest`
4. **Review**: Complete Play Console store listing and submit for review

### Store Assets
Generate required screenshots and graphics:
```bash
./scripts/generate-store-assets.sh
```

## Monitoring

- **Crash Reports**: Sentry dashboard
- **Analytics**: Amplitude dashboard
- **Code Quality**: SonarCloud dashboard
- **Build Status**: GitHub Actions

## Beta Testing

Before production release, run comprehensive beta testing:

### Quick Beta Deployment
```bash
# Deploy to beta channels
./scripts/deploy-beta.sh all internal

# Or use GitHub Actions
# Push to 'develop' branch or trigger workflow manually
```

### Beta Testing Phases
1. **Internal Testing** (1-2 weeks) - Team and close contacts
2. **Closed Beta** (2-3 weeks) - Invited trail runners  
3. **Open Beta** (1-2 weeks) - Public TestFlight/Play Console
4. **Release Candidate** (1 week) - Final validation

For detailed beta testing instructions, see:
- **[Beta Testing Guide](./BETA_TESTING_GUIDE.md)** - Complete beta testing workflow

## Troubleshooting

### Common Issues

1. **Build Failures**: Check EAS build logs
2. **Submission Failures**: Verify app store credentials
3. **Test Failures**: Run tests locally first
4. **Beta Issues**: Check TestFlight/Play Console status

### Support

For deployment issues, check:
1. EAS documentation: https://docs.expo.dev/eas/
2. GitHub Actions logs
3. Project issue tracker
4. Beta testing feedback channels