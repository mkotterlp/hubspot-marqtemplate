const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://info.marq.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.main = async (context, { logger, contactId, fileBuffer, fileName, fileType }) => {
    const apiKey = context.secrets.Marqsaveback_API_KEY;

    if (context.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: corsHeaders
        };
    }

    try {
        logger.info("Starting file upload process");
        let formData = new FormData();
        formData.append('file', fileBuffer, fileName);
        const uploadResponse = await axios.post('https://api.hubapi.com/files/v3/files', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${apiKey}`
            }
        });

        logger.debug(`Upload response: ${JSON.stringify(uploadResponse.data)}`);
        const hsAttachmentId = uploadResponse.data.objects[0].id;
        logger.info(`Attachment ID: ${hsAttachmentId}`);

        const noteBody = {
            "properties": {
                "hs_timestamp": new Date().getTime(),
                "hs_note_body": `File ${fileName} attached.`,
                "hs_attachment_ids": `${hsAttachmentId}`
            }
        };

        const noteResponse = await axios.post('https://api.hubapi.com/crm/v3/objects/notes', noteBody, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        logger.debug(`Note response: ${JSON.stringify(noteResponse.data)}`);
        const noteId = noteResponse.data.id;
        logger.info(`Note ID: ${noteId}`);

        const associationResponse = await axios.put(
            `https://api.hubapi.com/crm/v3/objects/notes/${noteId}/associations/contact/${contactId}/note_to_contact`, 
            {},
            { headers: {'Authorization': `Bearer ${apiKey}`} }
        );

        logger.debug(`Association response: ${JSON.stringify(associationResponse.data)}`);
        
        return { 
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'SUCCESS', noteId: noteId })
        };
    } catch ( error ) {
        logger.error(`An error occurred: ${error.message}`);
        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'An error occurred during the upload process' })
        };
    }
};
