import express from 'express';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
import { fileURLToPath } from 'url';

// Assuming PData and createPDataRoutes are exported from your main files
import { PData } from '../PData.js'; // Adjust path
import { createPDataRoutes } from '../routes.js'; // Adjust path

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let LocalStrategyType; // Will hold the Strategy constructor

// Dynamically import passport-local's Strategy constructor once
beforeAll(async () => {
  try {
    LocalStrategyType = (await import('passport-local')).Strategy;
    if (!LocalStrategyType) {
      throw new Error('passport-local Strategy not loaded correctly.');
    }
  } catch (err) {
    console.error('Failed to load passport-local Strategy:', err);
    throw err; // Re-throw to fail tests if critical
  }
});

export async function createTestApp() {
    const app = express();

    // Set PD_DIR for the PData instance *before* PData is instantiated
    // This tells PData where to find users.csv, roles.csv, and store data/uploads
    // Ensure 'pdata_test_root' exists in 'pdata/tests/' and is populated for tests
    process.env.PD_DIR = path.resolve(__dirname, 'pdata_test_root'); 
    console.log(`[Test Server] Using PD_DIR: ${process.env.PD_DIR}`);

    let pdataInstance;
    try {
        pdataInstance = new PData();
    } catch (error) {
        console.error('[Test Server] CRITICAL: PData failed to initialize.', error);
        throw new Error(`PData failed to initialize: ${error.message}`);
    }

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    app.use(session({
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: false, // True might be useful if tests rely on unauth sessions
        cookie: { httpOnly: true } // secure: true should be for production with HTTPS
    }));

    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Configure Passport Strategy *inside* createTestApp to access pdataInstance
    if (!LocalStrategyType) {
        throw new Error('LocalStrategy constructor not available. Check beforeAll hook.');
    }
    passport.use('local-test', new LocalStrategyType(
      (username, password, done) => {
        console.log(`[Test Strategy] Authenticating user: ${username}`);
        
        try {
            // Use PData's validateUser method for proper password checking
            const passwordValid = pdataInstance.validateUser(username, password);
            console.log(`[Test Strategy] Using PData.validateUser, result: ${passwordValid}`);
            
            if (passwordValid) {
              const userRole = pdataInstance.getUserRole ? pdataInstance.getUserRole(username) : 'user';
              const userForSession = { id: username, username, role: userRole };
              return done(null, userForSession);
            } else {
              return done(null, false, { message: 'Incorrect password' });
            }
        } catch (error) {
            console.error(`[Test Strategy] Error in authentication:`, error);
            return done(error);
        }
      }
    ));

    passport.serializeUser((user, done) => {
        console.log('[Test SerializeUser] Serializing:', user);
        if (!user || !user.id) {
            console.error('[Test SerializeUser] Error: User object or user.id is missing.');
            return done(new Error('User object or user.id is missing for serialization.'));
        }
        done(null, user.id); // Store user.id in session
    });

    passport.deserializeUser((id, done) => {
        console.log(`[Test DeserializeUser] Deserializing user by ID: ${id}`);
        const username = id; // Assuming id is the username for test purposes
        
        // Don't rely on pdataInstance.users structure which might change
        // Instead, create a valid user object directly from the username
        // This matches what we put in the session during login
        const userRole = pdataInstance.getUserRole ? pdataInstance.getUserRole(username) : 'user';
        const user = { id: username, username: username, role: userRole };
        
        console.log('[Test DeserializeUser] Created user:', user);
        done(null, user);
    });

    // Mount PData routes
    if (typeof createPDataRoutes !== 'function') {
        console.error("[Test Server] createPDataRoutes is not a function. Check import from '../routes.js'");
        throw new Error("createPDataRoutes not imported correctly.");
    }
    app.use('/api/pdata', createPDataRoutes(pdataInstance));

    // Test login route for tests to acquire a session cookie
    app.post('/test-login',
        (req, res, next) => {
            console.log('[Test Server] POST /test-login attempt. Body:', req.body);
            next();
        },
        passport.authenticate('local-test', {
            // failureRedirect: '/login-failed', // Optional: for debugging
            // successRedirect: '/login-success' // Optional: for debugging
        }), // This middleware calls the strategy
        (req, res) => { // This handler is called only on successful authentication
            console.log('[Test Server] Login successful. User:', req.user);
            res.status(200).json({ message: 'Login successful', user: req.user });
        },
        // Add an error handler specifically for the auth route for better debugging
        (err, req, res, next) => {
            console.error('[Test Server /test-login] Authentication error:', err);
            res.status(401).json({ message: 'Authentication failed at route level', error: err.message });
        }
    );

    app.get('/test-logout', (req, res, next) => {
        console.log('[Test Server] GET /test-logout');
        req.logout(function(err) {
            if (err) {
                console.error('[Test Server] Logout error:', err);
                return next(err);
            }
            req.session.destroy((destroyErr) => {
                if (destroyErr) {
                    console.error('[Test Server] Session destruction error during logout:', destroyErr);
                    return res.status(500).json({ message: 'Logout failed during session destruction' });
                }
                console.log('[Test Server] Logout successful, session destroyed.');
                res.status(200).json({ message: 'Logout successful' });
            });
        });
    });

    app.get('/health', (req, res) => {
        console.log('[Test Server] Health check hit');
        res.status(200).send('ok');
    });

    // Socket tracking for graceful shutdown (this part seems good)
    let sockets = new Set();
    const originalListen = app.listen.bind(app);

    app.listen = (...args) => {
        const serverInstance = originalListen(...args);
        console.log('[Test Server] Server is listening. Patching for destroy capability.');
        serverInstance.on('connection', (socket) => {
            sockets.add(socket);
            socket.on('close', () => sockets.delete(socket));
        });
        serverInstance.destroy = (cb) => {
            console.log(`[Test Server] Destroying server. Closing ${sockets.size} sockets.`);
            for (const socket of sockets) {
                socket.destroy();
            }
            sockets.clear(); // Clear the set after destroying
            serverInstance.close((err) => {
                if (err) console.error('[Test Server] Error during server.close():', err);
                else console.log('[Test Server] Server closed gracefully.');
                if (cb) cb(err);
            });
        };
        return serverInstance; // This is the http.Server instance
    };

    return app; // Return the express app
}
