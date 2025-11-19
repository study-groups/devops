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
    PUBLISH_BASE_URL
} = process.env;

const REQUIRED_ENV_VARS = [
    'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_ENDPOINT', 'DO_SPACES_BUCKET', 'DO_SPACES_REGION'
];

// --- Validation & Initialization ---
const missingEnvVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
    console.error(`[PUBLISH ROUTE] FATAL: Missing required environment variables for DigitalOcean Spaces: ${missingEnvVars.join(', ')}`);
    // throw new Error(`Missing DO Spaces environment variables: ${missingEnvVars.join(', ')}`);
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

// Helper function to get the context state file path
const getContextStateFilePath = (filePath) => {
    const dir = path.dirname(filePath);
    return path.join(dir, '.context_state.json');
};

// Helper function to get the context directory path
const getContextPath = (filePath, contextName) => {
    const projectRootDir = path.resolve(__dirname, '../..');
    const contextDir = path.join(projectRootDir, 'notepads', 'context', contextName);
    return contextDir;
};

// Helper function to get context file path
const getContextFilePath = (filePath, contextName) => {
    const filename = path.basename(filePath, '.md') + '.md';
    return path.join(getContextPath('', contextName), filename);
};

// Load context published state
async function loadContextPublishedState(req, filePath) {
    try {
        const stateFilePath = getContextStateFilePath(filePath);
        const username = req.user?.username || '[unknown_user]';
        
        const stateContent = await req.pdata.readFile(username, stateFilePath);
        return JSON.parse(stateContent);
    } catch (error) {
        // File doesn't exist or other error, return empty state
        return {};
    }
}

// Save context published state
async function saveContextPublishedState(req, filePath, state) {
    try {
        const stateFilePath = getContextStateFilePath(filePath);
        const username = req.user?.username || '[unknown_user]';
        
        await req.pdata.writeFile(username, stateFilePath, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('[CONTEXT PUBLISH STATE] Error saving state:', error);
        // Don't throw here, as the context operation might have succeeded
    }
}

// --- Routes ---

/**
 * GET /api/publish/context/list
 * Get a list of all available publishing contexts (subdirectories in notepads/context).
 */
router.get('/context/list', async (req, res) => {
    try {
        const contextBasePath = path.join(projectRootDir, 'notepads', 'context');
        const fs = await import('fs/promises');
        
        const dirents = await fs.readdir(contextBasePath, { withFileTypes: true });
        
        const contextNames = dirents
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
            
        res.json({ contexts: contextNames });
    } catch (error) {
        console.error('[API /context/list] Error listing context directories:', error);
        // If the directory doesn't exist, return an empty list gracefully
        if (error.code === 'ENOENT') {
            return res.json({ contexts: [] });
        }
        res.status(500).json({ error: 'Failed to retrieve publish contexts.' });
    }
});

/**
 * GET /api/publish/context/:contextName/files
 * List files in a specific context
 */
router.get('/context/:contextName/files', async (req, res) => {
    try {
        const { contextName } = req.params;
        
        if (!contextName || !/^[a-zA-Z0-9_-]+$/.test(contextName)) {
            return res.status(400).json({ error: 'Invalid context name' });
        }

        const contextDir = getContextPath('', contextName);
        const fs = await import('fs/promises');
        
        try {
            const entries = await fs.readdir(contextDir, { withFileTypes: true });
            const files = [];
            
            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.md')) {
                    const filePath = path.join(contextDir, entry.name);
                    const stats = await fs.stat(filePath);
                    const content = await fs.readFile(filePath, 'utf8');
                    
                    files.push({
                        name: entry.name,
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
                        lineCount: content.split('\n').length,
                        preview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
                    });
                }
            }
            
            // Sort by modification date, newest first
            files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
            
            res.json({ 
                success: true, 
                contextName,
                files,
                totalFiles: files.length 
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json({ 
                    success: true, 
                    contextName,
                    files: [],
                    totalFiles: 0 
                });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('[CONTEXT FILES] Error listing context files:', error);
        res.status(500).json({ error: 'Failed to list context files' });
    }
});


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
 * Supports custom S3 configuration via config object in request body.
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();

    try {
        const username = req.user?.username || '[unknown_user]';
        const { pathname, htmlContent, config } = req.body;

        console.log('[PUBLISH] Received request:', {
            pathname,
            htmlContentLength: htmlContent?.length,
            hasConfig: !!config,
            configKeys: config ? Object.keys(config) : [],
            configBucket: config?.bucket,
            configEndpoint: config?.endpoint
        });

        if (!pathname || htmlContent === undefined) {
            return res.status(400).json({ error: 'pathname and htmlContent are required.' });
        }
        if (typeof htmlContent !== 'string') {
            return res.status(400).json({ error: 'htmlContent must be a string.' });
        }

        // Use custom config if provided, otherwise fall back to environment variables
        const s3Config = config || {
            endpoint: DO_SPACES_ENDPOINT,
            region: DO_SPACES_REGION,
            bucket: DO_SPACES_BUCKET,
            accessKey: DO_SPACES_KEY,
            secretKey: DO_SPACES_SECRET,
            prefix: 'published/',
            baseUrl: PUBLISH_BASE_URL
        };

        console.log('[PUBLISH] Using S3 config:', {
            endpoint: s3Config.endpoint,
            region: s3Config.region,
            bucket: s3Config.bucket,
            prefix: s3Config.prefix,
            hasAccessKey: !!s3Config.accessKey,
            hasSecretKey: !!s3Config.secretKey
        });

        // Permission check - user must be authenticated (handled by authMiddleware)
        // Additional file-level permissions can be added here if needed
        if (!req.pdata) {
            return res.status(500).json({ error: 'PData system not available.' });
        }

        // Generate S3 key using custom prefix if provided
        const normalized = path.normalize(pathname || '').replace(/\\/g, '/').replace(/^\/|\/$/g, '');
        if (normalized.includes('..') || normalized === '') {
            return res.status(400).json({ error: 'Invalid pathname for S3 key generation.' });
        }
        const base = normalized.replace(/\.md$/, '');
        const prefix = s3Config.prefix || 'published/';
        const s3Key = `${prefix}${base}.html`;

        // Create S3 client with custom config if credentials provided
        const clientToUse = (s3Config.accessKey && s3Config.secretKey)
            ? (() => {
                // Parse endpoint to ensure it doesn't include the bucket name
                // Correct format: https://sfo3.digitaloceanspaces.com
                // Incorrect format: https://bucket.sfo3.digitaloceanspaces.com
                let cleanEndpoint = s3Config.endpoint;
                try {
                    const url = new URL(s3Config.endpoint);
                    const hostname = url.hostname;

                    // Check if hostname starts with bucket name (e.g., "devpages.sfo3.digitaloceanspaces.com")
                    // Extract region-based endpoint (e.g., "sfo3.digitaloceanspaces.com")
                    const parts = hostname.split('.');
                    if (parts.length > 3 && parts[parts.length - 3] === s3Config.region) {
                        // Rebuild URL without bucket prefix
                        const regionalHost = parts.slice(-3).join('.');
                        url.hostname = regionalHost;
                        cleanEndpoint = url.toString().replace(/\/$/, ''); // Remove trailing slash
                        console.log(`[PUBLISH] Cleaned endpoint from ${s3Config.endpoint} to ${cleanEndpoint}`);
                    }
                } catch (error) {
                    console.warn('[PUBLISH] Could not parse endpoint URL, using as-is:', error.message);
                }

                return new S3Client({
                    endpoint: cleanEndpoint,
                    region: s3Config.region,
                    credentials: {
                        accessKeyId: s3Config.accessKey,
                        secretAccessKey: s3Config.secretKey
                    },
                    forcePathStyle: false
                });
            })()
            : s3Client; // Use default client if no custom credentials

        // Upload to S3/Spaces
        const putCommand = new PutObjectCommand({
            Bucket: s3Config.bucket,
            Key: s3Key,
            Body: htmlContent,
            ContentType: 'text/html; charset=utf-8',
            CacheControl: 'public, max-age=3600',
            ACL: 'public-read'
        });

        await clientToUse.send(putCommand);

        // Generate public URL using custom baseUrl if provided
        let publicUrl;
        if (s3Config.baseUrl) {
            const baseUrl = s3Config.baseUrl.replace(/\/$/, '');
            const keyPart = s3Key.replace(/^\//, '');
            publicUrl = `${baseUrl}/${keyPart}`;
        } else {
            // Auto-construct CDN URL from bucket and region
            const baseUrl = `https://${s3Config.bucket}.${s3Config.region}.cdn.digitaloceanspaces.com`;
            const keyPart = s3Key.replace(/^\//, '');
            publicUrl = `${baseUrl}/${keyPart}`;
        }

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
 * Requires JSON body: { pathname: string, config?: object } <- MARKDOWN pathname and optional custom config
 */
router.delete('/', express.json(), async (req, res) => {
    const logPrefix = '[DELETE /api/publish v3]';
    const username = req.user?.username || '[unknown_user]';
    const { pathname, config } = req.body; // Markdown pathname to unpublish and optional custom config

    if (!pathname) {
        return res.status(400).json({ error: 'pathname (markdown path) is required in the request body.' });
    }

    let s3Key; // Define outside for logging in catch
    try {
        console.log(`${logPrefix} User='${username}', Unpublishing Markdown path='${pathname}', hasConfig=${!!config}`);

        // 1. Load State using PData
        const publishedState = await loadPublishedState(req, pathname);
        const stateEntry = publishedState[pathname];

        if (!stateEntry || !stateEntry.s3Key) {
            console.log(`${logPrefix} File not found in state (already unpublished or never published). Path='${pathname}'`);
            return res.status(404).json({ error: 'File not found in published state.' });
        }
        s3Key = stateEntry.s3Key; // Get the HTML S3 key
        console.log(`${logPrefix} Found state entry. HTML S3 Key='${s3Key}'`);

        // 2. Permission Check - user must be authenticated (handled by authMiddleware)
        if (!req.pdata) {
             console.error(`${logPrefix} Error: req.pdata is not available.`);
             return res.status(500).json({ error: 'Server configuration error (PData)' });
        }
        console.log(`${logPrefix} Permission granted for managing publish state of '${pathname}'.`);

        // Use custom config if provided, otherwise fall back to environment variables
        const s3Config = config || {
            endpoint: DO_SPACES_ENDPOINT,
            region: DO_SPACES_REGION,
            bucket: DO_SPACES_BUCKET,
            accessKey: DO_SPACES_KEY,
            secretKey: DO_SPACES_SECRET
        };

        // Create S3 client with custom config if credentials provided
        const clientToUse = (s3Config.accessKey && s3Config.secretKey)
            ? (() => {
                // Parse endpoint to ensure it doesn't include the bucket name
                // Correct format: https://sfo3.digitaloceanspaces.com
                // Incorrect format: https://bucket.sfo3.digitaloceanspaces.com
                let cleanEndpoint = s3Config.endpoint;
                try {
                    const url = new URL(s3Config.endpoint);
                    const hostname = url.hostname;

                    // Check if hostname starts with bucket name (e.g., "devpages.sfo3.digitaloceanspaces.com")
                    // Extract region-based endpoint (e.g., "sfo3.digitaloceanspaces.com")
                    const parts = hostname.split('.');
                    if (parts.length > 3 && parts[parts.length - 3] === s3Config.region) {
                        // Rebuild URL without bucket prefix
                        const regionalHost = parts.slice(-3).join('.');
                        url.hostname = regionalHost;
                        cleanEndpoint = url.toString().replace(/\/$/, ''); // Remove trailing slash
                        console.log(`${logPrefix} Cleaned endpoint from ${s3Config.endpoint} to ${cleanEndpoint}`);
                    }
                } catch (error) {
                    console.warn(`${logPrefix} Could not parse endpoint URL, using as-is:`, error.message);
                }

                return new S3Client({
                    endpoint: cleanEndpoint,
                    region: s3Config.region,
                    credentials: {
                        accessKeyId: s3Config.accessKey,
                        secretAccessKey: s3Config.secretKey
                    },
                    forcePathStyle: false
                });
            })()
            : s3Client; // Use default client if no custom credentials

        // 3. Delete HTML from S3
        console.log(`${logPrefix} Deleting object from S3: Bucket='${s3Config.bucket}', Key='${s3Key}'`);
        const command = new DeleteObjectCommand({ Bucket: s3Config.bucket, Key: s3Key });
        await clientToUse.send(command);
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

/**
 * POST /api/publish/context
 * Publish a file to context directory for Cursor AI consumption
 */
router.post('/context', express.json({ limit: '10mb' }), async (req, res) => {
    const startTime = Date.now();
    
    try {
        const username = req.user?.username || '[unknown_user]';
        const { pathname, contextName, markdownContent } = req.body;

        if (!pathname || !contextName || markdownContent === undefined) {
            return res.status(400).json({ error: 'pathname, contextName, and markdownContent are required.' });
        }
        if (typeof markdownContent !== 'string') {
            return res.status(400).json({ error: 'markdownContent must be a string.' });
        }
        if (typeof contextName !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(contextName)) {
            return res.status(400).json({ error: 'contextName must be a valid identifier (alphanumeric, underscore, hyphen only).' });
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

        // Ensure context directory exists
        const contextDir = getContextPath('', contextName);
        const fs = await import('fs/promises');
        await fs.mkdir(contextDir, { recursive: true });

        // Write to context directory
        const contextFilePath = getContextFilePath(pathname, contextName);
        await fs.writeFile(contextFilePath, markdownContent, 'utf8');

        // Update context state
        const contextState = await loadContextPublishedState(req, pathname);
        contextState[pathname] = {
            contextName,
            contextPath: contextFilePath,
            publishedAt: new Date().toISOString(),
            publishedBy: username
        };
        await saveContextPublishedState(req, pathname, contextState);

        const processingTime = Date.now() - startTime;
        console.log(`[CONTEXT PUBLISH] Successfully published ${pathname} to context '${contextName}' in ${processingTime}ms`);
        
        res.json({
            success: true,
            contextName,
            contextPath: contextFilePath,
            processingTime
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('Context publish error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            processingTime
        });
    }
});

/**
 * DELETE /api/publish/context
 * Remove a file from context directory
 */
router.delete('/context', express.json(), async (req, res) => {
    const logPrefix = '[DELETE /api/publish/context]';
    const username = req.user?.username || '[unknown_user]';
    const { pathname, contextName } = req.body;

    if (!pathname || !contextName) {
        return res.status(400).json({ error: 'pathname and contextName are required in the request body.' });
    }

    try {
        console.log(`${logPrefix} User='${username}', Unpublishing from context '${contextName}', path='${pathname}'`);

        // Load context state
        const contextState = await loadContextPublishedState(req, pathname);
        const stateEntry = contextState[pathname];

        if (!stateEntry || stateEntry.contextName !== contextName) {
            console.log(`${logPrefix} File not found in context state or context mismatch.`);
            return res.status(404).json({ error: 'File not found in context state.' });
        }

        // Delete from context directory
        const contextFilePath = getContextFilePath(pathname, contextName);
        const fs = await import('fs/promises');
        
        try {
            await fs.unlink(contextFilePath);
            console.log(`${logPrefix} Successfully deleted file from context directory.`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error; // Re-throw if it's not a "file not found" error
            }
            console.log(`${logPrefix} File already deleted from context directory.`);
        }

        // Update context state
        delete contextState[pathname];
        await saveContextPublishedState(req, pathname, contextState);

        res.json({ success: true });

    } catch (error) {
        console.error(`${logPrefix} Error unpublishing from context:`, error);
        res.status(500).json({ error: `Error unpublishing from context: ${error.message}` });
    }
});

/**
 * GET /api/publish/context/:contextName/file/:fileName
 * Get specific file content from context
 */
router.get('/context/:contextName/file/:fileName', async (req, res) => {
    try {
        const { contextName, fileName } = req.params;
        
        if (!contextName || !/^[a-zA-Z0-9_-]+$/.test(contextName)) {
            return res.status(400).json({ error: 'Invalid context name' });
        }
        
        if (!fileName || !fileName.endsWith('.md')) {
            return res.status(400).json({ error: 'Invalid file name' });
        }

        const contextDir = getContextPath('', contextName);
        const filePath = path.join(contextDir, fileName);
        const fs = await import('fs/promises');
        
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const stats = await fs.stat(filePath);
            
            res.json({ 
                success: true, 
                contextName,
                fileName,
                content,
                size: stats.size,
                modified: stats.mtime.toISOString()
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ error: 'File not found in context' });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('[CONTEXT FILE] Error getting context file:', error);
        res.status(500).json({ error: 'Failed to get context file' });
    }
});

/**
 * DELETE /api/publish/context/:contextName/file/:fileName
 * Delete specific file from context
 */
router.delete('/context/:contextName/file/:fileName', async (req, res) => {
    try {
        const { contextName, fileName } = req.params;
        const username = req.user?.username || '[unknown_user]';
        
        if (!contextName || !/^[a-zA-Z0-9_-]+$/.test(contextName)) {
            return res.status(400).json({ error: 'Invalid context name' });
        }
        
        if (!fileName || !fileName.endsWith('.md')) {
            return res.status(400).json({ error: 'Invalid file name' });
        }

        const contextDir = getContextPath('', contextName);
        const filePath = path.join(contextDir, fileName);
        const fs = await import('fs/promises');
        
        try {
            await fs.unlink(filePath);
            console.log(`[CONTEXT DELETE] Successfully deleted ${fileName} from context ${contextName} by ${username}`);
            
            res.json({ 
                success: true, 
                message: `File ${fileName} deleted from context ${contextName}`
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ error: 'File not found in context' });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('[CONTEXT DELETE] Error deleting context file:', error);
        res.status(500).json({ error: 'Failed to delete context file' });
    }
});

/**
 * GET /api/publish/context-templates
 * List available context templates
 */
router.get('/context-templates', async (req, res) => {
    try {
        const projectRootDir = path.resolve(__dirname, '../..');
        const templatesDir = path.join(projectRootDir, 'notepads', 'templates');
        const fs = await import('fs/promises');
        
        const templates = [
            // Built-in templates
            {
                id: 'project-docs',
                name: 'Project Documentation',
                description: 'Templates for project documentation, README files, and technical specs',
                files: ['README.md', 'API.md', 'SETUP.md'],
                builtin: true
            },
            {
                id: 'ui-components',
                name: 'UI Components',
                description: 'Documentation for UI components, styles, and design patterns',
                files: ['components.md', 'styles.md', 'patterns.md'],
                builtin: true
            },
            {
                id: 'api-docs',
                name: 'API Documentation',
                description: 'REST API documentation, endpoints, and schemas',
                files: ['endpoints.md', 'schemas.md', 'examples.md'],
                builtin: true
            },
            {
                id: 'troubleshooting',
                name: 'Troubleshooting Guide',
                description: 'Common issues, solutions, and debugging information',
                files: ['common-issues.md', 'debugging.md', 'faq.md'],
                builtin: true
            }
        ];
        
        try {
            // Add custom templates from templates directory
            const entries = await fs.readdir(templatesDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const templatePath = path.join(templatesDir, entry.name);
                    const configPath = path.join(templatePath, 'template.json');
                    
                    try {
                        const configContent = await fs.readFile(configPath, 'utf8');
                        const config = JSON.parse(configContent);
                        
                        // List template files
                        const templateFiles = await fs.readdir(templatePath);
                        const mdFiles = templateFiles.filter(f => f.endsWith('.md'));
                        
                        templates.push({
                            id: entry.name,
                            name: config.name || entry.name,
                            description: config.description || 'Custom template',
                            files: mdFiles,
                            builtin: false,
                            path: templatePath
                        });
                    } catch (err) {
                        console.warn(`[TEMPLATES] Skipping invalid template: ${entry.name}`, err.message);
                    }
                }
            }
        } catch (error) {
            // Templates directory doesn't exist, only use built-in templates
            console.log('[TEMPLATES] No custom templates directory found, using built-in templates only');
        }
        
        res.json({ 
            success: true, 
            templates 
        });
        
    } catch (error) {
        console.error('[TEMPLATES] Error listing templates:', error);
        res.status(500).json({ error: 'Failed to list context templates' });
    }
});

/**
 * POST /api/publish/context-from-template
 * Create a new context from a template
 */
router.post('/context-from-template', async (req, res) => {
    try {
        const { templateId, contextName } = req.body;
        const username = req.user?.username || '[unknown_user]';
        
        if (!templateId || !contextName) {
            return res.status(400).json({ error: 'Template ID and context name are required' });
        }
        
        if (!/^[a-zA-Z0-9_-]+$/.test(contextName)) {
            return res.status(400).json({ error: 'Invalid context name. Use only letters, numbers, hyphens, and underscores.' });
        }

        const contextDir = getContextPath('', contextName);
        const fs = await import('fs/promises');
        
        // Check if context already exists
        try {
            await fs.access(contextDir);
            return res.status(400).json({ error: 'Context already exists' });
        } catch (error) {
            // Context doesn't exist, which is what we want
        }
        
        // Create context directory
        await fs.mkdir(contextDir, { recursive: true });
        
        // Get template content
        const templateContent = await generateTemplateContent(templateId);
        
        // Create files from template
        for (const [filename, content] of Object.entries(templateContent)) {
            const filePath = path.join(contextDir, filename);
            await fs.writeFile(filePath, content, 'utf8');
        }
        
        console.log(`[CONTEXT TEMPLATE] Created context "${contextName}" from template "${templateId}" by ${username}`);
        
        res.json({ 
            success: true, 
            message: `Context "${contextName}" created from template "${templateId}"`,
            contextName,
            templateId,
            filesCreated: Object.keys(templateContent)
        });
        
    } catch (error) {
        console.error('[CONTEXT TEMPLATE] Error creating context from template:', error);
        res.status(500).json({ error: 'Failed to create context from template' });
    }
});

// Helper function to generate template content
async function generateTemplateContent(templateId) {
    const templates = {
        'project-docs': {
            'README.md': `# Project Documentation

## Overview
Brief description of the project and its purpose.

## Architecture
High-level architecture and design decisions.

## Getting Started
Quick start guide for new developers.

## Contributing
Guidelines for contributing to the project.
`,
            'API.md': `# API Documentation

## Authentication
How to authenticate with the API.

## Endpoints
List of available endpoints and their usage.

## Error Handling
Common error codes and their meanings.
`,
            'SETUP.md': `# Setup Guide

## Prerequisites
Required software and dependencies.

## Installation
Step-by-step installation instructions.

## Configuration
Environment variables and configuration options.

## Troubleshooting
Common setup issues and solutions.
`
        },
        'ui-components': {
            'components.md': `# UI Components

## Button Components
Standard button styles and variants.

## Form Components
Input fields, checkboxes, and form elements.

## Layout Components
Containers, grids, and layout utilities.

## Navigation Components
Menus, breadcrumbs, and navigation elements.
`,
            'styles.md': `# Style Guide

## Color Palette
Primary, secondary, and accent colors.

## Typography
Font families, sizes, and text styles.

## Spacing
Margin and padding conventions.

## Layout Patterns
Common layout patterns and structures.
`,
            'patterns.md': `# Design Patterns

## Component Patterns
Reusable component patterns and structures.

## State Management
How to handle component state and data flow.

## Accessibility
Guidelines for accessible component design.

## Responsive Design
Mobile-first design principles and breakpoints.
`
        },
        'api-docs': {
            'endpoints.md': `# API Endpoints

## Authentication Endpoints
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

## Data Endpoints
- GET /api/data
- POST /api/data
- PUT /api/data/:id
- DELETE /api/data/:id

## File Endpoints
- POST /api/files/upload
- GET /api/files/:id
- DELETE /api/files/:id
`,
            'schemas.md': `# API Schemas

## User Schema
\`\`\`json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "created_at": "string"
}
\`\`\`

## Data Schema
\`\`\`json
{
  "id": "string",
  "title": "string",
  "content": "string",
  "author": "string",
  "updated_at": "string"
}
\`\`\`
`,
            'examples.md': `# API Examples

## Authentication Example
\`\`\`bash
curl -X POST /api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username": "user", "password": "pass"}'
\`\`\`

## Data Retrieval Example
\`\`\`bash
curl -X GET /api/data \\
  -H "Authorization: Bearer <token>"
\`\`\`

## File Upload Example
\`\`\`bash
curl -X POST /api/files/upload \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@document.pdf"
\`\`\`
`
        },
        'troubleshooting': {
            'common-issues.md': `# Common Issues

## Build Errors
Common build-time errors and solutions.

## Runtime Errors
Typical runtime issues and debugging steps.

## Performance Issues
Performance bottlenecks and optimization tips.

## Dependency Issues
Package and dependency-related problems.
`,
            'debugging.md': `# Debugging Guide

## Debug Tools
Recommended debugging tools and setup.

## Logging
How to enable and use application logging.

## Performance Profiling
Tools and techniques for performance analysis.

## Testing
Debugging test failures and test setup.
`,
            'faq.md': `# Frequently Asked Questions

## Installation Questions
Q: Why won't the application install?
A: Check your Node.js version and dependencies.

## Usage Questions
Q: How do I configure the application?
A: See the SETUP.md file for configuration details.

## Troubleshooting Questions
Q: The application is running slowly, what should I do?
A: Check the performance section in debugging.md.
`
        }
    };
    
    if (!templates[templateId]) {
        // Try to load custom template
        const projectRootDir = path.resolve(__dirname, '../..');
        const templatePath = path.join(projectRootDir, 'notepads', 'templates', templateId);
        const fs = await import('fs/promises');
        
        try {
            const files = await fs.readdir(templatePath);
            const content = {};
            
            for (const file of files) {
                if (file.endsWith('.md')) {
                    const filePath = path.join(templatePath, file);
                    content[file] = await fs.readFile(filePath, 'utf8');
                }
            }
            
            return content;
        } catch (error) {
            throw new Error(`Template "${templateId}" not found`);
        }
    }
    
    return templates[templateId];
}

export default router;
