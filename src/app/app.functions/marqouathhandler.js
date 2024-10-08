const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
    });

    try {
        const userID = context.parameters?.userID || "";
        const marqUserID = context.parameters?.marqUserID || "";
        const templatesfeed = context.parameters?.templatesfeed || "";
        const refreshToken = context.parameters?.refreshToken || "";
        const lastTemplateSyncDate = null;

        if (!userID) {
            throw new Error('UserID parameter is missing.');
        }

        console.log(`UserID being queried: ${userID}`);

        // Fetch the user_data table
        const tablesResponse = await hubspotClient.cms.hubdb.tablesApi.getAllTables();
        let userTable = tablesResponse.results.find(table => table.name.toLowerCase() === 'user_data');
        let tableId;
        
        if (!userTable) {
            console.log('Table user_data not found. Creating the table.');
        
            const newTable = await hubspotClient.cms.hubdb.tablesApi.createTable({
                name: 'user_data',
                label: 'Marq User Data',
                columns: [
                    { name: 'userID', label: 'User ID', type: 'TEXT' },
                    { name: 'marqUserID', label: 'Marq User ID', type: 'TEXT' },
                    { name: 'templatesfeed', label: 'Templates Feed', type: 'TEXT' },
                    { name: 'refreshToken', label: 'Refresh Token', type: 'TEXT' },
                    { name: 'lastTemplateSyncDate', label: 'Last Template Sync Date', type: 'DATETIME' }
                ],
                useForPages: false
            });
            
            tableId = newTable.id;  // Set the tableId from the created table
            console.log(`Table user_data created with ID: ${tableId}`);
        } else {
            tableId = userTable.id;  // Set the tableId from the existing table
            console.log('Table user_data found with ID:', tableId);
        }

        // Fetch rows from the user_data table
        const rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
        const existingUserRow = rowsResponse.results.find(row => String(row.values.userID) === String(userID));

        if (existingUserRow) {
            console.log(`User ${userID} found. Returning existing row data.`);

            // Publish the table
            await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);
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
                lastTemplateSyncDate,
            };

            const newRow = await hubspotClient.cms.hubdb.rowsApi.createTableRow(tableId, { values: rowValues });
            console.log(`User ${userID} added to the table.`);

            // Publish the table after making changes (new row added)
            await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);

            console.log(`Returning new row data for User ${userID}`);

            // Return the newly created row data
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, row: { id: newRow.id, values: rowValues } })
            };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An error occurred while processing your request.', details: error.message })
        };
    }
};
