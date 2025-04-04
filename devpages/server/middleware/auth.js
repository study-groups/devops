const authMiddleware = (req, res, next) => {
    console.log('[AUTH MIDDLEWARE] Checking session...');
    // Check if session exists and user is marked as loggedIn
    if (req.session && req.session.user && req.session.user.loggedIn) {
        console.log(`[AUTH MIDDLEWARE] Session valid for user: ${req.session.user.username}`);
        // Optionally attach user info to req for downstream handlers
        req.user = req.session.user;
        next(); // User is authenticated, proceed
    } else {
        console.log('[AUTH MIDDLEWARE] No valid session found.');
        res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
};

module.exports = { authMiddleware }; 