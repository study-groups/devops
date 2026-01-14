/**
 * Auth Routes - Authentication endpoints
 * Supports Basic Auth, JWT sessions, and Magic Link
 */

import { Router } from 'express';
import { parseBasicAuth } from '../middleware/auth.js';
import { getPermissions } from '../lib/permissions.js';

export function createAuthRoutes(pdata, magicLink = null) {
    const router = Router();

    /**
     * POST /api/auth/login
     * Validate credentials and return user info (+ JWT if magic link enabled)
     */
    router.post('/login', (req, res) => {
        // Try body first, then Basic Auth header
        let username, password;

        if (req.body.username && req.body.password) {
            username = req.body.username;
            password = req.body.password;
        } else {
            const credentials = parseBasicAuth(req.headers.authorization);
            if (credentials) {
                username = credentials.username;
                password = credentials.password;
            }
        }

        if (!username || !password) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Username and password required',
            });
        }

        const valid = pdata.validateUser(username, password);

        if (!valid) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid credentials',
            });
        }

        const role = pdata.getUserRole(username) || 'user';
        const user = { username, role, permissions: getPermissions(role) };

        const response = {
            success: true,
            user,
        };

        // Include JWT if magic link is enabled
        if (magicLink) {
            response.token = magicLink.createSession(user);
        }

        res.json(response);
    });

    /**
     * GET /api/auth/user
     * Get current user info (supports Basic Auth or JWT Bearer token)
     */
    router.get('/user', (req, res) => {
        // Try JWT first
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ') && magicLink) {
            const token = authHeader.slice(7);
            const result = magicLink.verifySession(token);

            if (result.valid) {
                const role = pdata.getUserRole(result.user.username) || result.user.role || 'user';
                return res.json({
                    authenticated: true,
                    method: 'jwt',
                    user: {
                        username: result.user.username,
                        email: result.user.email,
                        role,
                        permissions: getPermissions(role),
                    },
                });
            }
        }

        // Try Basic Auth
        const credentials = parseBasicAuth(authHeader);

        if (!credentials) {
            return res.json({
                authenticated: false,
                user: {
                    username: 'anonymous',
                    role: 'guest',
                    permissions: getPermissions('guest'),
                },
            });
        }

        const valid = pdata.validateUser(credentials.username, credentials.password);

        if (!valid) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid credentials',
            });
        }

        const role = pdata.getUserRole(credentials.username) || 'user';
        res.json({
            authenticated: true,
            method: 'basic',
            user: {
                username: credentials.username,
                role,
                permissions: getPermissions(role),
            },
        });
    });

    /**
     * POST /api/auth/magic-link
     * Send a magic link to the provided email
     */
    router.post('/magic-link', async (req, res) => {
        if (!magicLink) {
            return res.status(501).json({
                error: 'Not Implemented',
                message: 'Magic link authentication not configured',
            });
        }

        const { email } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Valid email required',
            });
        }

        try {
            const result = await magicLink.sendMagicLink(email);

            if (result.success) {
                const response = {
                    success: true,
                    message: 'Magic link sent to your email',
                };

                // In dev mode (no email service), return the token/link
                if (result.token) {
                    response.dev_mode = true;
                    response.token = result.token;
                    response.link = result.link;
                }

                res.json(response);
            } else {
                res.status(500).json({
                    error: 'Failed to send email',
                    message: result.error,
                });
            }
        } catch (err) {
            console.error('[Auth] Magic link error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message,
            });
        }
    });

    /**
     * GET /api/auth/verify
     * Verify magic link token and create session
     */
    router.get('/verify', (req, res) => {
        if (!magicLink) {
            return res.status(501).json({
                error: 'Not Implemented',
                message: 'Magic link authentication not configured',
            });
        }

        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Token required',
            });
        }

        const result = magicLink.verifyToken(token);

        if (!result.valid) {
            // Redirect to login page with error
            return res.redirect(`/?error=${encodeURIComponent(result.error)}`);
        }

        // For magic link, create user entry based on email
        // PData doesn't have getOrCreateByEmail, so we use the email as username
        const username = result.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const role = pdata.getUserRole(username) || 'user';
        const user = { username, email: result.email, role, permissions: getPermissions(role) };

        // Create JWT session
        const sessionToken = magicLink.createSession(user);

        // Redirect to dashboard with token
        res.redirect(`/?token=${sessionToken}&welcome=back`);
    });

    /**
     * POST /api/auth/logout
     * Logout (client-side only - just returns success)
     */
    router.post('/logout', (req, res) => {
        res.json({ success: true, message: 'Logged out' });
    });

    return router;
}
