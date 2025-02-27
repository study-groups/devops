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
                    name: `👤 ${item.name}`,
                    description: `Personal files for ${item.name}`
                }))
        );

        res.json([...dirs, ...userDirs]);
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
        const selectedDir = req.query.dir || username || '.';
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
        const selectedDir = req.query.dir || username || '.';
        const targetDir = getTargetDirectory(baseDir, selectedDir, username);

        // Get directory configuration
        const config = await getDirectoryConfig(targetDir);
        res.json(config);
    } catch (error) {
        console.error('[CONFIG ERROR]', error);
        res.status(500).json({ error: 'Failed to load directory config' });
    }
});

// Helper functions
function getTargetDirectory(baseDir, selectedDir, username) {
    if (selectedDir === '.') return baseDir;
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

module.exports = router; 