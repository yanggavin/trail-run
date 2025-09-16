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

### iOS App Store

1. Builds are automatically submitted via EAS Submit
2. Review submission in App Store Connect
3. Submit for App Store review

### Google Play Store

1. Builds are automatically uploaded to internal testing
2. Promote to production in Google Play Console
3. Submit for Google Play review

## Monitoring

- **Crash Reports**: Sentry dashboard
- **Analytics**: Amplitude dashboard
- **Code Quality**: SonarCloud dashboard
- **Build Status**: GitHub Actions

## Troubleshooting

### Common Issues

1. **Build Failures**: Check EAS build logs
2. **Submission Failures**: Verify app store credentials
3. **Test Failures**: Run tests locally first

### Support

For deployment issues, check:
1. EAS documentation: https://docs.expo.dev/eas/
2. GitHub Actions logs
3. Project issue tracker