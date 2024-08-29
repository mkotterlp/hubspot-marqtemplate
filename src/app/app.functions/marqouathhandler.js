const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
    });

    let tableId;
    let actionSuccess = false;

    try {
        const userID = String(context.parameters?.userID);

        if (!userID) {
            throw new Error('UserID parameter is missing.');
        }

        // Fetch all tables
        const tablesResponse = await hubspotClient.cms.hubdb.tablesApi.getAllTables();
        if (!tablesResponse || !tablesResponse.results) {
            throw new Error('Failed to fetch tables');
        }

        let userTable = tablesResponse.results.find(table => table.name.toLowerCase() === 'user_data');

        if (!userTable) {
            console.log('Table user_data not found, creating new table');
            const tableCreationResponse = await hubspotClient.cms.hubdb.tablesApi.createTable({
                name: 'user_data',
                label: 'Marq User Data',
                columns: [
                    { name: 'userID', label: 'User ID', type: 'TEXT' },
                    { name: 'marqUserID', label: 'Marq User ID', type: 'TEXT' },
                    { name: 'templatesfeed', label: 'Templates', type: 'TEXT' },
                    { name: 'refreshToken', label: 'Refresh Token', type: 'TEXT' }
                ],
            });
            tableId = tableCreationResponse.id;
            userTable = tableCreationResponse;

            console.log('Table user_data created and published');
        } else {
            tableId = userTable.id;
            console.log('Table user_data found with ID:', tableId);
        }

        console.log('Fetching rows from user_data table');
        let rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
        if (!rowsResponse || !rowsResponse.results) {
            throw new Error('Failed to fetch rows from the table');
        }

        // Check if the user already exists
        let existingUserRow = rowsResponse.results.find(row => row.values.userID === userID);

        if (existingUserRow) {
            console.log(`User ${userID} already exists. Updating the existing row.`);
            const updatedRowValues = {
                userID: userID,
                marqUserID: context.parameters.marqUserID || existingUserRow.values.marqUserID || "",
                templatesfeed: context.parameters.templatesfeed || existingUserRow.values.templatesfeed || "",
                refreshToken: context.parameters.refreshToken || existingUserRow.values.refreshToken || ""
            };

            await hubspotClient.cms.hubdb.rowsApi.updateTableRow(tableId, existingUserRow.id, { values: updatedRowValues });
            console.log(`User ${userID} row updated successfully.`);
            actionSuccess = true; // Mark as successful if updated
        } else {
            console.log(`User ${userID} not found. Creating a new row.`);
            const rowValues = {
                userID: userID,
                marqUserID: context.parameters.marqUserID || "",  // Assuming marqUserID is passed in parameters
                templatesfeed: context.parameters.templatesfeed || "",  // Assuming templatesfeed is passed in parameters
                refreshToken: context.parameters.refreshToken || "" // Assuming refreshToken is passed in parameters
            };

            const createRowResponse = await hubspotClient.cms.hubdb.rowsApi.createTableRow(tableId, { values: rowValues });
            existingUserRow = createRowResponse;  // Use the newly created row
            console.log(`User ${userID} added to the table.`);
            actionSuccess = true; // Mark as successful if created
        }

        await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);
        console.log('Table user_data published after creating or updating rows.');

        return {
            body: JSON.stringify({ success: actionSuccess }),
            statusCode: 200,
        };
    } catch (error) {
        console.error('Error:', {
            message: error.message,
            statusCode: error.statusCode,
            body: error.body,
            stack: error.stack,
        });
        return {
            body: JSON.stringify({ error: 'An error occurred while processing your request.', details: error.message }),
            statusCode: 500,
        };
    }
};
