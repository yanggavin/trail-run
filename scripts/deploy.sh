#!/bin/bash

# TrailRun Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Environments: development, preview, production

set -e

ENVIRONMENT=${1:-preview}
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 Starting TrailRun deployment for $ENVIRONMENT environment"

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g @expo/eas-cli
fi

# Navigate to project directory
cd "$PROJECT_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm run test

# Type check
echo "🔍 Type checking..."
npm run type-check

# Lint
echo "🔧 Linting..."
npm run lint

# Security audit
echo "🔒 Security audit..."
npm run security:audit

echo "✅ Pre-deployment checks passed"

# Build based on environment
case $ENVIRONMENT in
  development)
    echo "🔨 Building development version..."
    eas build --profile development --platform all
    ;;
  preview)
    echo "🔨 Building preview version..."
    eas build --profile preview --platform all
    ;;
  production)
    echo "🔨 Building production version..."
    eas build --profile production --platform all --wait
    echo "📱 Submitting to app stores..."
    eas submit --platform ios --latest
    eas submit --platform android --latest
    ;;
  *)
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Valid environments: development, preview, production"
    exit 1
    ;;
esac

echo "🎉 Deployment completed successfully!"