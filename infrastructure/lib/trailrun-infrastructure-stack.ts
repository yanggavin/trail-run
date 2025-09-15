import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class TrailRunInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const activitiesTable = new dynamodb.Table(this, 'ActivitiesTable', {
      tableName: 'trailrun-activities',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for querying activities by timestamp
    activitiesTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    const photosTable = new dynamodb.Table(this, 'PhotosTable', {
      tableName: 'trailrun-photos',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // S3 Buckets
    const photosBucket = new s3.Bucket(this, 'PhotosBucket', {
      bucketName: `trailrun-photos-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const thumbnailsBucket = new s3.Bucket(this, 'ThumbnailsBucket', {
      bucketName: `trailrun-thumbnails-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldThumbnails',
          expiration: cdk.Duration.days(365),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'trailrun-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'trailrun-mobile-client',
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: false,
        adminUserPassword: false,
      },
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
    });

    // Identity Pool for AWS resource access
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: 'trailrun-identity-pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // IAM roles for authenticated users
    const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Attach identity pool roles
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    // Lambda execution role
    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant Lambda permissions to DynamoDB tables
    activitiesTable.grantReadWriteData(lambdaExecutionRole);
    photosTable.grantReadWriteData(lambdaExecutionRole);

    // Grant Lambda permissions to S3 buckets
    photosBucket.grantReadWrite(lambdaExecutionRole);
    thumbnailsBucket.grantReadWrite(lambdaExecutionRole);

    // Lambda functions
    const activitiesFunction = new lambda.Function(this, 'ActivitiesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'activities.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaExecutionRole,
      environment: {
        ACTIVITIES_TABLE_NAME: activitiesTable.tableName,
        PHOTOS_TABLE_NAME: photosTable.tableName,
        PHOTOS_BUCKET_NAME: photosBucket.bucketName,
        THUMBNAILS_BUCKET_NAME: thumbnailsBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    const photosFunction = new lambda.Function(this, 'PhotosFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'photos.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaExecutionRole,
      environment: {
        ACTIVITIES_TABLE_NAME: activitiesTable.tableName,
        PHOTOS_TABLE_NAME: photosTable.tableName,
        PHOTOS_BUCKET_NAME: photosBucket.bucketName,
        THUMBNAILS_BUCKET_NAME: thumbnailsBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    const authFunction = new lambda.Function(this, 'AuthFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'auth.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaExecutionRole,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'TrailRunApi', {
      restApiName: 'TrailRun API',
      description: 'API for TrailRun mobile application',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // API Resources and Methods
    const authResource = api.root.addResource('auth');
    authResource.addMethod('POST', new apigateway.LambdaIntegration(authFunction));

    const activitiesResource = api.root.addResource('activities');
    activitiesResource.addMethod('GET', new apigateway.LambdaIntegration(activitiesFunction), {
      authorizer,
    });
    activitiesResource.addMethod('POST', new apigateway.LambdaIntegration(activitiesFunction), {
      authorizer,
    });

    const activityResource = activitiesResource.addResource('{activityId}');
    activityResource.addMethod('GET', new apigateway.LambdaIntegration(activitiesFunction), {
      authorizer,
    });
    activityResource.addMethod('PUT', new apigateway.LambdaIntegration(activitiesFunction), {
      authorizer,
    });
    activityResource.addMethod('DELETE', new apigateway.LambdaIntegration(activitiesFunction), {
      authorizer,
    });

    const photosResource = api.root.addResource('photos');
    photosResource.addMethod('GET', new apigateway.LambdaIntegration(photosFunction), {
      authorizer,
    });
    photosResource.addMethod('POST', new apigateway.LambdaIntegration(photosFunction), {
      authorizer,
    });

    const photoResource = photosResource.addResource('{photoId}');
    photoResource.addMethod('GET', new apigateway.LambdaIntegration(photosFunction), {
      authorizer,
    });
    photoResource.addMethod('DELETE', new apigateway.LambdaIntegration(photosFunction), {
      authorizer,
    });

    // Upload URL endpoint for signed URLs
    const uploadResource = photosResource.addResource('upload-url');
    uploadResource.addMethod('POST', new apigateway.LambdaIntegration(photosFunction), {
      authorizer,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'PhotosBucketName', {
      value: photosBucket.bucketName,
      description: 'S3 bucket for photos',
    });

    new cdk.CfnOutput(this, 'ThumbnailsBucketName', {
      value: thumbnailsBucket.bucketName,
      description: 'S3 bucket for thumbnails',
    });
  }
}