const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
    // Initialize HubSpot client with API key from environment variables or secrets
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
      });    

    const objectTypeId = context.parameters?.objectTypeId;

    if (!objectTypeId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'objectTypeId is required but was not provided' })
        };
    }

    try {
        const objectSchemaResponse = await hubspotClient.crm.schemas.coreApi.getById(objectTypeId);
        const objectType = objectSchemaResponse.name;

        return {
            statusCode: 200,
            body: JSON.stringify({ objectType })
        };
    } catch (error) {
        console.error(`Error fetching object schema: ${error.message}`);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
