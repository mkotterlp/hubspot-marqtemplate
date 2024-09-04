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
        const lastTemplateSyncDate = context.parameters?.lastTemplateSyncDate 
    ? Number(context.parameters.lastTemplateSyncDate) 
    : null;

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

        if (existingUserRow) {
            console.log(`User ${userID} found. Returning existing row data.`);

            // Return the existing row data without updating it
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, row: { id: existingUserRow.id, values: existingUserRow.values } })
            };
        } else {
            console.log(`User ${userID} not found. Creating a new row.`);

            const rowValues = {
                userID,
                marqUserID,
                templatesfeed,
                refreshToken,
                lastTemplateSyncDate
            };

            const newRow = await hubspotClient.cms.hubdb.rowsApi.createTableRow(tableId, { values: rowValues });
            console.log(`User ${userID} added to the table.`);

            console.log(`Returning new row data for User ${userID}`);

            // Return the newly created row data
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, row: { id: newRow.id, values: rowValues } })
            };
        }

        // Publish the table after making changes (only relevant if rows were created or updated)
        await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);
        console.log('Table user_data published after updating/creating rows.');
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An error occurred while processing your request.', details: error.message })
        };
    }
};
