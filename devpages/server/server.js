const express = require('express');
const path = require('path');
const multer = require('multer');
const { port, uploadsDirectory } = require('./config');
const fs = require('fs/promises');

const app = express();

// Move this middleware to the TOP of your file, right after creating the Express app
// This should be around line 10, right after const app = express();
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Make sure express.json() middleware is registered BEFORE your routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
const cliRoutes = require('./routes/cli');
const filesRoutes = require('./routes/files');
const previewRoutes = require('./routes/previewRoutes');

// Configure routes that need JSON parsing
app.use('/api/auth', express.json(), authRoutes);
app.use('/api/files', filesRoutes.router || filesRoutes);
app.use('/api/community', express.json(), authMiddleware, communityRoutes);

// Backwards compatibility for old routes - redirect to new API
app.use('/api/markdown', (req, res, next) => {
  console.log('[SERVER] Redirecting legacy markdown route to files API');
  const newUrl = req.url.replace('/api/markdown', '/api/files');
  console.log(`[SERVER] Redirecting ${req.method} ${req.url} to ${newUrl}`);
  req.url = newUrl;
  next('route'); // Continue to next route handler instead of reprocessing
});

// Image routes with JSON parsing for delete and reference operations
app.use('/api/images', express.json(), authMiddleware, imageRoutes);

// Add this line with your other route registrations
app.use('/api/save', express.text({ type: 'text/plain' }), express.json(), saveRoutes);

// CLI routes with JSON parsing and authentication
app.use('/api/cli', express.json(), authMiddleware, cliRoutes);

// Register the preview routes
app.use('/', previewRoutes);

// Direct image delete endpoint for emergency use
app.post('/image-delete', express.json(), authMiddleware, async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'Image URL is required' });
        }
        
        // Extract filename from URL
        let filename = url.split('/').pop();
        
        // Make sure the filename is valid
        if (!filename || filename.includes('..')) {
            return res.status(400).json({ error: 'Invalid image filename' });
        }
        
        // Ensure we're only deleting from uploads directory
        const imagePath = path.join(uploadsDirectory, filename);
        
        console.log(`Attempting to delete image: ${imagePath}`);
        
        // Check if file exists
        try {
            await fs.access(imagePath);
        } catch (error) {
            return res.status(404).json({ error: 'Image file not found' });
        }
        
        // Delete the file
        await fs.unlink(imagePath);
        
        console.log(`Successfully deleted image: ${filename}`);
        
        return res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Fix for /api/files/get endpoint
app.get('/api/files/get', async (req, res) => {
  try {
    const { name, dir } = req.query;
    
    if (!name) {
      return res.status(400).json({ error: 'File name is required' });
    }
    
    // Determine base directory
    const baseDir = process.env.MD_DIR || '.';
    // Construct full path
    const filePath = path.join(baseDir, dir || '', name);
    
    console.log(`[SERVER] Reading file: ${filePath}`);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Send response
    res.json({ 
      name, 
      dir, 
      content,
      success: true 
    });
  } catch (error) {
    console.error('[SERVER] Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Additional endpoint for direct content access
app.get('/api/files/content/:dir/:file', async (req, res) => {
  try {
    const dir = req.params.dir;
    const filename = req.params.file;
    
    console.log(`[SERVER] Content request for ${dir}/${filename}`);
    
    // Determine base directory
    const baseDir = process.env.MD_DIR || '.';
    // Construct full path
    const filePath = path.join(baseDir, dir, filename);
    
    console.log(`[SERVER] Reading file: ${filePath}`);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.md') {
      res.setHeader('Content-Type', 'text/markdown');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    
    // Send content directly
    res.send(content);
  } catch (error) {
    console.error('[SERVER] Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Global emergency file access
app.use(async (req, res, next) => {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  // Skip non-file requests 
  if (req.url.includes('/api/') || req.url.includes('/client/') || 
      req.url.includes('/images/') || req.url.includes('/uploads/')) {
    return next();
  }
  
  // Check if this looks like a potential file path
  const match = req.url.match(/^\/([^\/]+)\/([^\/]+\.md)$/);
  if (match) {
    const [, dir, file] = match;
    
    console.log(`[EMERGENCY SERVER] Detected potential file request: ${dir}/${file}`);
    
    try {
      // Determine base directory
      const baseDir = process.env.MD_DIR || '.';
      // Construct full path
      const filePath = path.join(baseDir, dir, file);
      
      console.log(`[EMERGENCY SERVER] Checking file: ${filePath}`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (err) {
        // Let it continue to regular handling
        return next();
      }
      
      // File exists, read and serve it
      console.log(`[EMERGENCY SERVER] Serving file: ${filePath}`);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Set appropriate content type
      res.setHeader('Content-Type', 'text/markdown');
      
      // Send content directly
      return res.send(content);
    } catch (error) {
      console.error('[EMERGENCY SERVER] Error:', error);
      // Continue to regular handlers
      return next();
    }
  }
  
  // Not a file request, continue
  next();
});

// Handle 404s - but only after all other API routes
app.use('/api/*', (req, res) => {
    console.log(`[API] 404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: 'API endpoint not found',
        path: req.originalUrl,
        method: req.method,
        message: 'The requested API endpoint does not exist or is misconfigured.'
    });
});

// After setting up all routes
console.log('Registered routes:');
app._router.stack.forEach(middleware => {
    if (middleware.route) {
        console.log(`${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach(handler => {
            if (handler.route) {
                console.log(`${Object.keys(handler.route.methods)} ${middleware.regexp} ${handler.route.path}`);
            }
        });
    }
});

// Add this at the end of your server.js file, after all other route handlers
app.use((req, res, next) => {
  // This handles all routes that weren't matched
  console.log(`[SERVER] 404 Not Found: ${req.originalUrl}`);
  
  // Check if it's a preview route
  if (req.originalUrl.startsWith('/preview/')) {
    console.log('[SERVER] Attempting to serve preview page as fallback for unmatched preview URL');
    res.sendFile(path.resolve(__dirname, '../client/preview/viewer.html'));
  } else {
    // For non-preview routes, return a standard 404
    res.status(404).send('404 Not Found');
  }
});

// After registering the routes, log them with full paths
console.log('[SERVER] Detailed route registration:');
app._router.stack.forEach(middleware => {
  if (middleware.route) {
    // Routes directly on the app
    console.log(`[SERVER] Direct route: ${Object.keys(middleware.route.methods).join(',')} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    // Routes inside routers
    const prefix = middleware.regexp.toString()
      .replace('\\/?(?=\\/|$)', '')
      .replace(/^\/\^/, '')
      .replace(/\/i$/, '')
      .replace(/\\\//g, '/');
    
    console.log(`[SERVER] Router prefix: ${prefix}`);
    
    middleware.handle.stack.forEach(layer => {
      if (layer.route) {
        const fullPath = prefix + layer.route.path;
        console.log(`[SERVER] Router route: ${Object.keys(layer.route.methods).join(',')} ${fullPath}`);
      }
    });
  }
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

app.get('/test-route', (req, res) => {
  res.json({ success: true, message: 'Test route works!' });
});

// Add direct test routes to verify Express is working
app.get('/api-direct-test', (req, res) => {
  res.json({ success: true, message: 'Direct API test route works!' });
});

app.post('/api/direct-publish', express.json(), async (req, res) => {
  console.log('[SERVER] Direct publish route called');
  console.log('[SERVER] Request body:', req.body);
  
  res.json({ 
    success: true, 
    message: 'Direct publish route works',
    url: `${req.protocol}://${req.get('host')}/view/test/123456`
  });
});

// Update the emergency file loading endpoint
app.get('/emergency/load-file', async (req, res) => {
  try {
    const { name, dir } = req.query;
    
    console.log('[SERVER] Emergency file loading request:', { name, dir });
    
    if (!name) {
      return res.status(400).json({ error: 'File name is required' });
    }
    
    // Determine base directory
    const baseDir = process.env.MD_DIR || '.';
    
    // Construct full path - sanitize dir to prevent path traversal
    const sanitizedDir = (dir || '').replace(/\.\./g, '').replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(baseDir, sanitizedDir, name);
    
    console.log(`[SERVER] Emergency loading file: ${filePath}`);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      console.error(`[SERVER] Emergency file not found: ${filePath}`);
      return res.status(404).json({ error: 'File not found', path: filePath });
    }
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    
    console.log(`[SERVER] Emergency file loaded successfully: ${filePath} (${content.length} chars)`);
    
    // Send response
    res.json({ 
      name, 
      dir: sanitizedDir, 
      content,
      success: true 
    });
  } catch (error) {
    console.error('[SERVER] Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

