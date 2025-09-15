const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ACTIVITIES_TABLE = process.env.ACTIVITIES_TABLE_NAME;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const { httpMethod, pathParameters, body, requestContext } = event;
    const userId = requestContext.authorizer.claims.sub;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters && pathParameters.activityId) {
          return await getActivity(userId, pathParameters.activityId, headers);
        } else {
          return await getActivities(userId, event.queryStringParameters, headers);
        }

      case 'POST':
        return await createActivity(userId, JSON.parse(body), headers);

      case 'PUT':
        return await updateActivity(userId, pathParameters.activityId, JSON.parse(body), headers);

      case 'DELETE':
        return await deleteActivity(userId, pathParameters.activityId, headers);

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

async function getActivities(userId, queryParams, headers) {
  const params = {
    TableName: ACTIVITIES_TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
    },
    ScanIndexForward: false, // Sort by SK descending (newest first)
  };

  // Add pagination if provided
  if (queryParams && queryParams.lastKey) {
    params.ExclusiveStartKey = JSON.parse(decodeURIComponent(queryParams.lastKey));
  }

  // Add limit if provided
  if (queryParams && queryParams.limit) {
    params.Limit = parseInt(queryParams.limit);
  }

  const result = await dynamodb.query(params).promise();

  const response = {
    activities: result.Items.map(item => item.activityData),
    lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(response),
  };
}

async function getActivity(userId, activityId, headers) {
  const params = {
    TableName: ACTIVITIES_TABLE,
    Key: {
      PK: `USER#${userId}`,
      SK: `ACTIVITY#${activityId}`,
    },
  };

  const result = await dynamodb.get(params).promise();

  if (!result.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Activity not found' }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(result.Item.activityData),
  };
}

async function createActivity(userId, activityData, headers) {
  const activityId = uuidv4();
  const timestamp = new Date().toISOString();

  const activity = {
    ...activityData,
    activityId,
    userId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const params = {
    TableName: ACTIVITIES_TABLE,
    Item: {
      PK: `USER#${userId}`,
      SK: `ACTIVITY#${activityId}`,
      GSI1PK: `ACTIVITY#${activityId}`,
      GSI1SK: timestamp,
      activityData: activity,
    },
  };

  await dynamodb.put(params).promise();

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify(activity),
  };
}

async function updateActivity(userId, activityId, updateData, headers) {
  const timestamp = new Date().toISOString();

  // First, get the existing activity
  const getParams = {
    TableName: ACTIVITIES_TABLE,
    Key: {
      PK: `USER#${userId}`,
      SK: `ACTIVITY#${activityId}`,
    },
  };

  const existingResult = await dynamodb.get(getParams).promise();

  if (!existingResult.Item) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Activity not found' }),
    };
  }

  const updatedActivity = {
    ...existingResult.Item.activityData,
    ...updateData,
    updatedAt: timestamp,
  };

  const updateParams = {
    TableName: ACTIVITIES_TABLE,
    Key: {
      PK: `USER#${userId}`,
      SK: `ACTIVITY#${activityId}`,
    },
    UpdateExpression: 'SET activityData = :activityData',
    ExpressionAttributeValues: {
      ':activityData': updatedActivity,
    },
  };

  await dynamodb.update(updateParams).promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(updatedActivity),
  };
}

async function deleteActivity(userId, activityId, headers) {
  const params = {
    TableName: ACTIVITIES_TABLE,
    Key: {
      PK: `USER#${userId}`,
      SK: `ACTIVITY#${activityId}`,
    },
  };

  await dynamodb.delete(params).promise();

  return {
    statusCode: 204,
    headers,
    body: '',
  };
}