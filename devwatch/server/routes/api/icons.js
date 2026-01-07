const express = require('express');
const router = express.Router();
const fs = require('fs/promises');
const path = require('path');

const ICONS_DIR = path.resolve(__dirname, '..', '..', 'static', 'icons');

router.get('/', async (req, res) => {
    try {
        const files = await fs.readdir(ICONS_DIR);
        const svgFiles = files.filter(file => file.endsWith('.svg'));
        res.json(svgFiles);
    } catch (err) {
        console.error('Error reading icons directory:', err);
        res.status(500).json({ 
            error: 'Could not list icons.', 
            details: err.message 
        });
    }
});

module.exports = router;
