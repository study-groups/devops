/**
 * files.js - Standardized API for file operations
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js'; // Import the exported name
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

/**
 * GET /api/files/list
 * Get list of files and subdirectories in a directory
 */
router.get('/list', authMiddleware, async (req, res) => {
  const username = req.user.username;
  const logPrefix = '[API /list]';

  let requestedRelativePath = '';

  try {
    requestedRelativePath = req.query.pathname || '';
    console.log(`${logPrefix} Client requested relative path: '${requestedRelativePath}'`);

    // Call PData directly with the client's requested relative path
    const listing = await req.pdata.listDirectory(username, requestedRelativePath);

    // Construct response using the ORIGINAL relative path
    const responseJson = {
      pathname: requestedRelativePath,
      dirs: listing.dirs,
      files: listing.files
    };
    console.log(`${logPrefix} Sending JSON response:`, JSON.stringify(responseJson));
    res.json(responseJson);

  } catch (error) {
    console.error(`${logPrefix} Error processing request for client path '${requestedRelativePath}':`, error);
    const statusCode = (error.code === 'ENOENT' || error.message?.includes('not found')) ? 404 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed processing request',
      requestedPath: requestedRelativePath
    });
  }
});

/**
 * GET /api/files/dirs
 * Get list of directories based on username and permissions
 */
router.get('/dirs', async (req, res) => {
  try {
    const username = req.user.username;

    // Use the correct method name from PData.js
    const directories = await req.pdata.getUserTopLevelDirectories(username);

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
  const username = req.user.username;
  const contentSubDir = 'data'; // Name of subdir in PD_DIR linking to MD_DIR

  // --- Expect a single 'pathname' parameter ---
  const requestedRelativePath = req.query.pathname; // Use 'pathname' or 'path'

  if (typeof requestedRelativePath !== 'string') { // Basic validation
    return res.status(400).json({ error: "Missing or invalid 'pathname' query parameter." });
  }
  console.log(`[API /content] Client requested relative path: '${requestedRelativePath}'`);

  // Declare error variable outside try
  let errorOccurred = null;

  try {
    // Call PData.readFile with the translated path
    const content = await req.pdata.readFile(username, requestedRelativePath);

    // Determine Content-Type based on file extension (important!)
    const ext = path.extname(requestedRelativePath).toLowerCase();
    let contentType = 'text/plain'; // Default
    if (ext === '.md') contentType = 'text/markdown; charset=utf-8';
    else if (ext === '.html') contentType = 'text/html; charset=utf-8';
    else if (ext === '.css') contentType = 'text/css; charset=utf-8';
    else if (ext === '.js') contentType = 'application/javascript; charset=utf-8';
    else if (ext === '.json') contentType = 'application/json; charset=utf-8';
    // Add more types as needed

    console.log(`[API /content] Sending content for '${requestedRelativePath}' with Content-Type: ${contentType}`);
    res.setHeader('Content-Type', contentType);
    res.send(content);

  } catch (error) {
    errorOccurred = error; // Store error for logging below
    console.error(`[API /content] Error processing request for client path '${requestedRelativePath}':`, error);
    const statusCode = (error.code === 'ENOENT' || error.message?.includes('not found')) ? 404 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to read file',
      requestedPath: requestedRelativePath
    });
  }
});

/**
 * POST /api/files/save
 * Save file content
 */
router.post('/save', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const username = req.user.username;
    const { dir, name, content } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const relativePath = path.join(dir || '', name);
    console.log(`[API /save] User='${username}', Saving file='${relativePath}'`);
    
    await req.pdata.writeFile(username, relativePath, content);
    
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    console.error('[API /save] Error:', error);
    
    if (error.message === 'Permission denied' || error.message === 'Permission denied to write in parent directory') {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Error saving file' });
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