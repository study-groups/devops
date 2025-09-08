/**
 * files.js - Standardized API for file operations
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js'; // Import the exported name
import { createAuthToken } from './routeUtils.js';
// authMiddleware is likely applied *before* this router in server.js now
// import { authMiddleware } from '../middleware/auth.js'; // No longer needed here if applied globally/per-route earlier

// Derive __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Base directory for storing files (managed by PData instance now)
// const getBaseDir = (req) => {
//   const baseDir = process.env.MD_DIR || path.join(__dirname, '../../data');
//   return baseDir;
// };
// This is now accessible via req.pdata.dataDir if needed, but direct access might be less necessary

// Helper to validate filename (still useful)
const isValidFilename = (filename) => {
  return filename &&
         typeof filename === 'string' &&
         !filename.includes('..') && // Basic check
         !filename.includes('/') &&  // Basic check
         filename.trim() !== ''; // Ensure not just whitespace
};

// Helper to validate relative directory part (still useful)
const isValidRelativeDirectory = (directory) => {
  // Allow empty string for root of dataDir
  if (directory === '' || directory === null || directory === undefined) {
      return true;
  }
  return typeof directory === 'string' &&
         !directory.includes('..') && // Basic check
         !directory.startsWith('/'); // Ensure it's relative
};


// Gets *absolute* path to file/dir within the PData managed dataDir
// SECURITY: This function *resolves* the path but relies on pdata.can() for authorization *before* use.
const resolvePathInDataDir = (req, relativeDir, filename = '') => {
    const pdata = req.pdata; // Get PData instance from request
    const username = req.user?.username || '[unknown_user]'; // For logging
    const logPrefix = '[resolvePathInDataDir]';

    console.log(`${logPrefix} User='${username}', Input relativeDir='${relativeDir}', filename='${filename}'`);

    // Validate inputs
    if (!isValidRelativeDirectory(relativeDir)) {
        console.error(`${logPrefix} FAIL Invalid relative directory: '${relativeDir}'. User='${username}'.`);
        throw new Error('Invalid relative directory path structure');
    }
    // Allow filename to be empty if resolving a directory path
    if (filename && !isValidFilename(filename)) {
        console.error(`${logPrefix} FAIL Invalid filename: '${filename}'. User='${username}'.`);
        throw new Error('Invalid filename format');
    }

    const dataDir = pdata.dataRoot; // Get the managed data directory root from PData
    console.log(`${logPrefix} STEP 1 PData managed dataDir: '${dataDir}'`);

    // Combine dataDir + relativeDir + filename
    const combinedPath = path.join(dataDir, relativeDir || '', filename || '');
    console.log(`${logPrefix} STEP 2 Combined path: '${combinedPath}'`);

    // Resolve the absolute path
    const resolvedPath = path.resolve(combinedPath);
    const resolvedDataDir = path.resolve(dataDir);
    console.log(`${logPrefix} STEP 3 Resolved path: '${resolvedPath}', Resolved dataDir: '${resolvedDataDir}'`);

    // Security Check: Ensure resolved path is still within the managed data directory
    // This check is crucial to prevent escape tricks even before the pdata.can() check.
    if (!resolvedPath.startsWith(resolvedDataDir + path.sep) && resolvedPath !== resolvedDataDir) {
        console.error(`${logPrefix} FAIL Path escape detected! Resolved path '${resolvedPath}' is outside managed dataDir '${resolvedDataDir}'. User='${username}'.`);
        throw new Error('Security violation: Path escape detected');
    }

    console.log(`${logPrefix} SUCCESS Returning resolved path: '${resolvedPath}'`);
    return resolvedPath;
};

const contentSubDir = 'data'; // The name of the subdir in PD_DIR linking to MD_DIR

// Helper function to get effective path with org
function getEffectivePath(req, pathname) {
    // If the path starts with a tilde, it's a virtual path and should not be modified.
    if (pathname.startsWith('~')) {
        return pathname;
    }

    // For now, return the pathname as-is. Let the permission system handle access control.
    // The old logic was automatically prefixing with username/org which breaks navigation.
    // TODO: If we need org-based path prefixing in the future, it should be explicit, not automatic.
    return pathname;
}

// Helper function to create an auth token from a request object
// MOVED to routeUtils.js

/**
 * GET /api/files/list
 * Get list of files and subdirectories in a directory
 */
router.get('/list', authMiddleware, async (req, res) => {
    const clientPathname = req.query.pathname || '/';
    
    try {
        const username = req.user.username;
        const effectivePath = getEffectivePath(req, clientPathname);

        console.log(`[API /list] Client requested: '${clientPathname}', effective path: '${effectivePath}', user: '${username}'`);

        let result;
        if (effectivePath.startsWith('~')) {
            // Use token-based authorization for virtual paths
            const authToken = await createAuthToken(req);
            result = await req.pdata.listDirectory(authToken, effectivePath);
        } else {
            // Use username-based authorization for relative paths
            const userRole = req.pdata.getUserRole(username);
            
            // Special case: root path requests
            if (clientPathname === '/') {
                if (userRole === 'admin') {
                    // Admin users get the top-level directory list
                    const mounts = await req.pdata.getAvailableTopDirs(username);
                    return res.json({ pathname: '/', dirs: mounts, files: [] });
                } else {
                    // Regular users get redirected to their home directory
                    result = await req.pdata.listDirectory(username, username);
                    // Return the actual path that represents the user's home directory
                    const actualPath = `users/${username}`;
                    console.log(`[API /list] Regular user root request redirected to: '${actualPath}'`);
                    console.log(`[API /list] Directory contents: dirs=${result.dirs?.length || 0}, files=${result.files?.length || 0}`);
                    console.log(`[API /list] Dirs:`, result.dirs);
                    console.log(`[API /list] Files:`, result.files);
                    return res.json({
                        pathname: actualPath,
                        dirs: result.dirs || [],
                        files: result.files || []
                    });
                }
            } else {
                // Special case: redirect 'user' (singular) to 'users' (plural)
                if (effectivePath === 'user') {
                    console.log(`[API /list] Redirecting 'user' to 'users' for user: '${username}'`);
                    const userRole = req.pdata.getUserRole(username);
                    if (userRole !== 'admin') {
                        // Regular users should see their own directory
                        const actualPath = `users/${username}`;
                        result = await req.pdata.listDirectory(username, actualPath);
                        console.log(`[API /list] Regular user 'user' request redirected to: '${actualPath}'`);
                        return res.json({
                            pathname: actualPath,
                            dirs: result.dirs,
                            files: result.files
                        });
                    } else {
                        // Admin users can see the top-level users directory
                        result = await req.pdata.listDirectory(username, 'users');
                        console.log(`[API /list] Admin user 'user' request redirected to: 'users'`);
                        return res.json({
                            pathname: 'users',
                            dirs: result.dirs,
                            files: result.files
                        });
                    }
                }
                // Special case: if user requests 'users' directory, redirect to their own user directory
                else if (effectivePath === 'users') {
                    const userRole = req.pdata.getUserRole(username);
                    if (userRole !== 'admin') {
                        // Regular users should see their own directory when accessing 'users'
                        const actualPath = `users/${username}`;
                        result = await req.pdata.listDirectory(username, actualPath);
                        console.log(`[API /list] Regular user 'users' request redirected to: '${actualPath}'`);
                        return res.json({
                            pathname: actualPath,
                            dirs: result.dirs,
                            files: result.files
                        });
                    } else {
                        // Admin users can see the top-level users directory
                        result = await req.pdata.listDirectory(username, effectivePath);
                    }
                } else {
                    // For all other paths, use the effective path as-is
                    // The permission system will handle access control
                    result = await req.pdata.listDirectory(username, effectivePath);
                    console.log(`[API /list] Regular path listing for '${effectivePath}': dirs=${result.dirs?.length || 0}, files=${result.files?.length || 0}`);
                    console.log(`[API /list] Dirs:`, result.dirs);
                    console.log(`[API /list] Files:`, result.files);
                }
            }
        }

        console.log(`[API /list] Success for '${effectivePath}': ${result.dirs.length} dirs, ${result.files.length} files`);
        res.json({
            pathname: clientPathname,
            dirs: result.dirs,
            files: result.files
        });
    } catch (error) {
        console.error(`[API /list] Error for '${req.query.pathname || '/'}':`, error.message);
        res.status(500).json({
            error: `Failed to list contents for '${req.query.pathname || '/'}': ${error.message}`,
            requestedPath: req.query.pathname || '/'
        });
    }
});

/**
 * GET /api/files/dirs
 * Get list of directories based on username and permissions
 */
router.get('/dirs', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username;

    console.log(`[API /dirs] Getting directories for user: ${username}`);

    // Use the correct method name from PData.js
    const directories = await req.pdata.getAvailableTopDirs(username);

    console.log(`[API /dirs] Server returning directories:`, directories);

    res.json(directories);
  } catch (error) {
    console.error('[API /dirs] Error:', error);
    res.status(500).json({ error: 'Error fetching directories' });
  }
});

/**
 * GET /api/files/content
 * Get file content
 */
router.get('/content', authMiddleware, async (req, res) => {
    const clientPathname = req.query.pathname;
    if (!clientPathname) {
        return res.status(400).json({ error: 'pathname parameter is required' });
    }

    try {
        const effectivePath = getEffectivePath(req, clientPathname);
        const username = req.user.username;
        console.log(`[API /content] Client requested: '${clientPathname}', effective path: '${effectivePath}', user: '${username}'`);

        let content;
        if (effectivePath.startsWith('~')) {
            // Use token-based authorization for virtual paths
            const authToken = await createAuthToken(req);
            content = await req.pdata.readFile(authToken, effectivePath);
        } else {
            // Use legacy username-based authorization for relative paths
            content = await req.pdata.readFile(username, effectivePath);
        }
        
        console.log(`[API /content] Success for '${effectivePath}': ${content.length} chars`);

        // ---> START DIAGNOSTIC LOG <---
        console.log(`[files.js] Sending content for ${clientPathname}. Preview: ${content.substring(0, 200)}...`);
        // --->  END DIAGNOSTIC LOG  <---

        const extension = path.extname(clientPathname).toLowerCase();
        let contentType = 'text/plain'; // Default

        if (extension === '.html' || extension === '.htm') {
            contentType = 'text/html';
        } else if (extension === '.css') {
            contentType = 'text/css';
        } else if (extension === '.js' || extension === '.mjs') {
            contentType = 'application/javascript';
        } else if (extension === '.json') {
            contentType = 'application/json';
        } else if (extension === '.png') {
            contentType = 'image/png';
        } else if (extension === '.jpg' || extension === '.jpeg') {
            contentType = 'image/jpeg';
        } else if (extension === '.gif') {
            contentType = 'image/gif';
        } else if (extension === '.svg') {
            contentType = 'image/svg+xml';
        }
        
        // Set cache-control headers to prevent the browser from caching the file content response.
        // This is crucial to prevent showing stale content when switching between files.
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');

        console.log(`[API /content] Determined Content-Type for '${clientPathname}': ${contentType}`);
        res.type(contentType).send(content);
    } catch (error) {
        console.error(`[API /content] Error for '${clientPathname}':`, error.message);
        res.status(500).json({
            error: `Failed to read file '${clientPathname}': ${error.message}`,
            requestedPath: clientPathname
        });
    }
});

/**
 * POST /api/files/save
 * Save file content
 */
router.post('/save', express.json({ type: '*/*' }), authMiddleware, async (req, res) => {
    const { pathname: clientPathname, content, org } = req.body;
    if (!clientPathname || content === undefined) {
        return res.status(400).json({ error: 'pathname and content are required' });
    }
    
    const effectivePath = getEffectivePath(req, clientPathname);
    const username = req.user.username;
    console.log(`[API /save] Client saving: '${clientPathname}', effective path: '${effectivePath}', user: '${username}'`);
    
    // CRITICAL SECURITY CHECK: Prevent creation of literal ~ directories
    if (effectivePath.includes('~') && !effectivePath.startsWith('~')) {
        console.error(`[API /save] SECURITY VIOLATION: Attempted to create literal ~ directory: '${effectivePath}', user: '${username}'`);
        return res.status(400).json({
            error: 'Invalid path: literal ~ characters in non-virtual paths are forbidden',
            requestedPath: clientPathname
        });
    }
    
    try {
        if (effectivePath.startsWith('~')) {
            // Use token-based authorization for virtual paths
            const authToken = await createAuthToken(req);
            console.log(`[API /save] Using token-based auth for virtual path: '${effectivePath}'`);
            await req.pdata.writeFile(authToken, effectivePath, content);
        } else {
            // Use legacy username-based authorization for relative paths
            console.log(`[API /save] Using username-based auth for relative path: '${effectivePath}'`);
            await req.pdata.writeFile(username, effectivePath, content);
        }
        
        console.log(`[API /save] Success for '${effectivePath}': ${content.length} chars saved`);
        res.json({
            success: true,
            message: `File '${clientPathname}' saved successfully`,
            pathname: clientPathname
        });
  } catch (error) {
        console.error(`[API /save] Error for '${effectivePath}':`, error.message);
        res.status(500).json({
            error: `Failed to save file '${clientPathname}': ${error.message}`,
            requestedPath: clientPathname
        });
  }
});

/**
 * DELETE /api/files/delete
 * Delete a file
 */
router.delete('/delete', async (req, res) => {
  try {
    const username = req.user.username;
    const { dir, file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    const relativePath = path.join(dir || '', file);
    console.log(`[API /delete] User='${username}', Deleting file='${relativePath}'`);
    
    await req.pdata.deleteFile(username, relativePath);
    
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('[API /delete] Error:', error);
    
    if (error.message === 'Permission denied') {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.status(500).json({ error: 'Error deleting file' });
  }
});


/**
 * POST /api/files/rename
 * Rename a file
 */
router.post('/rename', express.json(), async (req, res) => { // Removed authMiddleware
    const logPrefix = '[API /rename]';
    const username = req.user.username;
    const pdata = req.pdata;
    console.log(`${logPrefix} User='${username}'. Received body: ${JSON.stringify(req.body)}`);

    try {
        const { dir: relativeDir, oldName, newName } = req.body;

        // 1. Validate inputs
        if (!oldName || !newName) {
             console.error(`${logPrefix} FAIL Missing oldName or newName. User='${username}'.`);
            return res.status(400).json({ error: 'Both old and new filenames are required' });
        }
         // Use the existing helpers, adapted slightly if needed
         if (!isValidFilename(oldName)) {
             console.error(`${logPrefix} FAIL Invalid oldName: '${oldName}'. User='${username}'.`);
             return res.status(400).json({ error: 'Invalid old filename' });
         }
          if (!isValidFilename(newName)) {
             console.error(`${logPrefix} FAIL Invalid newName: '${newName}'. User='${username}'.`);
             return res.status(400).json({ error: 'Invalid new filename' });
         }
          if (!isValidRelativeDirectory(relativeDir)) {
             console.error(`${logPrefix} FAIL Invalid relativeDir: '${relativeDir}'. User='${username}'.`);
             return res.status(400).json({ error: 'Invalid directory' });
          }

        // 2. Resolve absolute paths for old and new locations
        const oldAbsPath = resolvePathInDataDir(req, relativeDir, oldName);
        const newAbsPath = resolvePathInDataDir(req, relativeDir, newName);
        console.log(`${logPrefix} STEP Resolved old path: '${oldAbsPath}'`);
        console.log(`${logPrefix} STEP Resolved new path: '${newAbsPath}'`);

        // Check they are in the same directory (simple rename, not move)
        if (path.dirname(oldAbsPath) !== path.dirname(newAbsPath)) {
             console.error(`${logPrefix} FAIL Rename across directories detected (or path resolution issue). Old: '${oldAbsPath}', New: '${newAbsPath}'. User='${username}'.`);
             // This shouldn't happen if relativeDir is the same, but check anyway.
             return res.status(400).json({ error: 'Rename across different directories is not supported.' });
        }

        // 3. Check permissions using PData
        // Requires 'write' on the source file (to delete/rename it)
        // Requires 'write' on the destination file path (to create it)
        if (!pdata.can(username, 'write', oldAbsPath)) {
             console.warn(`${logPrefix} Access Denied. User='${username}', action='write' (for rename source), resource='${oldAbsPath}'`);
             return res.status(403).json({ error: 'Forbidden: You do not have permission to rename the source file.' });
        }
        if (!pdata.can(username, 'write', newAbsPath)) {
              console.warn(`${logPrefix} Access Denied. User='${username}', action='write' (for rename dest), resource='${newAbsPath}'`);
             return res.status(403).json({ error: 'Forbidden: You do not have permission to create the destination file name.' });
        }
        console.log(`${logPrefix} Access Granted. User='${username}', action='write', resources='${oldAbsPath}' -> '${newAbsPath}'`);


        // 4. Check existence (Old must exist, New must NOT exist)
        try {
            await fs.access(oldAbsPath);
            console.log(`${logPrefix} STEP Source file exists: '${oldAbsPath}'`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`${logPrefix} Source file not found: '${oldAbsPath}'. Cannot rename.`);
                return res.status(404).json({ error: 'Source file not found' });
            }
            throw error;
        }
        try {
            await fs.access(newAbsPath);
            // If access succeeds, the file *exists*, which is an error for rename
             console.log(`${logPrefix} Destination file already exists: '${newAbsPath}'. Cannot rename.`);
            return res.status(409).json({ error: 'Destination file already exists' });
        } catch (error) {
            if (error.code === 'ENOENT') {
                 console.log(`${logPrefix} STEP Destination file does not exist: '${newAbsPath}' (Good)`);
                // This is the expected case - file doesn't exist, proceed.
            } else {
                // Other error checking destination
                throw error;
            }
        }


        // 5. Rename file (Permissions checked)
        console.log(`[API] Attempting rename from ${oldAbsPath} to ${newAbsPath}`);
        try {
            await fs.rename(oldAbsPath, newAbsPath);
            console.log(`${logPrefix} SUCCESS File renamed: '${oldAbsPath}' -> '${newAbsPath}'`);
            res.json({ success: true, message: 'File renamed successfully' });
        } catch (renameError) {
            // Filesystem error
            console.error(`${logPrefix} FAIL @ rename fs.rename failed. Error Code: ${renameError.code}. User='${username}'`, renameError);
            const userMessage = renameError.code === 'EACCES' ? 'Permission denied to rename file (filesystem).' : `Server failed to rename file (${renameError.code}).`;
            return res.status(500).json({ error: userMessage });
        }

    } catch (error) {
        console.error(`${logPrefix} User='${username}'. CATCH Overall error. Error Name: ${error.name}, Message: ${error.message}. Body: ${JSON.stringify(req.body)}`, error);
         // Handle specific errors from resolvePathInDataDir
         if (error.message.startsWith('Invalid') || error.message.startsWith('Security violation')) {
            return res.status(400).json({ error: error.message });
         }
         res.status(500).json({ error: `Server error renaming file: ${error.message}` });
    }
});


export default router; 