const express = require('express');
const router = express.Router();
const fs = require('fs/promises');
const path = require('path');

// Helper to extract user from HTTP Basic Auth
function getCurrentUser(req) {
    // Try different ways nginx might pass the user info
    
    // Method 1: Direct Authorization header (if nginx passes it through)
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Basic ')) {
        try {
            const credentials = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
            const [username] = credentials.split(':');
            return username || 'anonymous';
        } catch (error) {
            console.warn('Error parsing basic auth:', error);
        }
    }
    
    // Method 2: Remote-User header (common nginx setup)
    if (req.headers['remote-user']) {
        return req.headers['remote-user'];
    }
    
    // Method 3: X-Remote-User header (another common setup)
    if (req.headers['x-remote-user']) {
        return req.headers['x-remote-user'];
    }
    
    // Method 4: X-Forwarded-User header
    if (req.headers['x-forwarded-user']) {
        return req.headers['x-forwarded-user'];
    }
    
    return 'anonymous';
}

const DOCS_DIR = path.resolve(__dirname, '..', '..', '..', 'docs');
const META_FILE_PATH = path.join(DOCS_DIR, 'docs-meta.json');

// Route to get current user info
router.get('/whoami', (req, res) => {
    console.log('[DOCS WHOAMI] Request received');
    console.log('[DOCS WHOAMI] Request headers:', Object.keys(req.headers));
    console.log('[DOCS WHOAMI] Full headers:', JSON.stringify(req.headers, null, 2));
    
    const currentUser = getCurrentUser(req);
    
    // If no authentication headers are present, return a more specific error
    if (currentUser === 'anonymous') {
        return res.status(401).json({ 
            error: 'Authentication Required',
            message: 'No valid authentication headers found. Please provide authentication via Remote-User, X-Remote-User, or Authorization header.',
            supportedMethods: [
                'Remote-User header',
                'X-Remote-User header', 
                'X-Forwarded-User header',
                'Basic Authorization header'
            ],
            timestamp: new Date().toISOString()
        });
    }
    
    res.json({ 
        user: currentUser,
        isAuthenticated: true,
        timestamp: new Date().toISOString()
    });
});

// Helper to read metadata
async function readMetadata() {
    try {
        await fs.access(META_FILE_PATH);
        const metaContent = await fs.readFile(META_FILE_PATH, 'utf8');
        const meta = JSON.parse(metaContent);
        // Ensure default structure exists
        if (!meta.docs) meta.docs = {};
        if (!meta.views) meta.views = { default: [] };
        if (!meta.userPreferences) meta.userPreferences = {};
        return meta;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { 
                docs: {}, 
                views: { default: [] },
                userPreferences: {}
            }; // Return a default structure if file doesn't exist
        }
        console.error('Error reading metadata file:', error);
        throw error;
    }
}

// Helper to write metadata
async function writeMetadata(data) {
    try {
        await fs.writeFile(META_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing metadata file:', error);
        throw error;
    }
}


// Route to get a list of all documentation files
router.get('/', async (req, res) => {
    try {
        const { view = 'default' } = req.query;
        const files = await fs.readdir(DOCS_DIR);
        const markdownFiles = files.filter(file => file.endsWith('.md'));
        
        const metadata = await readMetadata();
        
        const combinedData = markdownFiles.map(file => {
            const meta = metadata.docs[file] || {};
            return {
                name: file,
                title: meta.title || path.basename(file, '.md'),
                tags: meta.tags || [],
                rating: meta.rating || 0,
            };
        });

        // Get the ordered list of filenames for the current view
        const orderedFilenames = metadata.views[view] || [];
        
        // Create a set for quick lookups
        const orderedSet = new Set(orderedFilenames);
        
        // Filter out files that are no longer in the ordered list
        const existingOrdered = orderedFilenames.filter(f => markdownFiles.includes(f));
        
        // Find new files that are not in the ordered list
        const newFiles = markdownFiles.filter(f => !orderedSet.has(f));

        // Combine and maintain the order
        const finalOrder = [...existingOrdered, ...newFiles];

        if (JSON.stringify(metadata.views[view]) !== JSON.stringify(finalOrder)) {
            metadata.views[view] = finalOrder;
            await writeMetadata(metadata);
        }

        const sortedDocs = finalOrder.map(filename => {
            return combinedData.find(doc => doc.name === filename);
        }).filter(Boolean); // Filter out any undefined entries

        res.json(sortedDocs);

    } catch (err) {
        console.error('Error reading docs directory:', err);
        res.status(500).json({ 
            error: 'Could not list documentation files.', 
            details: err.message,
            docsDir: DOCS_DIR
        });
    }
});

// Route to get a specific documentation file
router.get('/:filename', async (req, res) => {
    const { filename } = req.params;

    if (path.extname(filename) !== '.md' || filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid documentation file requested.' });
    }

    try {
        const filePath = path.join(DOCS_DIR, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const metadata = await readMetadata();
        const docMeta = metadata.docs[filename] || {};

        res.json({ 
            name: filename, 
            content: content,
            tags: docMeta.tags || [],
            rating: docMeta.rating || 0,
            title: docMeta.title || ''
        });
    } catch (err) {
        console.error('Error reading file:', err);
        if (err.code === 'ENOENT') {
            return res.status(404).json({ 
                error: 'Documentation file not found.',
                filename,
                docsDir: DOCS_DIR
            });
        }
        res.status(500).json({ 
            error: 'Could not read documentation file.', 
            details: err.message 
        });
    }
});

// Route to create/update a document
router.post('/', async (req, res) => {
    const { filename, content, tags, rating, title } = req.body;

    if (!filename || path.extname(filename) !== '.md' || filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename provided.' });
    }

    try {
        const filePath = path.join(DOCS_DIR, filename);
        await fs.writeFile(filePath, content || '');

        const metadata = await readMetadata();
        metadata.docs[filename] = {
            tags: tags || [],
            rating: rating || 0,
            title: title || path.basename(filename, '.md')
        };
        await writeMetadata(metadata);

        res.status(201).json({ message: 'Document saved successfully.' });
    } catch (error) {
        console.error('Error saving document:', error);
        res.status(500).json({ error: 'Could not save document.', details: error.message });
    }
});

// Route to delete a document
router.delete('/:filename', async (req, res) => {
    const { filename } = req.params;

    if (path.extname(filename) !== '.md' || filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid documentation file requested.' });
    }

    try {
        const filePath = path.join(DOCS_DIR, filename);
        await fs.unlink(filePath);

        const metadata = await readMetadata();
        delete metadata.docs[filename];
        await writeMetadata(metadata);

        res.status(200).json({ message: 'Document deleted successfully.' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'Document not found.' });
        }
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Could not delete document.', details: error.message });
    }
});

// Route to update document order for a view
router.post('/order', async (req, res) => {
    const currentUser = getCurrentUser(req);
    const { view = 'default', order, timestamp } = req.body;

    if (!order || !Array.isArray(order)) {
        return res.status(400).json({ error: 'Invalid order data provided.' });
    }

    try {
        const metadata = await readMetadata();
        
        // Store the order with metadata about who changed it
        metadata.views[view] = order;
        
        // Track order changes
        if (!metadata.orderHistory) {
            metadata.orderHistory = {};
        }
        
        if (!metadata.orderHistory[view]) {
            metadata.orderHistory[view] = [];
        }
        
        // Keep last 10 order changes for history
        metadata.orderHistory[view].unshift({
            order: [...order],
            userId: currentUser,
            timestamp: timestamp || new Date().toISOString()
        });
        
        if (metadata.orderHistory[view].length > 10) {
            metadata.orderHistory[view] = metadata.orderHistory[view].slice(0, 10);
        }
        
        await writeMetadata(metadata);
        console.log(`[DOCS] Order for view '${view}' saved by user '${currentUser}'`);
        res.status(200).json({ 
            message: `Order for view '${view}' saved.`,
            savedBy: currentUser,
            timestamp: timestamp || new Date().toISOString()
        });
    } catch (error) {
        console.error('Error saving document order:', error);
        res.status(500).json({ error: 'Could not save document order.', details: error.message });
    }
});

// Route to get user preferences (with userId)
router.get('/preferences/:userId', async (req, res) => {
    const currentUser = getCurrentUser(req);
    const userId = req.params.userId || currentUser;
    
    try {
        const metadata = await readMetadata();
        const userPrefs = metadata.userPreferences[userId] || {
            tagFilters: [],
            minRating: 0,
            currentView: 'default',
            lastUpdated: new Date().toISOString()
        };
        
        res.json({
            ...userPrefs,
            userId: userId,
            currentUser: currentUser
        });
    } catch (error) {
        console.error('Error reading user preferences:', error);
        res.status(500).json({ error: 'Could not read user preferences.', details: error.message });
    }
});

// Route to get user preferences (without userId)
router.get('/preferences', async (req, res) => {
    const currentUser = getCurrentUser(req);
    const userId = currentUser;
    
    try {
        const metadata = await readMetadata();
        const userPrefs = metadata.userPreferences[userId] || {
            tagFilters: [],
            minRating: 0,
            currentView: 'default',
            lastUpdated: new Date().toISOString()
        };
        
        res.json({
            ...userPrefs,
            userId: userId,
            currentUser: currentUser
        });
    } catch (error) {
        console.error('Error reading user preferences:', error);
        res.status(500).json({ error: 'Could not read user preferences.', details: error.message });
    }
});

// Route to save user preferences (with userId)
router.post('/preferences/:userId', async (req, res) => {
    const currentUser = getCurrentUser(req);
    const userId = req.params.userId || currentUser;
    const { tagFilters, minRating, currentView } = req.body;

    // Only allow users to save their own preferences
    if (userId !== currentUser && currentUser !== 'anonymous') {
        return res.status(403).json({ error: 'You can only modify your own preferences.' });
    }

    try {
        const metadata = await readMetadata();
        
        if (!metadata.userPreferences) {
            metadata.userPreferences = {};
        }
        
        metadata.userPreferences[userId] = {
            tagFilters: tagFilters || [],
            minRating: minRating || 0,
            currentView: currentView || 'default',
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentUser
        };
        
        await writeMetadata(metadata);
        console.log(`[DOCS] Preferences saved for user '${userId}' by '${currentUser}'`);
        res.status(200).json({ 
            message: 'User preferences saved successfully.',
            userId: userId,
            savedBy: currentUser
        });
    } catch (error) {
        console.error('Error saving user preferences:', error);
        res.status(500).json({ error: 'Could not save user preferences.', details: error.message });
    }
});

// Route to save user preferences (without userId)
router.post('/preferences', async (req, res) => {
    const currentUser = getCurrentUser(req);
    const userId = currentUser;
    const { tagFilters, minRating, currentView } = req.body;

    try {
        const metadata = await readMetadata();
        
        if (!metadata.userPreferences) {
            metadata.userPreferences = {};
        }
        
        metadata.userPreferences[userId] = {
            tagFilters: tagFilters || [],
            minRating: minRating || 0,
            currentView: currentView || 'default',
            lastUpdated: new Date().toISOString(),
            lastUpdatedBy: currentUser
        };
        
        await writeMetadata(metadata);
        console.log(`[DOCS] Preferences saved for user '${userId}' by '${currentUser}'`);
        res.status(200).json({ 
            message: 'User preferences saved successfully.',
            userId: userId,
            savedBy: currentUser
        });
    } catch (error) {
        console.error('Error saving user preferences:', error);
        res.status(500).json({ error: 'Could not save user preferences.', details: error.message });
    }
});

module.exports = router;