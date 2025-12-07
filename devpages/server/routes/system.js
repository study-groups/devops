import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { uploadsDirectory, imagesDirectory } from '../config.js';

const router = Router();

// Get system/environment information
router.get('/info', async (req, res) => {
    try {
        const info = {
            PD_DIR: process.env.PD_DIR || null,
            MD_DIR: process.env.MD_DIR || (process.env.PD_DIR ? path.join(process.env.PD_DIR, 'data') : null),
            uploadsDirectory,
            imagesDirectory,
            NODE_ENV: process.env.NODE_ENV || 'development',
            PORT: process.env.PORT || 4000,
        };

        return res.json(info);
    } catch (error) {
        console.error('Error getting system info:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Recursively build file tree
async function buildFileTree(dirPath, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) {
        return null;
    }

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const children = [];

        for (const entry of entries) {
            // Skip hidden files and common directories to ignore
            if (entry.name.startsWith('.') ||
                entry.name === 'node_modules' ||
                entry.name === 'dist' ||
                entry.name === 'build') {
                continue;
            }

            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                const subtree = await buildFileTree(fullPath, depth + 1, maxDepth);
                if (subtree && subtree.children) {
                    children.push({
                        name: entry.name,
                        type: 'directory',
                        children: subtree.children
                    });
                } else {
                    children.push({
                        name: entry.name,
                        type: 'directory',
                        children: []
                    });
                }
            } else {
                children.push({
                    name: entry.name,
                    type: 'file'
                });
            }
        }

        // Sort: directories first, then files, alphabetically
        children.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
        });

        return { children };
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
        return { children: [], error: error.message };
    }
}

// Get PD_DIR file tree
router.get('/file-tree', async (req, res) => {
    try {
        const pdDir = process.env.PD_DIR;

        if (!pdDir) {
            return res.status(400).json({
                error: 'PD_DIR environment variable is not set'
            });
        }

        // Check if directory exists
        try {
            await fs.access(pdDir);
        } catch (error) {
            return res.status(404).json({
                error: `PD_DIR directory not found: ${pdDir}`
            });
        }

        const tree = await buildFileTree(pdDir);

        return res.json(tree);
    } catch (error) {
        console.error('Error getting file tree:', error);
        return res.status(500).json({ error: error.message });
    }
});

export default router;
