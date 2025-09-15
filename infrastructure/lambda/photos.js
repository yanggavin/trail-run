const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const PHOTOS_TABLE = process.env.PHOTOS_TABLE_NAME;
const PHOTOS_BUCKET = process.env.PHOTOS_BUCKET_NAME;
const THUMBNAILS_BUCKET = process.env.THUMBNAILS_BUCKET_NAME;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const { httpMethod, pathParameters, body, requestContext, resource } = event;
    const userId = requestContext.authorizer.claims.sub;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters && pathParameters.photoId) {
          return await getPhoto(userId, pathParameters.photoId, headers);
        } else {
          return await getPhotos(userId, event.queryStringParameters, headers);
        }

      case 'POST':
        if (resource.includes('upload-url')) {
          return await generateUploadUrl(userId, JSON.parse(body), headers);
        } else {
          return await createPhoto(userId, JSON.parse(body), headers);
        }

      case 'DELETE':
        return await deletePhoto(userId, pathParameters.photoId, headers);

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getPhotos(userId, queryParams, headers) {
  let params;

  if (queryParams && queryParams.activityId) {
    // Get photos for a specific activity
    params = {
      TableName: PHOTOS_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `ACTIVITY#${queryParams.activityId}`,
      },
    };
  } else {
    // Get all photos for user (this would require a GSI in a real implementation)
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'activityId parameter is required' }),
    };
  }

  const result = await dynamodb.query(params).promise();

  const photos = result.Items.map(item => item.photoData);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ photos }),
  };
}

async function getPhoto(userId, photoId, headers) {
  // We need to find the photo across all activities for this user
  // In a real implementation, we'd use a GSI for this
  return {
    statusCode: 501,
    headers,
    body: JSON.stringify({ error: 'Get single photo not implemented - use activity-specific queries' }),
  };
}

async function createPhoto(userId, photoData, headers) {
  const photoId = uuidv4();
  const timestamp = new Date().toISOString();

  const photo = {
    ...photoData,
    photoId,
    userId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const params = {
    TableName: PHOTOS_TABLE,
    Item: {
      PK: `ACTIVITY#${photoData.activityId}`,
      SK: `PHOTO#${photoId}`,
      photoData: photo,
    },
  };

  await dynamodb.put(params).promise();

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify(photo),
  };
}

async function deletePhoto(userId, photoId, headers) {
  // In a real implementation, we'd need to find the photo first to get the activity ID
  // For now, we'll require the activityId as a query parameter
  return {
    statusCode: 501,
    headers,
    body: JSON.stringify({ error: 'Delete photo not fully implemented - requires activityId' }),
  };
}

async function generateUploadUrl(userId, requestData, headers) {
  const { activityId, photoId, contentType, fileSize } = requestData;

  if (!activityId || !photoId || !contentType) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'activityId, photoId, and contentType are required' }),
    };
  }

  // Validate file size (max 10MB)
  if (fileSize && fileSize > 10 * 1024 * 1024) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'File size exceeds 10MB limit' }),
    };
  }

  // Validate content type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/heic'];
  if (!allowedTypes.includes(contentType)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid content type. Only JPEG, PNG, and HEIC are allowed' }),
    };
  }

  const photoKey = `${userId}/${activityId}/${photoId}`;
  const thumbnailKey = `${userId}/${activityId}/${photoId}_thumb`;

  // Generate signed URL for photo upload
  const photoUploadParams = {
    Bucket: PHOTOS_BUCKET,
    Key: photoKey,
    Expires: 3600, // 1 hour
    ContentType: contentType,
    Conditions: [
      ['content-length-range', 0, 10 * 1024 * 1024], // Max 10MB
    ],
  };

  // Generate signed URL for thumbnail upload
  const thumbnailUploadParams = {
    Bucket: THUMBNAILS_BUCKET,
    Key: thumbnailKey,
    Expires: 3600, // 1 hour
    ContentType: 'image/jpeg', // Thumbnails are always JPEG
    Conditions: [
      ['content-length-range', 0, 1024 * 1024], // Max 1MB for thumbnails
    ],
  };

  try {
    const photoUploadUrl = await s3.getSignedUrlPromise('putObject', photoUploadParams);
    const thumbnailUploadUrl = await s3.getSignedUrlPromise('putObject', thumbnailUploadParams);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        photoUploadUrl,
        thumbnailUploadUrl,
        photoKey,
        thumbnailKey,
        expiresIn: 3600,
      }),
    };
  } catch (error) {
    console.error('Error generating signed URLs:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to generate upload URLs' }),
    };
  }
}