const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
    });

    let tableId;

    try {
        // Fetch all tables
        const tablesResponse = await hubspotClient.cms.hubdb.tablesApi.getAllTables();
        if (!tablesResponse || !tablesResponse.results) {
            throw new Error('Failed to fetch tables');
        }

        let marqembedTable = tablesResponse.results.find(table => table.name.toLowerCase() === 'marq_account_data');

        if (!marqembedTable) {
            throw new Error('Table marq_account_data not found');
        } else {
            tableId = marqembedTable.id;
            console.log('Table account found with ID:', tableId);
        }

        console.log('Fetching rows from table');
        let rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
        if (!rowsResponse || !rowsResponse.results) {
            throw new Error('Failed to fetch rows from the table');
        }

        // Filter the matched row based on provided objectType
        const objectType = context.parameters?.objectType?.toLowerCase() || 'default'; // Default object type if not provided
        let matchedRow = rowsResponse.results.find(row => row.values.objectType && row.values.objectType.toLowerCase() === objectType);
        let dataRow = rowsResponse.results.find(row => row.values.objectType && row.values.objectType.toLowerCase() === 'data');

        if (!matchedRow && !dataRow) {
            throw new Error(`No configuration found for object type: ${objectType} or 'data'`);
        }

        return {
            body: JSON.stringify({
                objectTypeRow: matchedRow || null,
                dataRow: dataRow || null
            }),
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
