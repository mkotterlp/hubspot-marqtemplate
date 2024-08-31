const hubspot = require('@hubspot/api-client');
const axios = require('axios');

exports.main = async (context) => {
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
    });

    const marqUserId = context.parameters?.marqUserId;
    const refreshToken = context.parameters?.refreshToken;
    const userId = context.parameters?.userId;
    const apiKey = context.parameters?.apiKey;
    const accessToken = context.parameters?.accessToken;

    if (!marqUserId || !refreshToken || !userId || !apiKey || !accessToken) {
        console.log("Missing required parameters: marqUserId, refreshToken, userId, apiKey, or accessToken");
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing required parameters." })
        };
    }

    try {
        // Define the request body for the update
        const requestBody = {
            marquserid: marqUserId,
            refreshToken: refreshToken,
            userid: userId,
            accessToken: accessToken,
            apikey: apiKey,
        };

        // Make the PATCH request to update the Marq User Data table
        const updateResponse = await axios.patch('https://marqembed.fastgenapp.com/update-hbTable', requestBody);

        if (updateResponse.status === 200) {
            console.log("Marq User Data table updated successfully:", updateResponse.data);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: "User token updated successfully",
                    result: updateResponse.data
                })
            };
        } else {
            console.error("Failed to update Marq User Data table:", updateResponse.data);
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Failed to update Marq User Data table", error: updateResponse.data })
            };
        }

    } catch (error) {
        console.error("Error in updating Marq User Data table:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to update Marq User Data table", error: error.message })
        };
    }
};
