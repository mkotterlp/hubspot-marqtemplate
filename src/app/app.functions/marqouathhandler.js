const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
    });

    let tableId;

    try {
        const userID = String(context.parameters?.userID);

        if (!userID) {
            throw new Error('UserID parameter is missing.');
        }

        console.log(`UserID being queried: ${userID}`);

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

        console.log(`Rows fetched from user_data table: ${JSON.stringify(rowsResponse.results, null, 2)}`);

        // Check if the user already exists
        let existingUserRow = rowsResponse.results.find(row => row.values.userID === userID);

        if (existingUserRow) {
            console.log(`User ${userID} found. Updating the existing row.`);
            const rowValues = {
                userID: userID,
                marqUserID: context.parameters.marqUserID || "",  
                templatesfeed: context.parameters.templatesfeed || "",  
                refreshToken: context.parameters.refreshToken || "" 
            };

            const updateRowResponse = await hubspotClient.cms.hubdb.rowsApi.updateDraftTableRow(tableId, existingUserRow.id, { values: rowValues });
            existingUserRow = updateRowResponse;
            console.log(`User ${userID} updated in the table.`);
        } else {
            console.log(`User ${userID} not found. Creating a new row.`);
            const rowValues = {
                userID: userID,
                marqUserID: context.parameters.marqUserID || "",  
                templatesfeed: context.parameters.templatesfeed || "",  
                refreshToken: context.parameters.refreshToken || "" 
            };

            const createRowResponse = await hubspotClient.cms.hubdb.rowsApi.createTableRow(tableId, { values: rowValues });
            existingUserRow = createRowResponse;
            console.log(`User ${userID} added to the table.`);
        }

        await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);
        console.log('Table user_data published after updating/creating rows.');

        return {
            body: JSON.stringify(existingUserRow),
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
