const hubspot = require('@hubspot/api-client');
const axios = require('axios');

exports.main = async (context) => {
    const hubspotClient = new hubspot.Client({
        accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
    });    

    const templateId = context.parameters?.templateId;
    const userId = context.parameters?.userId;
    const contactId = context.parameters?.contactId;
    const apiKey = context.parameters?.apiKey;

    if (!templateId || !userId || !contactId || !apiKey) {
        console.log("Missing required parameters: templateId, userId, contactId, or apiKey");
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing required parameters." })
        };
    }

    try {
        // Step 1: Call Marq API to create a project
        const marqResponse = await axios.post('https://marqembed.fastgenapp.com/create-project', {
            templateId: templateId,
            userId: userId,
            contactId: contactId,
            apiKey: apiKey,
        });

        if (marqResponse.data.success) {
            const { documentid, new_refresh_token, project_info } = marqResponse.data;
            console.log("Marq project created successfully:", project_info);

            // Step 2: Return the project details along with the new refresh token
            return {
                statusCode: 200,
                body: JSON.stringify({
                    documentid: documentid,
                    new_refresh_token: new_refresh_token,
                    project_info: project_info
                })
            };
        } else {
            console.error("Failed to create Marq project:", marqResponse.data);
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Failed to create Marq project", error: marqResponse.data })
            };
        }

    } catch (error) {
        console.error("Error in creating Marq project:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to create Marq project", error: error.message })
        };
    }
};


// const hubspot = require('@hubspot/api-client');

// exports.main = async (context) => {
//     const hubspotClient = new hubspot.Client({
//         accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
//       });    
//           const objectIds = context.parameters?.objectIds;

//     console.log("Received object IDs:", objectIds);

//     if (!objectIds || objectIds.length === 0) {
//         console.log("No object IDs provided or object IDs array is empty");
//         return {
//             statusCode: 400,
//             body: JSON.stringify({ message: "Missing object IDs." })
//         };
//     }

//     // Update this to match the correct usage for batch retrieving custom object records
//     const requestBody = {
//         inputs: objectIds.map(id => ({ id: id })),
//         properties: ["projectid", "fileid", "name", "fileurl", "encodedoptions", "hs_createdate", "hs_lastmodifieddate"]
//     };

//     try {
//         console.log("Starting to fetch details for object IDs:", objectIds);

//         // Adjust this to use the correct API endpoint for batch reading custom object records
//         const apiResponse = await hubspotClient.crm.objects.batchApi.read(
//             'projects', // Ensure this is your actual custom object type
//             requestBody
//         );

//         const projectDetails = apiResponse.results.map(item => ({
//             objectId: item.id,  // This assumes that the response includes the object ID
//             projectid: item.properties.projectid,
//             fileid: item.properties.fileid,
//             fileurl: item.properties.fileurl,
//             encodedoptions: item.properties.encodedoptions,
//             name: item.properties.name,
//             hs_createdate: item.properties.hs_createdate,
//             hs_lastmodifieddate: item.properties.hs_lastmodifieddate
//         }));

//         console.log("Fetched project details:", projectDetails);

//         return {
//             statusCode: 200,
//             body: JSON.stringify(projectDetails)
//         };

//     } catch (error) {
//         console.error("Error in processing project details:", error);
//         return {
//             statusCode: 500,
//             body: JSON.stringify({ message: "Failed to fetch project details", error: error.message })
//         };
//     }
// };
