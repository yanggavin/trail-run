# TrailRun

A React Native mobile application for trail runners to track GPS routes, capture geotagged photos, and generate comprehensive activity summaries.

## Features

- GPS tracking with foreground and background support
- Photo capture with automatic geotagging
- Comprehensive activity analysis (Routine Records)
- Local-first data storage with cloud sync
- Cross-platform support (iOS and Android)

## Tech Stack

- **Framework:** React Native with Expo managed workflow
- **Navigation:** React Navigation 6
- **State Management:** Zustand
- **Local Database:** SQLite
- **Maps:** Mapbox GL Native (to be added)
- **Camera:** react-native-vision-camera (to be added)
- **Backend:** AWS Serverless (to be added)

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components
│   ├── map/           # Map-related components
│   ├── photo/         # Photo-related components
│   └── stats/         # Statistics components
├── screens/            # Screen components
│   ├── Home/          # Main tracking screen
│   ├── Camera/        # Photo capture screen
│   ├── ActivityDetail/ # Activity detail screen
│   ├── History/       # Activity history screen
│   └── Settings/      # Settings screen
├── services/          # Business logic services
│   ├── location/      # GPS tracking service
│   ├── photo/         # Photo capture service
│   ├── activity/      # Activity management
│   ├── sync/          # Cloud synchronization
│   └── storage/       # Local storage
├── store/             # Zustand state management
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── hooks/             # Custom React hooks
└── navigation/        # Navigation configuration
```

## Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm start
   ```

3. Run on specific platform:
   ```bash
   npm run ios     # iOS simulator
   npm run android # Android emulator
   npm run web     # Web browser
   ```

## Code Quality

- **Linting:** ESLint with TypeScript support
- **Formatting:** Prettier
- **Type Checking:** TypeScript

Run code quality checks:

```bash
npm run lint        # Check for linting errors
npm run lint:fix    # Fix linting errors
npm run format      # Format code with Prettier
npm run type-check  # TypeScript type checking
```

## Requirements

- Node.js 20.17.0+
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio/Emulator (for Android development)

## Implementation Status

This project is currently in the initial setup phase. The following tasks are planned:

1. ✅ Project structure and development environment
2. ⏳ Core data models and local storage
3. ⏳ Native GPS tracking module
4. ⏳ GPS tracking business logic
5. ⏳ Photo capture functionality
6. ⏳ Core UI components and screens
7. ⏳ Map integration and visualization
8. ⏳ Routine record generation
9. ⏳ History and browsing functionality
10. ⏳ Cloud sync and backend integration
11. ⏳ Background processing and app lifecycle
12. ⏳ Security and privacy features
13. ⏳ Performance monitoring and analytics
14. ⏳ Comprehensive testing suite
15. ⏳ App configuration and deployment setup

## License

This project is private and proprietary.
