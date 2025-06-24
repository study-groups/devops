/**
 * Unified CSS Route Handler for DevPages
 * 
 * Serves CSS files for both preview and publishing contexts with:
 * - Proper security checks and path validation
 * - Caching headers for performance
 * - Support for both client and user CSS files
 * - Theme hierarchy: $MD_DIR/themes/ > user styles > system styles
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
 * Priority: themes > user styles > client styles
 */
function classifyCssFile(cssPath) {
    // Theme files have highest priority - served from $MD_DIR/themes/
    if (cssPath.startsWith('themes/')) {
        return {
            type: 'theme',
            baseDir: 'data',
            relativePath: cssPath,
            priority: 1
        };
    }
    
    // Client/system files from project
    if (cssPath.startsWith('/client/') || cssPath.startsWith('client/')) {
        return {
            type: 'client',
            baseDir: 'project',
            relativePath: cssPath.startsWith('/') ? cssPath.substring(1) : cssPath,
            priority: 3
        };
    }
    
    // User styles and other files
    if (cssPath === 'styles.css' || cssPath.startsWith('styles/')) {
        return {
            type: 'user',
            baseDir: 'data',
            relativePath: cssPath,
            priority: 2
        };
    }
    
    // Default: treat as user file
    return {
        type: 'user',
        baseDir: 'data',
        relativePath: cssPath,
        priority: 2
    };
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
            return {
                absolutePath: path.resolve(projectRoot, classification.relativePath),
                classification
            };
            
        case 'data':
            // User files and themes are in PD_DIR/data
            if (!req.pdata?.dataRoot) {
                throw new Error('Data root not available');
            }
            return {
                absolutePath: path.resolve(req.pdata.dataRoot, 'data', classification.relativePath),
                classification
            };
            
        default:
            throw new Error(`Unknown CSS base directory: ${classification.baseDir}`);
    }
}

/**
 * Check if user has permission to access CSS file
 */
function checkCssPermission(absolutePath, classification, req) {
    const currentUser = req.user?.username || '__public__';
    
    // For client/system files, allow access to authenticated users
    if (classification.type === 'client') {
        return req.isAuthenticated && req.isAuthenticated();
    }
    
    // For theme files, allow read access (themes are generally public)
    if (classification.type === 'theme') {
        return true; // Themes should be publicly accessible
    }
    
    // For user files, check PData permissions
    if (req.pdata && typeof req.pdata.can === 'function') {
        return req.pdata.can(currentUser, 'read', absolutePath);
    }
    
    // Fallback: allow if authenticated
    return req.isAuthenticated && req.isAuthenticated();
}

/**
 * Validate that resolved path is within allowed directories
 */
function validateResolvedPath(absolutePath, req) {
    const projectRoot = process.cwd();
    const dataRoot = req.pdata?.dataRoot;
    
    // Allow paths within data root (user files, themes)
    if (dataRoot && absolutePath.startsWith(path.resolve(dataRoot))) {
        return true;
    }
    
    // Allow paths within client directory
    if (absolutePath.startsWith(path.resolve(projectRoot, 'client'))) {
        return true;
    }
    
    // Allow system styles in styles directory
    if (absolutePath.startsWith(path.resolve(projectRoot, 'styles'))) {
        return true;
    }
    
    return false;
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
        
        // Resolve absolute path and get classification
        const { absolutePath, classification } = resolveCssPath(validation.path, req);
        console.log(`${logPrefix} Resolved path: ${absolutePath} (type: ${classification.type}, priority: ${classification.priority})`);
        
        // Security check - ensure path is within allowed directories
        if (!validateResolvedPath(absolutePath, req)) {
            console.warn(`${logPrefix} Path outside allowed directories: ${absolutePath}`);
            return res.status(403).send('Forbidden: Path outside allowed directories');
        }
        
        // Check permissions
        if (!checkCssPermission(absolutePath, classification, req)) {
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
            'X-Content-Type-Options': 'nosniff',
            'X-CSS-Type': classification.type,
            'X-CSS-Priority': classification.priority.toString()
        });
        
        console.log(`${logPrefix} Successfully served CSS: ${cssPath} (${cssContent.length} chars, type: ${classification.type})`);
        res.send(cssContent);
        
    } catch (error) {
        console.error(`${logPrefix} Error serving CSS ${cssPath}:`, error);
        res.status(500).send('Internal Server Error: Failed to serve CSS file');
    }
});

/**
 * CSS bundle route for multiple files
 * POST /css/bundle - Bundles multiple CSS files into one response
 * Files are processed in priority order: themes (1) > user (2) > client (3)
 */
router.post('/bundle', express.json(), async (req, res) => {
    const logPrefix = '[CSS Bundle]';
    const { files = [], context = 'preview' } = req.body;
    
    console.log(`${logPrefix} Bundle request for ${files.length} files, context: ${context}`);
    
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Files array is required' });
    }
    
    try {
        const fileData = [];
        const errors = [];
        
        // Process and classify each file
        for (const cssPath of files) {
            try {
                const validation = validateCssPath(cssPath);
                if (!validation.valid) {
                    errors.push({ file: cssPath, error: validation.error });
                    continue;
                }
                
                const { absolutePath, classification } = resolveCssPath(validation.path, req);
                
                // Check permissions
                if (!checkCssPermission(absolutePath, classification, req)) {
                    errors.push({ file: cssPath, error: 'Permission denied' });
                    continue;
                }
                
                // Validate path
                if (!validateResolvedPath(absolutePath, req)) {
                    errors.push({ file: cssPath, error: 'Path not allowed' });
                    continue;
                }
                
                // Read file
                const cssContent = await fs.readFile(absolutePath, 'utf8');
                fileData.push({
                    path: cssPath,
                    content: cssContent,
                    classification,
                    size: cssContent.length
                });
                
            } catch (error) {
                console.error(`${logPrefix} Error processing ${cssPath}:`, error);
                errors.push({ file: cssPath, error: error.message });
            }
        }
        
        // Sort by priority (1 = highest priority, 3 = lowest)
        fileData.sort((a, b) => a.classification.priority - b.classification.priority);
        
        // Build bundled CSS with priority order
        const bundledCss = fileData.map(file => 
            `/* === BUNDLED CSS (Priority ${file.classification.priority}): ${file.path} === */\n${file.content}\n`
        );
        
        // Add error comments for failed files
        errors.forEach(error => {
            bundledCss.push(`/* === FAILED TO LOAD: ${error.file} - ${error.error} === */\n`);
        });
        
        const finalCss = bundledCss.join('\n');
        
        // Set headers
        const bundleCacheControl = process.env.NODE_ENV === 'production' 
            ? 'public, max-age=300' // 5 minute cache for bundles in production
            : 'no-store, no-cache, must-revalidate'; // No cache in development
            
        res.set({
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': bundleCacheControl,
            'X-Content-Type-Options': 'nosniff',
            'X-Bundle-Files': fileData.length.toString(),
            'X-Bundle-Errors': errors.length.toString()
        });
        
        console.log(`${logPrefix} Bundle complete: ${finalCss.length} chars, ${fileData.length} files, ${errors.length} errors`);
        
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