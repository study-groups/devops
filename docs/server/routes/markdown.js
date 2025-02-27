const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { getUserMarkdownDirectory, imagesDirectory } = require('../config');
const { readMarkdownFiles, getFileStats, getFileRankings, updateFileRanking } = require('../utils/fileUtils');
const { parseMarkdown } = require('../utils/markdownUtils');
const { getAllImages } = require('../utils/imageUtils');
const { getDirectoryConfig, rankFiles } = require('../utils/directoryConfig');

const router = express.Router();

// Store connected clients
const clients = new Set();

// SSE endpoint for file updates
router.get('/events', (req, res) => {
    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Send initial heartbeat
    res.write('event: connected\ndata: connected\n\n');

    // Add client to set
    clients.add(res);

    // Handle client disconnect
    req.on('close', () => {
        clients.delete(res);
    });
});

// Function to notify all clients
function notifyClients(event, data) {
    clients.forEach(client => {
        client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
}

// Unified directory handling
async function ensureDirectory(dir) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`[FILES] Created directory: ${dir}`);
    }
}

// Unified path resolution
function getTargetDirectory(baseDir, selectedDir, username) {
    if (selectedDir === '.') return baseDir;
    return username === 'mike' ? 
        path.join(baseDir, selectedDir) : 
        path.join(baseDir, username);
}

// Add logging middleware
router.use((req, res, next) => {
    console.log(`[MARKDOWN] ${req.method} ${req.url}`);
    next();
});

// Get all directories
router.get('/dirs', async (req, res) => {
    try {
        const baseDir = process.env.MD_DIR || '.';
        await ensureDirectory(baseDir);

        const dirs = [{ 
            id: '.',
            name: '📚 Community Files',
            description: 'Shared markdown files'
        }];

        const items = await fs.readdir(baseDir, { withFileTypes: true });
        const userDirs = await Promise.all(
            items
                .filter(item => item.isDirectory())
                .map(async item => ({
                    id: item.name,
                    name: `📁 ${item.name}`,
                    description: item.name === req.auth?.name ? 'Your Files' : `${item.name}'s Files`
                }))
        );

        // Sort directories with user's directory first
        userDirs.sort((a, b) => {
            if (a.id === req.auth?.name) return -1;
            if (b.id === req.auth?.name) return 1;
            return a.id.localeCompare(b.id);
        });

        console.log(`[FILES] Found ${userDirs.length} user directories in ${baseDir}`);
        res.json([...dirs, ...userDirs]);
    } catch (error) {
        console.error(`[FILES ERROR] ${error.message}`);
        res.status(500).json({ error: 'Failed to list directories' });
    }
});

// Modify the list endpoint to use the same file listing logic
async function getFileList(baseDir, selectedDir, username) {
    const targetDir = getTargetDirectory(baseDir, selectedDir, username);
    console.log(`[LIST] User ${username} accessing directory: ${targetDir}`);

    // Special handling for images directory
    if (await isImagesDirectory(targetDir)) {
        return [{
            name: 'index.md',
            path: path.join(targetDir, 'index.md')
        }];
    }

    await ensureDirectory(targetDir);

    const items = await fs.readdir(targetDir, { withFileTypes: true });
    return items
        .filter(item => item.isFile() && item.name.endsWith('.md'))
        .map(item => ({
            name: item.name,
            path: path.join(targetDir, item.name)
        }));
}

// Get files in directory
router.get('/list', async (req, res) => {
    try {
        const baseDir = process.env.MD_DIR || '.';
        const username = req.auth?.name;
        const selectedDir = req.query.dir || username || '.';
        const targetDir = getTargetDirectory(baseDir, selectedDir, username);

        // Special handling for images directory
        if (await isImagesDirectory(targetDir)) {
            const { generateImageIndex } = require('./images');
            await generateImageIndex();
            res.json([{ name: 'index.md', path: path.join(targetDir, 'index.md') }]);
            return;
        }

        const files = await getFileList(baseDir, selectedDir, username);
        console.log(`[FILES] Found ${files.length} files in ${selectedDir}`);
        res.json(files);
    } catch (error) {
        console.error(`[FILES ERROR] ${error.message}`);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// Get file contents
router.get('/get', async (req, res) => {
    try {
        const { name, dir } = req.query;
        if (!name) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        const baseDir = process.env.MD_DIR || '.';
        const username = req.auth?.name;
        const selectedDir = dir || username || '.';
        const targetDir = getTargetDirectory(baseDir, selectedDir, username);

        console.log(`[GET] User ${username} accessing file: ${path.join(targetDir, name)}`);

        // Special handling for images directory
        if (await isImagesDirectory(targetDir)) {
            if (name !== 'index.md') {
                return res.status(403).json({ error: 'Only index.md is accessible in images directory' });
            }
            const { generateImageIndex } = require('./images');
            await generateImageIndex();
        }

        // Read and send raw file content
        const content = await fs.readFile(path.join(targetDir, name), 'utf8');
        res.set('Content-Type', 'text/plain');
        res.send(content);
    } catch (error) {
        console.error(`[GET ERROR] ${error.message}`);
        res.status(500).json({ error: 'Failed to read file' });
    }
});

// Modify save endpoint to notify clients
router.post('/save/:filename', async (req, res) => {
    try {
        const username = req.auth?.name;
        const filename = req.params.filename;
        const { content, pwd, userDir } = req.body;

        if (!filename || !content) {
            return res.status(400).json({ error: 'Missing filename or content' });
        }

        const baseDir = process.env.MD_DIR || '.';
        const targetDir = getTargetDirectory(baseDir, pwd || '.', username);
        console.log(`[SAVE] User ${username} saving to: ${targetDir}`);

        // Security check
        const resolvedPath = path.resolve(path.join(targetDir, filename));
        const basePath = path.resolve(baseDir);
        if (!resolvedPath.startsWith(basePath)) {
            console.log(`[SAVE] Security violation - attempted path: ${resolvedPath}`);
            return res.status(403).json({ error: 'Invalid path' });
        }

        await ensureDirectory(targetDir);
        await fs.writeFile(path.join(targetDir, filename), content);
        
        console.log(`[SAVE] File saved successfully: ${resolvedPath}`);

        // Notify clients about the update
        const files = await getFileList(baseDir, pwd, username);
        notifyClients('files-updated', files);

        res.json({ message: 'File saved successfully' });
    } catch (error) {
        console.error(`[SAVE ERROR] ${error.message}`);
        res.status(500).json({ error: 'Failed to save file' });
    }
});

// Add endpoint to update rankings
router.post('/rank', async (req, res) => {
    try {
        const { directory, filename, rank } = req.body;
        if (!filename || rank === undefined) {
            return res.status(400).json({ error: 'Missing filename or rank' });
        }

        const targetDir = directory === '.' ? 
            process.env.MD_DIR : 
            path.join(process.env.MD_DIR, directory);

        await updateFileRanking(targetDir, filename, rank);
        res.json({ message: 'Ranking updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new endpoint for updating ranks
router.post('/ranks', async (req, res) => {
    try {
        const { directory, ranks } = req.body;
        const username = req.auth.name;
        
        // Ensure user has permission
        if (directory !== '.' && directory !== username && username !== 'admin') {
            return res.status(403).json({ error: 'Cannot modify ranks in this directory' });
        }
        
        const targetDir = directory === '.' ? 
            process.env.MD_DIR : 
            path.join(process.env.MD_DIR, directory);
            
        // Save ranks to user-specific meta file
        const metaFile = path.join(targetDir, `.ranks-${username}.json`);
        await fs.writeFile(metaFile, JSON.stringify(ranks, null, 2));
        
        res.json({ message: 'Ranks updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this to the existing markdown routes
router.get('/files', async (req, res) => {
    try {
        const baseDir = process.env.MD_DIR;
        const username = req.auth?.name;
        const selectedDir = req.query.dir || username;
        const targetDir = selectedDir === '.' ? baseDir : path.join(baseDir, selectedDir);

        // Special handling for images directory
        if (await isImagesDirectory(targetDir)) {
            const { generateImageIndex } = require('./images');
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

// Add directory config endpoint
router.get('/config', async (req, res) => {
    try {
        const baseDir = process.env.MD_DIR || '.';
        const username = req.auth?.name;
        const selectedDir = req.query.dir || username || '.';
        const targetDir = getTargetDirectory(baseDir, selectedDir, username);

        // Get directory configuration
        const config = await getDirectoryConfig(targetDir);
        res.json(config);
    } catch (error) {
        console.error(`[CONFIG ERROR] ${error.message}`);
        res.status(500).json({ error: 'Failed to load directory config' });
    }
});

// Helper function to check if directory is images directory
function isImagesDirectory(dir) {
    const normalizedDir = path.normalize(dir).replace(/\\/g, '/');
    return normalizedDir === 'images' || normalizedDir.endsWith('/images');
}

// Add editor route to handle file opening
router.get('/editor/open', async (req, res) => {
    try {
        const { file } = req.query;
        if (!file) {
            return res.status(400).json({ error: 'File parameter is required' });
        }

        // Redirect to the main editor page with file info in URL
        res.redirect(`/?file=${encodeURIComponent(file)}`);
    } catch (error) {
        console.error(`[EDITOR ERROR] ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
