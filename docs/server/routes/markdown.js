const express = require('express');
const fs = require('fs');
const path = require('path'); // ✅ Missing Import
const { markdownDirectory, imagesDirectory } = require('../config');
const { readMarkdownFiles, getFileStats } = require('../utils/fileUtils');
const { parseMarkdown } = require('../utils/markdownUtils');
const { getAllImages } = require('../utils/imageUtils');

const router = express.Router();

router.get('/index-summary', (req, res) => {
    try {
        const files = readMarkdownFiles(markdownDirectory);
        let allReferencedImages = new Set();
        let fileMetadata = [];

        files.forEach(file => {
            const filePath = path.join(markdownDirectory, file);
            const { metadata, images } = parseMarkdown(filePath);
            const stats = getFileStats(filePath);

            images.forEach(img => allReferencedImages.add(img));

            fileMetadata.push({
                name: file,
                modified: stats?.mtimeMs || 0,
                priority: metadata.priority || 0,
                tags: metadata.tags || []
            });
        });

        fileMetadata.sort((a, b) => b.priority - a.priority || b.modified - a.modified);

        const allImages = getAllImages(imagesDirectory);
        const orphanedImages = allImages.filter(img => !allReferencedImages.has(img));

        res.json({ files: fileMetadata, referencedImages: [...allReferencedImages], orphanedImages });
    } catch (error) {
        console.error('Error in index-summary:', error);
        res.status(500).json({ error: 'Failed to process index.md' });
    }
});

// ✅ Fix: Add missing `fs` and debug logging
router.get('/files', (req, res) => {
    console.log(`Fetching list of Markdown files from: ${markdownDirectory}`);

    fs.readdir(markdownDirectory, (err, files) => {
        if (err) {
            console.error(`Error reading directory: ${err.message}`);
            return res.status(500).json({ error: 'Unable to read directory' });
        }

        const mdFiles = files.filter(file => file.endsWith('.md'));
        console.log(`Found ${mdFiles.length} markdown files`);
        res.json(mdFiles);
    });
});

router.get('/file', (req, res) => {
    const filename = req.query.name;
    if (!filename) return res.status(400).json({ error: 'Filename is required' });

    const safeFilename = path.basename(filename);
    const filePath = path.join(markdownDirectory, safeFilename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
});

module.exports = router;
