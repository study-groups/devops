/**
 * files.js - Standardized API for file operations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs/promises');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');

// Base directory for storing files
const getBaseDir = (req) => {
  const baseDir = process.env.MD_DIR || path.join(__dirname, '../../data');
  return baseDir;
};

// Get user directory
const getUserDir = (req) => {
  return req.user ? req.user.username : null;
};

// Helper to validate filename
const isValidFilename = (filename) => {
  return filename && 
         typeof filename === 'string' && 
         !filename.includes('..') && 
         !filename.includes('/');
};

// Helper to validate directory
const isValidDirectory = (directory) => {
  return directory && 
         typeof directory === 'string' && 
         !directory.includes('..') && 
         !directory.includes('/');
};

// Helper function to get user's base directory
const getUserBaseDir = (req) => {
    const baseDir = process.env.MD_DIR || path.join(__dirname, '../../data');
    const username = req.user?.username;
    if (!username) {
        // This case should ideally be prevented by authMiddleware
        console.error('[getUserBaseDir] Failed: Username not found in req.user');
        throw new Error('Cannot determine user base directory without username');
    }
    // Base directory is simply MD_DIR/username
    const userSpecificBase = path.join(baseDir, username);
    // console.log(`[getUserBaseDir] Determined base for '${username}': ${userSpecificBase}`); // Optional: uncomment if needed
    return userSpecificBase;
};

// Gets full path to file, with security validation
const getFullPath = (req, directory, filename) => {
  const username = req.user?.username || '[unknown_user]';
  console.log(`[getFullPath ENTRY] User='${username}', Input directory='${directory}', filename='${filename}'`);

  if (!isValidFilename(filename)) {
    console.error(`[getFullPath FAIL] Invalid filename: '${filename}'. User='${username}'.`);
    throw new Error('Invalid filename format');
  }

  // Use the overall base directory (e.g., /root/pj/md)
  const serverBaseDir = getBaseDir(req); 
  console.log(`[getFullPath STEP 1] Server base directory: '${serverBaseDir}'`);

  const relativeDir = directory || '';
  console.log(`[getFullPath STEP 2] Using relative directory from client: '${relativeDir}'`);

  if (relativeDir.includes('..') || relativeDir.startsWith('/')) {
    console.error(`[getFullPath FAIL] Invalid relative directory: '${relativeDir}'. User='${username}'.`);
    throw new Error('Invalid directory path structure (relative part)');
  }

  // Combine overall server base + client relative dir + filename
  const combinedPath = path.join(serverBaseDir, relativeDir, filename);
  console.log(`[getFullPath STEP 3] Combined path (serverBaseDir + relativeDir + filename): '${combinedPath}'`);

  const resolvedPath = path.resolve(combinedPath);
  // Use the overall server base for the security check now
  const resolvedBaseDir = path.resolve(serverBaseDir); 
  console.log(`[getFullPath STEP 4] Resolved path: '${resolvedPath}', Resolved server base: '${resolvedBaseDir}'`);

  // Check if resolved path is within the overall server base directory
  if (!resolvedPath.startsWith(resolvedBaseDir + path.sep) && resolvedPath !== resolvedBaseDir) {
      console.error(`[getFullPath FAIL] Path escape detected! Resolved path '${resolvedPath}' is outside server base '${resolvedBaseDir}'. User='${username}'.`);
      throw new Error('Security violation: Path escape detected');
  }

  console.log(`[getFullPath SUCCESS] Returning validated path: '${resolvedPath}'`);
  return resolvedPath; 
};

/**
 * GET /api/files/list
 * Get list of files and subdirectories in a directory relative to the session context.
 */
router.get('/list', authMiddleware, async (req, res) => {
   try {
       const actualBaseDir = getBaseDir(req); // Get the root data directory (e.g., ./data)
       const requestedDir = req.query.dir || ''; // Get the directory requested by client (e.g., 'gridranger' or 'gridranger/subdir')

       // Basic validation
       // Prevent climbing up the directory tree
       if (requestedDir.includes('..')) {
           return res.status(400).json({ error: 'Invalid directory path (contains ..)' });
       }
       // Optional: Add user-specific access control here if needed later
       // E.g., ensure requestedDir starts with req.user.username unless user is 'mike'

       const targetDir = path.join(actualBaseDir, requestedDir); // Construct the full path
       console.log(`[API /list] Listing contents of: ${targetDir} (Base: ${actualBaseDir}, Requested: ${requestedDir})`);

       // Check if target directory exists
       await fs.access(targetDir); 

       const entries = await fs.readdir(targetDir, { withFileTypes: true });
       const files = entries.filter(e => e.isFile()).map(e => e.name);
       const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
       
       // Sort directories and files alphabetically
       dirs.sort();
       files.sort();

       console.log(`[API /list] Found Dirs: [${dirs.join(', ')}], Files: [${files.join(', ')}]`);
       res.json({ dirs, files }); // Return object with both lists

   } catch (error) {
       console.error('[API /list] Error:', error);
       if (error.code === 'ENOENT') {
           // Correctly handle directory not found - Log the directory requested in the query
           console.log(`[API /list] Directory not found: '${req.query.dir || ''}'. Returning empty lists.`); 
           res.json({ dirs: [], files: [] }); 
       } else {
           res.status(500).json({ error: error.message });
       }
   }
});

/**
 * GET /api/files/dirs
 * Get list of directories based on username.
 * - If user is 'mike', returns all top-level directories in MD_DIR.
 * - Otherwise, returns only the user's own directory name.
 */
router.get('/dirs', authMiddleware, async (req, res) => {
   try {
       const username = req.user?.username; // Get username from authMiddleware

       if (!username) {
           // Should not happen if authMiddleware is effective, but handle defensively
           console.warn('[API /dirs] User not found in req.user');
           return res.status(401).json({ error: 'User not authenticated' });
       }

       const baseDir = getBaseDir(req); // Use existing helper to get base MD_DIR

       if (username.toLowerCase() === 'mike') {
           // --- Logic for user 'mike' --- 
           console.log(`[API /dirs] User 'mike' detected. Listing all dirs in ${baseDir}`);
           try {
                await fs.access(baseDir); // Check if base directory exists
                const entries = await fs.readdir(baseDir, { withFileTypes: true });
                const directories = entries
                   .filter(entry => entry.isDirectory())
                   .map(entry => entry.name);
                console.log(`[API /dirs] Returning all directories for 'mike': ${directories.join(', ')}`);
                res.json(directories);
           } catch (error) {
               // Handle case where baseDir might not exist for mike
               if (error.code === 'ENOENT') {
                   console.error(`[API /dirs] Base directory ${baseDir} not found for user 'mike'.`);
                   // Return empty list if base dir doesn't exist, perhaps mike hasn't used it yet
                   return res.json([]); 
               } else {
                   // Log unexpected errors but try to continue gracefully if possible
                   console.error('[API /dirs] Unexpected error listing directories for mike:', error);
                   // Depending on severity, maybe return empty or re-throw
                   return res.status(500).json({ error: 'Failed to list directories' }); 
               }
           }
       } else {
           // --- Logic for other users --- 
           console.log(`[API /dirs] User '${username}' detected. Returning only user directory.`);
           // Simply return the username in an array
           // Check if their specific directory exists, create if not?
           const userDirPath = path.join(baseDir, username);
           try {
               await fs.access(userDirPath); 
               // Directory exists, return just the username
               res.json([username]); 
           } catch (error) {
               if (error.code === 'ENOENT') {
                   // Directory doesn't exist, create it and then return username
                   console.log(`[API /dirs] Directory for user '${username}' not found. Creating: ${userDirPath}`);
                   try {
                       await fs.mkdir(userDirPath, { recursive: true });
                       res.json([username]); // Return username after creating dir
                   } catch (mkdirError) {
                        console.error(`[API /dirs] Failed to create directory for user '${username}':`, mkdirError);
                        res.status(500).json({ error: 'Failed to create user directory' });
                   }
               } else {
                   // Other error accessing user directory
                   throw error;
               }
           }
       }

   } catch (error) {
       console.error('[API /dirs] General Error:', error);
       res.status(500).json({ error: error.message || 'Internal server error' });
   }
});

/**
 * GET /api/files/content/:dir/:file
 * Get file content
 */
router.get('/content/:dir/:file', authMiddleware, async (req, res) => {
  try {
    const directory = req.params.dir;
    const filename = req.params.file;
    
    const fullPath = getFullPath(req, directory, filename);
    
    console.log(`[API] Getting file content: ${fullPath}`);
    
    const content = await fs.readFile(fullPath, 'utf8');
    
    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.md') {
      res.setHeader('Content-Type', 'text/markdown');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    
    res.send(content);
  } catch (error) {
    console.error('[API ERROR]', error);
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files/content
 * Get file content (query params version)
 */
router.get('/content', async (req, res) => {
  // --- DETAILED LOGGING START ---
  console.log(`[/api/files/content ENTRY] Received query params: dir='${req.query.dir}', file='${req.query.file}'`);
  // --- DETAILED LOGGING END ---
  try {
    const { dir, file } = req.query;
    
    if (!file) {
      console.error('[/api/files/content FAIL] Filename missing in query.');
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    // --- DETAILED LOGGING START ---
    console.log(`[/api/files/content STEP] Calling getFullPath with dir='${dir}', file='${file}'`);
    // --- DETAILED LOGGING END ---
    const fullPath = getFullPath(req, dir, file); // Call getFullPath
    
    // --- DETAILED LOGGING START ---
    console.log(`[/api/files/content STEP] getFullPath returned: '${fullPath}'. Attempting readFile...`);
    // --- DETAILED LOGGING END ---
    const content = await fs.readFile(fullPath, 'utf8');
    
    // --- DETAILED LOGGING START ---
    console.log(`[/api/files/content SUCCESS] Read file content successfully for '${fullPath}'. Sending response.`);
    // --- DETAILED LOGGING END ---
    
    // Set appropriate content type
    const ext = path.extname(file).toLowerCase();
    if (ext === '.md') {
      res.setHeader('Content-Type', 'text/markdown');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    
    res.send(content);
  } catch (error) {
    // --- DETAILED LOGGING START ---
    console.error(`[/api/files/content CATCH] Caught error: ${error.message}`, error);
    // --- DETAILED LOGGING END ---
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/files/save
 * Save file content
 */
router.post('/save', authMiddleware, express.json({ type: '*/*' }), async (req, res) => {
  const username = req.user?.username || '[unknown_user_in_save]';
  console.log(`[POST /save ENTRY] User='${username}'. Received body: ${JSON.stringify(req.body)}`);
  try {
    // 1. Extract data from body
    const { dir, name, content } = req.body;
    console.log(`[POST /save STEP 1] Extracted from body: dir='${dir}', name='${name}', content provided?: ${content !== undefined}`);

    // 2. Validate required fields
    if (!name) {
      console.error(`[POST /save FAIL @ Validation] Filename (name) missing in body. User='${username}'. Body: ${JSON.stringify(req.body)}`);
      return res.status(400).json({ error: 'Filename (name) is required in request body' });
    }
    if (dir === undefined || dir === null) { // Ensure dir is present, even if ""
      console.error(`[POST /save FAIL @ Validation] Directory (dir) missing in body. User='${username}'. Body: ${JSON.stringify(req.body)}`);
      return res.status(400).json({ error: 'Directory (dir) is required in request body' });
    }
    if (typeof content !== 'string') {
      console.error(`[POST /save FAIL @ Validation] Content missing or not a string in body. User='${username}'. Body: ${JSON.stringify(req.body)}`);
      return res.status(400).json({ error: 'Content string is required in request body' });
    }

    // 3. Get the fully resolved and validated path using the helper function
    console.log(`[POST /save STEP 2] Calling getFullPath for User='${username}', dir='${dir}', name='${name}'`);
    const fullPath = getFullPath(req, dir, name); // This now returns the resolved path
    console.log(`[POST /save STEP 3] getFullPath returned resolved path: '${fullPath}'`);

    // 4. Ensure parent directory exists
    const directoryPath = path.dirname(fullPath);
    console.log(`[POST /save STEP 4] Ensuring parent directory exists: '${directoryPath}'`);
    // *** PERMISSION CHECK POINT 1 ***: Does user '${username}' (or the node process user) have write permissions for '${directoryPath}'?
    try {
        await fs.mkdir(directoryPath, { recursive: true });
        console.log(`[POST /save STEP 5] fs.mkdir seemingly succeeded for: '${directoryPath}'`);
    } catch (mkdirError) {
        console.error(`[POST /save FAIL @ mkdir] fs.mkdir failed for directory '${directoryPath}'. Error Code: ${mkdirError.code}, Message: ${mkdirError.message}. User='${username}'`, mkdirError);
        // Provide a more specific error message if possible
        const userMessage = mkdirError.code === 'EACCES' ? 'Permission denied to create directory.' : `Server failed to create directory (${mkdirError.code}).`;
        // Don't throw here, send response directly
        return res.status(500).json({ error: userMessage });
    }

    // 5. Write file content
    console.log(`[POST /save STEP 6] Attempting to write file: '${fullPath}'`);
    // *** PERMISSION CHECK POINT 2 ***: Does user '${username}' (or the node process user) have write permissions for the file '${fullPath}'?
    try {
        await fs.writeFile(fullPath, content, 'utf8');
        console.log(`[POST /save SUCCESS] fs.writeFile succeeded for: '${fullPath}'`);
    } catch (writeFileError) {
        console.error(`[POST /save FAIL @ writeFile] fs.writeFile failed for path '${fullPath}'. Error Code: ${writeFileError.code}, Message: ${writeFileError.message}. User='${username}'`, writeFileError);
        // Provide a more specific error message if possible
        const userMessage = writeFileError.code === 'EACCES' ? 'Permission denied to write file.' : `Server failed to write file (${writeFileError.code}).`;
         // Don't throw here, send response directly
        return res.status(500).json({ error: userMessage });
    }

    // 6. Send success response
    console.log(`[POST /save FINAL SUCCESS] File saved successfully: User='${username}', Path='${fullPath}'`);
    res.json({ success: true, message: 'File saved successfully' });

  } catch (error) { // Catch errors from validation, getFullPath, or unexpected issues
    console.error(`[POST /save CATCH] Overall error in /save handler for User='${username}'. Error Name: ${error.name}, Message: ${error.message}. Body received: ${JSON.stringify(req.body)}`, error);
    // Ensure a response is sent
    res.status(500).json({ error: `Server error processing save request: ${error.message}` });
  }
});

/**
 * DELETE /api/files/delete
 * Delete a file
 */
router.delete('/delete', authMiddleware, async (req, res) => {
  try {
    const { dir, file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    const fullPath = getFullPath(req, dir, file);
    
    console.log(`[API] Deleting file: ${fullPath}`);
    
    // Check if file exists
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete file
    await fs.unlink(fullPath);
    
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/files/rename
 * Rename a file
 */
router.post('/rename', authMiddleware, express.json(), async (req, res) => {
  try {
    const { dir, oldName, newName } = req.body;
    
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Both old and new filenames are required' });
    }
    
    if (!isValidFilename(oldName) || !isValidFilename(newName)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const directory = dir || getUserDir(req);
    
    if (!isValidDirectory(directory)) {
      return res.status(400).json({ error: 'Invalid directory' });
    }
    
    const baseDir = getBaseDir(req);
    const oldPath = path.join(baseDir, directory, oldName);
    const newPath = path.join(baseDir, directory, newName);
    
    console.log(`[API] Renaming file from ${oldPath} to ${newPath}`);
    
    // Check if old file exists
    const oldExists = await fs.access(oldPath).then(() => true).catch(() => false);
    if (!oldExists) {
      return res.status(404).json({ error: 'Source file not found' });
    }
    
    // Check if new file already exists
    const newExists = await fs.access(newPath).then(() => true).catch(() => false);
    if (newExists) {
      return res.status(409).json({ error: 'Destination file already exists' });
    }
    
    // Rename file
    await fs.rename(oldPath, newPath);
    
    res.json({ success: true, message: 'File renamed successfully' });
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 