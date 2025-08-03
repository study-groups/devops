import express from 'express';
import path from 'path';

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

        // Basic path validation
        if (file.includes('..') || file.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        // Use PData system for file operations (handles directory creation automatically)
        const relativePath = dir ? path.posix.join(dir, file) : file;
        await req.pdata.writeFile(username, relativePath, content);

        console.log(`[SAVE] File saved: ${relativePath} for user ${username}`);
        res.json({ success: true, message: 'File saved successfully' });
    } catch (error) {
        console.error('[SAVE ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// module.exports = router; // Old CommonJS export
export default router; // New ESM export 