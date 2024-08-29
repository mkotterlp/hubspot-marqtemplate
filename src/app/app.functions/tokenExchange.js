const hubspot = require('@hubspot/api-client');
const axios = require('axios');

exports.main = async (context) => {
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
    });

    // Extract the code and state parameters from the context
    const code = context.parameters?.code;
    const stateEncoded = context.parameters?.state;

    if (!code || !stateEncoded) {
        return { error: "Missing code or state parameter" };
    }

    try {
        // Decode the state parameter
        const stateDecoded = Buffer.from(stateEncoded, 'base64').toString('utf-8');
        const stateData = JSON.parse(stateDecoded);

        const apiKey = stateData.apiKey;
        const marqUserID = stateData.clientId;  // Assuming clientId in stateData is the Marq user ID
        const clientSecret = stateData.clientSecret;
        const redirectUri = stateData.redirectUri;

        const tableId = await getHubDBTableId(hubspotClient, 'user_data');

        if (!apiKey || !tableId) {
            return { error: "Missing API Key or HubDB Table ID" };
        }

        // Exchange the code for tokens by making a POST request to Fastgen
        const response = await axios.post('https://marqembed.fastgenapp.com/marq-oauth', {
            code: code,
            client_id: marqUserID,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });

        if (response.status !== 200) {
            return { error: `Failed to exchange tokens: ${response.status}` };
        }

        const { refresh_token } = response.data;

        if (!refresh_token) {
            return { error: "No refresh token received from Fastgen" };
        }

        // Update the HubDB table with the new refresh token
        const existingUserRow = await getUserRow(hubspotClient, tableId, marqUserID);
        if (existingUserRow) {
            await hubspotClient.cms.hubdb.rowsApi.updateTableRow(tableId, existingUserRow.id, {
                values: {
                    ...existingUserRow.values,
                    refreshToken: refresh_token
                }
            });
        } else {
            await hubspotClient.cms.hubdb.rowsApi.createTableRow(tableId, {
                values: {
                    userID: marqUserID,
                    refreshToken: refresh_token
                }
            });
        }

        await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);

        return { success: true, message: "Refresh token updated successfully" };
    } catch (error) {
        console.error('Error during token exchange or HubDB update:', error);
        return { error: `Error during token exchange: ${error.message}` };
    }
};

// Utility function to get the HubDB table ID for a given table name
async function getHubDBTableId(hubspotClient, tableName) {
    const tablesResponse = await hubspotClient.cms.hubdb.tablesApi.getAllTables();
    const userTable = tablesResponse.results.find(table => table.name.toLowerCase() === tableName);
    return userTable ? userTable.id : null;
}

// Utility function to fetch a user's row from the HubDB table
async function getUserRow(hubspotClient, tableId, userID) {
    const rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
    return rowsResponse.results.find(row => row.values.userID === userID);
}