const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { getUserMarkdownDirectory } = require('../config');

// Get files in directory
router.get('/files', async (req, res) => {
    try {
        const userDir = getUserMarkdownDirectory(req.auth.name);
        const files = await fs.readdir(userDir);
        
        const markdownFiles = files
            .filter(file => file.endsWith('.md'))
            .map(file => ({
                name: file,
                path: path.join(userDir, file)
            }));
            
        res.json(markdownFiles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 