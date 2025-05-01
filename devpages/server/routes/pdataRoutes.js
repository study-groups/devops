import express from 'express';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// GET /api/pdata/list
// This route expects authMiddleware to have run first, providing req.user
// It also expects pdataInstance to be attached as req.pdata and the application's
// data directory path to be available (e.g., as req.dataDir or via imported config).
router.get('/list', async (req, res) => {
    // Ensure required properties from middleware exist
    if (!req.user || !req.user.username) {
        console.error('[API /pdata/list ROUTE] User information missing from request. Ensure authMiddleware ran.');
        return res.status(500).json({ error: 'Internal Server Error: User context missing.' });
    }
     if (!req.pdata) {
        console.error('[API /pdata/list ROUTE] PData instance missing from request. Ensure server setup is correct.');
        return res.status(500).json({ error: 'Internal Server Error: PData context missing.' });
    }
    // Get dataDir - prefer from req if attached, otherwise fallback (though relying on req is better)
    // We'll assume it's attached as req.dataDir by the middleware in server.js
    if (!req.dataDir) {
         console.error('[API /pdata/list ROUTE] Data directory missing from request. Ensure server setup is correct.');
         return res.status(500).json({ error: 'Internal Server Error: Data context missing.' });
    }

    const username = req.user.username;
    const pdata = req.pdata;
    const dataDir = req.dataDir; // Use the value attached in server.js middleware

    let targetDir;
    let canList;
    const userRole = pdata.getUserRole(username);

    if (userRole === 'admin') {
        targetDir = dataDir; // Admin lists the application's data directory
        canList = pdata.can(username, 'list', targetDir);
    } else if (userRole === 'user') {
        targetDir = path.join(dataDir, username); // User lists their implicit directory
        canList = pdata.can(username, 'list', targetDir);
    } else {
         console.log(`[API /pdata/list ROUTE] Denying access for user ${username} with unknown/missing role.`);
         return res.status(403).json({ error: 'Permission denied. Unknown role.' });
    }

    console.log(`[API /pdata/list ROUTE] User: ${username}, Role: ${userRole}, Checking list access for: ${targetDir}`);

    if (canList) {
        try {
             await fs.access(targetDir); // Check existence at FS level
             const entries = await fs.readdir(targetDir, { withFileTypes: true });
             const listing = entries.map(entry => ({
                name: entry.name,
                isDirectory: entry.isDirectory(),
             }));
             console.log(`[API /pdata/list ROUTE] Listing allowed for ${username} on ${targetDir}. Found ${listing.length} entries.`);
             res.json({ success: true, path: targetDir, listing: listing });
        } catch (error) {
             if (error.code === 'ENOENT') {
                console.error(`[API /pdata/list ROUTE] Target directory not found: ${targetDir}`);
                res.status(404).json({ success: false, error: `Directory not found: ${targetDir}` });
             } else if (error.code === 'EACCES') {
                console.error(`[API /pdata/list ROUTE] Filesystem permission error reading directory: ${targetDir}`, error);
                res.status(500).json({ success: false, error: `Server error reading directory (permissions): ${targetDir}` });
             }
             else {
                console.error(`[API /pdata/list ROUTE] Error listing directory ${targetDir}:`, error);
                res.status(500).json({ success: false, error: `Server error listing directory: ${error.message}` });
             }
        }
    } else {
         console.log(`[API /pdata/list ROUTE] Denying PData list access for ${username} on ${targetDir}.`);
         res.status(403).json({ success: false, error: 'Permission denied by PData.' });
    }
});

// Add other /api/pdata/... routes here later if needed

export default router; // Export the router instance
