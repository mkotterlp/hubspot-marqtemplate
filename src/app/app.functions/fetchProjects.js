const hubspot = require('@hubspot/api-client');

const STANDARD_OBJECT_TYPES = ['contact', 'deal', 'company'];

exports.main = async (context) => {
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
    });
    
    let fromObjectType = context.parameters?.fromObjectType; // e.g., 'contacts'
    const toObjectType = 'projects';
    const fromObjectId = context.parameters?.fromObjectId; // e.g., contact ID

    if (!fromObjectType || !toObjectType || !fromObjectId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing required parameters." })
        };
    }

    // Append "p_" to fromObjectType if it's not a standard type
    if (!STANDARD_OBJECT_TYPES.includes(fromObjectType.toLowerCase())) {
        fromObjectType = `p_${fromObjectType}`;
    }

    try {
        const retrieveResponse = await hubspotClient.crm.associations.batchApi.read(
            fromObjectType, 
            toObjectType, 
            { "inputs": [{ "id": fromObjectId }] }
        );
        return {
            statusCode: 200,
            body: JSON.stringify(retrieveResponse)
        };
    } catch (error) {
        console.error("Error retrieving associations:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to retrieve associations", error: error.message })
        };
    }
};
