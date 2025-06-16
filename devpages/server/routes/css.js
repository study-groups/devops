/**
 * Unified CSS Route Handler for DevPages
 * 
 * Serves CSS files for both preview and publishing contexts with:
 * - Proper security checks and path validation
 * - Caching headers for performance
 * - Support for both client and user CSS files
 * - Configurable prefixes for different deployment contexts
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Cache control headers for CSS files
const CSS_CACHE_HEADERS = process.env.NODE_ENV === 'production' ? {
    'Cache-Control': 'public, max-age=3600', // 1 hour cache in production
    'ETag': null // Will be set per file
} : {
    'Cache-Control': 'no-store, no-cache, must-revalidate', // No cache in development
    'ETag': null
};

/**
 * Generate ETag for file caching
 */
async function generateETag(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return `"${stats.mtime.getTime()}-${stats.size}"`;
    } catch (error) {
        return `"${Date.now()}"`;
    }
}

/**
 * Validate CSS file path for security
 */
function validateCssPath(cssPath) {
    if (!cssPath || typeof cssPath !== 'string') {
        return { valid: false, error: 'Invalid or missing CSS path' };
    }

    // Normalize path and check for directory traversal
    const normalizedPath = path.normalize(cssPath).replace(/^(\.\.(\/|\\|$))+/, '');
    if (normalizedPath !== cssPath || normalizedPath.includes('..')) {
        return { valid: false, error: 'Directory traversal attempt detected' };
    }

    // Only allow CSS files
    if (!normalizedPath.endsWith('.css')) {
        return { valid: false, error: 'Only CSS files are allowed' };
    }

    return { valid: true, path: normalizedPath };
}

/**
 * Determine CSS file type and resolution strategy
 */
function classifyCssFile(cssPath) {
    if (cssPath.startsWith('/client/')) {
        return {
            type: 'client',
            baseDir: 'project',
            relativePath: cssPath.substring(1) // Remove leading slash
        };
    } else if (cssPath === 'styles.css' || cssPath.startsWith('styles/') || cssPath.startsWith('themes/')) {
        return {
            type: 'user',
            baseDir: 'data',
            relativePath: cssPath
        };
    } else {
        return {
            type: 'user',
            baseDir: 'data', 
            relativePath: cssPath
        };
    }
}

/**
 * Resolve CSS file path to absolute path
 */
function resolveCssPath(cssPath, req) {
    const classification = classifyCssFile(cssPath);
    
    switch (classification.baseDir) {
        case 'project':
            // Client files are relative to project root
            const projectRoot = process.cwd();
            return path.resolve(projectRoot, classification.relativePath);
            
        case 'data':
            // User files are in PD_DIR/data
            if (!req.pdata?.dataRoot) {
                throw new Error('Data root not available');
            }
            return path.resolve(req.pdata.dataRoot, 'data', classification.relativePath);
            
        default:
            throw new Error(`Unknown CSS base directory: ${classification.baseDir}`);
    }
}

/**
 * Check if user has permission to access CSS file
 */
function checkCssPermission(absolutePath, req) {
    const currentUser = req.user?.username || '__public__';
    
    // For client files, allow access to authenticated users
    if (absolutePath.includes('/client/')) {
        return req.isAuthenticated && req.isAuthenticated();
    }
    
    // For user files, check PData permissions
    if (req.pdata && typeof req.pdata.can === 'function') {
        return req.pdata.can(currentUser, 'read', absolutePath);
    }
    
    // Fallback: allow if authenticated
    return req.isAuthenticated && req.isAuthenticated();
}

/**
 * Main CSS serving route
 * GET /css/:path - Serves CSS files with proper caching and security
 */
router.get('/:path(*)', async (req, res) => {
    const logPrefix = '[CSS Route]';
    const cssPath = req.params.path;
    
    console.log(`${logPrefix} Request for CSS: ${cssPath}`);
    
    try {
        // Validate CSS path
        const validation = validateCssPath(cssPath);
        if (!validation.valid) {
            console.warn(`${logPrefix} Path validation failed: ${validation.error}`);
            return res.status(400).send(`Bad Request: ${validation.error}`);
        }
        
        // Resolve absolute path
        const absolutePath = resolveCssPath(validation.path, req);
        console.log(`${logPrefix} Resolved path: ${absolutePath}`);
        
        // Security check - ensure path is within allowed directories
        const projectRoot = process.cwd();
        const dataRoot = req.pdata?.dataRoot;
        
        let pathAllowed = false;
        if (dataRoot && absolutePath.startsWith(path.resolve(dataRoot))) {
            pathAllowed = true;
        } else if (absolutePath.startsWith(path.resolve(projectRoot, 'client'))) {
            pathAllowed = true;
        }
        
        if (!pathAllowed) {
            console.warn(`${logPrefix} Path outside allowed directories: ${absolutePath}`);
            return res.status(403).send('Forbidden: Path outside allowed directories');
        }
        
        // Check permissions
        if (!checkCssPermission(absolutePath, req)) {
            console.warn(`${logPrefix} Permission denied for user: ${req.user?.username || 'anonymous'}`);
            return res.status(401).send('Unauthorized: Insufficient permissions');
        }
        
        // Check if file exists
        try {
            await fs.access(absolutePath, fs.constants.R_OK);
        } catch (error) {
            console.warn(`${logPrefix} File not found or not readable: ${absolutePath}`);
            return res.status(404).send('Not Found: CSS file not found');
        }
        
        // Generate ETag for caching
        const etag = await generateETag(absolutePath);
        
        // Check if client has cached version (skip in development)
        if (process.env.NODE_ENV === 'production') {
            const clientETag = req.headers['if-none-match'];
            if (clientETag === etag) {
                console.log(`${logPrefix} Serving cached version (304): ${cssPath}`);
                return res.status(304).end();
            }
        }
        
        // Read and serve CSS file
        const cssContent = await fs.readFile(absolutePath, 'utf8');
        
        // Set appropriate headers
        res.set({
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': CSS_CACHE_HEADERS['Cache-Control'],
            'ETag': etag,
            'X-Content-Type-Options': 'nosniff'
        });
        
        console.log(`${logPrefix} Successfully served CSS: ${cssPath} (${cssContent.length} chars)`);
        res.send(cssContent);
        
    } catch (error) {
        console.error(`${logPrefix} Error serving CSS ${cssPath}:`, error);
        res.status(500).send('Internal Server Error: Failed to serve CSS file');
    }
});

/**
 * CSS bundle route for multiple files
 * POST /css/bundle - Bundles multiple CSS files into one response
 */
router.post('/bundle', express.json(), async (req, res) => {
    const logPrefix = '[CSS Bundle]';
    const { files = [], context = 'preview' } = req.body;
    
    console.log(`${logPrefix} Bundle request for ${files.length} files, context: ${context}`);
    
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Files array is required' });
    }
    
    try {
        const bundledCss = [];
        const errors = [];
        
        // Process each file
        for (const cssPath of files) {
            try {
                const validation = validateCssPath(cssPath);
                if (!validation.valid) {
                    errors.push({ file: cssPath, error: validation.error });
                    continue;
                }
                
                const absolutePath = resolveCssPath(validation.path, req);
                
                // Check permissions
                if (!checkCssPermission(absolutePath, req)) {
                    errors.push({ file: cssPath, error: 'Permission denied' });
                    continue;
                }
                
                // Read file
                const cssContent = await fs.readFile(absolutePath, 'utf8');
                bundledCss.push(`/* === BUNDLED CSS: ${cssPath} === */\n${cssContent}\n`);
                
            } catch (error) {
                console.error(`${logPrefix} Error processing ${cssPath}:`, error);
                errors.push({ file: cssPath, error: error.message });
                bundledCss.push(`/* === FAILED TO LOAD: ${cssPath} === */\n`);
            }
        }
        
        const finalCss = bundledCss.join('\n');
        
        // Set headers
        const bundleCacheControl = process.env.NODE_ENV === 'production' 
            ? 'public, max-age=300' // 5 minute cache for bundles in production
            : 'no-store, no-cache, must-revalidate'; // No cache in development
            
        res.set({
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': bundleCacheControl,
            'X-Content-Type-Options': 'nosniff'
        });
        
        console.log(`${logPrefix} Bundle complete: ${finalCss.length} chars, ${errors.length} errors`);
        
        if (errors.length > 0) {
            console.warn(`${logPrefix} Bundle had errors:`, errors);
        }
        
        res.send(finalCss);
        
    } catch (error) {
        console.error(`${logPrefix} Bundle error:`, error);
        res.status(500).json({ error: 'Failed to bundle CSS files' });
    }
});

export default router; 