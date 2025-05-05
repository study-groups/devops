import express from 'express';
import path from 'path'; // Still potentially useful for input checks maybe?
// --- ADD S3 SDK Imports --- 
import { PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const router = express.Router();
console.log('[DEBUG spaces.js] Router module loaded and router object created.');

// --- NEW: Endpoint to get public Spaces configuration ---
router.get('/config', (req, res) => {
    // Note: Add authentication/authorization if this info is sensitive
    try {
        // Return both the expected var name and its value (or fallback)
        const config = {
            endpointVar: 'DO_SPACES_ENDPOINT',
            endpointValue: process.env.DO_SPACES_ENDPOINT || 'Not Set',
            regionVar: 'DO_SPACES_REGION',
            regionValue: process.env.DO_SPACES_REGION || 'Not Set',
            bucketVar: 'DO_SPACES_BUCKET',
            bucketValue: process.env.DO_SPACES_BUCKET || 'Not Set',
            publishBaseUrlVar: 'PUBLISH_BASE_URL',
            publishBaseUrlValue: process.env.PUBLISH_BASE_URL || 'Not Set'
        };
        res.json({ success: true, config });
    } catch (error) {
        console.error('[API /api/spaces/config] Error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve Spaces configuration' });
    }
});
// --- END NEW --- 

// --- NEW: Endpoint to list bucket contents ---
router.get('/list-bucket', async (req, res) => {
    const s3Client = req.s3Client; // Get client from request
    if (!s3Client) {
        return res.status(500).json({ success: false, message: 'S3 client not initialized' });
    }

    const { bucket, prefix } = req.query; // Get bucket and optional prefix from query params
    const logPrefix = '[Spaces ListBucket]';

    if (!bucket) {
        console.error(`${logPrefix} Error: Bucket name is required.`);
        return res.status(400).json({ success: false, message: 'Bucket name is required' });
    }

    console.log(`${logPrefix} Attempting to list contents for bucket: '${bucket}', Prefix: '${prefix || 'None'}'`);

    try {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix || undefined, // Use prefix if provided
            Delimiter: '/' // Add delimiter to group by folder
        });

        const response = await s3Client.send(command);

        // Extract common prefixes (simulating folders)
        const commonPrefixes = response.CommonPrefixes ? response.CommonPrefixes.map(item => item.Prefix) : [];
        // Extract object keys (files at this level)
        // Filter out the prefix itself if it appears as a key (sometimes happens for empty "folders")
        const objectKeys = response.Contents ? response.Contents.filter(item => item.Key !== prefix).map(item => item.Key) : [];

        // Combine and sort for a unified view
        const combinedList = [...commonPrefixes, ...objectKeys].sort();

        console.log(`${logPrefix} Successfully listed contents for bucket '${bucket}' (Prefix: ${prefix || 'None'}). Found ${commonPrefixes.length} prefixes and ${objectKeys.length} objects.`);

        res.json({ success: true, keys: combinedList }); // Send combined and sorted list

    } catch (error) {
        console.error(`${logPrefix} Error listing bucket contents for bucket '${bucket}':`, error);
        res.status(500).json({ success: false, message: `Error listing bucket contents: ${error.message || error.name}` });
    }
});
// --- END NEW LIST BUCKET ROUTE ---

// --- Route Definition --- 
// POST /api/spaces/presigned-url
router.post('/presigned-url', express.json(), async (req, res) => {
    const logPrefix = '[API /spaces/presigned-url]';
    console.log(`${logPrefix} Received request. Body:`, req.body);

    // --- Get User and Services from Request --- 
    const username = req.user?.username;
    if (!username) {
        console.error(`${logPrefix} User not found on request object after authMiddleware.`);
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const pdata = req.pdata;
    const s3Client = req.s3Client; // Get the single client instance

    if (!pdata) {
        console.error(`${logPrefix} PData instance not found on request object.`);
        return res.status(500).json({ success: false, error: 'Internal Server Error: PData not configured.' });
    }
    if (!s3Client) {
        console.error(`${logPrefix} S3 client instance not found on request object. S3 features disabled.`);
        return res.status(501).json({ success: false, error: 'S3 functionality is not configured on the server.' });
    }

    // --- Extract Parameters (No spaceName needed) --- 
    const { operation, bucket, key, contentType, expiresIn } = req.body;

    // --- Validate Core Parameters --- 
    if (!operation || !bucket || !key) {
        return res.status(400).json({ success: false, error: 'Missing required fields: operation, bucket, key' });
    }

    // --- Security: Basic Key Sanitization --- 
    const normalizedKey = path.normalize(key).replace(/^(\.\.(?:\/|\\|$))+/, '');
    if (normalizedKey !== key || key.includes('..')) {
         console.warn(`${logPrefix} Potential path traversal detected in key: ${key}`);
         return res.status(400).json({ success: false, error: 'Invalid key format.' });
    }
    
    // --- AUTHORIZATION CHECK (CRUCIAL) --- 
    // TODO: Implement logic here to check if 'username' has permission
    //       to perform 'operation' on 'bucket'/'normalizedKey'.
    //       This might involve checking user roles via pdata.getUserRole(username)
    //       or looking up permissions based on bucket/slug/key patterns.
    //       Example: 
    //       if (!pdata.canAccessBucket(username, bucket, operation, normalizedKey)) { 
    //           return res.status(403).json({ success: false, error: 'Forbidden' });
    //       }
    console.log(`${logPrefix} Authorization check placeholder PASSED for user '${username}' on bucket '${bucket}'. Implement real checks!`);
    // -------------------------------------

    try {
        // Determine S3 command and HTTP method
        let command;
        let requestMethod;
        const options = {};
        if (contentType) options.contentType = contentType;
        const expirySeconds = expiresIn ? parseInt(expiresIn, 10) : 300;

        if (operation === 'putObject') {
            command = new PutObjectCommand({
                Bucket: bucket,
                Key: normalizedKey,
                ContentType: options.contentType || 'application/octet-stream',
                // ACL: 'public-read', // Optional
            });
            requestMethod = 'PUT';
        } else if (operation === 'getObject') {
            command = new GetObjectCommand({
                Bucket: bucket,
                Key: normalizedKey,
            });
            requestMethod = 'GET';
        } else {
            return res.status(400).json({ success: false, error: 'Invalid operation specified. Use "putObject" or "getObject".' });
        }

        // Generate the pre-signed URL using the single client
        const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: expirySeconds,
        });

        console.log(`${logPrefix} Successfully generated pre-signed URL for ${operation} on ${bucket}/${normalizedKey}`);
        
        // Return the successful result
        res.json({
            success: true,
            url: signedUrl,
            method: requestMethod,
            key: normalizedKey,
            expiresIn: expirySeconds
        });

    } catch (error) {
        console.error(`${logPrefix} Error generating pre-signed URL:`, error);
        // Return a user-friendly error
        res.status(500).json({ success: false, error: 'Failed to generate pre-signed URL.' });
    }
});

export default router; 