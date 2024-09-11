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
                    { name: 'refreshtoken', label: 'Refresh token', type: 'TEXT' },
                    { name: 'datasetid', label: 'Data set ID', type: 'TEXT' },
                    { name: 'collectionid', label: 'Collection ID', type: 'TEXT' },
                    { name: 'dataFields', label: 'Data Fields', type: 'TEXT' }  // Added column for designated fields
                ],
            });
            tableId = tableCreationResponse.id;
            marqembedTable = tableCreationResponse;

            console.log('Table marqembed2 created and published');
        } else {
            tableId = marqembedTable.id;
            console.log('Table marqembed2 found with ID:', tableId);
        }

        console.log('Fetching rows from table');
        let rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
        if (!rowsResponse || !rowsResponse.results) {
            throw new Error('Failed to fetch rows from the table');
        }

        // Handle saving or updating the refresh token
        if (context.parameters?.action === 'saveToken' && context.parameters.refreshToken && context.parameters.userid) {
            const refreshToken = context.parameters.refreshToken;
            const userid = context.parameters.userid;

            // Find the row corresponding to the provided userid
            let userRow = rowsResponse.results.find(row => row.values.accountId === userid);

            if (userRow) {
                // Update the refresh token for the existing row
                await hubspotClient.cms.hubdb.rowsApi.updateTableRow(tableId, userRow.id, {
                    values: { refreshtoken: refreshToken }
                });
                console.log(`Updated refresh token for user ID ${userid}`);
            } else {
                // If no row found, create a new row with the refresh token
                await hubspotClient.cms.hubdb.rowsApi.createTableRow(tableId, {
                    values: {
                        accountId: userid,
                        refreshtoken: refreshToken,
                        objectType: 'account', // Example, modify as needed
                    }
                });
                console.log(`Created new row for user ID ${userid} with refresh token`);
            }

            await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId); // Publish changes

            return {
                body: JSON.stringify({ message: 'Token saved successfully' }),
                statusCode: 200
            };
        }

        // Check if the request is for checking an existing account token
        if (context.parameters?.checkExistingToken && context.parameters.userid) {
            // Find the row corresponding to the provided userid
            const userRow = rowsResponse.results.find(row => row.values.accountId === context.parameters.userid);
            
            if (userRow && userRow.values.refreshtoken) {
                // If refresh token exists, return it
                return {
                    body: JSON.stringify({ refreshToken: userRow.values.refreshtoken }),
                    statusCode: 200
                };
            } else {
                // If no token found, return null
                return {
                    body: JSON.stringify({ refreshToken: null }),
                    statusCode: 200
                };
            }
        }

        // Fetching all CRM object types
        const objectTypesResponse = await hubspotClient.crm.schemas.coreApi.getAll();
        if (!objectTypesResponse || !objectTypesResponse.results) {
            throw new Error('Failed to fetch CRM object types');
        }
        const customObjectTypes = objectTypesResponse.results.map(obj => obj.name.toLowerCase());

        // Including standard object types
        const standardObjectTypes = ['contact', 'company', 'deal', 'ticket'];

        const allObjectTypes = [...standardObjectTypes.map(type => type.toLowerCase()), ...customObjectTypes];

        let existingObjectTypes = rowsResponse.results.map(row => row.values.objectType.toLowerCase());

        for (const objectType of allObjectTypes) {
            if (!existingObjectTypes.includes(objectType.toLowerCase())) {
                console.log(`Creating new row for object type: ${objectType}`);
                const rowValues = {
                    objectType: objectType,
                    textboxFields: "", 
                    textboxFilters: "", 
                    dataFields: "", 
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

        // Step 7: Update fields and schema in HubDB
        const objectType = context.parameters?.objectType?.toLowerCase() || 'default'; // Default object type if not provided
        let relevantRow = rowsResponse.results.find(row => row.values.objectType.toLowerCase() === objectType);

        if (!relevantRow) {
            throw new Error(`No configuration found for object type: ${objectType}`);
        }

        // Fetch designated fields from the 'dataFields' column
        const designatedFields = relevantRow.values.dataFields || '';  
        const designatedFieldList = designatedFields.split(',').map(field => field.trim());

        // Ensure 'Id' (primary field) is included in the fields
        if (!designatedFieldList.includes('Id')) {
            designatedFieldList.push('Id');
        }

        console.log('Designated fields:', designatedFieldList);

        // Update the row with the newly designated fields
        const updatedRow = {
            ...relevantRow.values,
            dataFields: designatedFieldList.join(', ')  // Update the 'dataFields' column with new schema
        };

        await hubspotClient.cms.hubdb.rowsApi.updateTableRow(tableId, relevantRow.id, { values: updatedRow });

        // Publish the changes to the HubDB table
        await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);

        console.log('Fields and schema updated successfully in HubDB.');

        return {
            body: JSON.stringify({
                message: 'Fields and schema updated successfully in HubDB.',
                updatedFields: designatedFieldList
            }),
            statusCode: 200
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

















// ORIGINAL
// const hubspot = require('@hubspot/api-client');

// exports.main = async (context) => {
//     const hubspotClient = new hubspot.Client({
//         accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
//     });

//     let tableId;

//     try {
//         // Fetch all tables
//         const tablesResponse = await hubspotClient.cms.hubdb.tablesApi.getAllTables();
//         if (!tablesResponse || !tablesResponse.results) {
//             throw new Error('Failed to fetch tables');
//         }

//         let marqembedTable = tablesResponse.results.find(table => table.name.toLowerCase() === 'marq_account_data');

//         if (!marqembedTable) {
//             console.log('Table marqembed2 not found, creating new table');
//             const tableCreationResponse = await hubspotClient.cms.hubdb.tablesApi.createTable({
//                 name: 'marq_account_data',
//                 label: 'Marq Account Data',
//                 columns: [
//                     { name: 'objectType', label: 'Object Type', type: 'TEXT' },
//                     { name: 'accountId', label: 'Account ID', type: 'TEXT' },
//                     { name: 'refreshtoken', label: 'Refresh token', type: 'TEXT' },
//                     { name: 'datasetid', label: 'Data set ID', type: 'TEXT' },
//                     { name: 'collectionid', label: 'Collection ID', type: 'TEXT' },
                    
//                 ],
//             });
//             tableId = tableCreationResponse.id;
//             marqembedTable = tableCreationResponse;

//             console.log('Table marqembed2 created and published');
//         } else {
//             tableId = marqembedTable.id;
//             console.log('Table marqembed2 found with ID:', tableId);
//         }

//         console.log('Fetching rows from table');
//         let rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
//         if (!rowsResponse || !rowsResponse.results) {
//             throw new Error('Failed to fetch rows from the table');
//         }


//         // Fetching all CRM object types
//         const objectTypesResponse = await hubspotClient.crm.schemas.coreApi.getAll();
//         if (!objectTypesResponse || !objectTypesResponse.results) {
//             throw new Error('Failed to fetch CRM object types');
//         }
//         const customObjectTypes = objectTypesResponse.results.map(obj => obj.name.toLowerCase());

//         // Including standard object types
//         const standardObjectTypes = ['contact', 'company', 'deal', 'ticket'];

//         const allObjectTypes = [...standardObjectTypes.map(type => type.toLowerCase()), ...customObjectTypes];

//         let existingObjectTypes = rowsResponse.results.map(row => row.values.objectType.toLowerCase());

//         for (const objectType of allObjectTypes) {
//             if (!existingObjectTypes.includes(objectType.toLowerCase())) {
//                 console.log(`Creating new row for object type: ${objectType}`);
//                 const rowValues = {
//                     objectType: objectType,
//                     textboxFields: "", 
//                     textboxFilters: "", 
//                     dataFields: "", 
//                 };
//                 await hubspotClient.cms.hubdb.rowsApi.createTableRow(tableId, { values: rowValues });
//             }
//         }

//         await hubspotClient.cms.hubdb.tablesApi.publishDraftTable(tableId);
//         console.log('Table marqembed2 published after creating new rows.');

//         // Re-fetch rows after publishing to ensure newly added rows are included
//         rowsResponse = await hubspotClient.cms.hubdb.rowsApi.getTableRows(tableId);
//         if (!rowsResponse || !rowsResponse.results) {
//             throw new Error('Failed to fetch rows from the table after publishing');
//         }

//         // Assuming context.parameters contains necessary keys for filtering config
//         const objectType = context.parameters?.objectType?.toLowerCase() || 'default'; // Default object type if not provided
//         let relevantRow = rowsResponse.results.find(row => row.values.objectType.toLowerCase() === objectType);

//         if (!relevantRow) {
//             throw new Error(`No configuration found for object type: ${objectType}`);
//         }

//         return {
//             body: JSON.stringify(relevantRow),
//             statusCode: 200,
//         };
//     } catch (error) {
//         console.error('Error:', {
//             message: error.message,
//             statusCode: error.statusCode,
//             body: error.body,
//             stack: error.stack,
//         });
//         return {
//             body: JSON.stringify({ error: 'An error occurred while processing your request.', details: error.message }),
//             statusCode: 500,
//         };
//     }
// };
