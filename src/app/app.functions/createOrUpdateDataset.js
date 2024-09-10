const axios = require('axios');

exports.main = async (context) => {
  const { refreshToken, schema } = context.parameters;

  if (!refreshToken) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing refresh token' }),
    };
  }

  if (!schema || !Array.isArray(schema)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid or missing schema' }),
    };
  }

  try {
    // API credentials
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;

    // Prepare the payload for the API call
    const payload = {
      refresh_token: refreshToken,
      clientid: clientId,
      clientsecret: clientSecret,
      schema: schema,
    };

    // Make the API call to the dataset creation endpoint
    const apiResponse = await axios.post('https://marqembed.fastgenapp.com/create-dataset', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (apiResponse.status === 200) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Dataset created or updated successfully',
          data: apiResponse.data,
        }),
      };
    } else {
      return {
        statusCode: apiResponse.status,
        body: JSON.stringify({
          error: 'Failed to create or update dataset',
          details: apiResponse.data,
        }),
      };
    }
  } catch (error) {
    console.error('Error creating or updating dataset:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        details: error.message,
      }),
    };
  }
};
