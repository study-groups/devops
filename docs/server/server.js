const express = require('express');
const path = require('path');
const multer = require('multer');
const { port, uploadsDirectory } = require('./config');

const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: uploadsDirectory,
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${Math.random().toString(36).substring(7)}${ext}`);
    }
});

// Configure MIME types
express.static.mime.define({
    'image/svg+xml': ['svg'],
    'text/plain': ['md'],
    'text/markdown': ['md']
});

const staticOptions = { followSymlinks: true };

// Serve static files
app.use('/client', express.static(path.join(__dirname, '../client'), staticOptions));
app.use('/images', express.static(path.join(process.env.MD_DIR || '.', 'images'), staticOptions));
app.use('/uploads', express.static(uploadsDirectory, staticOptions));
app.use('/favicon.ico', express.static(path.join(__dirname, '../client/favicon.ico'), staticOptions));
// Serve SVG files from the root directory
app.use(express.static(path.join(__dirname, '..'), staticOptions));
app.use(express.static('client', staticOptions));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Import routes and middleware
const { authMiddleware } = require('./middleware/auth');
const markdownRoutes = require('./routes/markdown');
const { router: imageRoutes } = require('./routes/images');
const authRoutes = require('./routes/auth');
const communityRoutes = require('./routes/community');
const saveRoutes = require('./routes/save');

// Configure routes that need JSON parsing
app.use('/api/auth', express.json(), authRoutes);
app.use('/api/files', express.json(), authMiddleware, markdownRoutes);
app.use('/api/community', express.json(), authMiddleware, communityRoutes);

// Image routes with JSON parsing for delete and reference operations
app.use('/api/images', express.json(), authMiddleware, imageRoutes);

// Add this line with your other route registrations
app.use('/api/save', express.text({ type: 'text/plain' }), express.json(), saveRoutes);

// Handle 404s
app.use('/api/*', (req, res) => {
    console.log(`[API] 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'API endpoint not found' });
});

// Start server
console.log('[SERVER] Starting server...');
console.log(`[SERVER] Environment: ${process.env.NODE_ENV}`);
console.log(`[SERVER] Listening on port ${port}`);

app.listen(port, () => {
    console.log('='.repeat(50));
    console.log(`[SERVER] Server running at http://localhost:${port}`);
    console.log(`[SERVER] Using MD_DIR: ${process.env.MD_DIR || 'default'}`);
    console.log('='.repeat(50));
});

