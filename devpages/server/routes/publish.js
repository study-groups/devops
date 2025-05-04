import express from 'express';
// Use v3 imports
import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand
} from "@aws-sdk/client-s3";
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs'; // Use promises API for async file ops
import { generateStaticHtml } from '../utils/htmlGenerator.js'; // Import the utility

// Helper to derive __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.resolve(__dirname, '../..'); // Project root

// --- Configuration ---
const {
    DO_SPACES_KEY,
    DO_SPACES_SECRET,
    DO_SPACES_ENDPOINT,
    DO_SPACES_BUCKET,
    DO_SPACES_REGION,
    PUBLISH_BASE_URL // Optional base URL for public links
} = process.env;

const REQUIRED_ENV_VARS = [
    'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_ENDPOINT', 'DO_SPACES_BUCKET', 'DO_SPACES_REGION'
];

// --- State File Path ---
const PUBLISHED_STATE_FILE = path.join(projectRootDir, 'data', 'published_files.json'); // Store state in data/

// Ensure data directory exists
fs.mkdir(path.dirname(PUBLISHED_STATE_FILE), { recursive: true }).catch(console.error);

// --- Validation & Initialization ---
const missingEnvVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
    console.error(`[PUBLISH ROUTE] FATAL: Missing required environment variables for DigitalOcean Spaces: ${missingEnvVars.join(', ')}`);
    // Optionally throw an error or exit if critical for server start
    // throw new Error(`Missing DO Spaces environment variables: ${missingEnvVars.join(', ')}`);
}

// Make sure endpoint doesn't include the bucket or protocol
let endpointUrl = DO_SPACES_ENDPOINT;
// Remove protocol if present
if (endpointUrl.startsWith('http://') || endpointUrl.startsWith('https://')) {
    endpointUrl = endpointUrl.replace(/^https?:\/\//, '');
}
// Remove bucket prefix if present (e.g., "devpages.sfo3.digitaloceanspaces.com" -> "sfo3.digitaloceanspaces.com")
if (endpointUrl.startsWith(`${DO_SPACES_BUCKET}.`)) {
    endpointUrl = endpointUrl.replace(`${DO_SPACES_BUCKET}.`, '');
}

console.log(`[PUBLISH] Configuring S3 client with endpoint: ${endpointUrl}, region: ${DO_SPACES_REGION}, bucket: ${DO_SPACES_BUCKET}`);

const s3Client = new S3Client({
    endpoint: `https://${endpointUrl}`,
    region: DO_SPACES_REGION,
    credentials: {
        accessKeyId: DO_SPACES_KEY,
        secretAccessKey: DO_SPACES_SECRET
    },
    // Use path-style URLs to avoid the hostname issues
    forcePathStyle: true
});

const router = express.Router();

// Helper function to generate S3 Key from relative pathname
// We'll prefix with 'published/' to keep them organized
const getS3Key = (pathname) => {
    // Normalize, remove leading/trailing slashes, and ensure it's safe
    const normalized = path.normalize(pathname || '').replace(/\\/g, '/').replace(/^\/|\/$/g, '');
    if (normalized.includes('..') || normalized === '') {
        throw new Error('Invalid pathname for S3 key generation.');
    }
    // Change extension to .html
    const base = normalized.replace(/\.md$/, '');
    return `published/${base}.html`; // Store as HTML
};

// Helper function to generate the public URL
const getPublicUrl = (s3Key) => {
    if (PUBLISH_BASE_URL) {
        // Ensure PUBLISH_BASE_URL doesn't have a trailing slash and key doesn't have a leading one
        const baseUrl = PUBLISH_BASE_URL.replace(/\/$/, '');
        const keyPart = s3Key.replace(/^\//, '');
        if (baseUrl.endsWith(DO_SPACES_BUCKET)) {
             return `${baseUrl.replace(/\/$/, '')}/${keyPart}`;
        } else {
             return `${baseUrl}/${keyPart}`;
        }
    } else {
        // Construct default DO URL
        return `https://${DO_SPACES_BUCKET}.${DO_SPACES_REGION}.digitaloceanspaces.com/${s3Key}`;
    }
};

// --- State Management Helpers ---
async function loadPublishedState() {
    try {
        await fs.access(PUBLISHED_STATE_FILE);
        const data = await fs.readFile(PUBLISHED_STATE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[PUBLISH STATE] State file not found, starting fresh.');
            return {}; // Return empty object if file doesn't exist
        }
        console.error('[PUBLISH STATE] Error loading state:', error);
        throw new Error('Failed to load publish state.'); // Rethrow other errors
    }
}

async function savePublishedState(state) {
    try {
        // Write atomically (to temp then rename) might be better in high concurrency
        await fs.writeFile(PUBLISHED_STATE_FILE, JSON.stringify(state, null, 2));
        console.log('[PUBLISH STATE] State saved successfully.');
    } catch (error) {
        console.error('[PUBLISH STATE] Error saving state:', error);
        // Don't throw here, maybe just log, as the S3 operation might have succeeded
    }
}
// --- End State Management ---

// --- Routes ---

/**
 * GET /api/publish?pathname=...
 * Check if a file is currently published (uses JSON state file).
 */
router.get('/', async (req, res) => {
    const logPrefix = '[GET /api/publish v3]';
    const username = req.user?.username || '[unknown_user]';
    const { pathname } = req.query;

    if (!pathname) {
        return res.status(400).json({ error: 'pathname query parameter is required.' });
    }

    try {
        console.log(`${logPrefix} User='${username}', Checking status for Markdown path='${pathname}'`);

        // 1. Load state from file
        const publishedState = await loadPublishedState();

        // 2. Check if the markdown path exists in the state
        const stateEntry = publishedState[pathname];

        if (stateEntry && stateEntry.url) {
            console.log(`${logPrefix} File found in state. Path='${pathname}', URL='${stateEntry.url}'`);
            // Optional: Verify with HeadObject if desired, but increases latency
            // try {
            //    await s3Client.send(new HeadObjectCommand({ Bucket: DO_SPACES_BUCKET, Key: stateEntry.s3Key }));
            // } catch (s3Error) { ... handle mismatch ... }
            res.json({ isPublished: true, url: stateEntry.url });
        } else {
            console.log(`${logPrefix} File not found in state (not published). Path='${pathname}'`);
            res.json({ isPublished: false, url: null });
        }

    } catch (error) {
        console.error(`${logPrefix} User='${username}', Path='${pathname}'. Error checking publish status:`, error);
        res.status(500).json({ error: `Error checking publish status: ${error.message}` });
    }
});

/**
 * POST /api/publish
 * Publish a file (upload PRE-RENDERED HTML content to DO Spaces).
 * Requires JSON body: { pathname: string, htmlContent: string } <- pathname is original MD path
 */
router.post('/', express.json({ limit: '10mb' }), async (req, res) => { // Keep limit high for HTML
    const logPrefix = '[POST /api/publish v3]';
    const username = req.user?.username || '[unknown_user]';
    // *** Expect htmlContent instead of content ***
    const { pathname, htmlContent } = req.body;

    // *** Update validation check ***
    if (!pathname || htmlContent === undefined) {
        return res.status(400).json({ error: 'pathname (markdown path) and htmlContent (pre-rendered HTML) are required.' });
    }
    if (typeof htmlContent !== 'string') {
         return res.status(400).json({ error: 'htmlContent must be a string.' });
    }

    let s3Key;
    try {
        console.log(`${logPrefix} User='${username}', Publishing pre-rendered HTML for MD path='${pathname}'`);

        // 1. Permission Check (on original markdown file path) - Remains the same
        if (!req.pdata || typeof req.pdata.can !== 'function') { /* ... error handling ... */ }
        const baseDir = req.pdata.dataRoot || req.dataDir;
        if (!baseDir) { /* ... error handling ... */ }
        const absolutePath = path.resolve(baseDir, pathname);
        console.log(`${logPrefix} Checking permission to read source Markdown: ${absolutePath}`);
        const canReadSource = req.pdata.can(username, 'read', absolutePath);
        if (!canReadSource) { /* ... permission denied error ... */ }
        console.log(`${logPrefix} Permission Granted. User='${username}' can read source '${pathname}'.`);

        // 2. *** REMOVE HTML Generation Step ***
        // const generatedHtml = await generateStaticHtml(...); // <<< REMOVE THIS

        // 3. Determine S3 Key for the HTML file - Remains the same
        s3Key = getS3Key(pathname); // Generates published/path/file.html
        console.log(`${logPrefix} Determined S3 Key for HTML: '${s3Key}'`);

        // 4. Upload **RECEIVED HTML** to S3
        console.log(`${logPrefix} Uploading received HTML content (Length: ${htmlContent.length}) to S3 Key: ${s3Key}`);
        const command = new PutObjectCommand({
            Bucket: DO_SPACES_BUCKET,
            Key: s3Key,
            Body: htmlContent, // *** Use htmlContent from request body ***
            ACL: 'public-read',
            ContentType: 'text/html; charset=utf-8',
            CacheControl: 'no-cache'
        });
        await s3Client.send(command);
        const publicUrl = getPublicUrl(s3Key);
        console.log(`${logPrefix} Successfully uploaded received HTML. MD Path='${pathname}', URL='${publicUrl}'`);

        // 5. Update State File - Remains the same
        const publishedState = await loadPublishedState();
        publishedState[pathname] = {
            s3Key: s3Key,
            url: publicUrl,
            publishedAt: new Date().toISOString(),
            publishedBy: username
        };
        await savePublishedState(publishedState);

        // 6. Respond to Client - Remains the same
        res.json({ success: true, url: publicUrl });

    } catch (error) {
        // ... error handling remains the same ...
         if (error.message?.startsWith('Invalid pathname')) { /* ... */ }
         else { /* ... */ }
    }
});

/**
 * DELETE /api/publish
 * Unpublish a file (delete HTML from DO Spaces and update state).
 * Requires JSON body: { pathname: string } <- MARKDOWN pathname
 */
router.delete('/', express.json(), async (req, res) => {
    const logPrefix = '[DELETE /api/publish v3]';
    const username = req.user?.username || '[unknown_user]';
    const { pathname } = req.body; // Markdown pathname to unpublish

    if (!pathname) {
        return res.status(400).json({ error: 'pathname (markdown path) is required in the request body.' });
    }

    let s3Key; // Define outside for logging in catch
    try {
        console.log(`${logPrefix} User='${username}', Unpublishing Markdown path='${pathname}'`);

        // 1. Load State
        const publishedState = await loadPublishedState();
        const stateEntry = publishedState[pathname];

        if (!stateEntry || !stateEntry.s3Key) {
            console.log(`${logPrefix} File not found in state (already unpublished or never published). Path='${pathname}'`);
            return res.status(404).json({ error: 'File not found in published state.' });
        }
        s3Key = stateEntry.s3Key; // Get the HTML S3 key
        console.log(`${logPrefix} Found state entry. HTML S3 Key='${s3Key}'`);

        // 2. Permission Check (Optional but good practice: Check if user *could* read source)
        // This implicitly checks if they likely had permission to publish/unpublish it.
        if (!req.pdata || typeof req.pdata.can !== 'function') {
             console.error(`${logPrefix} Error: req.pdata.can is not available.`);
             return res.status(500).json({ error: 'Server configuration error (PData)' });
        }
        const baseDir = req.pdata.dataRoot || req.dataDir;
        if (!baseDir) return res.status(500).json({ error: 'Server configuration error (Data Dir)' });
        const absolutePath = path.resolve(baseDir, pathname);
        const canReadSource = req.pdata.can(username, 'read', absolutePath);
         if (!canReadSource) {
             console.warn(`${logPrefix} Permission Denied. User='${username}' cannot read source file '${pathname}'. Unpublish denied.`);
             return res.status(403).json({ error: 'Permission denied to manage the publication status of this file.' });
         }
          console.log(`${logPrefix} Permission Granted for managing publish state of '${pathname}'.`);

        // 3. Delete HTML from S3
        console.log(`${logPrefix} Deleting object from S3: Bucket='${DO_SPACES_BUCKET}', Key='${s3Key}'`);
        const command = new DeleteObjectCommand({ Bucket: DO_SPACES_BUCKET, Key: s3Key });
        await s3Client.send(command);
        console.log(`${logPrefix} Successfully deleted object from S3.`);

        // 4. Update State File (Remove entry)
        delete publishedState[pathname];
        await savePublishedState(publishedState);
        console.log(`${logPrefix} Removed entry from state file for '${pathname}'.`);

        // 5. Respond to Client
        res.json({ success: true });

    } catch (error) {
        if (error.message?.startsWith('Invalid pathname')) {
             console.error(`${logPrefix} User='${username}', Invalid pathname='${pathname}'. Error: ${error.message}`);
             res.status(400).json({ error: error.message });
        } else {
            console.error(`${logPrefix} User='${username}', MD Path='${pathname}', S3 Key='${s3Key || 'N/A'}'. Error unpublishing file:`, error);
            res.status(500).json({ error: `Error unpublishing file: ${error.message || error.name}` });
        }
    }
});

export default router;
