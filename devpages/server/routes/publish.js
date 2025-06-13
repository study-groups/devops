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

// --- Validation & Initialization ---
const missingEnvVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
    console.error(`[PUBLISH ROUTE] FATAL: Missing required environment variables for DigitalOcean Spaces: ${missingEnvVars.join(', ')}`);
    throw new Error(`Missing DO Spaces environment variables: ${missingEnvVars.join(', ')}`);
}

// Simple S3 client configuration
const s3Client = new S3Client({
    endpoint: DO_SPACES_ENDPOINT,
    region: DO_SPACES_REGION,
    credentials: {
        accessKeyId: DO_SPACES_KEY,
        secretAccessKey: DO_SPACES_SECRET
    },
    forcePathStyle: false
});

const router = express.Router();

// Helper function to get the state file path for a given file's directory
const getStateFilePath = (filePath) => {
    const dir = path.dirname(filePath);
    return path.join(dir, '.publish_state.json');
};

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
    let baseUrl;
    
    if (PUBLISH_BASE_URL) {
        baseUrl = PUBLISH_BASE_URL.replace(/\/$/, '');
    } else {
        // Auto-construct CDN URL from bucket and region for better performance
        baseUrl = `https://${DO_SPACES_BUCKET}.${DO_SPACES_REGION}.cdn.digitaloceanspaces.com`;
    }
    
    const keyPart = s3Key.replace(/^\//, '');
    return `${baseUrl}/${keyPart}`;
};

// --- PData State Management Helpers ---
async function loadPublishedState(req, filePath) {
    try {
        const stateFilePath = getStateFilePath(filePath);
        const username = req.user?.username || '[unknown_user]';
        
        try {
            // Use PData to read the state file
            const stateContent = await req.pdata.readFile(username, stateFilePath);
            return JSON.parse(stateContent);
        } catch (error) {
            if (error.message.includes('not found') || error.message.includes('ENOENT')) {
                return {}; // Return empty object if file doesn't exist
            }
            throw error;
        }
    } catch (error) {
        console.error('[PUBLISH STATE] Error loading state:', error);
        return {}; // Return empty object on any error
    }
}

async function savePublishedState(req, filePath, state) {
    try {
        const stateFilePath = getStateFilePath(filePath);
        const username = req.user?.username || '[unknown_user]';
        
        // Use PData to write the state file
        await req.pdata.writeFile(username, stateFilePath, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('[PUBLISH STATE] Error saving state:', error);
        // Don't throw here, as the S3 operation might have succeeded
    }
}

// --- Routes ---

/**
 * GET /api/publish?pathname=...
 * Check if a file is currently published (uses PData state files).
 */
router.get('/', async (req, res) => {
    const username = req.user?.username || '[unknown_user]';
    const { pathname } = req.query;

    if (!pathname) {
        return res.status(400).json({ error: 'pathname query parameter is required.' });
    }

    try {
        // 1. Load state from PData
        const publishedState = await loadPublishedState(req, pathname);

        // 2. Check if the markdown path exists in the state
        const stateEntry = publishedState[pathname];

        if (stateEntry && stateEntry.url) {
            res.json({ isPublished: true, url: stateEntry.url });
        } else {
            res.json({ isPublished: false, url: null });
        }

    } catch (error) {
        console.error(`Error checking publish status for ${pathname}:`, error);
        res.status(500).json({ error: `Error checking publish status: ${error.message}` });
    }
});

/**
 * POST /api/publish
 * Publish a file (upload PRE-RENDERED HTML content to DO Spaces).
 */
router.post('/', express.json({ limit: '10mb' }), async (req, res) => {
    const startTime = Date.now();
    
    try {
        const username = req.user?.username || '[unknown_user]';
        const { pathname, htmlContent } = req.body;

        if (!pathname || htmlContent === undefined) {
            return res.status(400).json({ error: 'pathname and htmlContent are required.' });
        }
        if (typeof htmlContent !== 'string') {
            return res.status(400).json({ error: 'htmlContent must be a string.' });
        }

        // Permission check
        if (!req.pdata || typeof req.pdata.can !== 'function') {
            return res.status(500).json({ error: 'Permission system not available.' });
        }
        
        const baseDir = req.pdata.dataRoot || req.dataDir;
        if (!baseDir) {
            return res.status(500).json({ error: 'Data directory not configured.' });
        }
        
        const absolutePath = path.resolve(baseDir, pathname);
        const canReadSource = req.pdata.can(username, 'read', absolutePath);
        if (!canReadSource) {
            return res.status(403).json({ error: `Permission denied. User '${username}' cannot read source file: ${pathname}` });
        }

        // Generate S3 key
        const s3Key = getS3Key(pathname);

        // Upload to DO Spaces
        const putCommand = new PutObjectCommand({
            Bucket: DO_SPACES_BUCKET,
            Key: s3Key,
            Body: htmlContent,
            ContentType: 'text/html; charset=utf-8',
            CacheControl: 'public, max-age=3600',
            ACL: 'public-read'
        });

        await s3Client.send(putCommand);

        // Generate public URL
        const publicUrl = getPublicUrl(s3Key);

        // Update state using PData
        const publishedState = await loadPublishedState(req, pathname);
        publishedState[pathname] = {
            s3Key,
            url: publicUrl,
            publishedAt: new Date().toISOString(),
            publishedBy: username
        };
        await savePublishedState(req, pathname, publishedState);

        const processingTime = Date.now() - startTime;
        console.log(`[PUBLISH] Successfully published ${pathname} to ${publicUrl} in ${processingTime}ms`);
        
        res.json({
            success: true,
            url: publicUrl,
            s3Key,
            processingTime
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('Publish error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            processingTime
        });
    }
});

// Helper function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

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

        // 1. Load State using PData
        const publishedState = await loadPublishedState(req, pathname);
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

        // 4. Update State File using PData
        delete publishedState[pathname];
        await savePublishedState(req, pathname, publishedState);
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
