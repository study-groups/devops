const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { uploadsDirectory } = require('../config');

const router = express.Router();

// Supported image types
const SUPPORTED_MIME_TYPES = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'image/svg+xml'  // Add SVG support
];

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: uploadsDirectory,
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${Math.random().toString(36).substring(7)}${ext}`);
    }
});

// File filter to validate image types
const fileFilter = (req, file, cb) => {
    if (SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`), false);
    }
};

const upload = multer({ 
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Helper to find image references in markdown content
function findImageReferences(content, targetImage) {
    const regex = /!\[.*?\]\((.*?)\)/g;
    let count = 0;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
        if (match[1].trim() === targetImage) {
            count++;
        }
    }
    return count;
}

// Generate the image index markdown
async function generateImageIndex() {
    const mdDir = process.env.MD_DIR || '.';
    const indexPath = path.join(mdDir, 'images', 'index.md');
    
    try {
        // Get all images in uploads directory
        const files = await fs.readdir(uploadsDirectory);
        const images = files.filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f));
        
        // Get all markdown files recursively
        async function getMarkdownFiles(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(entries.map(entry => {
                const res = path.resolve(dir, entry.name);
                return entry.isDirectory() ? getMarkdownFiles(res) : res;
            }));
            return files.flat().filter(f => f.endsWith('.md') && !f.includes('/images/'));
        }
        
        const mdFiles = await getMarkdownFiles(mdDir);
        
        // Count references for each image
        const imageStats = {};
        for (const image of images) {
            imageStats[image] = { count: 0, refs: [] };
            const imageUrl = `/uploads/${image}`;
            
            for (const mdFile of mdFiles) {
                try {
                    const content = await fs.readFile(mdFile, 'utf8');
                    const refCount = findImageReferences(content, imageUrl);
                    if (refCount > 0) {
                        const fullRelativePath = path.relative(mdDir, mdFile);
                        const displayPath = fullRelativePath.split('/').pop();
                        const dirPath = path.dirname(fullRelativePath);
                        imageStats[image].count += refCount;
                        imageStats[image].refs.push({
                            displayPath,
                            fullPath: fullRelativePath,
                            dirPath: dirPath === '.' ? '' : dirPath,
                            count: refCount
                        });
                    }
                } catch (err) {
                    console.error(`Error reading file ${mdFile}:`, err);
                }
            }
        }
        
        // Generate markdown content with thumbnails
        let content = '# Image Index\n\n';
        content += '[Delete Unused Images](/api/images/delete-unused)\n\n';
        content += '| Thumbnail | Image Info | References | Actions |\n';
        content += '|-----------|------------|------------|----------|\n';
        
        for (const [image, stats] of Object.entries(imageStats)) {
            const imageUrl = `/uploads/${image}`;
            
            // Log the image and stats for debugging
            console.log('Processing image:', image);
            console.log('Image stats:', stats);

            // Convert references to string
            const files = stats.refs.length > 0 
                ? stats.refs.map(ref => {
                    const dirParam = ref.dirPath ? `&dir=${encodeURIComponent(ref.dirPath)}` : '';
                    const refString = `[${String(ref.displayPath)}](/?file=${encodeURIComponent(String(ref.displayPath))}${dirParam}) (${String(ref.count)})`;
                    console.log('Reference:', refString);
                    return refString;
                }).join('<br>')
                : 'No references';
            
            // Create thumbnail cell
            let thumbnailCell;
            if (image.toLowerCase().endsWith('.svg')) {
                thumbnailCell = `<div class="svg-container" data-src="${String(imageUrl)}" style="max-width:100px; max-height:100px;"></div><br>${String(image)}`;
            } else {
                thumbnailCell = `<img src="${String(imageUrl)}" alt="${String(image)}" style="max-width:100px; max-height:100px;"><br>${String(image)}`;
            }
            
            // Create image info
            const imageInfo = `**Name**: ${String(image)}<br>**Used**: ${String(stats.count)} times`;
            
            // Create delete button
            const deleteButton = `<button onclick="window.handleImageDelete('${encodeURIComponent(String(image))}')" class="delete-btn">Delete</button>`;
            
            // Log the final row for debugging
            const row = `| ${thumbnailCell} | ${imageInfo} | ${files} | ${deleteButton} |\n`;
            console.log('Table row:', row);
            
            // Add row to table
            content += row;
        }
        
        // Ensure images directory exists and write index
        await fs.mkdir(path.join(mdDir, 'images'), { recursive: true });
        await fs.writeFile(indexPath, content);
        
        return true;
    } catch (error) {
        console.error('Error generating image index:', error);
        return false;
    }
}

// Routes
router.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    try {
        await generateImageIndex();
        res.json({ url: `/uploads/${req.file.filename}` });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Delete specific image
router.get('/delete/:image', async (req, res) => {
    try {
        const imagePath = path.join(uploadsDirectory, req.params.image);
        await fs.unlink(imagePath);
        await generateImageIndex();
        res.redirect('/images/index.md');
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).send('Failed to delete image');
    }
});

// Delete all unused images
router.get('/delete-unused', async (req, res) => {
    try {
        const mdDir = process.env.MD_DIR || '.';
        const files = await fs.readdir(uploadsDirectory);
        const images = files.filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f));
        
        // Get all markdown files
        async function getMarkdownFiles(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(entries.map(entry => {
                const res = path.resolve(dir, entry.name);
                return entry.isDirectory() ? getMarkdownFiles(res) : res;
            }));
            return files.flat().filter(f => f.endsWith('.md') && !f.includes('/images/'));
        }
        
        const mdFiles = await getMarkdownFiles(mdDir);
        
        for (const image of images) {
            let totalRefs = 0;
            const imageUrl = `/uploads/${image}`;
            
            for (const mdFile of mdFiles) {
                try {
                    const content = await fs.readFile(mdFile, 'utf8');
                    totalRefs += findImageReferences(content, imageUrl);
                } catch (err) {
                    console.error(`Error reading file ${mdFile}:`, err);
                }
            }
            
            if (totalRefs === 0) {
                try {
                    await fs.unlink(path.join(uploadsDirectory, image));
                } catch (err) {
                    console.error(`Error deleting file ${image}:`, err);
                }
            }
        }
        
        await generateImageIndex();
        res.redirect('/images/index.md');
    } catch (error) {
        console.error('Delete unused error:', error);
        res.status(500).send('Failed to delete unused images');
    }
});

// Generate index manually
router.post('/generate-index', async (req, res) => {
    try {
        const success = await generateImageIndex();
        if (success) {
            res.json({ message: 'Index generated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to generate index' });
        }
    } catch (error) {
        console.error('Index generation error:', error);
        res.status(500).json({ error: 'Failed to generate index' });
    }
});

module.exports = {
    router,
    generateImageIndex // Export the function for use in markdown routes
};
