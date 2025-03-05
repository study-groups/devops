const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { getUserMarkdownDirectory } = require('../config');
const { generateImageIndex } = require('./images').generateImageIndex;

// Get list of all directories
router.get('/dirs', async (req, res) => {
    try {
        const baseDir = process.env.MD_DIR || '.';
        await ensureDirectory(baseDir);

        const items = await fs.readdir(baseDir, { withFileTypes: true });
        
        // Process all directories from the file system
        const allDirs = await Promise.all(
            items
                .filter(item => item.isDirectory())
                .map(async item => {
                    // Special handling for Community_Files (with underscore)
                    if (item.name === 'Community_Files') {
                        return {
                            id: 'Community_Files',
                            name: '📚 Community Files',
                            description: 'Shared markdown files'
                        };
                    } else {
                        return {
                            id: item.name,
                            name: `👤 ${item.name}`,
                            description: `Personal files for ${item.name}`
                        };
                    }
                })
        );

        console.log(`[FILES] Found ${allDirs.length} directories in ${baseDir}`);
        res.json(allDirs);
    } catch (error) {
        console.error('[FILES ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Get files in directory
router.get('/list', async (req, res) => {
    try {
        const baseDir = process.env.MD_DIR || '.';
        const username = req.auth?.name;
        // Default to user's directory, not '.'
        const selectedDir = req.query.dir || username;
        const targetDir = getTargetDirectory(baseDir, selectedDir, username);

        // Special handling for images directory
        if (isImagesDirectory(selectedDir)) {
            await generateImageIndex(); // Always regenerate index
            res.json([{
                name: 'index.md',
                path: path.join(targetDir, 'index.md'),
                rank: 0,
                index: 1
            }]);
            return;
        }

        // Get directory configuration
        const config = await getDirectoryConfig(targetDir);
        
        // Get all files in directory
        const allFiles = await fs.readdir(targetDir);
        
        // Filter and process files
        let files = allFiles
            .filter(file => file.endsWith('.md'))
            .filter(file => !config.exclude.includes(file))
            .filter(file => file !== 'index.md')
            .map(name => ({ name }));
            
        // Apply rankings
        files = await rankFiles(files, config);
        
        // Map to response format
        const fileList = files.map((file, idx) => ({
            id: file.name,
            name: file.name,
            rank: file.rank || 0,
            index: config.showIndex ? String.fromCharCode(97 + idx) : '',
            showRank: config.showRank
        }));
        
        res.json(fileList);
    } catch (error) {
        console.error('[FILES ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Get file content
router.get('/get', async (req, res) => {
    try {
        const { name, dir } = req.query;
        if (!name) {
            return res.status(400).json({ error: 'File name required' });
        }

        const baseDir = process.env.MD_DIR || '.';
        const username = req.auth?.name;
        const targetDir = getTargetDirectory(baseDir, dir || username, username);
        const filePath = path.join(targetDir, name);

        const content = await fs.readFile(filePath, 'utf8');
        res.type('text/plain').send(content);
    } catch (error) {
        console.error('[FILES ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Save file content
router.post('/save', async (req, res) => {
    try {
        const { name, dir, content } = req.body;
        if (!name || !content) {
            return res.status(400).json({ error: 'File name and content required' });
        }

        const baseDir = process.env.MD_DIR || '.';
        const username = req.auth?.name;
        const targetDir = getTargetDirectory(baseDir, dir || username, username);
        const filePath = path.join(targetDir, name);

        await fs.writeFile(filePath, content, 'utf8');
        res.json({ success: true });
    } catch (error) {
        console.error('[FILES ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// Get directory configuration
router.get('/config', async (req, res) => {
    try {
        const baseDir = process.env.MD_DIR || '.';
        const username = req.auth?.name;
        // Default to user's directory, not '.'
        const selectedDir = req.query.dir || username;
        const targetDir = getTargetDirectory(baseDir, selectedDir, username);

        // Get directory configuration
        const config = await getDirectoryConfig(targetDir);
        res.json(config);
    } catch (error) {
        console.error('[CONFIG ERROR]', error);
        res.status(500).json({ error: 'Failed to load directory config' });
    }
});

// Manage symlink in Community_Files
router.post('/community-link', async (req, res) => {
    try {
        console.log('[COMMUNITY] Request received:', req.body);
        console.log('[COMMUNITY] Request headers:', req.headers);
        console.log('[COMMUNITY] Authentication:', req.auth);
        console.log('[COMMUNITY] User session:', req.session);
        
        const { filename, directory, action } = req.body;
        
        if (!filename || !directory) {
            console.error('[COMMUNITY ERROR] Missing filename or directory in request');
            return res.status(400).json({ error: 'Filename and directory required' });
        }

        // Check authentication
        if (!req.auth || !req.auth.name) {
            console.error('[COMMUNITY ERROR] User not authenticated');
            return res.status(401).json({ error: 'Authentication required' });
        }

        const baseDir = process.env.MD_DIR || '.';
        const username = req.auth?.name;
        console.log(`[COMMUNITY] User: ${username}, Action: ${action}, File: ${filename}, Dir: ${directory}`);
        
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
        } catch (error) {
            console.error(`[COMMUNITY ERROR] Failed to create Community_Files directory: ${error.message}`);
            return res.status(500).json({ error: 'Failed to create Community_Files directory' });
        }

        // Check if file exists in source location
        try {
            await fs.access(sourcePath);
        } catch (error) {
            console.error(`[COMMUNITY ERROR] Source file not found: ${sourcePath}`);
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

// Helper functions
function getTargetDirectory(baseDir, selectedDir, username) {
    // No special handling for '.' anymore
    // Just use the actual directory name
    if (selectedDir === 'Community_Files') {
        return path.join(baseDir, 'Community_Files');
    }
    
    return username === 'mike' ? 
        path.join(baseDir, selectedDir) : 
        path.join(baseDir, username);
}

async function ensureDirectory(dir) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`[FILES] Created directory: ${dir}`);
    }
}

function isImagesDirectory(dir) {
    const normalizedDir = path.normalize(dir).replace(/\\/g, '/');
    return normalizedDir === 'images' || normalizedDir.endsWith('/images');
}

// Make sure we export the router properly
module.exports = router; 