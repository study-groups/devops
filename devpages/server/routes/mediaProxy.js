import dotenv from 'dotenv';
import express from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import grayMatter from 'gray-matter';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Load environment variables
dotenv.config();

const DOCS_BASE_PATH = path.resolve('md'); // Assuming md/ is at the project root

// --- Configuration (Use DO_SPACES_ prefix to match rest of codebase) ---
const SPACES_ENDPOINT = process.env.DO_SPACES_ENDPOINT; // e.g., 'sfo3.digitaloceanspaces.com'
const SPACES_REGION = process.env.DO_SPACES_REGION;     // e.g., 'sfo3'
const SPACES_BUCKET = process.env.DO_SPACES_BUCKET;   // Your Spaces bucket name
const SPACES_KEY = process.env.DO_SPACES_KEY;
const SPACES_SECRET = process.env.DO_SPACES_SECRET;

// Basic validation of configuration (non-fatal - spaces are optional)
if (!SPACES_ENDPOINT || !SPACES_REGION || !SPACES_BUCKET || !SPACES_KEY || !SPACES_SECRET) {
    console.warn('[Media Proxy] Spaces configuration missing in environment variables. Media proxy features disabled.');
    // Spaces features will be disabled but server continues
}

// Initialize S3 client only if configuration is complete
let s3Client = null;
if (SPACES_ENDPOINT && SPACES_REGION && SPACES_KEY && SPACES_SECRET) {
    try {
        s3Client = new S3Client({
            region: SPACES_REGION,
            endpoint: SPACES_ENDPOINT,
            credentials: {
                accessKeyId: SPACES_KEY,
                secretAccessKey: SPACES_SECRET,
            },
        });
        console.log('[Media Proxy] S3 client initialized successfully');
    } catch (error) {
        console.error('[Media Proxy] Failed to initialize S3 client:', error);
    }
}

// --- Helper Functions ---

// Checks if a user meets the permissions defined in front matter
function checkPermissions(user, permissions) {
    if (!permissions) {
        // Default: If no permissions specified, allow any authenticated user
        // Change this default if needed (e.g., return false to deny by default)
        return true;
    }

    // Check against specific users
    if (permissions.users && permissions.users.includes(user.username)) { // Assumes user object has username
        return true;
    }

    // Check against roles (assuming user object has a roles array)
    if (permissions.roles && user.roles && user.roles.some(role => permissions.roles.includes(role))) {
        return true;
    }

    // Deny if none of the checks passed
    return false;
}

// --- Route Handler ---
router.get('/', authMiddleware, async (req, res) => {
    const { path: mediaKey, context: contextPath } = req.query;
    const user = req.auth; // User info attached by authMiddleware (adjust property names if needed)

    console.log(`[MEDIA PROXY] Request: User=${user?.name || 'anon'}, MediaKey=${mediaKey}, Context=${contextPath}`);

    // 1. Validate input
    if (!mediaKey || !contextPath) {
        return res.status(400).send('Missing required query parameters: path and context.');
    }
    if (!user) {
        // Should be caught by authMiddleware, but double-check
        return res.status(401).send('Authentication required.');
    }
    if (!s3Client) {
        return res.status(503).send('Media proxy service unavailable: Spaces configuration not complete.');
    }

    // Construct absolute path to the markdown file
    const markdownFilePath = path.resolve(DOCS_BASE_PATH, contextPath);
    console.log(`[MEDIA PROXY] Reading context file: ${markdownFilePath}`);

    try {
        // 2. Read and parse the markdown file
        const fileContent = await fs.readFile(markdownFilePath, 'utf8');
        const { data: frontMatter } = grayMatter(fileContent);
        const permissions = frontMatter.permissions;

        console.log(`[MEDIA PROXY] Parsed permissions for ${contextPath}:`, permissions);

        // 3. Check authorization based on front matter
        const isAuthorized = checkPermissions(user, permissions);

        if (!isAuthorized) {
            console.log(`[MEDIA PROXY] User ${user.name} denied access to ${mediaKey} based on context ${contextPath}`);
            return res.status(403).send('Forbidden: You do not have permission to access this media based on the document context.');
        }

        console.log(`[MEDIA PROXY] User ${user.name} authorized for ${mediaKey}`);

        // 4. Fetch the object from Spaces
        // Construct the object key for Spaces. Assuming mediaKey is relative to the bucket root.
        // If mediaKey is like './uploads/media/file.mp3', remove './'
        const objectKey = mediaKey.startsWith('./') ? mediaKey.substring(2) : mediaKey;
        console.log(`[MEDIA PROXY] Fetching from Spaces: Bucket=${SPACES_BUCKET}, Key=${objectKey}`);

        const getObjectParams = {
            Bucket: SPACES_BUCKET,
            Key: objectKey
        };
        const command = new GetObjectCommand(getObjectParams);
        const s3Response = await s3Client.send(command);

        // 5. Stream the object back to the client
        res.setHeader('Content-Type', s3Response.ContentType || 'application/octet-stream');
        if (s3Response.ContentLength) {
            res.setHeader('Content-Length', s3Response.ContentLength);
        }
        // Add other headers if needed (e.g., Cache-Control)

        // Ensure the body is a readable stream
        if (s3Response.Body && typeof s3Response.Body.pipe === 'function') {
             console.log(`[MEDIA PROXY] Streaming ${objectKey} to client.`);
             s3Response.Body.pipe(res);
        } else {
            throw new Error('S3 response body is not a readable stream.');
        }

    } catch (error) {
        console.error(`[MEDIA PROXY] Error processing request:`, error);

        if (error.code === 'ENOENT') {
            return res.status(404).send('Context markdown file not found.');
        }
        if (error.name === 'NoSuchKey') {
            return res.status(404).send('Media file not found in storage.');
        }
        if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
             return res.status(500).send('Server access denied fetching media from storage.'); // Avoid leaking info
        }
        // Generic error
        return res.status(500).send('Internal Server Error processing media request.');
    }
});

export default router; 