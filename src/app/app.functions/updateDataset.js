const hubspot = require('@hubspot/api-client');
const axios = require('axios');

exports.main = async (context) => {
  try {
    // Extract parameters from the serverless context
    const { refreshToken, collectionId, dataSourceId, clientid, clientsecret, properties, schema } = context.parameters;

    if (!refreshToken || !collectionId || !dataSourceId || !clientid || !clientsecret) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required parameters: refreshToken, collectionId, dataSourceId, clientid, or clientsecret',
        }),
      };
    }

    // Step 1: Prepare the data payload
    const dataPayload = {
      refresh_token: refreshToken,
      clientid: clientid,
      clientsecret: clientsecret,
      collectionId: collectionId,
      dataSourceId: dataSourceId,
      properties: properties, // Send user-specific data and custom fields
      schema: schema           // Send the schema
    };

    console.log('Prepared data payload:', dataPayload);

    // Step 2: Make the API call to send the data to the dataset
    const response = await axios.post('https://marqembed.fastgenapp.com/update-data3', dataPayload, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Step 3: Check the response status and handle success or errors
    if (response.status === 200) {
      console.log("Data sent successfully to the dataset:", response.data);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Data sent successfully to the dataset',
          data: response.data,
        }),
      };
    } else {
      console.error("Failed to send data to the dataset:", response.data);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: 'Failed to send data to the dataset',
          details: response.data,
        }),
      };
    }
  } catch (error) {
    console.error('Error sending data to the dataset:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        details: error.message,
      }),
    };
  }
};
