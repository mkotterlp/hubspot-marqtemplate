const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
    // Read the parameters from the request
    const accountId = String(context.parameters?.accountId); // Read accountId instead of userID
    const refreshToken = context.parameters?.refreshToken; 
    const datatsetid = context.parameters?.datasetId;  
    const collectionid = context.parameters?.collectionid;      

    console.log("accountId:", accountId);
    console.log("refreshToken:", refreshToken);
    console.log("datatsetid:", datatsetid);
    console.log("collectionid:", collectionid);

    // Check if all required parameters are provided
    if (!accountId || !refreshToken || !datatsetid || !collectionid) {
        console.error("Error: Missing required parameters.");
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'accountId, refreshToken, datatsetid, and collectionid are required but were not provided' }),
        };
    }

    try {
        // Initialize the HubSpot client with the private app access token
        const hubspotClient = new hubspot.Client({
            accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
        });

        // Fetch all tables to find the marq_account_data table
        const tablesResponse = await hubspotClient.cms.hubdb.tablesApi.getAllTables();
        if (!tablesResponse || !tablesResponse.results) {
            throw new Error('Failed to fetch tables');
        }

        // Find the table with the name 'marq_account_data'
        let accountTable = tablesResponse.results.find(table => table.name.toLowerCase() === 'marq_account_data');
        if (!accountTable) {
            throw new Error('Table marq_account_data not found.');
        }

        const tableId = accountTable.id;
        console.log('Table marq_account_data found with ID:', tableId);

        try {
          await hubspotClient.cms.hubdb.rowsApi.updateDraftTableRow(tableId, existingUserRow.id, { values: rowValues });
        } catch (error) {
          console.error("Error updating row in HubDB:", error.response?.body || error.message);
        }
        

        // Fetch all rows from the marq_account_data table
        const rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
        if (!rowsResponse || !rowsResponse.results) {
            throw new Error('Failed to fetch rows from the table');
        }

        // Find the row with the matching accountId
        let existingUserRow = rowsResponse.results.find(row => row.values.accountId === accountId);
        if (!existingUserRow) {
            throw new Error(`Account ${accountId} not found in the table.`);
        }

        // Update the row with the new refreshToken, datatsetid, and collectionid
        const rowValues = {
            refreshToken: refreshToken,
            datatsetid: datatsetid,
            collectionid: collectionid
        };

        // Update the draft row with new values
        await hubspotClient.cms.hubdb.rowsApi.updateDraftTableRow(tableId, existingUserRow.id, { values: rowValues });
        console.log(`Account ${accountId} updated in the table with new refreshToken, datatsetid, and collectionid.`);

        // Publish the table after updating the row
        await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);
        console.log('Table marq_account_data published after updating the row.');

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Account ${accountId} updated successfully in HubDB.`,
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
