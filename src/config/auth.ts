import { AuthConfig } from '../types/auth';

// These values should be replaced with actual values from your AWS CDK deployment
export const authConfig: AuthConfig = {
  apiEndpoint: process.env.EXPO_PUBLIC_API_ENDPOINT || 'https://your-api-gateway-url.execute-api.region.amazonaws.com/prod',
  userPoolId: process.env.EXPO_PUBLIC_USER_POOL_ID || 'us-east-1_YourUserPoolId',
  userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID || 'YourUserPoolClientId',
  identityPoolId: process.env.EXPO_PUBLIC_IDENTITY_POOL_ID || 'us-east-1:your-identity-pool-id',
  region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
};

// Validate configuration
export const validateAuthConfig = (config: AuthConfig): void => {
  const requiredFields: (keyof AuthConfig)[] = [
    'apiEndpoint',
    'userPoolId',
    'userPoolClientId',
    'identityPoolId',
    'region',
  ];

  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required auth configuration fields: ${missingFields.join(', ')}\n` +
      'Please ensure all environment variables are set or update the config directly.'
    );
  }

  // Validate URL format
  try {
    new URL(config.apiEndpoint);
  } catch {
    throw new Error('Invalid API endpoint URL format');
  }

  // Validate User Pool ID format
  if (!config.userPoolId.match(/^[a-z0-9-]+_[a-zA-Z0-9]+$/)) {
    throw new Error('Invalid User Pool ID format');
  }

  // Validate Identity Pool ID format
  if (!config.identityPoolId.match(/^[a-z0-9-]+:[a-f0-9-]+$/)) {
    throw new Error('Invalid Identity Pool ID format');
  }
};