const express = require('express');
const fs = require('fs');
const path = require('path');
const { getUserMarkdownDirectory, imagesDirectory } = require('../config');
const { readMarkdownFiles, getFileStats, getFileRankings, updateFileRanking } = require('../utils/fileUtils');
const { parseMarkdown } = require('../utils/markdownUtils');
const { getAllImages } = require('../utils/imageUtils');
const { getDirectoryConfig, rankFiles } = require('../utils/directoryConfig');

const router = express.Router();

// Ensure user directory exists
function ensureUserDirectory(username) {
    const userDir = getUserMarkdownDirectory(username);
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }
    return userDir;
}

// Add this logging to help debug
router.use((req, res, next) => {
    console.log(`[MARKDOWN] ${req.method} ${req.url}`);
    next();
});

// Get all directories - note no /files prefix needed
router.get('/dirs', async (req, res) => {
    const baseDir = process.env.MD_DIR || path.join(__dirname, '../../md');
    
    try {
        // Ensure base directory exists
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
            console.log(`[FILES] Created base directory: ${baseDir}`);
        }

        // Get all directories
        const dirs = [{ 
            id: '.',
            name: '📚 Community Files',
            description: 'Shared markdown files'
        }];
        
        // Add user directories
        const userDirs = fs.readdirSync(baseDir)
            .filter(item => {
                try {
                    return fs.statSync(path.join(baseDir, item)).isDirectory();
                } catch (error) {
                    console.error(`[FILES] Error reading directory ${item}: ${error.message}`);
                    return false;
                }
            })
            .map(dir => ({
                id: dir,
                name: `📁 ${dir}`,
                description: dir === req.auth?.name ? 'Your Files' : `${dir}'s Files`
            }));

        // Sort directories
        userDirs.sort((a, b) => {
            if (a.id === req.auth?.name) return -1;
            if (b.id === req.auth?.name) return 1;
            return a.id.localeCompare(b.id);
        });

        console.log(`[FILES] Found ${userDirs.length} user directories in ${baseDir}`);
        res.json([...dirs, ...userDirs]);
    } catch (error) {
        console.error(`[FILES ERROR] Failed to read directories: ${error.message}`);
        res.status(500).json({ 
            error: 'Failed to read directories',
            details: error.message 
        });
    }
});

// Get files in directory
router.get('/list', async (req, res) => {
    try {
        const baseDir = process.env.MD_DIR || path.join(__dirname, '../../md');
        const username = req.auth?.name;
        const selectedDir = req.query.dir || username || '.';
        
        // For mike, use selected directory directly, for others force their user directory
        const targetDir = selectedDir === '.' ? 
            baseDir : 
            (username === 'mike' ? 
                path.join(baseDir, selectedDir) : 
                path.join(baseDir, username));

        console.log(`[LIST] User ${username} accessing directory: ${targetDir}`);

        // Ensure target directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            console.log(`[FILES] Created directory: ${targetDir}`);
        }

        // Get files
        const files = fs.readdirSync(targetDir)
            .filter(file => file.endsWith('.md'))
            .map(file => ({
                name: file,
                path: path.join(targetDir, file)
            }));
            
        res.json(files);
    } catch (error) {
        console.error(`[FILES ERROR] Failed to list files: ${error.message}`);
        res.status(500).json({ 
            error: 'Failed to list files',
            details: error.message 
        });
    }
});

// Update the resolvePath function
function resolvePath(directory, filename, username) {
    if (!process.env.MD_DIR) {
        throw new Error('MD_DIR not configured');
    }
    
    // Sanitize inputs
    const safeFilename = path.basename(filename);
    
    let filePath;
    if (directory === '.') {
        // Community files are directly in MD_DIR
        filePath = path.join(process.env.MD_DIR, safeFilename);
        console.log(`[FILES] Community file path: ${filePath}`);
    } else if (username === 'mike') {
        // For mike, use the directory directly under MD_DIR
        filePath = path.join(process.env.MD_DIR, directory, safeFilename);
        console.log(`[FILES] Mike's file path in ${directory}: ${filePath}`);
    } else {
        // Other users are restricted to their subdirectory
        const safeDir = path.basename(directory);
        filePath = path.join(process.env.MD_DIR, safeDir, safeFilename);
        console.log(`[FILES] User file path: ${filePath}`);
    }
    
    // Verify the path is within MD_DIR
    const resolvedPath = path.resolve(filePath);
    const basePath = path.resolve(process.env.MD_DIR);
    if (!resolvedPath.startsWith(basePath)) {
        throw new Error('Invalid path');
    }
    
    // Debug logging
    console.log(`[FILES] Base directory: ${basePath}`);
    console.log(`[FILES] Resolved path: ${resolvedPath}`);
    console.log(`[FILES] File exists: ${fs.existsSync(resolvedPath)}`);
    
    return resolvedPath;
}

// Get file contents
router.get('/get', (req, res) => {
    const baseDir = process.env.MD_DIR;
    const username = req.auth.name;
    const directory = req.query.dir || username;
    const filename = req.query.name;

    // For mike, use selected directory directly, for others force their user directory
    const targetDir = directory === '.' ? 
        baseDir : 
        (username === 'mike' ? 
            path.join(baseDir, directory) : 
            path.join(baseDir, username));

    const filePath = path.join(targetDir, filename);
    console.log(`[GET] User ${username} accessing file: ${filePath}`);

    try {
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update the save route
router.post('/save/:filename', (req, res) => {
    try {
        const username = req.auth.name;
        const filename = req.params.filename;
        const { content, pwd, userDir } = req.body;

        console.log(`[SAVE] Save request:
    User: ${username}
    PWD: ${pwd}
    Filename: ${filename}`);

        if (!filename || !content) {
            console.log(`[SAVE] Missing filename or content`);
            return res.status(400).json({ error: 'Missing filename or content' });
        }

        // Determine target directory based on user and PWD
        let targetDir;
        if (username === 'mike') {
            // Mike can save to any directory
            targetDir = pwd === '.' ? 
                process.env.MD_DIR : 
                path.join(process.env.MD_DIR, pwd);
            console.log(`[SAVE] Mike saving to directory: ${targetDir}`);
        } else {
            // Other users can only save to their directory
            targetDir = path.join(process.env.MD_DIR, userDir);
            console.log(`[SAVE] Regular user saving to their directory: ${targetDir}`);
        }

        const filePath = path.join(targetDir, filename);
        
        // Security check - ensure path is within MD_DIR
        const resolvedPath = path.resolve(filePath);
        const basePath = path.resolve(process.env.MD_DIR);
        if (!resolvedPath.startsWith(basePath)) {
            console.log(`[SAVE] Security violation - attempted path: ${resolvedPath}`);
            return res.status(403).json({ error: 'Invalid path' });
        }

        console.log(`[SAVE] Final path: ${filePath}`);

        // Ensure directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            console.log(`[SAVE] Created directory: ${targetDir}`);
        }

        fs.writeFileSync(filePath, content);
        console.log(`[SAVE] File saved successfully: ${filePath}`);
        res.json({ message: 'File saved successfully' });
    } catch (error) {
        console.error(`[SAVE ERROR] ${error.message}`);
        res.status(400).json({ error: error.message });
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
        const selectedDir = req.query.dir || req.auth.name;
        const targetDir = selectedDir === '.' ? baseDir : path.join(baseDir, selectedDir);

        // Get directory configuration
        const config = await getDirectoryConfig(targetDir);
        
        // Get files matching include pattern and filter excluded
        const files = fs.readdirSync(targetDir)
            .filter(file => file.endsWith('.md'))
            .filter(file => !config.exclude.includes(file))
            .filter(file => file !== 'index.md');
        
        // Rank files according to config
        const rankedFiles = rankFiles(files, config);
        
        // Map to response format
        const fileList = rankedFiles.map((file, idx) => ({
            id: file.name,
            name: file.name,
            rank: file.rank,
            index: config.showIndex ? String.fromCharCode(97 + idx) : '',
            showRank: config.showRank
        }));
        
        res.json(fileList);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
