// const axios = require('axios');

// exports.main = async (context) => {
//   const { refreshToken, schema, collectionId, dataSourceId, properties } = context.parameters;

//   if (!refreshToken) {
//     return {
//       statusCode: 400,
//       body: JSON.stringify({ error: 'Missing refresh token' }),
//     };
//   }

//   if (!schema || !Array.isArray(schema)) {
//     return {
//       statusCode: 400,
//       body: JSON.stringify({ error: 'Invalid or missing schema' }),
//     };
//   }

//   if (!collectionId || !dataSourceId) {
//     return {
//       statusCode: 400,
//       body: JSON.stringify({ error: 'Missing collectionId or dataSourceId' }),
//     };
//   }

//   try {
//     // API credentials
//     const clientId = process.env.CLIENT_ID;
//     const clientSecret = process.env.CLIENT_SECRET;

//     // Prepare the payload for the API call
//     const payload = {
//       refresh_token: refreshToken,
//       clientid: clientId,
//       clientsecret: clientSecret,
//       collectionId: collectionId,
//       dataSourceId: dataSourceId,
//       properties: properties,
//       schema: schema,
//     };

//     // Make the API call to the dataset creation endpoint
//     const apiResponse = await axios.post('https://marqembed.fastgenapp.com/create-dataset', payload, {
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     });

//     if (apiResponse.status === 200) {
//       return {
//         statusCode: 200,
//         body: JSON.stringify({
//           collectionId: apiResponse.data.collectionId,
//           dataSourceId: apiResponse.data.dataSourceId,
//           new_refresh_token: apiResponse.data.new_refresh_token,
//           success: true
//         }),
//       };
//     } else {
//       return {
//         statusCode: apiResponse.status,
//         body: JSON.stringify({
//           error: 'Failed to create or update dataset',
//           details: apiResponse.data,
//         }),
//       };
//     }
//   } catch (error) {
//     console.error('Error creating or updating dataset:', error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({
//         error: 'Internal Server Error',
//         details: error.message,
//       }),
//     };
//   }
// };
