const axios = require('axios');

exports.main = async (context) => {
    const accessToken = process.env['PRIVATE_APP_ACCESS_TOKEN'];

    const objectId = context.parameters?.objectId;
    const objectType = context.parameters?.objectType;
    const properties = context.parameters?.properties;
    const parentObjectType = context.parameters?.parentObjectType || objectType; // Use dynamic parent object type

    console.log("Received parameters:", JSON.stringify(context.parameters));

    if (!objectId || !objectType || !properties) {
        console.log("Missing required parameters: objectId, objectType, or properties");
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing required parameters: objectId, objectType, or properties." })
        };
    }

    try {
        console.log(`Fetching details for ${objectType} with ID ${objectId} and properties: ${properties.join(', ')}`);

        // Fetch object properties dynamically
        let apiResponse = await fetchObjectProperties(accessToken, objectType, objectId, properties);

        if (!apiResponse || !apiResponse.properties) {
            console.log('Invalid API response structure');
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "No properties found." })
            };
        }

        // Fetch property definitions for the object
        const propertyDefinitions = await fetchPropertyDefinitions(accessToken, objectType, properties);

        // Fetch pipeline stages if applicable
        let pipelineStages = [];
        if (objectType === 'DEAL' && properties.includes('dealstage')) {
            pipelineStages = await fetchPipelineStages(accessToken);
        }

        // Map property values to human-readable labels
        let mappedProperties = mapPropertyValuesToLabels(apiResponse.properties, propertyDefinitions, pipelineStages);

        // Dynamically fetch associated objects (e.g., contacts, companies, deals, etc.)
        const associatedObjects = await fetchDynamicAssociations(accessToken, objectId, parentObjectType);

        // Add dynamic associations to the response
        mappedProperties.associations = associatedObjects;

        return {
            statusCode: 200,
            body: JSON.stringify({
                objectDetails: apiResponse,
                mappedProperties: mappedProperties
            })
        };

    } catch (error) {
        console.error("Error:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message })
        };
    }
};

// Fetch object properties
async function fetchObjectProperties(accessToken, objectType, objectId, properties) {
    try {
        const response = await axios.get(`https://api.hubapi.com/crm/v3/objects/${objectType}/${objectId}`, {
            params: {
                properties: properties.join(',')
            },
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching object properties:`, error.message);
        throw error;
    }
}

// Fetch property definitions for the given objectType
async function fetchPropertyDefinitions(accessToken, objectType, properties) {
    const propertyDefinitions = {};
    for (const property of properties) {
        try {
            console.log(`Fetching property definition for ${property}`);
            const response = await axios.get(`https://api.hubapi.com/crm/v3/properties/${objectType}/${property}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            propertyDefinitions[property] = response.data;
        } catch (error) {
            console.error(`Error fetching property definition for ${property}:`, error.message);
            throw error;
        }
    }
    return propertyDefinitions;
}

// Fetch pipeline stages (if the object is a DEAL)
async function fetchPipelineStages(accessToken) {
    try {
        const response = await axios.get('https://api.hubapi.com/crm/v3/pipelines/deals', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data.results;
    } catch (error) {
        console.error('Error fetching pipeline stages:', error.message);
        throw error;
    }
}

// Fetch dynamic associations (without hardcoding any associated objects)
async function fetchDynamicAssociations(accessToken, objectId, objectType) {
    try {
        // Dynamically get all associations for the object
        const response = await axios.get(`https://api.hubapi.com/crm/v4/objects/${objectType}/${objectId}/associations`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        // Parse associated object types and details
        const associations = response.data.results.reduce((acc, association) => {
            const { type, associatedObjectIds } = association;
            acc[type] = associatedObjectIds;  // Store each association type with its related object IDs
            return acc;
        }, {});

        return associations;

    } catch (error) {
        console.error('Error fetching dynamic associations:', error.message);
        return {};
    }
}

// Map property values to readable labels (e.g., deal stages, enumerations)
function mapPropertyValuesToLabels(properties, propertyDefinitions, pipelineStages) {
    const mappedProperties = {};
    for (const key in properties) {
        if (properties.hasOwnProperty(key)) {
            const property = propertyDefinitions[key];
            if (key === 'dealstage' && pipelineStages.length > 0) {
                for (const pipeline of pipelineStages) {
                    const stage = pipeline.stages.find(stage => stage.id === properties[key]);
                    if (stage) {
                        mappedProperties[key] = stage.label;
                        break;
                    }
                }
                if (!mappedProperties[key]) {
                    mappedProperties[key] = properties[key];
                }
            } else if (property && property.type === 'enumeration' && property.options) {
                const option = property.options.find(opt => opt.value === properties[key]);
                mappedProperties[key] = option ? option.label : properties[key];
            } else {
                mappedProperties[key] = properties[key];
            }
        }
    }
    return mappedProperties;
}
