const hubspot = require('@hubspot/api-client');

exports.main = async (context) => {
  const hubspotClient = new hubspot.Client({
    accessToken: process.env['PRIVATE_APP_ACCESS_TOKEN'],
  });

  const recordId = context.parameters?.recordId;
  const objectType = context.parameters?.objectType;

  if (!recordId || !objectType) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing required parameters: recordId, objectType" })
    };
  }

  try {
    // Make an API call to delete the record
    await hubspotClient.crm.objects.basicApi.archive(objectType, recordId);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Record deleted successfully" })
    };
  } catch (error) {
    console.error("Error deleting record:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to delete record", error: error.message })
    };
  }
};
