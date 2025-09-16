# TrailRun Beta Testing Guide

This guide covers how to set up and manage beta testing for TrailRun before releasing to the App Store and Google Play Store.

## 🎯 Beta Testing Strategy

### Testing Phases
1. **Internal Testing** (Team & Close Friends) - 1-2 weeks
2. **Closed Beta** (Invited Trail Runners) - 2-3 weeks  
3. **Open Beta** (Public TestFlight/Play Console) - 1-2 weeks
4. **Release Candidate** (Final validation) - 1 week

### Target Beta Testers
- **Trail runners** of different experience levels
- **Different device types** (iPhone, Android, various models)
- **Geographic diversity** (urban, rural, mountain, forest environments)
- **Usage patterns** (casual joggers to ultra-marathon runners)

## 📱 iOS Beta Testing (TestFlight)

### Step 1: Set Up TestFlight

1. **Build for TestFlight**
   ```bash
   # Build preview version for testing
   eas build --platform ios --profile preview
   ```

2. **Submit to TestFlight**
   ```bash
   # Submit to TestFlight (not App Store)
   eas submit --platform ios --latest --non-interactive
   ```

3. **Configure TestFlight in App Store Connect**
   - Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Select your app → TestFlight tab
   - Add build information and testing notes

### Step 2: Internal Testing (Team)

1. **Add Internal Testers**
   - Add team members by Apple ID
   - Up to 100 internal testers
   - No review required, immediate access

2. **Internal Testing Checklist**
   ```
   - [ ] App launches successfully
   - [ ] GPS tracking works accurately
   - [ ] Camera captures and saves photos
   - [ ] Photos are properly geotagged
   - [ ] Background tracking continues
   - [ ] Battery usage is reasonable
   - [ ] All screens navigate properly
   - [ ] Settings save correctly
   - [ ] Privacy controls work
   - [ ] Cloud sync functions (if enabled)
   ```

### Step 3: External Testing (Public Beta)

1. **Add External Testers**
   - Create groups (e.g., "Trail Runners", "Power Users")
   - Add testers by email or public link
   - Up to 10,000 external testers

2. **Beta App Review**
   - Apple reviews beta before external distribution
   - Usually takes 24-48 hours
   - Must pass basic functionality review

3. **TestFlight Public Link**
   ```
   https://testflight.apple.com/join/YOUR_PUBLIC_LINK
   ```

## 🤖 Android Beta Testing (Google Play Console)

### Step 1: Set Up Play Console Testing

1. **Build for Play Console**
   ```bash
   # Build preview version
   eas build --platform android --profile preview
   ```

2. **Upload to Play Console**
   ```bash
   # Submit to Play Console internal testing
   eas submit --platform android --latest
   ```

### Step 2: Internal Testing Track

1. **Configure Internal Testing**
   - Go to Google Play Console
   - Release → Testing → Internal testing
   - Upload APK/AAB file
   - Add internal testers (up to 100)

2. **Create Internal Testing Release**
   - Add release notes
   - Set up tester groups
   - Generate shareable link

### Step 3: Closed Testing Track

1. **Set Up Closed Testing**
   - Release → Testing → Closed testing
   - Create new track (e.g., "Beta Testers")
   - Add up to 2,000 testers

2. **Opt-in URL**
   ```
   https://play.google.com/apps/internaltest/YOUR_PACKAGE_NAME
   ```

### Step 4: Open Testing Track

1. **Configure Open Testing**
   - Release → Testing → Open testing
   - Available to anyone with the link
   - Up to 2,000 testers initially

## 🧪 Beta Testing Workflow

### Automated Beta Builds

The project includes automated beta deployment:

```bash
# Trigger beta builds via GitHub Actions
git push origin develop  # Triggers preview builds

# Or manually build beta versions
npm run build:preview
```

### Beta Build Configuration

Update `eas.json` for beta-specific settings:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "channel": "beta",
      "ios": {
        "simulator": true,
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk",
        "resourceClass": "medium"
      }
    }
  }
}
```

## 📋 Beta Testing Checklist

### Pre-Beta Release
- [ ] All automated tests passing
- [ ] Manual smoke testing completed
- [ ] Beta build configuration verified
- [ ] Crash reporting enabled (Sentry)
- [ ] Analytics configured for beta tracking
- [ ] Beta-specific feedback collection ready

### Core Functionality Testing
- [ ] **GPS Tracking**
  - Accurate location recording
  - Background tracking works
  - Auto-pause detection
  - Battery usage acceptable
- [ ] **Photo Capture**
  - Camera opens and captures
  - Photos save correctly
  - Geotagging works
  - Photo quality acceptable
- [ ] **Route Analysis**
  - Maps display correctly
  - Statistics calculate properly
  - Elevation data accurate
  - Route visualization clear
- [ ] **Data Management**
  - Activities save and load
  - History browsing works
  - Search and filtering functional
  - Data export works
- [ ] **Privacy & Security**
  - Privacy settings functional
  - EXIF stripping works
  - Local encryption active
  - Permission requests appropriate

### Device-Specific Testing
- [ ] **iOS Devices**
  - iPhone 12/13/14/15 series
  - Different iOS versions (15.0+)
  - Various screen sizes
- [ ] **Android Devices**
  - Samsung Galaxy series
  - Google Pixel series
  - Different Android versions (API 26+)
  - Various manufacturers (OnePlus, Xiaomi, etc.)

### Environment Testing
- [ ] **Urban environments** (buildings, GPS interference)
- [ ] **Forest trails** (tree cover, limited GPS)
- [ ] **Mountain terrain** (elevation changes, weather)
- [ ] **Different weather conditions**
- [ ] **Various trail distances** (short runs to ultra-marathons)

## 📊 Beta Feedback Collection

### Feedback Channels

1. **In-App Feedback**
   - Built-in feedback modal (already implemented)
   - Crash reporting via Sentry
   - Analytics via Amplitude

2. **External Feedback**
   - TestFlight feedback (iOS)
   - Play Console reviews (Android)
   - Email: beta@trailrun.app
   - Discord/Slack community

3. **Structured Feedback Form**
   ```
   Beta Tester Feedback Form:
   - Device model and OS version
   - Trail type and conditions
   - GPS accuracy rating (1-5)
   - Battery usage rating (1-5)
   - Photo quality rating (1-5)
   - Overall app performance (1-5)
   - Specific issues encountered
   - Feature requests
   - Would you recommend to other runners?
   ```

### Beta Analytics Tracking

Monitor key metrics during beta:
- **Crash-free sessions** (target: >99%)
- **GPS accuracy** (user-reported)
- **Battery usage** (device analytics)
- **Feature usage** (which features are used most)
- **Session duration** (how long users engage)
- **Retention rates** (do testers keep using it?)

## 🚀 Beta Release Process

### Week 1-2: Internal Testing
```bash
# Build and distribute to team
eas build --platform all --profile preview
eas submit --platform all --latest

# Team testing focus:
# - Core functionality
# - Major bug identification
# - Performance baseline
```

### Week 3-4: Closed Beta
```bash
# Expand to invited trail runners
# Focus areas:
# - Real-world GPS accuracy
# - Battery performance during long runs
# - Photo quality in various conditions
# - User experience feedback
```

### Week 5-6: Open Beta
```bash
# Public beta release
# Focus areas:
# - Scale testing
# - Edge case identification
# - Final UI/UX polish
# - Performance optimization
```

### Week 7: Release Candidate
```bash
# Final validation build
# Focus areas:
# - Critical bug fixes only
# - Final performance validation
# - App store submission preparation
```

## 📝 Beta Testing Scripts

### Beta Deployment Script

```bash
#!/bin/bash
# scripts/deploy-beta.sh

echo "🧪 Deploying TrailRun Beta..."

# Build preview versions
eas build --platform all --profile preview --non-interactive

# Submit to beta channels
eas submit --platform ios --latest --non-interactive
eas submit --platform android --latest --non-interactive

echo "✅ Beta deployment complete!"
echo "📱 iOS: Check TestFlight in App Store Connect"
echo "🤖 Android: Check Internal Testing in Play Console"
```

### Beta Tester Invitation Template

```markdown
# TrailRun Beta Testing Invitation

Hi [Name],

You're invited to beta test TrailRun, a new GPS tracking app designed specifically for trail runners!

## What is TrailRun?
- Precision GPS tracking for trail runs
- Photo capture with automatic geotagging
- Comprehensive activity summaries
- Privacy-focused design

## How to Join:
**iOS (iPhone):** [TestFlight Link]
**Android:** [Play Console Link]

## What We Need:
- Test during your regular trail runs
- Report any bugs or issues
- Share feedback on GPS accuracy and battery usage
- Try different trail environments (forest, mountain, urban)

## Testing Period:
[Start Date] - [End Date] (2-3 weeks)

## Feedback:
- Use in-app feedback button
- Email: beta@trailrun.app
- Join our Discord: [Link]

Thank you for helping make TrailRun better for the trail running community!

Best regards,
The TrailRun Team
```

## 🔧 Beta Configuration

### Environment Variables for Beta

```bash
# .env.beta
NODE_ENV=beta
DEBUG_MODE=true
ANALYTICS_ENABLED=true
CRASH_REPORTING=true
BETA_FEEDBACK_ENABLED=true
API_BASE_URL=https://beta-api.trailrun.app
```

### Beta-Specific Features

1. **Enhanced Logging**
   - Detailed GPS tracking logs
   - Performance metrics collection
   - User interaction tracking

2. **Beta Feedback Integration**
   - Easy access to feedback forms
   - Automatic crash reporting
   - Performance issue detection

3. **Beta Branding**
   - "Beta" badge in app
   - Beta-specific app icon
   - Clear version identification

## 📈 Success Metrics for Beta

### Quantitative Metrics
- **Crash Rate**: <1% of sessions
- **GPS Accuracy**: >95% user satisfaction
- **Battery Usage**: <10% drain per hour of tracking
- **App Performance**: <3 second startup time
- **User Retention**: >70% return for second test

### Qualitative Feedback
- Overall user satisfaction rating
- Feature usefulness ratings
- User interface feedback
- Performance perception
- Likelihood to recommend

## 🎯 Beta Exit Criteria

Before moving to production release:
- [ ] Crash rate below 1%
- [ ] All critical bugs resolved
- [ ] GPS accuracy meets user expectations
- [ ] Battery usage optimized
- [ ] User feedback incorporated
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] App store guidelines compliance verified

This comprehensive beta testing approach ensures TrailRun is thoroughly validated before public release, reducing the risk of critical issues and improving user satisfaction from day one.