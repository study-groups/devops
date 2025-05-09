import express from 'express';
import path from 'path';
import multer from 'multer';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import fs from 'fs/promises';
import fsSync from 'fs';  // For sync methods like existsSync
import { fileURLToPath } from 'url';
import passport from 'passport'; // Assuming passport for auth
import FileStore from 'session-file-store'; // 1. Import
import { S3Client } from '@aws-sdk/client-s3'; // Import S3Client

// Import from local files (ensure .js extension)
import { port, uploadsDirectory, env } from './config.js'; // Import env for MD_DIR usage
import { authMiddleware } from './middleware/auth.js';
import imageRouter from './routes/images.js';
import authRoutes from './routes/auth.js'; // Assuming default export
import communityRoutes from './routes/community.js'; // Assuming default export
import saveRoutes from './routes/save.js'; // Assuming default export
import cliRoutes from './routes/cli.js'; // Assuming default export
import filesRouter from './routes/files.js';
import previewRoutes from './routes/previewRoutes.js'; // Assuming default export
import publishRouter from './routes/publish.js'; // <--- ADD THIS IMPORT
import { PData, createPDataRoutes } from 'pdata'; // Import class and factory
import spacesRouter from './routes/spaces.js'; // Keep spaces router import

// Derive __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(__filename); // Directory of the current file (e.g., /server)
const projectRoot = path.resolve(currentDir, '..'); // Go up one level to the project root

// --- At the top with other configurations ---
// Early access to environment variables for static routes
const pdDir = process.env.PD_DIR;
if (!pdDir) {
    console.error("[SERVER FATAL] PD_DIR environment variable is not set.");
    process.exit(1);
}

console.log(`[SERVER] Using PD_DIR: ${pdDir}`);
console.log(`[SERVER] Current Directory (__dirname equivalent): ${currentDir}`);
console.log(`[SERVER] Resolved Project Root: ${projectRoot}`);

// Add this extra log right before using clientDir
console.log(`[DEBUG] Path used for client static: ${currentDir}`);

// --- NEW: Single S3 Client Initialization (Using DO Spaces details) ---
const s3ClientInstance = (() => {
    const requiredEnvVars = ['DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_REGION', 'DO_SPACES_ENDPOINT'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    
    if (missingVars.length > 0) {
        console.warn(`[Server Config] Missing DO Spaces environment variables: ${missingVars.join(', ')}. S3 features disabled.`);
        return null;
    }

    console.log(`[Server Config] DO Spaces config found. Initializing S3 client...`);
    try {
        const client = new S3Client({
            endpoint: process.env.DO_SPACES_ENDPOINT,
            region: process.env.DO_SPACES_REGION,
            credentials: {
                accessKeyId: process.env.DO_SPACES_KEY,
                secretAccessKey: process.env.DO_SPACES_SECRET,
            },
            forcePathStyle: true, // Required for DO Spaces - SET TO TRUE
        });
        console.log(`[Server Config] S3 Client initialized successfully for region ${process.env.DO_SPACES_REGION}.`);
        return client;
    } catch (error) {
        console.error('[Server Config] Error initializing S3 Client:', error);
        return null;
    }
})();
// --- END NEW: Single S3 Client Initialization ---

// Continue with app setup and static routes which can now use dataDir
const app = express();

// Initialize PData **once**
let pdataInstance;
try {
	pdataInstance = new PData(); // PData no longer needs S3 config directly
	console.log('[Server] PData initialized successfully.');
} catch (error) {
	console.error('[Server] CRITICAL: PData failed to initialize. Server cannot start securely.', error);
	process.exit(1);
}

// Logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  // Make pdata instance available on request object
  req.pdata = pdataInstance;
  // --- ADD Single s3Client to request ---
  req.s3Client = s3ClientInstance;
  // ------------------------------------
  req.dataDir = pdataInstance.dataDir; // Also make dataDir easily available if needed
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
console.log('>>> [DEBUG] projectRoot for session path:', projectRoot); // Add this log
const FileStoreSession = FileStore(session);
app.use(session({
  name: 'devpages.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-for-prod',
  resave: false, // Recommended: false
  saveUninitialized: false, // Recommended: false
  store: new FileStoreSession({ // 3. Configure the file store
      path: path.join(projectRoot, '.sessions'), // Store sessions in project root/.sessions
      logFn: console.log, // Optional: Log session store activity
      ttl: 24 * 60 * 60 // Session TTL in seconds (e.g., 24 hours)
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Keep this check
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    sameSite: 'lax' // 'lax' is usually a good default
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ----- PASSPORT CONFIGURATION -----
// Also uncomment the serialize/deserialize functions if they were commented
passport.serializeUser((user, done) => {
    console.log('[Passport serializeUser] Storing user identifier in session:', user.username);
    done(null, user.username);
});
passport.deserializeUser((username, done) => {
    console.log('[Passport deserializeUser] Retrieving user from session identifier:', username);
    const user = { username: username };
    done(null, user);
});
// ----- END PASSPORT CONFIGURATION -----

console.log(`[SERVER] Using SESSION_SECRET: ${process.env.SESSION_SECRET || '!!! FALLBACK USED !!!'}`);

// Configure multer (using imported 'uploadsDirectory')
// Multer setup might be okay here, or move it after the static block if causing issues
const storage = multer.diskStorage({
    destination: uploadsDirectory,
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${Math.random().toString(36).substring(7)}${ext}`);
    }
});

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(projectRoot, 'client', 'index.html'));
});

// Configure MIME types
express.static.mime.define({
    'image/svg+xml': ['svg'],
    'text/plain': ['md'],
    'text/markdown': ['md']
});

const staticOptions = { followSymlinks: true };

// --- /client Static Serving Block (KEEP THIS ACTIVE) ---
app.use('/client', (req, res, next) => {
    console.log(`[DEBUG] Middleware BEFORE static: Request for /client${req.path}`);
    next();
});
// --- The actual static middleware ---
app.use('/client', express.static(path.join(projectRoot, 'client'), staticOptions));
// --- DEBUG: Log if request *passed through* static (shouldn't happen for existing files) ---
app.use('/client', (req, res, next) => {
    // This should ONLY log if express.static did NOT find the file
    console.log(`[DEBUG] Middleware AFTER static: File /client${req.path} likely not found by express.static`);
    next();
});
// --- End /client Static Serving Block ---


// --- Other static routes ---
app.use('/images', express.static(path.join(pdataInstance.dataRoot, 'images'), staticOptions));
app.use('/uploads', express.static(uploadsDirectory, staticOptions));
app.use('/favicon.ico', express.static(path.join(currentDir, 'favicon.ico'), staticOptions));
app.get('/config.js', (req, res) => {
    res.sendFile(path.join(projectRoot, 'config.js'));
});

// --- NEW: Securely serve JS/CSS files from pdata for preview --- 
const ALLOWED_PREVIEW_EXTENSIONS = ['.js', '.css'];
app.get('/pdata-files/*', async (req, res) => {
    const logPrefix = '[SERVER /pdata-files]';
    try {
        // 1. Extract requested relative path from URL
        // req.params[0] will contain everything after '/pdata-files/'
        const requestedRelativePath = req.params[0];
        if (!requestedRelativePath) {
            console.warn(`${logPrefix} Request path is empty.`);
            return res.status(400).send('Bad Request: No file path specified.');
        }
        console.log(`${logPrefix} Requested relative path: ${requestedRelativePath}`);

        // 2. Security: Basic path validation (check for null bytes, etc.)
        if (requestedRelativePath.includes('\0')) {
            console.warn(`${logPrefix} Denied request with null byte: ${requestedRelativePath}`);
            return res.status(400).send('Bad Request: Invalid characters in path.');
        }
        
        // 3. Security: Check file extension
        const requestedExt = path.extname(requestedRelativePath).toLowerCase();
        if (!ALLOWED_PREVIEW_EXTENSIONS.includes(requestedExt)) {
            console.warn(`${logPrefix} Denied request for non-allowed extension (${requestedExt}): ${requestedRelativePath}`);
            return res.status(403).send(`Forbidden: File type (${requestedExt}) not allowed.`);
        }

        // 4. Construct absolute path using pdataInstance.dataRoot AND ADDING 'data' for MD_DIR
        const mdDirRoot = path.join(pdataInstance.dataRoot, 'data'); // Base for user content
        const absolutePath = path.join(mdDirRoot, requestedRelativePath);
        console.log(`${logPrefix} Resolved absolute path (target MD_DIR): ${absolutePath}`);

        // 5. Security: Ensure the resolved path is *still within* the mdDirRoot directory
        if (!path.resolve(absolutePath).startsWith(path.resolve(mdDirRoot))) {
            console.error(`${logPrefix} CRITICAL SECURITY: Directory traversal attempt detected! Resolved path '${path.resolve(absolutePath)}' is outside MD_DIR root '${path.resolve(mdDirRoot)}'. Request: ${requestedRelativePath}`);
            return res.status(403).send('Forbidden: Access denied.');
        }

        // 6. Check if file exists
        await fs.access(absolutePath, fs.constants.R_OK); // Check for read access

        // 7. Send the file (Express handles Content-Type based on extension)
        console.log(`${logPrefix} Serving file: ${absolutePath}`);
        res.sendFile(absolutePath, (err) => {
            if (err) {
                // Handle potential errors during sendFile (e.g., file deleted after check)
                console.error(`${logPrefix} Error sending file ${absolutePath}:`, err);
                if (!res.headersSent) {
                    // Use status code from error if available, otherwise 500
                    res.status(err.status || 500).send('Error sending file.');
                }
            }
        });

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`${logPrefix} File not found: ${req.params[0]}`);
            res.status(404).send('Not Found');
        } else if (error.code === 'EACCES') {
            console.error(`${logPrefix} Permission denied for: ${req.params[0]}`);
            res.status(403).send('Forbidden');
        } else {
            console.error(`${logPrefix} Unexpected error serving file ${req.params[0]}:`, error);
            res.status(500).send('Internal Server Error');
        }
    }
});
// --- END NEW ROUTE --- 

// Application-specific directories within dataDir
const appImagesDir = path.join(pdataInstance.dataRoot, 'images');
// Ensure application directories exist
// Note: fs operations moved inside startServer() as they are async
// try {
//     if (!fsSync.existsSync(appImagesDir)) {
//         console.log(`[SERVER] Creating images directory: ${appImagesDir}`);
//         await fs.mkdir(appImagesDir, { recursive: true }); // await needs async context
//     }
// } catch (error) {
//     console.error(`[SERVER] Error creating application directories: ${error.message}`);
//     process.exit(1);
// }

// Middleware to attach PData instance to requests (KEEP THIS)
app.use((req, res, next) => {
    req.pdata = pdataInstance;
    next();
});


// ==============================================
// === REMOVE THE RESTORED MIDDLEWARE BLOCK BEFORE API ===
// ==============================================
// Remove the block around line 214-226 where we temporarily restored them
// ==============================================


// Authentication middleware (ensure this runs AFTER session and PData attachment)
// Apply auth middleware selectively or globally as needed
// app.use('/api', authMiddleware); // Example: protect all /api routes


// --- Routes ---
// Import routers ONCE
// import filesRouter from './routes/files.js'; // <<< REMOVE THIS ONE
import authRouter from './routes/auth.js'; // Import auth routes
console.log('[DEBUG server.js] Imported spacesRouter:', typeof spacesRouter, spacesRouter); // <<< ADD THIS LOG

// Use routers
app.use('/api/files', authMiddleware, filesRouter);
app.use('/api/auth', authRouter);

// <<< --- ADD THIS DEBUG MIDDLEWARE --- >>>
app.use('/api/spaces', (req, res, next) => {
    console.log(`[DEBUG] Request reached /api/spaces prefix. Path: ${req.path}, Method: ${req.method}`);
    // You could add more checks here if needed, e.g., console.log(req.user);
    next(); // Pass control to the next middleware in the chain
});
// <<< --- END DEBUG MIDDLEWARE --- >>>

// Mount the spaces router, protected by authentication
app.use('/api/spaces', authMiddleware, spacesRouter);

// --- Async Function to Load Routes and Start Server ---
async function startServer() {

    // --- Ensure application directories exist (Moved inside async function) ---
    try {
        if (!fsSync.existsSync(appImagesDir)) {
            console.log(`[SERVER] Creating images directory: ${appImagesDir}`);
            await fs.mkdir(appImagesDir, { recursive: true });
        }
    } catch (error) {
        console.error(`[SERVER] Error creating application directories: ${error.message}`);
        process.exit(1);
    }
    // --- End Directory Check ---


    // Routes are now imported at the top level

    // Dynamically import remaining ES Module routes (if any were missed)
    // Make sure extensions are included if needed by module resolution rules
    const mediaProxyModule = await import('./routes/mediaProxy.js');
    const mediaProxyRoutes = mediaProxyModule.default;
    const mediaUploadModule = await import('./routes/mediaUpload.js');
    const mediaUploadRoutes = mediaUploadModule.default;

    // --- START: Add *unprotected* route for public preview CSS ---
    app.get('/public/css', async (req, res) => {
        const logPrefix = '[SERVER /public/css]';
        const requestedFile = req.query.path;

        console.log(`${logPrefix} ROUTE HANDLER ENTERED for path: ${requestedFile}`);

        // --- Security Check 1: Allow only specific files ---
        // ONLY allow 'styles.css' (or a predefined list) through this route.
        // Prevents requesting arbitrary files like '../users.csv' etc.
        if (requestedFile !== 'styles.css') {
            console.warn(`${logPrefix} Denied request for non-allowed file: ${requestedFile}`);
            return res.status(403).send('Forbidden: Invalid file requested.');
        }

        // --- Security Check 2: Basic Authentication Check (Optional but Recommended) ---
        // Decide if *any* visitor or only logged-in users can get this CSS.
        // If only logged-in users:
        // if (!req.isAuthenticated || !req.isAuthenticated()) {
        //     console.warn(`${logPrefix} Denied request for '${requestedFile}' - User not authenticated.`);
        //     return res.status(401).send('Unauthorized');
        // }
        // console.log(`${logPrefix} User authenticated, proceeding to serve '${requestedFile}'.`);


        // --- Construct Correct Path ---
        // This CSS lives in the 'data' subdirectory of the main PData root.
        if (!req.pdata || !req.pdata.dataRoot) {
             console.error(`${logPrefix} CRITICAL: PData instance or dataRoot not available on request object.`);
             return res.status(500).send('Internal Server Error: Configuration Error.');
        }
        // Construct path: PD_DIR/data/styles.css
        const absoluteFilePath = path.join(req.pdata.dataRoot, 'data', requestedFile);

        console.log(`${logPrefix} Attempting to serve file from resolved path: ${absoluteFilePath}`);

        // --- Serve the File ---
        try {
            // Check if file exists before sending
            await fs.access(absoluteFilePath, fs.constants.R_OK); // Check read access
            console.log(`${logPrefix} File found and readable: ${absoluteFilePath}`);

            // Send the file, letting Express handle Content-Type based on extension
            res.sendFile(absoluteFilePath, (err) => {
                if (err) {
                    console.error(`${logPrefix} Error sending file '${absoluteFilePath}':`, err);
                    // Avoid sending detailed errors to client unless needed
                    if (!res.headersSent) {
                         res.status(500).send('Error serving file');
                    }
                } else {
                     console.log(`${logPrefix} Successfully sent file: ${absoluteFilePath}`);
                }
            });

        } catch (error) {
            // Handle errors like file not found or permission issues
            if (error.code === 'ENOENT') {
                console.error(`${logPrefix} File not found at: ${absoluteFilePath}`);
                res.status(404).send('Not Found: CSS file missing.');
            } else if (error.code === 'EACCES') {
                 console.error(`${logPrefix} Permission denied reading file: ${absoluteFilePath}`);
                 res.status(403).send('Forbidden: Cannot access file.');
            } else {
                console.error(`${logPrefix} Unexpected error accessing file '${absoluteFilePath}':`, error);
                res.status(500).send('Internal Server Error');
            }
        }
    });
    // --- END: Add *unprotected* route for public preview CSS ---

    // --- Protected API Routes (Example) ---
    // These should come AFTER specific public routes if paths could potentially overlap
    app.use('/api/auth', authRoutes);
    app.use('/api/files', authMiddleware, filesRouter);
    app.use('/api/publish', authMiddleware, publishRouter); // <--- ADD THIS LINE
    app.use('/api/community', express.json(), authMiddleware, communityRoutes);
    // Legacy markdown route redirect - remove import if markdownRoutes isn't used elsewhere
    app.use('/api/markdown', authMiddleware, (req, res, next) => {
      console.log('[SERVER] Redirecting legacy markdown route to files API');
      const newUrl = req.url.replace('/api/markdown', '/api/files');
      console.log(`[SERVER] Redirecting ${req.method} ${req.url} to ${newUrl}`);
      req.originalUrl = req.originalUrl.replace('/api/markdown', '/api/files');
      req.url = newUrl;
      next('route');
    });
    // Use the imported router directly
    app.use('/api/images', express.json(), authMiddleware, imageRouter);
    app.use('/api/save', express.text({ type: 'text/plain' }), express.json(), saveRoutes);
    app.use('/api/cli', express.json(), authMiddleware, cliRoutes);
    app.use('/api/media', mediaUploadRoutes);
    app.use('/api/media-proxy', mediaProxyRoutes);

    // --- Mount the Preview Router ---
    app.use('/api/preview', previewRoutes); // <--- ADD THIS LINE

    // --- Mount the new PData Router ---
    // Apply authMiddleware here so all routes in pdataRouter require login
    const pdataRouter = createPDataRoutes(pdataInstance);
    app.use('/api/pdata', pdataRouter);

    // --- Other Specific Endpoints (like /image-delete) ---
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
        const baseDir = pdataInstance.dataRoot;
        const safeName = path.normalize(name).replace(/^(\.\.(\/|\\|$))+/, '');
        const safeDir = dir ? path.normalize(dir).replace(/^(\.\.(\/|\\|$))+/, '') : '';
         if (safeName.includes('..') || safeDir.includes('..')) {
             return res.status(400).json({ error: 'Invalid path components detected.' });
        }
        const filePath = path.resolve(baseDir, safeDir, safeName);
        console.log(`[SERVER /api/files/get] Reading file: ${filePath}`);

        const currentUser = req.user?.username || '__public__';
        if (!req.pdata.can(currentUser, 'read', filePath)) {
             console.log(`[SERVER /api/files/get] PData denied read access for ${currentUser} to ${filePath}`);
             return res.status(403).json({ error: 'Permission denied.' });
         }
         console.log(`[SERVER /api/files/get] PData allowed read access for ${currentUser} to ${filePath}`);

        try { await fs.access(filePath); } catch (err) { return res.status(404).json({ error: 'File not found' }); }

        const content = await fs.readFile(filePath, 'utf8');
        res.json({ name: safeName, dir: safeDir, content, success: true });
      } catch (error) {
        console.error('[SERVER /api/files/get] Error reading file:', error);
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/files/content/:dir/:file', async (req, res) => {
      try {
        const dir = req.params.dir;
        const filename = req.params.file;
        console.log(`[SERVER /api/files/content] Content request for ${dir}/${filename}`);

        // Use env.MD_DIR from imported config
        const baseDir = pdataInstance.dataRoot;
        const safeDir = path.normalize(dir).replace(/^(\.\.(\/|\\|$))+/, '');
        const safeFilename = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
        if (safeDir.includes('..') || safeFilename.includes('..')) {
             return res.status(400).json({ error: 'Invalid path components detected.' });
        }
        const filePath = path.resolve(baseDir, safeDir, safeFilename);
        console.log(`[SERVER /api/files/content] Reading file: ${filePath}`);

        const currentUser = req.user?.username || '__public__';
        if (!req.pdata.can(currentUser, 'read', filePath)) {
            console.log(`[SERVER /api/files/content] PData denied read access for ${currentUser} to ${filePath}`);
            return res.status(403).json({ error: 'Permission denied.' });
        }
        console.log(`[SERVER /api/files/content] PData allowed read access for ${currentUser} to ${filePath}`);

        try { await fs.access(filePath); } catch (err) { return res.status(404).json({ error: 'File not found' }); }

        const content = await fs.readFile(filePath, 'utf8');
        const ext = path.extname(filename).toLowerCase();
        res.setHeader('Content-Type', ext === '.md' ? 'text/markdown' : 'text/plain');
        res.send(content);
      } catch (error) {
        console.error('[SERVER /api/files/content] Error reading file:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Emergency MD file serving middleware
    app.use(async (req, res, next) => {
      if (req.method !== 'GET' || req.url.includes('/api/') || req.url.includes('/client/') || req.url.includes('/images/') || req.url.includes('/uploads/')) {
        return next();
      }
      const match = req.url.match(/^\/([^/]+)\/([^/]+\.md)$/);
      if (match) {
        const [, dir, file] = match;
        console.log(`[EMERGENCY SERVER] Detected potential file request: ${dir}/${file}`);
        try {
          const baseDir = pdataInstance.dataRoot;
          const safeDir = path.normalize(dir).replace(/^(\.\.(\/|\\|$))+/, '');
          const safeFile = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, '');
          if (safeDir.includes('..') || safeFile.includes('..')) {
                console.warn(`[EMERGENCY SERVER] Denying potentially malicious path: ${req.url}`);
                return next();
           }
          const filePath = path.resolve(baseDir, safeDir, safeFile);
          console.log(`[EMERGENCY SERVER] Checking file: ${filePath}`);

          const currentUser = req.user?.username || '__public__';
          if (!req.pdata.can(currentUser, 'read', filePath)) {
               console.log(`[EMERGENCY SERVER] PData denied read access for ${currentUser} to ${filePath}`);
               return next();
          }
           console.log(`[EMERGENCY SERVER] PData allowed read access for ${currentUser} to ${filePath}`);

          try { await fs.access(filePath); } catch (err) { return next(); }
          console.log(`[EMERGENCY SERVER] Serving file: ${filePath}`);
          const content = await fs.readFile(filePath, 'utf8');
          res.setHeader('Content-Type', 'text/markdown');
          return res.send(content);
        } catch (error) { console.error('[EMERGENCY SERVER] Error:', error); return next(); }
      }
      next();
    });

    // --- API 404 Handler (Specific to /api) ---
    // Place this *after* all your other /api routes
    app.use('/api/*', (req, res) => {
        console.log(`[API 404 Not Found]: ${req.method} ${req.originalUrl}`);
        res.status(404).json({ error: 'API endpoint not found' });
    });

    // --- General 404 Handler (Catch-all) ---
    // >>>>>>>> THIS MUST BE REGISTERED *LAST* or very close to last <<<<<<<<<<<
    app.use((req, res, next) => {
      // --- DEBUG: Log clearly when 404 handler catches a client path ---
      if (req.originalUrl.startsWith('/client/')) {
          console.error(`[DEBUG 404 HANDLER] Caught request for MISSING client file: ${req.originalUrl}`);
          return res.status(404).send(`Static file not found: ${req.originalUrl}`);
      }
      console.log(`[GENERAL 404] ${req.method} ${req.originalUrl}`);
      if (req.originalUrl.startsWith('/preview/')) {
        console.log('[SERVER] Attempting to serve preview page as fallback for unmatched preview URL');
        // Use derived __dirname
        res.sendFile(path.resolve(currentDir, 'preview/viewer.html'));
      } else {
        res.status(404).send('Resource not found');
      }
    });

    // --- Log Registered Routes (Keep this near the end before listen) ---
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
        console.log(`PData DB Root: ${pdataInstance.dbRoot}`);
        console.log(`PData Data Root: ${pdataInstance.dataRoot}`);
        console.log(`PData Uploads Dir: ${pdataInstance.uploadsDir}`);
        console.log('='.repeat(50));
    });
}

// --- Call the async function to start the server ---
startServer().catch(err => {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
});

