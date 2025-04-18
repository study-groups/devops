import express from 'express';
import path from 'path';
import multer from 'multer';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Import from local files (ensure .js extension)
import { port, uploadsDirectory, env } from './config.js'; // Import env for MD_DIR usage
import { hashPassword } from './utils/userUtils.js';
import { authMiddleware } from './middleware/auth.js';
import imageRouter from './routes/images.js';
import authRoutes from './routes/auth.js'; // Assuming default export
import communityRoutes from './routes/community.js'; // Assuming default export
import saveRoutes from './routes/save.js'; // Assuming default export
import cliRoutes from './routes/cli.js'; // Assuming default export
import filesRouter from './routes/files.js';
import previewRoutes from './routes/previewRoutes.js'; // Assuming default export

// Derive __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// JS Content-Type middleware
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.type('application/javascript');
  }
  next();
});

// Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie Parser Middleware
app.use(cookieParser());

// Session Middleware Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-dev-secret-please-set-env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Configure multer (using imported 'uploadsDirectory')
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

// Serve static files (using derived __dirname and imported env)
app.use('/client', express.static(path.join(__dirname, '../client'), staticOptions));
// Use env.MD_DIR from imported config
app.use('/images', express.static(path.join(env.MD_DIR || '.', 'images'), staticOptions));
app.use('/uploads', express.static(uploadsDirectory, staticOptions));
app.use('/favicon.ico', express.static(path.join(__dirname, '../client/favicon.ico'), staticOptions));
app.use(express.static(path.join(__dirname, '..'), staticOptions)); // Serve root static files (like SVGs)

// Serve index.html (using derived __dirname)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// --- Async Function to Load Routes and Start Server ---
async function startServer() {
    // Routes are now imported at the top level

    // Dynamically import remaining ES Module routes (if any were missed)
    // Make sure extensions are included if needed by module resolution rules
    const mediaProxyModule = await import('./routes/mediaProxy.js');
    const mediaProxyRoutes = mediaProxyModule.default;
    const mediaUploadModule = await import('./routes/mediaUpload.js');
    const mediaUploadRoutes = mediaUploadModule.default;

    // --- Route Registration ---
    app.use('/api/auth', authRoutes);
    // Use the imported router directly
    app.use('/api/files', authMiddleware, filesRouter);
    app.use('/api/community', express.json(), authMiddleware, communityRoutes);
    // Legacy markdown route redirect - remove import if markdownRoutes isn't used elsewhere
    app.use('/api/markdown', (req, res, next) => {
      console.log('[SERVER] Redirecting legacy markdown route to files API');
      const newUrl = req.url.replace('/api/markdown', '/api/files');
      console.log(`[SERVER] Redirecting ${req.method} ${req.url} to ${newUrl}`);
      req.url = newUrl;
      next('route');
    });
    // Use the imported router directly
    app.use('/api/images', express.json(), authMiddleware, imageRouter);
    app.use('/api/save', express.text({ type: 'text/plain' }), express.json(), saveRoutes);
    app.use('/api/cli', express.json(), authMiddleware, cliRoutes);
    app.use('/', previewRoutes);

    // Register the dynamically imported routes
    app.use('/api/media', mediaUploadRoutes);
    app.use('/api/media-proxy', mediaProxyRoutes);

    // --- Other Endpoints ---
    app.post('/image-delete', express.json(), authMiddleware, async (req, res) => {
        try {
            const { url } = req.body;
            if (!url) return res.status(400).json({ error: 'Image URL is required' });

            let filename = url.split('/').pop();
            if (!filename || filename.includes('..')) return res.status(400).json({ error: 'Invalid image filename' });

            const imagePath = path.join(uploadsDirectory, filename);
            console.log(`Attempting to delete image: ${imagePath}`);

            try { await fs.access(imagePath); } catch (error) { return res.status(404).json({ error: 'Image file not found' }); }

            await fs.unlink(imagePath);
            console.log(`Successfully deleted image: ${filename}`);
            return res.json({ success: true, message: 'Image deleted successfully' });
        } catch (error) {
            console.error('Error deleting image:', error);
            return res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/files/get', async (req, res) => {
      try {
        const { name, dir } = req.query;
        if (!name) return res.status(400).json({ error: 'File name is required' });

        // Use env.MD_DIR from imported config
        const baseDir = env.MD_DIR || '.';
        const filePath = path.join(baseDir, dir || '', name);
        console.log(`[SERVER] Reading file: ${filePath}`);

        try { await fs.access(filePath); } catch (err) { return res.status(404).json({ error: 'File not found' }); }

        const content = await fs.readFile(filePath, 'utf8');
        res.json({ name, dir, content, success: true });
      } catch (error) {
        console.error('[SERVER] Error reading file:', error);
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/files/content/:dir/:file', async (req, res) => {
      try {
        const dir = req.params.dir;
        const filename = req.params.file;
        console.log(`[SERVER] Content request for ${dir}/${filename}`);

        // Use env.MD_DIR from imported config
        const baseDir = env.MD_DIR || '.';
        const filePath = path.join(baseDir, dir, filename);
        console.log(`[SERVER] Reading file: ${filePath}`);

        try { await fs.access(filePath); } catch (err) { return res.status(404).json({ error: 'File not found' }); }

        const content = await fs.readFile(filePath, 'utf8');
        const ext = path.extname(filename).toLowerCase();
        res.setHeader('Content-Type', ext === '.md' ? 'text/markdown' : 'text/plain');
        res.send(content);
      } catch (error) {
        console.error('[SERVER] Error reading file:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Emergency MD file serving middleware
    app.use(async (req, res, next) => {
      if (req.method !== 'GET' || req.url.includes('/api/') || req.url.includes('/client/') || req.url.includes('/images/') || req.url.includes('/uploads/')) {
        return next();
      }
      const match = req.url.match(/^\/([^\/]+)\/([^\/]+\.md)$/);
      if (match) {
        const [, dir, file] = match;
        console.log(`[EMERGENCY SERVER] Detected potential file request: ${dir}/${file}`);
        try {
          // Use env.MD_DIR from imported config
          const baseDir = env.MD_DIR || '.';
          const filePath = path.join(baseDir, dir, file);
          console.log(`[EMERGENCY SERVER] Checking file: ${filePath}`);
          try { await fs.access(filePath); } catch (err) { return next(); }

          console.log(`[EMERGENCY SERVER] Serving file: ${filePath}`);
          const content = await fs.readFile(filePath, 'utf8');
          res.setHeader('Content-Type', 'text/markdown');
          return res.send(content);
        } catch (error) { console.error('[EMERGENCY SERVER] Error:', error); return next(); }
      }
      next();
    });

    // API 404 Handler
    app.use('/api/*', (req, res) => {
        console.log(`[API] 404 Not Found: ${req.method} ${req.originalUrl}`);
        res.status(404).json({ error: 'API endpoint not found', path: req.originalUrl, method: req.method, message: 'The requested API endpoint does not exist or is misconfigured.' });
    });

    // General 404 Handler (including preview fallback)
    app.use((req, res, next) => {
      console.log(`[SERVER] 404 Not Found: ${req.originalUrl}`);
      if (req.originalUrl.startsWith('/preview/')) {
        console.log('[SERVER] Attempting to serve preview page as fallback for unmatched preview URL');
        // Use derived __dirname
        res.sendFile(path.resolve(__dirname, '../client/preview/viewer.html'));
      } else {
        res.status(404).send('404 Not Found');
      }
    });

    // --- Log Registered Routes ---
    console.log('Registered routes:');
    app._router.stack.forEach(middleware => {
        if (middleware.route) {
            console.log(`${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
        } else if (middleware.name === 'router' && middleware.handle.stack) { // Check handle.stack exists
            middleware.handle.stack.forEach(handler => {
                if (handler.route) {
                     // Construct the full path if possible
                     // Note: middleware.regexp might not give a clean base path always
                     const basePathPattern = middleware.regexp.source.replace(/^\^\/?/, '/').replace(/\/?\(\?=\/\|\$\)/, '').replace(/\\\//g, '/');
                     const fullPath = path.join(basePathPattern, handler.route.path).replace(/\\/g, '/'); // Normalize path separators
                     console.log(`${Object.keys(handler.route.methods).map(m=>m.toUpperCase()).join(',')} ${fullPath}`);
                }
            });
        }
    });

    // --- Test Routes ---
    app.get('/test-route', (req, res) => res.json({ success: true, message: 'Test route works!' }));
    app.get('/api-direct-test', (req, res) => res.json({ success: true, message: 'Direct API test route works!' }));
    app.post('/api/direct-publish', express.json(), async (req, res) => {
      console.log('[SERVER] Direct publish route called', req.body);
      res.json({ success: true, message: 'Direct publish route works', url: `${req.protocol}://${req.get('host')}/view/test/123456` });
    });
    app.get('/emergency/load-file', async (req, res) => {
      try {
        const { name, dir } = req.query;
        console.log('[SERVER] Emergency file loading request:', { name, dir });
        if (!name) return res.status(400).json({ error: 'File name is required' });

        // Use env.MD_DIR from imported config
        const baseDir = env.MD_DIR || '.';
        const sanitizedDir = (dir || '').replace(/\.\./g, '').replace(/[^a-zA-Z0-9_-]/g, '');
        const filePath = path.join(baseDir, sanitizedDir, name);
        console.log(`[SERVER] Emergency loading file: ${filePath}`);

        try { await fs.access(filePath); } catch (err) { console.error(`[SERVER] Emergency file not found: ${filePath}`); return res.status(404).json({ error: 'File not found', path: filePath }); }

        const content = await fs.readFile(filePath, 'utf8');
        console.log(`[SERVER] Emergency file loaded successfully: ${filePath} (${content.length} chars)`);
        res.json({ name, dir: sanitizedDir, content, success: true });
      } catch (error) {
        console.error('[SERVER] Error reading file:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // --- Start Server ---
    console.log('[SERVER] Starting server...');
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV}`);
    console.log(`[SERVER] Listening on port ${port}`);

    app.listen(port, () => {
        console.log('='.repeat(50));
        console.log(`[SERVER] Server running at http://localhost:${port}`);
        // Use env.MD_DIR from imported config
        console.log(`[SERVER] Using MD_DIR: ${env.MD_DIR || 'default'}`);
        console.log('='.repeat(50));
    });
}

// --- Call the async function to start the server ---
startServer().catch(err => {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
});

