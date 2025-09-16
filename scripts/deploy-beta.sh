#!/bin/bash

# TrailRun Beta Deployment Script
# Usage: ./scripts/deploy-beta.sh [platform] [phase]
# Platforms: ios, android, all (default: all)
# Phases: internal, closed, open (default: internal)

set -e

PLATFORM=${1:-all}
PHASE=${2:-internal}
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🧪 Starting TrailRun Beta Deployment"
echo "📱 Platform: $PLATFORM"
echo "🎯 Phase: $PHASE"
echo ""

# Navigate to project directory
cd "$PROJECT_DIR"

# Validate inputs
case $PLATFORM in
  ios|android|all)
    ;;
  *)
    echo "❌ Invalid platform: $PLATFORM"
    echo "Valid platforms: ios, android, all"
    exit 1
    ;;
esac

case $PHASE in
  internal|closed|open)
    ;;
  *)
    echo "❌ Invalid phase: $PHASE"
    echo "Valid phases: internal, closed, open"
    exit 1
    ;;
esac

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g @expo/eas-cli
fi

# Check if logged in to EAS
if ! eas whoami &> /dev/null; then
    echo "🔐 Please login to EAS:"
    eas login
fi

echo "📦 Installing dependencies..."
npm ci

echo "🧪 Running pre-deployment tests..."
npm run test
npm run type-check
npm run lint

echo "✅ Pre-deployment checks passed"

# Set build profile based on phase
BUILD_PROFILE="preview"
if [ "$PHASE" = "open" ]; then
    BUILD_PROFILE="preview"
fi

echo "🔨 Building beta version (profile: $BUILD_PROFILE)..."

# Build based on platform
case $PLATFORM in
  ios)
    echo "🍎 Building iOS beta..."
    eas build --platform ios --profile $BUILD_PROFILE --non-interactive
    ;;
  android)
    echo "🤖 Building Android beta..."
    eas build --platform android --profile $BUILD_PROFILE --non-interactive
    ;;
  all)
    echo "📱 Building for both platforms..."
    eas build --platform all --profile $BUILD_PROFILE --non-interactive
    ;;
esac

echo "📤 Submitting to beta channels..."

# Submit based on platform and phase
case $PLATFORM in
  ios)
    echo "🍎 Submitting iOS to TestFlight..."
    eas submit --platform ios --latest --non-interactive
    ;;
  android)
    echo "🤖 Submitting Android to Play Console..."
    eas submit --platform android --latest --non-interactive
    ;;
  all)
    echo "📱 Submitting to both platforms..."
    eas submit --platform ios --latest --non-interactive &
    eas submit --platform android --latest --non-interactive &
    wait
    ;;
esac

echo ""
echo "🎉 Beta deployment completed successfully!"
echo ""

# Provide next steps based on platform
case $PLATFORM in
  ios|all)
    echo "🍎 iOS Next Steps:"
    echo "  1. Go to App Store Connect (appstoreconnect.apple.com)"
    echo "  2. Navigate to TestFlight tab"
    echo "  3. Add beta testers and testing notes"
    echo "  4. Share TestFlight link with beta testers"
    ;;
esac

case $PLATFORM in
  android|all)
    echo "🤖 Android Next Steps:"
    echo "  1. Go to Google Play Console (play.google.com/console)"
    echo "  2. Navigate to Release → Testing → Internal testing"
    echo "  3. Add beta testers to testing groups"
    echo "  4. Share opt-in link with beta testers"
    ;;
esac

echo ""
echo "📊 Beta Testing Resources:"
echo "  - Beta Testing Guide: ./BETA_TESTING_GUIDE.md"
echo "  - Feedback Collection: beta@trailrun.app"
echo "  - Analytics Dashboard: Amplitude/Sentry"
echo ""

# Generate beta tester invitation
echo "📧 Generating beta tester invitation..."
cat > beta-invitation.md << EOF
# TrailRun Beta Testing Invitation

Hi there!

You're invited to beta test TrailRun, a new GPS tracking app designed specifically for trail runners!

## What is TrailRun?
- Precision GPS tracking for trail runs with background support
- Photo capture with automatic geotagging
- Comprehensive activity summaries called "Routine Records"
- Privacy-focused design with local encryption
- Cross-platform support (iOS and Android)

## Beta Testing Phase: $PHASE

EOF

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]; then
cat >> beta-invitation.md << EOF
### iOS (iPhone) - TestFlight
1. Install TestFlight from the App Store if you haven't already
2. Click this link on your iPhone: [TestFlight Link - Update with actual link]
3. Follow the prompts to install TrailRun Beta

EOF
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
cat >> beta-invitation.md << EOF
### Android - Google Play Console
1. Click this link: [Play Console Link - Update with actual link]
2. Opt-in to the beta program
3. Download TrailRun from Google Play Store

EOF
fi

cat >> beta-invitation.md << EOF
## What We Need From You:
- Test during your regular trail runs (any distance/terrain)
- Report any bugs, crashes, or unusual behavior
- Share feedback on GPS accuracy and battery usage
- Try different environments: forest, mountain, urban trails
- Test photo capture in various lighting conditions

## Testing Period:
$(date +"%B %d, %Y") - $(date -d "+3 weeks" +"%B %d, %Y") (3 weeks)

## How to Provide Feedback:
- **In-App**: Use the feedback button in Settings
- **Email**: beta@trailrun.app
- **Specific Issues**: Include device model, iOS/Android version, and steps to reproduce

## What to Test:
1. **GPS Tracking**: Start a run and verify accurate route recording
2. **Photo Capture**: Take photos during runs and check geotagging
3. **Background Tracking**: Minimize app during runs to test background GPS
4. **Battery Usage**: Monitor battery drain during longer runs
5. **Activity History**: Browse past activities and check data accuracy
6. **Privacy Settings**: Test privacy controls and data export

## Beta Features to Focus On:
- Auto-pause detection during breaks
- Photo quality and geotagging accuracy
- Route visualization on maps
- Activity statistics and summaries
- Cloud sync functionality (if enabled)

Thank you for helping make TrailRun the best GPS tracking app for trail runners!

**Questions?** Reply to this email or contact beta@trailrun.app

Happy trails! 🏃‍♂️🏃‍♀️

The TrailRun Team
EOF

echo "✅ Beta invitation saved to: beta-invitation.md"
echo ""
echo "🚀 Beta deployment complete! Monitor progress in:"
if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]; then
    echo "  - App Store Connect: https://appstoreconnect.apple.com"
fi
if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
    echo "  - Google Play Console: https://play.google.com/console"
fi
echo "  - Sentry (crashes): https://sentry.io"
echo "  - Amplitude (analytics): https://amplitude.com"