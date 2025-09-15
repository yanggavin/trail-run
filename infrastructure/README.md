# TrailRun AWS Infrastructure

This directory contains the AWS CDK infrastructure code for the TrailRun mobile application backend.

## Architecture

The infrastructure includes:

- **DynamoDB Tables**: Activities and Photos tables with proper indexing
- **S3 Buckets**: Photo storage and thumbnail storage with lifecycle policies
- **Cognito**: User authentication with User Pool and Identity Pool
- **API Gateway**: RESTful API with Cognito authorization
- **Lambda Functions**: Serverless backend logic for CRUD operations

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 18+ installed
3. AWS CDK CLI installed: `npm install -g aws-cdk`

## Setup

1. Install dependencies:
```bash
cd infrastructure
npm install
```

2. Install Lambda dependencies:
```bash
cd lambda
npm install
cd ..
```

3. Bootstrap CDK (first time only):
```bash
cdk bootstrap
```

## Deployment

1. Build the TypeScript code:
```bash
npm run build
```

2. Deploy the stack:
```bash
npm run deploy
```

3. Note the outputs - you'll need these for the mobile app configuration:
   - UserPoolId
   - UserPoolClientId
   - IdentityPoolId
   - ApiEndpoint
   - PhotosBucketName
   - ThumbnailsBucketName

## API Endpoints

### Authentication (`/auth`)
- `POST /auth` - User authentication operations (signUp, signIn, etc.)

### Activities (`/activities`)
- `GET /activities` - List user's activities (with pagination)
- `POST /activities` - Create new activity
- `GET /activities/{activityId}` - Get specific activity
- `PUT /activities/{activityId}` - Update activity
- `DELETE /activities/{activityId}` - Delete activity

### Photos (`/photos`)
- `GET /photos?activityId={id}` - Get photos for an activity
- `POST /photos` - Create photo metadata
- `POST /photos/upload-url` - Generate signed upload URLs
- `DELETE /photos/{photoId}` - Delete photo

## Security

- All API endpoints (except auth) require Cognito JWT authentication
- S3 buckets are private with signed URL access only
- DynamoDB tables use AWS managed encryption
- Lambda functions have minimal IAM permissions

## Monitoring

The infrastructure includes:
- CloudWatch logs for all Lambda functions
- DynamoDB point-in-time recovery
- S3 versioning and lifecycle policies

## Cleanup

To destroy the infrastructure:
```bash
npm run destroy
```

**Warning**: This will permanently delete all data including user accounts, activities, and photos.