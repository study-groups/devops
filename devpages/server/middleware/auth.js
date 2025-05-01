export const authMiddleware = (req, res, next) => {
    console.log('[AUTH MIDDLEWARE] Checking session...');
    // Log the session ID received from the client (if any)
    const cookieName = 'devpages.sid'; // Use the actual name set in server.js
    const clientSessionId = req.cookies ? req.cookies[cookieName] : 'N/A';
    console.log(`[AUTH MIDDLEWARE] Cookie received: ${cookieName}=${clientSessionId}`);
    // Log the entire session object found by the middleware (if any)
    // Use console.dir for better object inspection
    console.log(`[AUTH MIDDLEWARE] Session object found by middleware:`);
    console.dir(req.session, { depth: null }); // Log the full session object

    // Original check adjusted slightly for clarity/logging
    if (req.session && req.session.user && req.session.user.username) { // Check for username specifically
        req.user = req.session.user; // Attach user info to req object
        console.log(`[AUTH MIDDLEWARE] Valid session found for user: ${req.user.username}. Role: ${req.user.role}`);
        next(); // Proceed to the next middleware or route handler
    } else {
        // Log details about why it failed
        if (!req.session) {
            console.log('[AUTH MIDDLEWARE] No session object attached to request.');
        } else if (!req.session.user) {
            console.log('[AUTH MIDDLEWARE] Session object exists, but req.session.user is missing.');
        } else if (!req.session.user.username){
            console.log('[AUTH MIDDLEWARE] Session and user object exist, but username is missing.');
        } else {
             console.log('[AUTH MIDDLEWARE] Session check failed for unknown reason.'); // Fallback log
        }
        console.log('[AUTH MIDDLEWARE] No valid session found. Denying access.');
        // For API routes, send 401/403.
        if (req.path.startsWith('/api/')) {
             res.status(401).json({ error: 'Unauthorized: No active session.' });
        } else {
             // Handle non-API unauthorized access if needed (e.g., redirect to login)
             res.status(401).send('Unauthorized'); // Or redirect
        }
    }
}; 