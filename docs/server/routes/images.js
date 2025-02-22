const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { uploadsDirectory } = require('../config');

const router = express.Router();

// Function to check if large images are enabled in user's index.md
async function isLargeImagesEnabled(username) {
    if (!username) {
        throw new Error('Username is required');
    }

    try {
        const userIndexPath = path.join(process.env.MD_DIR || path.join(__dirname, '../../md'), username, 'index.md');
        const content = await fs.readFile(userIndexPath, 'utf8');
        
        // Simple check for large-images: true in the Options section
        return content.includes('large-images: true');
    } catch (error) {
        console.error('Error reading index.md config:', error);
        return false;
    }
}

const storage = multer.diskStorage({
    destination: uploadsDirectory,
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${Math.random().toString(36).substring(7)}${ext}`);
    }
});

// Configure multer with size limits based on 'large' flag and user config
const getMulterConfig = async (req) => {
    if (!req.user?.username) {
        throw new Error('Authentication required');
    }

    const largeImagesEnabled = await isLargeImagesEnabled(req.user.username);
    const isLarge = req.query.large === 'true' && largeImagesEnabled;

    return {
        storage,
        limits: {
            fileSize: isLarge ? 50 * 1024 * 1024 : 5 * 1024 * 1024 // 50MB for large, 5MB default
        },
        fileFilter: (req, file, cb) => {
            if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
                return cb(new Error('Only image files are allowed!'), false);
            }
            cb(null, true);
        }
    };
};

router.post('/upload', async (req, res) => {
    if (!req.user?.username) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const config = await getMulterConfig(req);
        const upload = multer(config).single('image');

        upload(req, res, async function(err) {
            if (err instanceof multer.MulterError) {
                console.error('Multer error:', err);
                return res.status(400).json({ error: 'File upload error: ' + err.message });
            } else if (err) {
                console.error('Upload error:', err);
                return res.status(400).json({ error: err.message });
            }
            
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                const userIndexPath = path.join(process.env.MD_DIR || path.join(__dirname, '../../md'), req.user.username, 'index.md');
                
                // Ensure user directory exists
                await fs.mkdir(path.dirname(userIndexPath), { recursive: true });
                
                // Check if index.md exists, if not create it
                try {
                    await fs.access(userIndexPath);
                } catch {
                    await fs.writeFile(userIndexPath, '# Image Gallery\n\n');
                }
                
                // Append the image to index.md
                const imageUrl = `/uploads/${req.file.filename}`;
                const imageMarkdown = `\n![](${imageUrl})\n`;
                await fs.appendFile(userIndexPath, imageMarkdown);

                res.json({ url: imageUrl, filename: req.file.filename });
            } catch (error) {
                console.error('Error managing index.md:', error);
                // Still return success for the upload even if index.md management fails
                res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
            }
        });
    } catch (error) {
        console.error('Error configuring upload:', error);
        if (error.message === 'Authentication required') {
            return res.status(401).json({ error: 'Authentication required' });
        }
        res.status(500).json({ error: 'Server configuration error' });
    }
});

module.exports = router;
