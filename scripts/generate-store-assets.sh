#!/bin/bash

# TrailRun Store Assets Generation Script
# This script helps prepare assets for App Store and Google Play submissions

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_DIR="$PROJECT_DIR/store-assets"

echo "🎨 Generating TrailRun store assets..."

# Create assets directory
mkdir -p "$ASSETS_DIR"/{ios,android,screenshots}

echo "📱 Required iOS Screenshots:"
echo "  - iPhone 6.7\" (1290x2796): 3-10 screenshots"
echo "  - iPhone 6.5\" (1242x2688): 3-10 screenshots" 
echo "  - iPhone 5.5\" (1242x2208): 3-10 screenshots"
echo "  - iPad Pro 12.9\" (2048x2732): 3-10 screenshots"

echo ""
echo "🤖 Required Android Assets:"
echo "  - App Icon: 512x512px"
echo "  - Feature Graphic: 1024x500px"
echo "  - Phone Screenshots: 320-3840px width/height"
echo "  - Tablet Screenshots (optional): 320-3840px width/height"

echo ""
echo "📝 Asset Guidelines:"
echo "  - Use high-quality, realistic screenshots"
echo "  - Show key features: GPS tracking, photo capture, route maps"
echo "  - Include diverse trail environments (forest, mountain, urban)"
echo "  - Highlight privacy and security features"
echo "  - Show activity summaries and statistics"

echo ""
echo "🎯 Recommended Screenshots:"
echo "  1. Home screen with GPS tracking active"
echo "  2. Camera screen capturing trail photo"
echo "  3. Activity detail with route map and photos"
echo "  4. Activity history with multiple runs"
echo "  5. Settings screen showing privacy controls"

echo ""
echo "📂 Assets will be saved to: $ASSETS_DIR"
echo ""
echo "Next steps:"
echo "1. Take screenshots using iOS Simulator and Android Emulator"
echo "2. Use design tools to create feature graphics"
echo "3. Optimize images for store requirements"
echo "4. Upload to respective app stores"

# Create placeholder files with instructions
cat > "$ASSETS_DIR/README.md" << EOF
# TrailRun Store Assets

## Directory Structure
- \`ios/\` - iOS App Store screenshots and assets
- \`android/\` - Google Play Store screenshots and assets
- \`screenshots/\` - Raw screenshots from simulators/emulators

## iOS Requirements
- iPhone 6.7" (1290x2796): Home, Camera, Activity Detail
- iPhone 6.5" (1242x2688): Same as above
- iPhone 5.5" (1242x2208): Same as above
- iPad Pro 12.9" (2048x2732): Landscape versions

## Android Requirements
- App Icon: 512x512px PNG
- Feature Graphic: 1024x500px JPG/PNG
- Phone Screenshots: Portrait orientation preferred
- Tablet Screenshots: Landscape orientation

## Asset Creation Tips
1. Use real data in screenshots (sample trail runs)
2. Show app in action with GPS tracking
3. Highlight unique features (photo geotagging, privacy)
4. Use consistent branding and colors
5. Test on actual devices for accuracy

## Tools Recommended
- iOS Simulator (Xcode)
- Android Emulator (Android Studio)
- Figma/Sketch for graphics
- ImageOptim for compression
EOF

echo "✅ Asset generation setup complete!"
echo "📖 See $ASSETS_DIR/README.md for detailed instructions"