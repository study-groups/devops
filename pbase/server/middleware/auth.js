/**
 * Auth Middleware - Basic Auth and JWT Bearer token validation
 * Works with PData for user validation
 */

import jwt from 'jsonwebtoken';
import { getPermissions } from '../lib/permissions.js';
import { JWT_SECRET } from '../lib/config.js';

/**
 * Parse Basic Auth header
 * @param {string} authHeader - Authorization header value
 * @returns {object|null} { username, password } or null
 */
export function parseBasicAuth(authHeader) {
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return null;
    }

    try {
        const base64 = authHeader.slice(6);
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        const [username, ...passwordParts] = decoded.split(':');
        const password = passwordParts.join(':'); // Handle passwords with colons

        if (!username || !password) {
            return null;
        }

        return { username, password };
    } catch (err) {
        return null;
    }
}

/**
 * Create auth middleware that validates credentials
 * @param {PData} pdata - PData instance
 * @param {object} options - Options
 * @param {boolean} options.required - If true, reject unauthenticated requests
 * @param {string} options.permission - Required permission (can_view, can_upload, etc.)
 */
export function createAuthMiddleware(pdata, options = {}) {
    const { required = false, permission = null } = options;

    return (req, res, next) => {
        const authHeader = req.headers.authorization;

        // Try JWT Bearer token first
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.slice(7);
                const decoded = jwt.verify(token, JWT_SECRET);
                const role = pdata.getUserRole(decoded.username) || decoded.role || 'user';
                req.user = {
                    username: decoded.username,
                    role,
                    permissions: getPermissions(role),
                };

                if (permission && !req.user.permissions[permission]) {
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: `Permission '${permission}' required`,
                    });
                }

                return next();
            } catch (err) {
                // Invalid token, continue to try Basic Auth
            }
        }

        // Try Basic Auth
        const credentials = parseBasicAuth(authHeader);
        if (credentials) {
            const valid = pdata.validateUser(credentials.username, credentials.password);
            if (valid) {
                const role = pdata.getUserRole(credentials.username) || 'user';
                req.user = {
                    username: credentials.username,
                    role,
                    permissions: getPermissions(role),
                };

                if (permission && !req.user.permissions[permission]) {
                    return res.status(403).json({
                        error: 'Forbidden',
                        message: `Permission '${permission}' required`,
                    });
                }

                return next();
            }
        }

        // No valid auth
        if (required) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Valid credentials required',
            });
        }

        // Allow anonymous access
        req.user = {
            username: 'anonymous',
            role: 'guest',
            permissions: getPermissions('guest'),
        };
        next();
    };
}

/**
 * Require authentication
 */
export function requireAuth(pdata) {
    return createAuthMiddleware(pdata, { required: true });
}

/**
 * Require specific permission
 */
export function requirePermission(pdata, permission) {
    return createAuthMiddleware(pdata, { required: true, permission });
}

/**
 * Optional auth (populate req.user if credentials provided)
 */
export function optionalAuth(pdata) {
    return createAuthMiddleware(pdata, { required: false });
}
