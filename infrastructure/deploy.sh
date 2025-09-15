#!/bin/bash

# TrailRun Infrastructure Deployment Script

set -e

echo "🚀 Starting TrailRun infrastructure deployment..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo "❌ AWS CDK not found. Installing..."
    npm install -g aws-cdk
fi

# Install infrastructure dependencies
echo "📦 Installing infrastructure dependencies..."
npm install

# Install Lambda dependencies
echo "📦 Installing Lambda dependencies..."
cd lambda
npm install
cd ..

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Bootstrap CDK if needed
echo "🏗️ Checking CDK bootstrap..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit > /dev/null 2>&1; then
    echo "🏗️ Bootstrapping CDK..."
    cdk bootstrap
fi

# Deploy the stack
echo "🚀 Deploying infrastructure..."
cdk deploy --require-approval never

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Note the output values from the deployment"
echo "2. Update your mobile app configuration with these values"
echo "3. Test the API endpoints"