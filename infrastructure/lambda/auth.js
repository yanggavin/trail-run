const AWS = require('aws-sdk');

const cognito = new AWS.CognitoIdentityServiceProvider();
const USER_POOL_ID = process.env.USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const { httpMethod, body } = event;

    if (httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const { action, ...requestData } = JSON.parse(body);

    switch (action) {
      case 'signUp':
        return await signUp(requestData, headers);
      case 'confirmSignUp':
        return await confirmSignUp(requestData, headers);
      case 'signIn':
        return await signIn(requestData, headers);
      case 'refreshToken':
        return await refreshToken(requestData, headers);
      case 'forgotPassword':
        return await forgotPassword(requestData, headers);
      case 'confirmForgotPassword':
        return await confirmForgotPassword(requestData, headers);
      case 'changePassword':
        return await changePassword(requestData, headers);
      case 'deleteUser':
        return await deleteUser(requestData, headers);
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' }),
        };
    }
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function signUp({ email, password, givenName, familyName }, headers) {
  const params = {
    ClientId: USER_POOL_CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      },
    ],
  };

  if (givenName) {
    params.UserAttributes.push({
      Name: 'given_name',
      Value: givenName,
    });
  }

  if (familyName) {
    params.UserAttributes.push({
      Name: 'family_name',
      Value: familyName,
    });
  }

  try {
    const result = await cognito.signUp(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        userSub: result.UserSub,
        codeDeliveryDetails: result.CodeDeliveryDetails,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function confirmSignUp({ email, confirmationCode }, headers) {
  const params = {
    ClientId: USER_POOL_CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
  };

  try {
    await cognito.confirmSignUp(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'User confirmed successfully' }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function signIn({ email, password }, headers) {
  const params = {
    AuthFlow: 'USER_SRP_AUTH',
    ClientId: USER_POOL_CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  };

  try {
    const result = await cognito.initiateAuth(params).promise();
    
    if (result.ChallengeName) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          challengeName: result.ChallengeName,
          session: result.Session,
          challengeParameters: result.ChallengeParameters,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        expiresIn: result.AuthenticationResult.ExpiresIn,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function refreshToken({ refreshToken }, headers) {
  const params = {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: USER_POOL_CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  };

  try {
    const result = await cognito.initiateAuth(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        expiresIn: result.AuthenticationResult.ExpiresIn,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function forgotPassword({ email }, headers) {
  const params = {
    ClientId: USER_POOL_CLIENT_ID,
    Username: email,
  };

  try {
    const result = await cognito.forgotPassword(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        codeDeliveryDetails: result.CodeDeliveryDetails,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function confirmForgotPassword({ email, confirmationCode, newPassword }, headers) {
  const params = {
    ClientId: USER_POOL_CLIENT_ID,
    Username: email,
    ConfirmationCode: confirmationCode,
    Password: newPassword,
  };

  try {
    await cognito.confirmForgotPassword(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Password reset successfully' }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function changePassword({ accessToken, previousPassword, proposedPassword }, headers) {
  const params = {
    AccessToken: accessToken,
    PreviousPassword: previousPassword,
    ProposedPassword: proposedPassword,
  };

  try {
    await cognito.changePassword(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Password changed successfully' }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function deleteUser({ accessToken }, headers) {
  const params = {
    AccessToken: accessToken,
  };

  try {
    await cognito.deleteUser(params).promise();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'User deleted successfully' }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}