# TrailRun App Store Deployment Guide

This guide provides step-by-step instructions for publishing TrailRun to the Apple App Store and Google Play Store.

## 📋 Prerequisites

### Required Accounts & Memberships
- **Apple Developer Account** ($99/year) - [developer.apple.com](https://developer.apple.com)
- **Google Play Console Account** ($25 one-time fee) - [play.google.com/console](https://play.google.com/console)
- **Expo Account** (free) - [expo.dev](https://expo.dev)

### Required Tools
- **EAS CLI**: `npm install -g @expo/eas-cli`
- **Xcode** (for iOS, macOS only)
- **Android Studio** (for Android)

### Required Credentials
- Apple Developer Team ID
- Apple App Store Connect credentials
- Google Play Console service account key
- App signing certificates

## 🍎 iOS App Store Deployment

### Step 1: Apple Developer Account Setup

1. **Enroll in Apple Developer Program**
   - Visit [developer.apple.com](https://developer.apple.com)
   - Enroll as an individual or organization
   - Pay the $99 annual fee
   - Wait for approval (1-2 business days)

2. **Create App Store Connect App**
   - Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Click "My Apps" → "+" → "New App"
   - Fill in app information:
     - **Name**: TrailRun
     - **Bundle ID**: `com.trailrun.app`
     - **SKU**: `trailrun-ios-001`
     - **Primary Language**: English

### Step 2: Configure App Information

1. **App Information**
   - **Category**: Health & Fitness
   - **Content Rights**: Check if you own or have licensed all content
   - **Age Rating**: Complete the questionnaire (likely 4+)

2. **Pricing and Availability**
   - **Price**: Free
   - **Availability**: All countries/regions
   - **App Store Distribution**: Available on App Store

### Step 3: Prepare App Metadata

1. **App Store Information**
   ```
   App Name: TrailRun
   Subtitle: GPS Tracking for Trail Runners
   Description: [Use description from store-metadata.json]
   Keywords: running,trail,GPS,tracking,fitness,outdoor,hiking
   Support URL: https://trailrun.app/support
   Marketing URL: https://trailrun.app
   Privacy Policy URL: https://trailrun.app/privacy
   ```

2. **Screenshots Required**
   - iPhone 6.7" (iPhone 14 Pro Max): 3-10 screenshots
   - iPhone 6.5" (iPhone 14 Plus): 3-10 screenshots
   - iPhone 5.5" (iPhone 8 Plus): 3-10 screenshots
   - iPad Pro 12.9" (6th gen): 3-10 screenshots

### Step 4: Build and Submit iOS App

1. **Configure EAS for iOS**
   ```bash
   cd TrailRun
   eas login
   eas build:configure
   ```

2. **Update eas.json with Apple credentials**
   ```json
   {
     "submit": {
       "production": {
         "ios": {
           "appleId": "your-apple-id@example.com",
           "ascAppId": "your-app-store-connect-app-id",
           "appleTeamId": "your-apple-team-id"
         }
       }
     }
   }
   ```

3. **Build production iOS app**
   ```bash
   eas build --platform ios --profile production
   ```

4. **Submit to App Store**
   ```bash
   eas submit --platform ios --latest
   ```

### Step 5: App Store Review Process

1. **Complete App Store Connect**
   - Upload screenshots
   - Fill in app description
   - Set pricing and availability
   - Complete age rating questionnaire
   - Add app review information

2. **Submit for Review**
   - Click "Submit for Review"
   - Answer additional questions about:
     - Export compliance (select "No" for encryption)
     - Content rights
     - Advertising identifier usage

3. **Review Timeline**
   - Initial review: 24-48 hours
   - If rejected: Address issues and resubmit
   - If approved: App goes live automatically

## 🤖 Google Play Store Deployment

### Step 1: Google Play Console Setup

1. **Create Google Play Console Account**
   - Go to [play.google.com/console](https://play.google.com/console)
   - Pay $25 registration fee
   - Complete identity verification

2. **Create New App**
   - Click "Create app"
   - Fill in details:
     - **App name**: TrailRun
     - **Default language**: English (United States)
     - **App or game**: App
     - **Free or paid**: Free

### Step 2: Configure App Details

1. **App Information**
   - **Category**: Health & Fitness
   - **Tags**: Fitness, Running, GPS, Outdoor
   - **Contact details**: Add developer email and website

2. **Store Listing**
   ```
   App name: TrailRun
   Short description: GPS tracking for trail runners with photo capture
   Full description: [Use description from store-metadata.json]
   ```

3. **Graphics Assets**
   - **App icon**: 512 x 512 px
   - **Feature graphic**: 1024 x 500 px
   - **Phone screenshots**: At least 2, up to 8
   - **Tablet screenshots**: At least 1 (if supporting tablets)

### Step 3: Set Up App Signing

1. **Create Service Account**
   - Go to Google Cloud Console
   - Create new service account
   - Download JSON key file
   - Grant necessary permissions in Play Console

2. **Configure EAS for Android**
   ```bash
   # Save service account key as google-service-account.json
   # Update eas.json
   ```

### Step 4: Build and Submit Android App

1. **Build production Android app**
   ```bash
   eas build --platform android --profile production
   ```

2. **Submit to Google Play**
   ```bash
   eas submit --platform android --latest
   ```

### Step 5: Google Play Review Process

1. **Complete Store Listing**
   - Upload all required graphics
   - Fill in content rating questionnaire
   - Set up pricing and distribution
   - Add privacy policy link

2. **Release Management**
   - Choose release type (Internal testing → Production)
   - Upload APK/AAB file
   - Add release notes

3. **Review Timeline**
   - Initial review: 1-3 days
   - Policy review: Up to 7 days
   - If approved: App goes live within hours

## 🚀 Automated Deployment (Recommended)

### Using GitHub Actions

The project includes automated deployment workflows:

1. **Automatic Builds**
   - Push to `main` branch triggers production builds
   - Pull requests trigger preview builds

2. **Automatic Submissions**
   - Create GitHub release to trigger app store submissions
   - Monitor GitHub Actions for build status

3. **Required GitHub Secrets**
   ```
   EXPO_TOKEN=your_expo_token
   EXPO_APPLE_ID=your_apple_id
   EXPO_ASC_APP_ID=your_app_store_connect_id
   EXPO_APPLE_TEAM_ID=your_apple_team_id
   EXPO_GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account.json
   ```

### Manual Deployment Script

Use the included deployment script:

```bash
# Build and submit to both stores
./scripts/deploy.sh production

# Or build for specific platform
eas build --platform ios --profile production
eas build --platform android --profile production
```

## 📝 Pre-Submission Checklist

### iOS App Store
- [ ] Apple Developer Account active
- [ ] App Store Connect app created
- [ ] All required screenshots uploaded
- [ ] App description and metadata complete
- [ ] Privacy policy URL added
- [ ] Age rating completed
- [ ] Export compliance answered
- [ ] App built and submitted via EAS

### Google Play Store
- [ ] Google Play Console account active
- [ ] App created in Play Console
- [ ] Store listing complete with graphics
- [ ] Content rating questionnaire completed
- [ ] Privacy policy link added
- [ ] App signing configured
- [ ] APK/AAB uploaded and submitted

## 🔍 Post-Submission Monitoring

### App Store Connect
- Monitor review status in App Store Connect
- Respond to reviewer feedback if needed
- Check crash reports and user feedback

### Google Play Console
- Monitor review status in Play Console
- Check pre-launch reports
- Monitor crash reports and ANRs
- Review user feedback and ratings

## 🛠 Troubleshooting Common Issues

### iOS Submission Issues
- **Invalid Bundle ID**: Ensure bundle ID matches Apple Developer account
- **Missing Permissions**: Add usage descriptions for all required permissions
- **Export Compliance**: Answer "No" if not using encryption beyond standard iOS encryption

### Android Submission Issues
- **Target SDK**: Ensure targeting latest Android API level
- **Permissions**: Review and justify all requested permissions
- **Content Rating**: Complete content rating questionnaire accurately

## 📞 Support Resources

- **Apple Developer Support**: [developer.apple.com/support](https://developer.apple.com/support)
- **Google Play Support**: [support.google.com/googleplay/android-developer](https://support.google.com/googleplay/android-developer)
- **Expo Documentation**: [docs.expo.dev](https://docs.expo.dev)
- **EAS Build Docs**: [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction)

## 🎉 Launch Strategy

### Soft Launch
1. Release to limited regions first
2. Monitor performance and user feedback
3. Fix any critical issues
4. Gradually expand to more regions

### Marketing Preparation
1. Prepare press kit and app screenshots
2. Create landing page at trailrun.app
3. Set up social media accounts
4. Plan launch announcement
5. Reach out to running and fitness communities

Remember to test thoroughly on real devices before submission and have a plan for handling user feedback and updates post-launch!