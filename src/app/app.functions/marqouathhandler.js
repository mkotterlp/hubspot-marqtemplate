const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
    });

    try {
        const userID = String(context.parameters?.userID);
        const marqUserID = context.parameters?.marqUserID || "";
        const templatesfeed = context.parameters?.templatesfeed || "";
        const refreshToken = context.parameters?.refreshToken || "";

        if (!userID) {
            throw new Error('UserID parameter is missing.');
        }

        console.log(`UserID being queried: ${userID}`);

        // Fetch the user_data table
        const tablesResponse = await hubspotClient.cms.hubdb.tablesApi.getAllTables();
        const userTable = tablesResponse.results.find(table => table.name.toLowerCase() === 'user_data');

        if (!userTable) {
            throw new Error('Table user_data not found.');
        }

        const tableId = userTable.id;
        console.log('Table user_data found with ID:', tableId);

        // Fetch rows from the user_data table
        const rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
        const existingUserRow = rowsResponse.results.find(row => row.values.userID === userID);

        const rowValues = {
            userID,
            marqUserID,
            templatesfeed,
            refreshToken
        };

        if (existingUserRow) {
            console.log(`User ${userID} found. Updating the existing row.`);
            await hubspotClient.cms.hubdb.rowsApi.updateDraftTableRow(tableId, existingUserRow.id, { values: rowValues });
        } else {
            console.log(`User ${userID} not found. Creating a new row.`);
            await hubspotClient.cms.hubdb.rowsApi.createTableRow(tableId, { values: rowValues });
        }

        // Publish the table after making changes
        await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);
        console.log('Table user_data published after updating/creating rows.');

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An error occurred while processing your request.', details: error.message })
        };
    }
};
