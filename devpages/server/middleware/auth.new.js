/**
 * New Authentication Middleware - Clean PData Integration
 * 
 * This replaces the old auth.js with a clean implementation that:
 * 1. Uses PData's built-in token system exclusively
 * 2. Eliminates the custom in-memory token store
 * 3. Provides unified authentication for both session and token-based access
 */

/**
 * Authentication middleware that supports both PData tokens and Passport sessions
 */
export const authMiddleware = (req, res, next) => {
    console.log('[AUTH MIDDLEWARE] Checking authentication status...');
    
    // Check for PData token first (Bearer token in Authorization header)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log(`[AUTH MIDDLEWARE] Found Bearer token: ${token.substring(0, 8)}...`);
        
        try {
            // Validate token using PData's AuthSrv
            const tokenData = req.pdata.validateToken(token);
            if (tokenData) {
                console.log(`[AUTH MIDDLEWARE] Valid PData token found for user: ${tokenData.username}. Allowing access.`);
                // Attach user data to request (similar to Passport)
                req.user = { 
                    username: tokenData.username,
                    roles: tokenData.roles,
                    capabilities: tokenData.caps,
                    mounts: tokenData.mounts
                };
                req.authMethod = 'pdata-token';
                req.pdataToken = tokenData; // Full token data for advanced operations
                return next();
            } else {
                console.log('[AUTH MIDDLEWARE] Invalid or expired PData token provided.');
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        } catch (error) {
            console.log(`[AUTH MIDDLEWARE] Error validating PData token: ${error.message}`);
            return res.status(401).json({ error: 'Token validation failed' });
        }
    }
    
    // Fall back to Passport session authentication
    console.log('[AUTH MIDDLEWARE] No Bearer token found, checking Passport session...');
    const cookieName = 'devpages.sid';
    const clientSessionId = req.cookies ? req.cookies[cookieName] : 'N/A';
    console.log(`[AUTH MIDDLEWARE] Cookie received: ${cookieName}=${clientSessionId}`);

    if (req.isAuthenticated()) {
        console.log(`[AUTH MIDDLEWARE] Valid session found via req.isAuthenticated() for user: ${req.user?.username || 'UNKNOWN'}. Allowing access.`);
        req.authMethod = 'session';
        
        // Ensure session object exists and has a default org
        if (!req.session) {
            req.session = {};
        }
        if (!req.session.org) {
            req.session.org = req.user?.username || 'default'; // Default to username or 'default'
        }
        
        next();
    } else {
        console.log('[AUTH MIDDLEWARE] No valid session found via req.isAuthenticated(). Denying access.');

        if (req.originalUrl.startsWith('/api/')) {
            res.status(401).json({ error: 'Unauthorized - Please provide valid session or Bearer token' });
        } else {
            res.sendStatus(401);
        }
    }
};

/**
 * Generate a PData token for the authenticated user
 * @param {object} req - Express request object (must have authenticated user)
 * @param {number} expiryHours - Token expiry in hours (default: 24)
 * @param {string} description - Token description
 * @returns {object} Token data {token, expiresAt, username}
 */
export function generatePDataToken(req, expiryHours = 24, description = 'API Access Token') {
    if (!req.user || !req.user.username) {
        throw new Error('User must be authenticated to generate token');
    }
    
    if (!req.pdata) {
        throw new Error('PData instance not available');
    }
    
    const username = req.user.username;
    const ttlSeconds = expiryHours * 60 * 60;
    
    try {
        // Create PData token with user's credentials
        const token = req.pdata.createToken(username, 'dummy-password-not-used-for-token-creation');
        
        if (!token) {
            throw new Error('Failed to create PData token - user validation failed');
        }
        
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        
        console.log(`[PDATA TOKEN] Generated token for user: ${username}, expires: ${new Date(expiresAt).toISOString()}`);
        
        return {
            token,
            expiresAt,
            username,
            expiresIn: ttlSeconds,
            description
        };
    } catch (error) {
        console.error(`[PDATA TOKEN] Failed to generate token for user ${username}:`, error);
        throw new Error(`Token generation failed: ${error.message}`);
    }
}

/**
 * Validate a PData token
 * @param {string} token - The token to validate
 * @param {object} pdataInstance - PData instance
 * @returns {object|null} Token data if valid, null if invalid
 */
export function validatePDataToken(token, pdataInstance) {
    if (!token || typeof token !== 'string') {
        return null;
    }
    
    try {
        const tokenData = pdataInstance.validateToken(token);
        return tokenData;
    } catch (error) {
        console.log(`[PDATA TOKEN] Token validation failed: ${error.message}`);
        return null;
    }
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check admin role via PData
    const userRole = req.pdata?.getUserRole(req.user.username);
    if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    
    next();
};

/**
 * Middleware to require specific capability
 */
export const requireCapability = (operation, resource) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // If we have a PData token, check capabilities directly
        if (req.pdataToken && req.pdata.authSrv) {
            const hasCapability = req.pdata.authSrv.tokenHasCap(req.pdataToken, operation, resource);
            if (!hasCapability) {
                return res.status(403).json({ 
                    error: `Insufficient permissions: ${operation} access to ${resource} denied` 
                });
            }
            return next();
        }
        
        // For session-based auth, we'll need to check via PData's user system
        // This is a simplified check - in production you might want more sophisticated capability checking
        const userRole = req.pdata?.getUserRole(req.user.username);
        if (!userRole) {
            return res.status(403).json({ error: 'Unable to determine user permissions' });
        }
        
        // Admin users have all capabilities
        if (userRole === 'admin') {
            return next();
        }
        
        // For non-admin users, you might want to implement more granular capability checking
        // For now, we'll allow basic operations for authenticated users
        if (['read', 'list'].includes(operation)) {
            return next();
        }
        
        return res.status(403).json({ 
            error: `Insufficient permissions: ${operation} access requires elevated privileges` 
        });
    };
};

console.log('[AUTH MIDDLEWARE] New PData-integrated auth middleware loaded');
