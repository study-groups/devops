import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs'; // Needed for checking/creating temp upload dir

// We no longer need userUtils or fileUtils imports here

// --- Helper for consistent error handling ---
function getErrorStatusAndMessage(error) {
    let status = 500;
    // Default message or use error message directly in dev?
    let message = (process.env.NODE_ENV === 'development' && error.message) ? error.message : 'Internal Server Error';

    if (error.message?.includes('Permission denied')) {
        status = 403;
        message = error.message; // Use the specific permission error
    } else if (error.message?.includes('not found')) {
        status = 404;
        message = error.message;
    } else if (error.message?.includes('not a file') || error.message?.includes('not a directory') || error.message?.includes('not a file or symbolic link')) {
        status = 400; // Bad request - trying action on wrong type
        message = error.message;
    } else if (error.message?.includes('Invalid path')) {
         status = 400; // Bad request - path issue
         message = error.message;
    } else if (error.message?.includes('Cannot overwrite')) {
        status = 409; // Conflict - Cannot overwrite
        message = error.message;
    }
    // Add more specific error code checks if needed (e.g., EACCES, ENOENT)
    else if (error.code === 'EACCES') {
        status = 403;
        message = 'Filesystem permission denied';
    } else if (error.code === 'ENOENT') {
        status = 404;
        message = 'Filesystem entry not found';
    } else if (error.code === 'EISDIR') {
         status = 400;
         message = 'Operation cannot be performed on a directory';
    }

    return { status, message };
}


// --- Factory Function ---
// This is the main export now. It creates and configures the router.
export function createPDataRoutes(pdataInstance) {
    // Create router *inside* the factory
    const router = express.Router();

    // --- Multer Setup ---
    // Configure multer destination based on the injected instance's uploadsDir
    const tempUploadDir = path.join(pdataInstance.uploadsDir, 'temp');
    try {
        if (!fs.existsSync(tempUploadDir)) {
            console.log(`[PData Routes] Creating temp upload directory: ${tempUploadDir}`);
            fs.mkdirSync(tempUploadDir, { recursive: true });
        } else if (!fs.statSync(tempUploadDir).isDirectory()) {
            console.error(`[PData Routes FATAL] Temp upload path exists but is not a directory: ${tempUploadDir}`);
            throw new Error(`Failed to setup temp upload directory`);
        }
    } catch(error) {
        console.error(`[PData Routes FATAL] Error ensuring temp upload directory: ${error.message}`);
        throw error; // Stop if we can't setup uploads
    }
    const upload = multer({ dest: tempUploadDir });


    // --- PData Route Middleware ---
    // This middleware runs for all routes defined *on this specific pdataRouter*.
    router.use((req, res, next) => {
        // 1. Check Authentication: Uses Passport's `req.isAuthenticated()` method.
        //    This method relies on `express-session` and `passport.session()` middleware
        //    having run *before* this router in the main server setup.
        //    It checks if the session is valid and if `deserializeUser` succeeded.
        if (!req.isAuthenticated()) {
             console.log('[PData Routes Middleware] Access denied: req.isAuthenticated() returned false.');
             return res.status(401).json({ error: 'Unauthorized' });
        }

        // 2. Attach PData Instance: If authenticated, make the shared PData instance
        //    available to the route handlers via `req.pdata`.
        //    `req.user` should already be populated by Passport's deserializeUser.
        console.log(`[PData Routes Middleware] User authenticated: ${req.user?.username}. Attaching pdata instance.`);
        req.pdata = pdataInstance;
        next(); // Proceed to the specific route handler (e.g., GET /list)
    });


    // --- Routes ---

    // List files
    router.get('/list', async (req, res) => {
        const logPrefix = '[API /list]';
        try {
            const username = req.user.username;
            const requestedDir = req.query.dir || '';
            
            // Call method directly on req.pdata
            const { dirs: dirNames, files: fileNames } = await req.pdata.listDirectory(username, requestedDir);
            
            // Transform the array of strings into objects with 'name' properties
            const dirs = dirNames.map(name => ({ name }));
            const files = fileNames.map(name => ({ name }));
            
            res.json({ dirs, files });
        } catch (error) {
            const { status, message } = getErrorStatusAndMessage(error);
            res.status(status).json({ error: message });
        }
    });

        
    // Read file
    router.get('/read', async (req, res) => {
        const logPrefix = '[PDATA /read]';
        const org = req.query.org;
        const file = req.query.file;
        
        if (!file) {
            return res.status(400).json({ error: 'File parameter is required' });
        }

        try {
            console.log(`${logPrefix} Client requested file: '${file}', org: '${org || 'default'}'`);
            
            // If org is specified, prepend it to the file path
            let effectiveFile = file;
            if (org) {
                effectiveFile = path.join(org, file);
            }

            const content = await req.pdata.readFile('system', effectiveFile); // Use system user for PData routes
            
            console.log(`${logPrefix} Org '${org || 'default'}': mapped '${file}' → '${effectiveFile}'`);
            
            res.setHeader('Content-Type', 'text/plain');
            res.send(content);
            
        } catch (error) {
            console.error(`${logPrefix} Error with org '${org}' for file '${file}':`, error);
            res.status(404).json({ error: 'File not found' });
        }
    });

    // Write file
    router.post('/write', async (req, res) => {
        const logPrefix = '[API /write]';
        try {
            const username = req.user.username;
            const filePath = req.body.file;
            const content = req.body.content;
            console.log(`${logPrefix} User='${username}', Requested file='${filePath}'`);
            if (!filePath || content === undefined) {
                return res.status(400).json({ error: 'File path and content body fields are required' });
            }
            // Call method directly on req.pdata
            await req.pdata.writeFile(username, filePath, content);
            res.json({ success: true });
        } catch (error) {
            console.error(`${logPrefix} Error:`, error);
            const { status, message } = getErrorStatusAndMessage(error);
            res.status(status).json({ error: message });
        }
    });

    // Delete file
    router.delete('/delete', async (req, res) => {
        const logPrefix = '[API /delete]';
        try {
            const username = req.user.username;
            const filePath = req.body.file;
            console.log(`${logPrefix} User='${username}', Requested deletion of file='${filePath}'`);
            if (!filePath) {
                return res.status(400).json({ error: 'File path body field is required' });
            }
            // Call method directly on req.pdata
            await req.pdata.deleteFile(username, filePath);
            res.json({ success: true });
        } catch (error) {
            console.error(`${logPrefix} Error:`, error);
            const { status, message } = getErrorStatusAndMessage(error);
            res.status(status).json({ error: message });
        }
    });

    // Upload file
    router.post('/upload', upload.single('file'), async (req, res) => {
        const logPrefix = '[API /upload]';
        try {
            // Middleware already checked authentication and attached pdata
            const username = req.user.username;
            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: 'No file provided in the "file" field' });
            }
            console.log(`${logPrefix} User='${username}', Uploaded file='${file.originalname}', tempPath='${file.path}'`);
            // Call method directly on req.pdata
            const relativeUrlPath = await req.pdata.handleUpload(file);
            res.json({ success: true, url: relativeUrlPath });
        } catch (error) {
            console.error(`${logPrefix} Error:`, error);
             // Use generic message, handleUpload logs details
            res.status(500).json({ error: 'Error processing uploaded file' });
        }
    });

    // Return the configured router instance
    return router;
}

// Remove the old default export:
// export default router;
