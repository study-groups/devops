export const authMiddleware = (req, res, next) => {
    console.log('[AUTH MIDDLEWARE] Checking authentication status using Passport...');
    // Log the session ID received from the client (if any)
    const cookieName = 'devpages.sid'; // Use the actual name set in server.js
    const clientSessionId = req.cookies ? req.cookies[cookieName] : 'N/A';
    console.log(`[AUTH MIDDLEWARE] Cookie received: ${cookieName}=${clientSessionId}`);

    // --- NEW PASSPORT CHECK ---
    // `req.isAuthenticated()` is added by Passport after `passport.session()` middleware runs.
    // It checks if the session is valid and if `deserializeUser` successfully attached `req.user`.
    if (req.isAuthenticated()) {
        // If true, Passport has already validated the session and attached `req.user`.
        console.log(`[AUTH MIDDLEWARE] Valid session found via req.isAuthenticated() for user: ${req.user?.username || 'UNKNOWN'}. Allowing access.`);
        // No need to manually attach req.user, Passport already did it.
        next(); // Proceed to the next middleware or route handler
    } else {
        // If false, the user is not authenticated via a valid Passport session.
        console.log('[AUTH MIDDLEWARE] No valid session found via req.isAuthenticated(). Denying access.');

        // For API routes, send 401.
        // Checking req.originalUrl is often more reliable than req.path for the full URL
        if (req.originalUrl.startsWith('/api/')) {
             res.status(401).json({ error: 'Unauthorized' }); // Send JSON error for APIs
        } else {
             // Handle non-API unauthorized access if needed (e.g., redirect to login page)
             // For now, just send a plain 401 status
             res.sendStatus(401); // Sends 'Unauthorized' text response
        }
    }
    // --- END NEW PASSPORT CHECK ---
}; 