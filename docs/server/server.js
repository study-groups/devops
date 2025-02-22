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

// Serve static files
app.use('/client', express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/favicon.ico', express.static(path.join(__dirname, '../client/favicon.ico')));
app.use(express.static('client'));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Import routes and middleware
const { authMiddleware } = require('./middleware/auth');
const markdownRoutes = require('./routes/markdown');
const imageRoutes = require('./routes/images');
const authRoutes = require('./routes/auth');
const filesRouter = require('./routes/files');

// Configure routes that need JSON parsing
app.use('/api/auth', express.json(), authRoutes);
app.use('/api/files', express.json(), authMiddleware, markdownRoutes);

// Image routes don't need JSON parsing
app.use('/api/images', authMiddleware, imageRoutes);

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
    console.log(`[SERVER] Using PJ_DIR: ${process.env.PJ_DIR || 'default'}`);
    console.log('='.repeat(50));
});

