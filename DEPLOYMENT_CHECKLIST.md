# TrailRun Deployment Checklist

## 🚀 Quick Deployment Steps

### Prerequisites Setup
- [ ] Apple Developer Account ($99/year)
- [ ] Google Play Console Account ($25 one-time)
- [ ] Expo Account (free)
- [ ] EAS CLI installed: `npm install -g @expo/eas-cli`

### Environment Configuration
- [ ] Copy `.env.example` to `.env` and fill in values
- [ ] Set up GitHub repository secrets
- [ ] Configure Apple Developer credentials
- [ ] Set up Google Play service account

### iOS App Store (Apple)

#### Account Setup
- [ ] Enroll in Apple Developer Program
- [ ] Create app in App Store Connect
- [ ] Configure bundle ID: `com.trailrun.app`
- [ ] Set up app metadata and screenshots

#### Build & Submit
```bash
# Login to EAS
eas login

# Build iOS app
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest
```

#### App Store Connect
- [ ] Upload required screenshots (iPhone 6.7", 6.5", 5.5", iPad 12.9")
- [ ] Complete app description and metadata
- [ ] Set privacy policy URL: `https://trailrun.app/privacy`
- [ ] Complete age rating questionnaire (4+)
- [ ] Answer export compliance (No encryption)
- [ ] Submit for review

### Google Play Store (Android)

#### Account Setup
- [ ] Create Google Play Console account
- [ ] Create new app: "TrailRun"
- [ ] Set up store listing and graphics
- [ ] Create service account for automated submissions

#### Build & Submit
```bash
# Build Android app
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android --latest
```

#### Play Console
- [ ] Upload app icon (512x512px) and feature graphic (1024x500px)
- [ ] Add phone screenshots (minimum 2)
- [ ] Complete content rating questionnaire
- [ ] Set privacy policy URL: `https://trailrun.app/privacy`
- [ ] Configure release to production

### Automated Deployment (Recommended)

#### GitHub Secrets Required
```
EXPO_TOKEN=your_expo_token
EXPO_APPLE_ID=your_apple_id@example.com
EXPO_ASC_APP_ID=your_app_store_connect_app_id
EXPO_APPLE_TEAM_ID=your_apple_team_id
EXPO_GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account.json
```

#### Deployment Commands
```bash
# Manual deployment
./scripts/deploy.sh production

# Or create GitHub release for automatic deployment
git tag v1.0.0
git push origin v1.0.0
# Then create release on GitHub
```

### Post-Submission
- [ ] Monitor App Store Connect for iOS review status
- [ ] Monitor Google Play Console for Android review status
- [ ] Prepare for user feedback and potential updates
- [ ] Set up crash monitoring (Sentry already configured)
- [ ] Plan marketing and launch strategy

### Timeline Expectations
- **iOS Review**: 24-48 hours
- **Android Review**: 1-3 days
- **Total Time to Live**: 3-7 days (including setup)

### Emergency Contacts
- Apple Developer Support: developer.apple.com/support
- Google Play Support: support.google.com/googleplay/android-developer
- Expo Support: docs.expo.dev

## 🎯 Success Metrics to Track
- Download numbers
- User retention rates
- Crash-free sessions (target: >99%)
- User ratings (target: >4.0 stars)
- GPS accuracy feedback
- Battery usage reports

## 📱 Post-Launch Monitoring
- Daily crash reports review
- Weekly user feedback analysis
- Monthly performance metrics review
- Quarterly feature usage analysis