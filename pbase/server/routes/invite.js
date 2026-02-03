/**
 * Invite Routes - Token-based shareable invite links
 *
 * Public:
 *   GET  /invite/:token        - Landing page
 *   POST /invite/:token/accept - Consume token, set cookie, redirect
 *
 * Admin (requireAuth + can_admin):
 *   GET    /api/invites         - List all tokens
 *   POST   /api/invites         - Create invite
 *   POST   /api/invites/:id/send - Send invite email via Resend
 *   DELETE /api/invites/:id     - Revoke token
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRY } from '../lib/config.js';
import { getPermissions } from '../lib/permissions.js';

/**
 * Parse a cookie header value into an object
 */
function parseCookies(header) {
    const cookies = {};
    if (!header) return cookies;
    header.split(';').forEach(pair => {
        const [name, ...rest] = pair.trim().split('=');
        if (name) cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
    });
    return cookies;
}

export function createInviteRoutes(inviteStore, pdata, magicLink, baseUrl) {
    const router = Router();

    // --- Public routes ---

    /**
     * GET /invite/:token - Landing page
     */
    router.get('/invite/:token', (req, res) => {
        const token = inviteStore.verify(req.params.token);

        if (!token) {
            return res.status(410).send(landingPage({
                valid: false,
            }));
        }

        res.send(landingPage({
            valid: true,
            email: token.email,
            role: token.role,
            tokenId: req.params.token,
        }));
    });

    /**
     * POST /invite/:token/accept - Consume token, set JWT cookie, redirect
     */
    router.post('/invite/:token/accept', (req, res) => {
        const tokenId = req.params.token;
        const token = inviteStore.verify(tokenId);

        if (!token) {
            return res.status(410).send(landingPage({ valid: false }));
        }

        // Mark token as used
        inviteStore.markUsed(tokenId);

        // Create user identity from invite
        const username = token.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const user = {
            username,
            email: token.email,
            role: token.role,
        };

        // Create JWT session
        const sessionToken = jwt.sign(
            { username: user.username, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        // Set cookie and redirect
        const isProduction = process.env.PBASE_ENV === 'production' || process.env.PBASE_ENV === 'dev';
        res.cookie('pbase_session', sessionToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/',
        });

        res.redirect('/');
    });

    // --- Admin API routes ---

    const adminAuth = (req, res, next) => {
        // Check Bearer token
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
                const role = pdata.getUserRole(decoded.username) || decoded.role || 'user';
                const perms = getPermissions(role);
                if (perms.can_admin) {
                    req.user = { username: decoded.username, role, permissions: perms };
                    return next();
                }
            } catch { /* fall through */ }
        }

        // Check Basic Auth
        if (authHeader && authHeader.startsWith('Basic ')) {
            try {
                const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
                const [username, ...rest] = decoded.split(':');
                const password = rest.join(':');
                if (pdata.validateUser(username, password)) {
                    const role = pdata.getUserRole(username) || 'user';
                    const perms = getPermissions(role);
                    if (perms.can_admin) {
                        req.user = { username, role, permissions: perms };
                        return next();
                    }
                }
            } catch { /* fall through */ }
        }

        // Check cookie
        const cookies = parseCookies(req.headers.cookie);
        if (cookies.pbase_session) {
            try {
                const decoded = jwt.verify(cookies.pbase_session, JWT_SECRET);
                const role = pdata.getUserRole(decoded.username) || decoded.role || 'user';
                const perms = getPermissions(role);
                if (perms.can_admin) {
                    req.user = { username: decoded.username, role, permissions: perms };
                    return next();
                }
            } catch { /* fall through */ }
        }

        return res.status(401).json({ error: 'Unauthorized', message: 'Admin credentials required' });
    };

    /**
     * GET /api/invites - List all tokens
     */
    router.get('/api/invites', adminAuth, (req, res) => {
        res.json({ invites: inviteStore.list() });
    });

    /**
     * POST /api/invites - Create invite
     * Body: { email, role?, ttl? }
     */
    router.post('/api/invites', adminAuth, (req, res) => {
        const { email, role, ttl } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }

        const opts = { email, createdBy: req.user.username };
        if (role) opts.role = role;
        if (ttl) opts.ttl = ttl;

        const result = inviteStore.create(opts, baseUrl);
        res.json(result);
    });

    /**
     * POST /api/invites/:id/send - Send invite email via Resend
     */
    router.post('/api/invites/:id/send', adminAuth, async (req, res) => {
        const token = inviteStore.verify(req.params.id);
        if (!token) {
            return res.status(404).json({ error: 'Token not found or no longer valid' });
        }

        const inviteUrl = `${baseUrl}/invite/${req.params.id}`;

        if (magicLink && magicLink.resend) {
            try {
                await magicLink.resend.emails.send({
                    from: magicLink.fromEmail,
                    to: token.email,
                    subject: 'You\'re invited to PBase',
                    html: `
                        <h2>You've been invited to PBase</h2>
                        <p>Click below to accept your invite and get started.</p>
                        <p><a href="${inviteUrl}" style="background:#e94560;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Accept Invite</a></p>
                        <p style="color:#666;font-size:12px;">Or copy this link: ${inviteUrl}</p>
                    `,
                });
                console.log(`[Invite] Sent invite email to ${token.email}`);
                return res.json({ success: true, message: `Invite sent to ${token.email}` });
            } catch (err) {
                console.error('[Invite] Email send failed:', err);
                return res.status(500).json({ error: 'Failed to send email', message: err.message });
            }
        }

        // Dev mode - no email service
        console.log(`[Invite] DEV MODE - Invite URL for ${token.email}: ${inviteUrl}`);
        res.json({ success: true, dev_mode: true, url: inviteUrl });
    });

    /**
     * DELETE /api/invites/:id - Revoke token
     */
    router.delete('/api/invites/:id', adminAuth, (req, res) => {
        const revoked = inviteStore.revoke(req.params.id);
        if (!revoked) {
            return res.status(404).json({ error: 'Token not found' });
        }
        res.json({ success: true, message: 'Token revoked' });
    });

    return router;
}

/**
 * Generate the invite landing page HTML
 */
function landingPage({ valid, email, role, tokenId }) {
    if (!valid) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PBase - Invite</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a1a; color: #e0e0e0; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #1a1a2e; border: 1px solid #333; border-radius: 12px; padding: 40px; max-width: 400px; text-align: center; }
        h1 { color: #e94560; margin-bottom: 16px; }
        p { color: #999; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Link Expired</h1>
        <p>This invite link is no longer valid. It may have been used, revoked, or expired.</p>
        <p>Contact your administrator for a new invite.</p>
    </div>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PBase - You're Invited</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a1a; color: #e0e0e0; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #1a1a2e; border: 1px solid #333; border-radius: 12px; padding: 40px; max-width: 400px; text-align: center; }
        h1 { color: #e94560; margin-bottom: 16px; }
        p { color: #999; line-height: 1.6; }
        .email { color: #e0e0e0; font-weight: 600; }
        .role { color: #e94560; text-transform: capitalize; }
        button { background: #e94560; color: white; border: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; cursor: pointer; margin-top: 20px; }
        button:hover { background: #d63851; }
        form { display: inline; }
    </style>
</head>
<body>
    <div class="card">
        <h1>You're Invited to PBase</h1>
        <p>Welcome, <span class="email">${email}</span></p>
        <p>Role: <span class="role">${role}</span></p>
        <form method="POST" action="/invite/${tokenId}/accept">
            <button type="submit">Continue to PBase</button>
        </form>
    </div>
</body>
</html>`;
}
