const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Helper function to ensure a directory exists
async function ensureDirectory(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}

// Helper function to get the target directory
function getTargetDirectory(baseDir, requestedDir, username) {
    // Sanitize the requested directory
    const sanitizedDir = requestedDir.replace(/\.\./g, '').replace(/[^a-zA-Z0-9_-]/g, '');
    
    // If the requested directory is the username or empty, use the user's directory
    if (sanitizedDir === username || !sanitizedDir) {
        return path.join(baseDir, username);
    }
    
    // Otherwise use the requested directory
    return path.join(baseDir, sanitizedDir);
}

// Manage symlink in Community_Files
router.post('/link', async (req, res) => {
    try {
        console.log('[COMMUNITY] Request received:', req.body);
        const { filename, directory, action } = req.body;
        
        if (!filename || !directory) {
            console.error('[COMMUNITY ERROR] Missing filename or directory in request');
            return res.status(400).json({ error: 'Filename and directory required' });
        }

        // Skip authentication check for simplicity
        // Just use a default username if not authenticated
        const username = req.auth?.name || 'guest';
        console.log(`[COMMUNITY] User: ${username}, Action: ${action}, File: ${filename}, Dir: ${directory}`);
        
        const baseDir = process.env.MD_DIR || '.';
        console.log(`[COMMUNITY] Base directory: ${baseDir}`);
        
        // Get the source directory path
        const sourceDir = getTargetDirectory(baseDir, directory, username);
        const sourcePath = path.join(sourceDir, filename);
        
        // Community_Files directory path
        const communityDir = path.join(baseDir, 'Community_Files');
        const targetPath = path.join(communityDir, filename);
        
        console.log(`[COMMUNITY] Source path: ${sourcePath}`);
        console.log(`[COMMUNITY] Target path: ${targetPath}`);

        // Ensure the Community_Files directory exists
        try {
            await ensureDirectory(communityDir);
            console.log(`[COMMUNITY] Ensured Community_Files directory exists: ${communityDir}`);
        } catch (error) {
            console.error(`[COMMUNITY ERROR] Failed to create Community_Files directory: ${error.message}`);
            return res.status(500).json({ error: 'Failed to create Community_Files directory' });
        }

        // Check if file exists in source location
        try {
            // List directory contents for debugging
            try {
                const dirContents = await fs.readdir(sourceDir);
                console.log(`[COMMUNITY] Directory ${sourceDir} contents:`, dirContents);
            } catch (err) {
                console.error(`[COMMUNITY] Could not read directory ${sourceDir}: ${err.message}`);
            }
            
            await fs.access(sourcePath);
            console.log(`[COMMUNITY] Source file exists: ${sourcePath}`);
        } catch (error) {
            console.error(`[COMMUNITY ERROR] Source file not found: ${sourcePath}, error: ${error.message}`);
            
            // If we're just checking, return false instead of an error
            if (action === 'check') {
                console.log(`[COMMUNITY] Check action with non-existent file, returning not linked`);
                return res.json({ success: true, linked: false, fileExists: false });
            }
            
            return res.status(404).json({ error: 'Source file not found' });
        }

        if (action === 'create') {
            // Create the symlink
            try {
                await fs.symlink(sourcePath, targetPath);
                console.log(`[COMMUNITY] Created symlink: ${targetPath} -> ${sourcePath}`);
                return res.json({ success: true, linked: true });
            } catch (error) {
                // If file already exists, handle gracefully
                if (error.code === 'EEXIST') {
                    console.log(`[COMMUNITY] Link already exists: ${targetPath}`);
                    return res.json({ success: true, linked: true, message: 'Link already exists' });
                }
                throw error;
            }
        } else if (action === 'remove') {
            // Remove the symlink
            try {
                const stats = await fs.lstat(targetPath);
                if (stats.isSymbolicLink()) {
                    await fs.unlink(targetPath);
                    console.log(`[COMMUNITY] Removed symlink: ${targetPath}`);
                }
                return res.json({ success: true, linked: false });
            } catch (error) {
                // If file doesn't exist, handle gracefully
                if (error.code === 'ENOENT') {
                    console.log(`[COMMUNITY] Link does not exist: ${targetPath}`);
                    return res.json({ success: true, linked: false, message: 'Link does not exist' });
                }
                throw error;
            }
        } else if (action === 'check') {
            // Check if symlink exists
            try {
                const stats = await fs.lstat(targetPath);
                const isLinked = stats.isSymbolicLink();
                console.log(`[COMMUNITY] Checked link status: ${targetPath}, linked: ${isLinked}`);
                return res.json({ success: true, linked: isLinked });
            } catch (error) {
                // If file doesn't exist, it's not linked
                if (error.code === 'ENOENT') {
                    console.log(`[COMMUNITY] Link does not exist: ${targetPath}`);
                    return res.json({ success: true, linked: false });
                }
                throw error;
            }
        } else {
            console.error(`[COMMUNITY ERROR] Invalid action: ${action}`);
            return res.status(400).json({ error: 'Invalid action specified' });
        }
    } catch (error) {
        console.error('[COMMUNITY LINK ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Simple test endpoint
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Community API is working' });
});

module.exports = router; 