import express from 'express';
import path from 'path';
import fs from 'fs/promises';

// Import local middleware with .js extension
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Simple save endpoint
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { file, dir } = req.query;
        // Use req.user attached by authMiddleware
        const username = req.user?.username;

        if (!file) {
            return res.status(400).json({ error: 'File name required' });
        }

        // Get content from request body
        let content = '';
        if (req.headers['content-type'] === 'text/plain') {
            content = req.body;
        } else {
            // If not plain text, expect JSON with a content field
            content = req.body?.content ?? ''; // Use optional chaining and nullish coalescing
        }

        // Determine target directory
        const baseDir = process.env.MD_DIR || '.';
        let targetDir;

        // Just use the actual directory name, falling back to username if dir is empty/null
        // Ensure username exists before using it as fallback
        const effectiveDir = dir || (username ? username : '');
        targetDir = path.join(baseDir, effectiveDir);

        // Ensure directory exists
        await fs.mkdir(targetDir, { recursive: true });

        // Save the file
        const filePath = path.join(targetDir, file);
        // Basic path validation
        if (file.includes('..') || file.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        await fs.writeFile(filePath, content, 'utf8');

        console.log(`[SAVE] File saved: ${filePath}`);
        res.json({ success: true, message: 'File saved successfully' });
    } catch (error) {
        console.error('[SAVE ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// module.exports = router; // Old CommonJS export
export default router; // New ESM export 