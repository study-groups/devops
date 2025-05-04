const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { getUserMarkdownDirectory } = require('../config');

// Admin middleware
const adminOnly = (req, res, next) => {
    if (req.auth.name !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Get all users and their files
router.get('/users', adminOnly, async (req, res) => {
    try {
        const baseDir = path.dirname(getUserMarkdownDirectory(''));
        const users = await fs.readdir(baseDir);
        
        const userFiles = await Promise.all(users.map(async user => {
            const userDir = getUserMarkdownDirectory(user);
            const files = await fs.readdir(userDir);
            return {
                username: user,
                files: files.filter(f => f.endsWith('.md')),
                directory: userDir
            };
        }));
        
        res.json(userFiles);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list users' });
    }
});

module.exports = router; 