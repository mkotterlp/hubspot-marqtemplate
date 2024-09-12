const axios = require('axios');

exports.main = async (context) => {
  const { code } = context.parameters;

  if (!code) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Authorization code is required' }),
    };
  }

  try {
    // OAuth token endpoint details
    const tokenEndpoint = 'https://marq.com/oauth2/token';
    const clientId = process.env.CLIENT_ID;  // Your client ID
    const clientSecret = process.env.CLIENT_SECRET;  // Your client secret
    const redirectUri = 'https://info.marq.com/crm-oauth-hubspot';  // DO WE NEED TO CREATE ANOTHER SCRIPT FOR SENDING THE DATA TO UPDATE-DATASET API?

    // Prepare the request payload
    const payload = new URLSearchParams();
    payload.append('grant_type', 'authorization_code');
    payload.append('code', code);
    payload.append('client_id', clientId);
    payload.append('client_secret', clientSecret);
    payload.append('redirect_uri', redirectUri);

    // Make the request to exchange the authorization code for an access token
    const tokenResponse = await axios.post(tokenEndpoint, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (tokenResponse && tokenResponse.data) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          access_token: tokenResponse.data.access_token,
          refresh_token: tokenResponse.data.refresh_token,
          expires_in: tokenResponse.data.expires_in,
          token_type: tokenResponse.data.token_type,
        }),
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to retrieve token from OAuth server' }),
      };
    }
  } catch (error) {
    console.error('Error exchanging authorization code for token:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error exchanging authorization code for token', details: error.message }),
    };
  }
};
