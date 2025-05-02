/**
 * files.js - Standardized API for file operations
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
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

    const dataDir = pdata.dataDir; // Get the managed data directory root from PData
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


/**
 * GET /api/files/list
 * Get list of files and subdirectories in a directory relative to the PData dataDir.
 */
router.get('/list', async (req, res) => { // Removed authMiddleware here
   const logPrefix = '[API /list]';
   const username = req.user.username; // From authMiddleware
   const pdata = req.pdata; // PData instance

   try {
       const requestedRelativeDir = req.query.dir ?? ''; // Relative path from client
       console.log(`${logPrefix} User='${username}', Request query dir='${req.query.dir}', using relativeDir='${requestedRelativeDir}'`);

       // 1. Resolve the absolute path to the target directory
       const targetDirAbsPath = resolvePathInDataDir(req, requestedRelativeDir); // Filename is empty
       console.log(`${logPrefix} Resolved target directory absolute path: '${targetDirAbsPath}'`);

       // 2. Check permission using PData
       if (!pdata.can(username, 'list', targetDirAbsPath)) {
           console.warn(`${logPrefix} Access Denied. User='${username}', action='list', resource='${targetDirAbsPath}'`);
           return res.status(403).json({ error: 'Forbidden: You do not have permission to list this directory.' });
       }
       console.log(`${logPrefix} Access Granted. User='${username}', action='list', resource='${targetDirAbsPath}'`);

       // 3. Check if directory exists and is a directory
       let stats;
       try {
           stats = await fs.stat(targetDirAbsPath);
           if (!stats.isDirectory()) {
               console.warn(`${logPrefix} Path exists but is not a directory: '${targetDirAbsPath}'`);
               return res.status(400).json({ error: 'Path is not a directory' });
           }
           console.log(`${logPrefix} Target directory exists and is a directory.`);
       } catch (error) {
           if (error.code === 'ENOENT') {
               console.log(`${logPrefix} Target directory not found: '${targetDirAbsPath}'. Requested relativeDir='${requestedRelativeDir}'. Returning empty lists.`);
               // If user had permission to list a non-existent dir, return empty (consistent with previous logic)
               return res.json({ dirs: [], files: [] });
           } else {
               console.error(`${logPrefix} Error checking target directory '${targetDirAbsPath}':`, error);
               throw error; // Re-throw other errors
           }
       }

       // 4. Read directory contents (Permission already checked)
       console.log(`${logPrefix} Reading contents of: '${targetDirAbsPath}'`);
       const entries = await fs.readdir(targetDirAbsPath, { withFileTypes: true });
       console.log(`${logPrefix} Found ${entries.length} entries.`);

       // 5. Separate files and directories (filtering logic remains the same)
       const files = [];
       const dirs = [];
       for (const e of entries) {
            const entryAbsPath = path.join(targetDirAbsPath, e.name);
             // Optional: Add fine-grained check? Maybe not needed if 'list' on parent is enough.
             // However, consider symlinks potentially pointing outside allowed areas.
             // Let's stick to the simpler model for now: if you can list parent, you see names.
           if (e.isDirectory()) {
               dirs.push(e.name);
           } else if (e.isFile() || e.isSymbolicLink()) {
               files.push(e.name);
           }
       }
       dirs.sort((a, b) => a.localeCompare(b));
       files.sort((a, b) => a.localeCompare(b));

       console.log(`${logPrefix} Filtered - Dirs: [${dirs.join(', ')}], Files: [${files.join(', ')}]`);
       res.json({ dirs, files });

   } catch (error) {
       console.error(`${logPrefix} User='${username}'. Unexpected Error:`, error);
       res.status(500).json({ error: error.message || 'Internal server error while listing directory.' });
   }
});

// --- Endpoint: /api/files/dirs ---
// This endpoint's logic was quite specific (mike vs others).
// Let's adapt it using PData roles and permissions.
router.get('/dirs', async (req, res) => { // Removed authMiddleware
    const logPrefix = '[API /dirs]';
    const username = req.user.username;
    const pdata = req.pdata;
    const userRole = req.user.role; // Assumes role is populated in session by login route

    console.log(`${logPrefix} Request received. User='${username}', Role='${userRole}'`);

    if (!userRole) {
        console.warn(`${logPrefix} User '${username}' has no role assigned in session.`);
        // Fallback or error? Let's deny access for now if role is missing.
        return res.status(403).json({ error: 'Forbidden: User role not determined.' });
    }

    const dataDir = pdata.dataDir; // The root data directory managed by PData

    try {
        let directoriesToList = [];

        if (userRole === 'admin') {
            // Admin: List all top-level directories *within dataDir* they have 'list' permission for.
            console.log(`${logPrefix} Admin user '${username}'. Listing accessible top-level dirs in '${dataDir}'`);
            try {
                const entries = await fs.readdir(dataDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const dirAbsPath = path.join(dataDir, entry.name);
                        // Check if admin can list this specific subdirectory
                        if (pdata.can(username, 'list', dirAbsPath)) {
                            directoriesToList.push(entry.name);
                        } else {
                             console.log(`${logPrefix} Admin '${username}' cannot list specific dir: '${dirAbsPath}' (Skipping)`);
                        }
                    }
                }
                console.log(`${logPrefix} Admin accessible dirs: [${directoriesToList.join(', ')}]`);
            } catch (error) {
                 if (error.code === 'ENOENT') {
                    console.warn(`${logPrefix} dataDir '${dataDir}' not found.`);
                    directoriesToList = []; // Return empty list
                } else {
                    console.error(`${logPrefix} Error reading dataDir '${dataDir}' for admin:`, error);
                    throw error; // Re-throw unexpected errors
                }
            }
        } else if (userRole === 'user') {
            // User: Their implicit top directory is dataDir/username.
            // Return only their own directory name *if* they have list permission on it.
            const userImplicitTopDir = path.join(dataDir, username);
            console.log(`${logPrefix} Normal user '${username}'. Checking access to implicit dir: '${userImplicitTopDir}'`);

            if (pdata.can(username, 'list', userImplicitTopDir)) {
                // Check existence, create if necessary (and allowed implicitly by 'list'?)
                // PData's current design doesn't explicitly handle auto-creation based on 'can'.
                // Let's check existence first. If it exists, add it.
                // If not, we might need a separate mechanism or policy decision on auto-creation.
                 try {
                    const stats = await fs.stat(userImplicitTopDir);
                    if (stats.isDirectory()) {
                         directoriesToList.push(username);
                         console.log(`${logPrefix} User '${username}' can list existing implicit dir.`);
                    } else {
                         console.warn(`${logPrefix} User '${username}' implicit path '${userImplicitTopDir}' exists but is not a directory.`);
                    }
                 } catch (error) {
                    if (error.code === 'ENOENT') {
                        console.log(`${logPrefix} User '${username}' implicit dir '${userImplicitTopDir}' does not exist. Not including in list.`);
                        // Original code created it. Let's reconsider that.
                        // If PData grants 'list' on a non-existent dir, should it appear? Probably not.
                        // Let's *not* auto-create here. Creation should likely be tied to a 'write' or 'create' action.
                    } else {
                        console.error(`${logPrefix} Error checking user implicit dir '${userImplicitTopDir}':`, error);
                        throw error; // Re-throw unexpected errors
                    }
                 }
            } else {
                console.log(`${logPrefix} User '${username}' does not have 'list' permission on implicit dir '${userImplicitTopDir}'.`);
            }
        } else {
            console.warn(`${logPrefix} Unknown role '${userRole}' for user '${username}'. Returning empty list.`);
            // Return empty list for unknown roles
        }

        // Sort and return
        directoriesToList.sort((a, b) => a.localeCompare(b));
        console.log(`${logPrefix} Returning directories for user '${username}': [${directoriesToList.join(', ')}]`);
        res.json(directoriesToList);

    } catch (error) {
        console.error(`${logPrefix} User='${username}'. General Error:`, error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});


/**
 * GET /api/files/content?dir=...&file=...
 * Get file content (query params version)
 */
// Note: Removed the /content/:dir/:file version for simplicity unless needed.
router.get('/content', async (req, res) => { // Removed authMiddleware
  const logPrefix = '[API /content]';
  const username = req.user.username;
  const pdata = req.pdata;
  console.log(`${logPrefix} User='${username}'. Received query params: dir='${req.query.dir}', file='${req.query.file}'`);

  try {
    const { dir: relativeDir, file: filename } = req.query;

    if (!filename) {
      console.error(`${logPrefix} FAIL Filename missing in query. User='${username}'.`);
      return res.status(400).json({ error: 'Filename is required' });
    }

    // 1. Resolve absolute path
    console.log(`${logPrefix} STEP Resolving path with relativeDir='${relativeDir}', filename='${filename}'`);
    const resolvedAbsPath = resolvePathInDataDir(req, relativeDir, filename);
    console.log(`${logPrefix} STEP Resolved absolute path: '${resolvedAbsPath}'`);

    // 2. Check permission using PData
    if (!pdata.can(username, 'read', resolvedAbsPath)) {
           console.warn(`${logPrefix} Access Denied. User='${username}', action='read', resource='${resolvedAbsPath}'`);
           return res.status(403).json({ error: 'Forbidden: You do not have permission to read this file.' });
    }
    console.log(`${logPrefix} Access Granted. User='${username}', action='read', resource='${resolvedAbsPath}'`);


    // 3. Read file content (Permission already checked)
    console.log(`${logPrefix} STEP Attempting readFile: '${resolvedAbsPath}'`);
    const content = await fs.readFile(resolvedAbsPath, 'utf8');
    console.log(`${logPrefix} SUCCESS Read file content for '${resolvedAbsPath}'.`);

    // Set content type and send
    const ext = path.extname(filename).toLowerCase();
    res.setHeader('Content-Type', ext === '.md' ? 'text/markdown' : 'text/plain');
    res.send(content);

  } catch (error) {
    console.error(`${logPrefix} User='${username}'. CATCH Error: ${error.message}`, error);
    if (error.code === 'ENOENT') {
      // Check if the error was because the file itself doesn't exist,
      // even if the user *could* have read it if it did.
      return res.status(404).json({ error: 'File not found' });
    }
     // Handle specific errors thrown by resolvePathInDataDir (like invalid name/dir)
     if (error.message.startsWith('Invalid') || error.message.startsWith('Security violation')) {
        return res.status(400).json({ error: error.message });
     }
     // Check for permission denied errors at the FS level (should ideally be caught by pdata.can, but defense-in-depth)
     if (error.code === 'EACCES') {
          console.error(`${logPrefix} Filesystem EACCES error despite PData check for User='${username}', action='read'. This might indicate a permissions mismatch.`);
          return res.status(500).json({ error: 'Internal server error (filesystem permission issue)' });
     }
    // Generic error
    res.status(500).json({ error: `Server error reading file: ${error.message}` });
  }
});

/**
 * POST /api/files/save
 * Save file content
 */
router.post('/save', express.json({ type: '*/*' }), async (req, res) => { // Removed authMiddleware
    const logPrefix = '[API /save]';
    const username = req.user.username;
    const pdata = req.pdata;
    console.log(`${logPrefix} User='${username}'. Received body: ${JSON.stringify(req.body)}`);

    try {
        const { dir: relativeDir, name: filename, content } = req.body;
        console.log(`${logPrefix} STEP Extracted: relativeDir='${relativeDir}', filename='${filename}', content provided?: ${content !== undefined}`);

        // 1. Validate required body fields
        if (filename === undefined || filename === null) {
             console.error(`${logPrefix} FAIL Filename (name) missing. User='${username}'.`);
             return res.status(400).json({ error: 'Filename (name) is required' });
        }
        if (relativeDir === undefined || relativeDir === null) { // Allow ""
             console.error(`${logPrefix} FAIL Directory (dir) missing. User='${username}'.`);
             return res.status(400).json({ error: 'Directory (dir) is required' });
        }
        if (typeof content !== 'string') {
             console.error(`${logPrefix} FAIL Content missing or not string. User='${username}'.`);
             return res.status(400).json({ error: 'Content string is required' });
        }

        // 2. Resolve absolute path
        console.log(`${logPrefix} STEP Resolving path with relativeDir='${relativeDir}', filename='${filename}'`);
        const resolvedAbsPath = resolvePathInDataDir(req, relativeDir, filename);
        console.log(`${logPrefix} STEP Resolved absolute path: '${resolvedAbsPath}'`);

        // 3. Check permission using PData
        // We need 'write' permission for the file itself.
        if (!pdata.can(username, 'write', resolvedAbsPath)) {
            console.warn(`${logPrefix} Access Denied. User='${username}', action='write', resource='${resolvedAbsPath}'`);
            return res.status(403).json({ error: 'Forbidden: You do not have permission to write to this file path.' });
        }
        console.log(`${logPrefix} Access Granted. User='${username}', action='write', resource='${resolvedAbsPath}'`);

        // 4. Ensure parent directory exists
        // PData's permission model implies if you can write a file, you should be able
        // to ensure its parent directory exists *within the managed dataDir*.
        // However, fs.mkdir needs permission on the *parent* directory.
        // Let's check pdata.can('write', directoryPath) as well.
        const directoryPath = path.dirname(resolvedAbsPath);
        console.log(`${logPrefix} STEP Ensuring parent directory exists: '${directoryPath}'`);

        // Check if parent is within dataDir (should be guaranteed by resolvePathInDataDir)
        if (!directoryPath.startsWith(pdata.dataDir)) {
             console.error(`${logPrefix} FAIL Parent directory '${directoryPath}' is outside dataDir '${pdata.dataDir}' after resolving. This shouldn't happen.`);
             throw new Error("Internal error: Parent directory resolution failed security check.");
        }

        // Check permission to write to parent directory (implicitly needed for mkdir)
        if (!pdata.can(username, 'write', directoryPath)) {
             console.warn(`${logPrefix} Access Denied. User='${username}', action='write' (implicitly needed for mkdir), resource='${directoryPath}'`);
             // Provide a slightly different error message
             return res.status(403).json({ error: 'Forbidden: You do not have permission to create subdirectories in the target location.' });
        }
         console.log(`${logPrefix} Access Granted. User='${username}', action='write' (for mkdir), resource='${directoryPath}'`);


        try {
            await fs.mkdir(directoryPath, { recursive: true });
            console.log(`${logPrefix} STEP fs.mkdir seemingly succeeded for: '${directoryPath}'`);
        } catch (mkdirError) {
            // This might happen due to underlying FS permissions mismatch, even if PData allowed it.
            console.error(`${logPrefix} FAIL @ mkdir fs.mkdir failed for directory '${directoryPath}'. Error Code: ${mkdirError.code}. User='${username}'`, mkdirError);
            const userMessage = mkdirError.code === 'EACCES' ? 'Permission denied to create directory (filesystem).' : `Server failed to create directory (${mkdirError.code}).`;
            return res.status(500).json({ error: userMessage });
        }

        // 5. Write file content (Permissions already checked by PData)
        console.log(`${logPrefix} STEP Attempting writeFile: '${resolvedAbsPath}'`);
        try {
            await fs.writeFile(resolvedAbsPath, content, 'utf8');
            console.log(`${logPrefix} SUCCESS fs.writeFile succeeded for: '${resolvedAbsPath}'`);
        } catch (writeFileError) {
             // This might happen due to underlying FS permissions mismatch
            console.error(`${logPrefix} FAIL @ writeFile fs.writeFile failed for path '${resolvedAbsPath}'. Error Code: ${writeFileError.code}. User='${username}'`, writeFileError);
            const userMessage = writeFileError.code === 'EACCES' ? 'Permission denied to write file (filesystem).' : `Server failed to write file (${writeFileError.code}).`;
            return res.status(500).json({ error: userMessage });
        }

        // 6. Send success response
        console.log(`${logPrefix} FINAL SUCCESS File saved: User='${username}', Path='${resolvedAbsPath}'`);
        res.json({ success: true, message: 'File saved successfully' });

    } catch (error) {
        console.error(`${logPrefix} User='${username}'. CATCH Overall error. Error Name: ${error.name}, Message: ${error.message}. Body: ${JSON.stringify(req.body)}`, error);
         // Handle specific errors thrown by resolvePathInDataDir
         if (error.message.startsWith('Invalid') || error.message.startsWith('Security violation')) {
            return res.status(400).json({ error: error.message });
         }
        res.status(500).json({ error: `Server error processing save request: ${error.message}` });
    }
});


/**
 * DELETE /api/files/delete?dir=...&file=...
 * Delete a file
 */
router.delete('/delete', async (req, res) => { // Removed authMiddleware
    const logPrefix = '[API /delete]';
    const username = req.user.username;
    const pdata = req.pdata;
    console.log(`${logPrefix} User='${username}'. Received query: dir='${req.query.dir}', file='${req.query.file}'`);

    try {
        const { dir: relativeDir, file: filename } = req.query;

        if (!filename) {
            console.error(`${logPrefix} FAIL Filename missing. User='${username}'.`);
            return res.status(400).json({ error: 'Filename is required' });
        }

        // 1. Resolve absolute path
        const resolvedAbsPath = resolvePathInDataDir(req, relativeDir, filename);
        console.log(`${logPrefix} STEP Resolved absolute path: '${resolvedAbsPath}'`);

        // 2. Check permission using PData (requires 'write' to delete)
        if (!pdata.can(username, 'write', resolvedAbsPath)) {
            console.warn(`${logPrefix} Access Denied. User='${username}', action='write' (for delete), resource='${resolvedAbsPath}'`);
            return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this file.' });
        }
         console.log(`${logPrefix} Access Granted. User='${username}', action='write' (for delete), resource='${resolvedAbsPath}'`);

        // 3. Check if file exists before attempting delete
        try {
            await fs.access(resolvedAbsPath); // Check existence
            console.log(`${logPrefix} STEP File exists: '${resolvedAbsPath}'`);
        } catch (error) {
             if (error.code === 'ENOENT') {
                 console.log(`${logPrefix} File not found: '${resolvedAbsPath}'. Cannot delete.`);
                return res.status(404).json({ error: 'File not found' });
             }
             // Other access error
             throw error;
        }

        // 4. Delete file (Permission checked)
        console.log(`${logPrefix} STEP Attempting unlink: '${resolvedAbsPath}'`);
        try {
            await fs.unlink(resolvedAbsPath);
            console.log(`${logPrefix} SUCCESS File deleted: '${resolvedAbsPath}'`);
            res.json({ success: true, message: 'File deleted successfully' });
        } catch (unlinkError) {
            // Filesystem error (e.g., EACCES despite PData check)
             console.error(`${logPrefix} FAIL @ unlink fs.unlink failed for path '${resolvedAbsPath}'. Error Code: ${unlinkError.code}. User='${username}'`, unlinkError);
            const userMessage = unlinkError.code === 'EACCES' ? 'Permission denied to delete file (filesystem).' : `Server failed to delete file (${unlinkError.code}).`;
            return res.status(500).json({ error: userMessage });
        }

    } catch (error) {
         console.error(`${logPrefix} User='${username}'. CATCH Overall error. Error Name: ${error.name}, Message: ${error.message}. Query: ${JSON.stringify(req.query)}`, error);
         // Handle specific errors from resolvePathInDataDir
         if (error.message.startsWith('Invalid') || error.message.startsWith('Security violation')) {
            return res.status(400).json({ error: error.message });
         }
         res.status(500).json({ error: `Server error deleting file: ${error.message}` });
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