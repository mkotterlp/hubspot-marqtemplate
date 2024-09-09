const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
    // Read the parameters from the request
    const userID = String(context.parameters?.userID);
    // const refreshToken = context.parameters?.refreshToken; newrefreshtoken
    const refreshToken = context.parameters?.newrefreshtoken; 


    // Check if all required parameters are provided
    if (!userID) {
        console.error("Error: Missing UserID.");
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'userID, refreshToken, and templatesJsonUrl are required but were not provided' }),
        };
    }

    try {
        const hubspotClient = new hubspot.Client({
            accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
        });

        const tablesResponse = await hubspotClient.cms.hubdb.tablesApi.getAllTables();
        if (!tablesResponse || !tablesResponse.results) {
            throw new Error('Failed to fetch tables');
        }

        let userTable = tablesResponse.results.find(table => table.name.toLowerCase() === 'user_data');
        if (!userTable) {
            throw new Error('Table user_data not found.');
        }

        const tableId = userTable.id;
        console.log('Table user_data found with ID:', tableId);

        const rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
        if (!rowsResponse || !rowsResponse.results) {
            throw new Error('Failed to fetch rows from the table');
        }

        let existingUserRow = rowsResponse.results.find(row => row.values.userID === userID);
        if (!existingUserRow) {
            throw new Error(`User ${userID} not found in the table.`);
        }

        const rowValues = {
            refreshToken: refreshToken,
        };


        await hubspotClient.cms.hubdb.rowsApi.updateDraftTableRow(tableId, existingUserRow.id, { values: rowValues });
        console.log(`User ${userID} updated in the table with new refresh token and templates URL.`);

        await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);
        console.log('Table user_data published after updating the row.');

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `User ${userID} updated successfully in HubDB.`,
            }),
        };
    } catch (error) {
        console.error("Error updating HubDB table:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update HubDB table with new data' }),
        };
    }
};
