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
            console.log('Table marqembed2 not found, creating new table');
            const tableCreationResponse = await hubspotClient.cms.hubdb.tablesApi.createTable({
                name: 'marq_account_data',
                label: 'Marq Account Data',
                columns: [
                    { name: 'objectType', label: 'Object Type', type: 'TEXT' },
                    { name: 'accountId', label: 'Account ID', type: 'TEXT' },
                    { name: 'refreshToken', label: 'Refresh token', type: 'TEXT' },
                    { name: 'datasetid', label: 'Data set ID', type: 'TEXT' },
                    { name: 'collectionid', label: 'Collection ID', type: 'TEXT' },
                    
                ],
            });
            tableId = tableCreationResponse.id;
            marqembedTable = tableCreationResponse;

            console.log('Table account created and published');
        } else {
            tableId = marqembedTable.id;
            console.log('Table account found with ID:', tableId);
        }

        console.log('Fetching rows from table');
        let rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
        if (!rowsResponse || !rowsResponse.results) {
            throw new Error('Failed to fetch rows from the table');
        }

        // Fetching all CRM object types
        const objectTypesResponse = await hubspotClient.crm.schemas.coreApi.getAll();
        if (!objectTypesResponse || !objectTypesResponse.results) {
            throw new Error('Failed to fetch CRM object types');
        }
        const customObjectTypes = objectTypesResponse.results.map(obj => obj.name.toLowerCase());

        // Including standard object types
        const standardObjectTypes = ['contact', 'company', 'deal', 'ticket', 'data'];

        const allObjectTypes = [...standardObjectTypes.map(type => type.toLowerCase()), ...customObjectTypes];

        let existingObjectTypes = rowsResponse.results.map(row => row.values.objectType.toLowerCase());

        for (const objectType of allObjectTypes) {
            if (!existingObjectTypes.includes(objectType.toLowerCase())) {
                console.log(`Creating new row for object type: ${objectType}`);
                const rowValues = {
                    objectType: objectType,
                    accountId: "", 
                    refreshToken: "", 
                    datasetid: "", 
                    collectionid: "", 
                };
                await hubspotClient.cms.hubdb.rowsApi.createTableRow(tableId, { values: rowValues });
            }
        }

        await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);
        console.log('Table marqembed2 published after creating new rows.');

        // Re-fetch rows after publishing to ensure newly added rows are included
        rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
        if (!rowsResponse || !rowsResponse.results) {
            throw new Error('Failed to fetch rows from the table after publishing');
        }

        // Assuming context.parameters contains necessary keys for filtering config
        const objectType = context.parameters?.objectType?.toLowerCase() || 'default'; // Default object type if not provided
        let matchedRow = rowsResponse.results.find(row => row.values.objectType.toLowerCase() === objectType);
        let dataRow = rowsResponse.results.find(row => row.values.objectType.toLowerCase() === 'data');

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
