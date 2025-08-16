import crypto from 'crypto';

// In-memory token store (in production, use Redis or database)
const tokenStore = new Map();

// Token configuration
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

// Cleanup expired tokens periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of tokenStore.entries()) {
        if (data.expiresAt < now) {
            tokenStore.delete(token);
            console.log(`[TOKEN CLEANUP] Removed expired token for user: ${data.username}`);
        }
    }
}, TOKEN_CLEANUP_INTERVAL);

/**
 * Generate a temporary API token for a user
 * @param {string} username - The username to generate token for
 * @param {number} expiryMs - Token expiry in milliseconds (optional)
 * @returns {object} Token data {token, expiresAt, username}
 */
export function generateApiToken(username, expiryMs = TOKEN_EXPIRY_MS) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + expiryMs;
    
    const tokenData = {
        username,
        expiresAt,
        createdAt: Date.now()
    };
    
    tokenStore.set(token, tokenData);
    
    console.log(`[TOKEN GENERATOR] Created token for user: ${username}, expires: ${new Date(expiresAt).toISOString()}`);
    
    return {
        token,
        expiresAt,
        username,
        expiresIn: Math.floor(expiryMs / 1000) // seconds
    };
}

/**
 * Validate an API token
 * @param {string} token - The token to validate
 * @returns {object|null} User data if valid, null if invalid
 */
export function validateApiToken(token) {
    if (!token || typeof token !== 'string') {
        return null;
    }
    
    const tokenData = tokenStore.get(token);
    if (!tokenData) {
        return null;
    }
    
    // Check if token is expired
    if (tokenData.expiresAt < Date.now()) {
        tokenStore.delete(token);
        console.log(`[TOKEN VALIDATOR] Removed expired token for user: ${tokenData.username}`);
        return null;
    }
    
    return {
        username: tokenData.username,
        expiresAt: tokenData.expiresAt
    };
}

/**
 * Revoke an API token
 * @param {string} token - The token to revoke
 * @returns {boolean} True if token was revoked, false if not found
 */
export function revokeApiToken(token) {
    const existed = tokenStore.has(token);
    if (existed) {
        const tokenData = tokenStore.get(token);
        tokenStore.delete(token);
        console.log(`[TOKEN REVOKER] Revoked token for user: ${tokenData.username}`);
    }
    return existed;
}

/**
 * Get all active tokens for a user (for management purposes)
 * @param {string} username - The username to get tokens for
 * @returns {Array} Array of token info (without actual token values)
 */
export function getUserTokens(username) {
    const userTokens = [];
    for (const [token, data] of tokenStore.entries()) {
        if (data.username === username && data.expiresAt > Date.now()) {
            userTokens.push({
                createdAt: data.createdAt,
                expiresAt: data.expiresAt,
                tokenPreview: token.substring(0, 8) + '...' // Show first 8 chars for identification
            });
        }
    }
    return userTokens;
}

export const authMiddleware = (req, res, next) => {
    console.log('[AUTH MIDDLEWARE] Checking authentication status...');
    
    // Check for API token first (Bearer token in Authorization header)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log(`[AUTH MIDDLEWARE] Found Bearer token: ${token.substring(0, 8)}...`);
        
        const tokenData = validateApiToken(token);
        if (tokenData) {
            console.log(`[AUTH MIDDLEWARE] Valid token found for user: ${tokenData.username}. Allowing access.`);
            // Attach user data to request (similar to Passport)
            req.user = { username: tokenData.username };
            req.authMethod = 'token';
            return next();
        } else {
            console.log('[AUTH MIDDLEWARE] Invalid or expired token provided.');
            return res.status(401).json({ error: 'Invalid or expired token' });
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