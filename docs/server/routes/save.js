const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { authMiddleware } = require('../middleware/auth');

// Simple save endpoint
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { file, dir } = req.query;
        const username = req.auth?.name;
        
        if (!file) {
            return res.status(400).json({ error: 'File name required' });
        }
        
        // Get content from request body
        let content = '';
        if (req.headers['content-type'] === 'text/plain') {
            content = req.body;
        } else {
            content = req.body.content || '';
        }
        
        // Determine target directory
        const baseDir = process.env.MD_DIR || '.';
        const targetDir = path.join(baseDir, dir || username || '');
        
        // Ensure directory exists
        await fs.mkdir(targetDir, { recursive: true });
        
        // Save the file
        const filePath = path.join(targetDir, file);
        await fs.writeFile(filePath, content, 'utf8');
        
        console.log(`[SAVE] File saved: ${filePath}`);
        res.json({ success: true, message: 'File saved successfully' });
    } catch (error) {
        console.error('[SAVE ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 