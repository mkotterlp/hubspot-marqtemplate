const axios = require('axios');

exports.main = async (context) => {
    const accessToken = process.env['PRIVATE_APP_ACCESS_TOKEN'];

    const objectId = context.parameters?.objectId;
    const objectType = context.parameters?.objectType;
    const properties = context.parameters?.properties;

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

        let apiResponse;
        try {
            // Fetch object properties
            apiResponse = await fetchObjectProperties(accessToken, objectType, objectId, properties);
            console.log("Fetched object properties:", JSON.stringify(apiResponse, null, 2));
        } catch (error) {
            console.error("Error fetching object properties:", error.message);
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Error fetching object properties" })
            };
        }

        if (!apiResponse || !apiResponse.properties) {
            console.log('Invalid API response structure');
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "No properties found." })
            };
        }

        let propertyDefinitions;
        try {
            // Fetch property definitions including options
            propertyDefinitions = await fetchPropertyDefinitions(accessToken, objectType, properties);
            console.log("Fetched property definitions:", JSON.stringify(propertyDefinitions, null, 2));
        } catch (error) {
            console.error("Error fetching property definitions:", error.message);
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Error fetching property definitions" })
            };
        }

        let pipelineStages = [];
        if (objectType === 'DEAL' && properties.includes('dealstage')) {
            try {
                console.log("Fetching pipeline stages");
                pipelineStages = await fetchPipelineStages(accessToken);
                console.log("Fetched pipeline stages:", JSON.stringify(pipelineStages, null, 2));
            } catch (error) {
                console.error("Error fetching pipeline stages:", error.message);
            }
        } else {
            console.log("Pipeline stages fetching not required for this object type or properties");
        }

        let mappedProperties;
        try {
            // Map property values to their labels
            mappedProperties = mapPropertyValuesToLabels(apiResponse.properties, propertyDefinitions, pipelineStages);
            console.log("Mapped Properties:", JSON.stringify(mappedProperties, null, 2));
        } catch (error) {
            console.error("Error mapping property values to labels:", error.message);
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Error mapping property values to labels" })
            };
        }

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
            console.log(`Response for ${property}:`, JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.error(`Error fetching property definition for ${property}:`, error.message);
            throw error;
        }
    }
    return propertyDefinitions;
}

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


