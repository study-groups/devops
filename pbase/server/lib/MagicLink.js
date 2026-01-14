/**
 * MagicLink - Email-based passwordless authentication
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { JWT_SECRET, JWT_EXPIRY } from './config.js';

export class MagicLink {
    constructor(config = {}) {
        this.tokens = new Map(); // token -> { email, expires }
        this.tokenTTL = config.tokenTTL || 10 * 60 * 1000; // 10 minutes
        this.jwtSecret = config.jwtSecret || JWT_SECRET;
        this.jwtExpiry = config.jwtExpiry || JWT_EXPIRY;
        this.baseUrl = config.baseUrl || process.env.PBASE_URL || 'http://localhost:2600';

        // Resend email service
        const resendKey = config.resendKey || process.env.RESEND_API_KEY;
        if (resendKey) {
            this.resend = new Resend(resendKey);
            this.fromEmail = config.fromEmail || process.env.RESEND_FROM || 'PBase <noreply@resend.dev>';
            console.log('[MagicLink] Email service configured');
        } else {
            this.resend = null;
            console.log('[MagicLink] No RESEND_API_KEY - emails will be logged to console');
        }

        // Cleanup expired tokens every minute
        setInterval(() => this._cleanup(), 60 * 1000);
    }

    /**
     * Generate a magic link token for an email
     * @param {string} email
     * @returns {string} token
     */
    generateToken(email) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + this.tokenTTL;

        this.tokens.set(token, { email, expires });

        return token;
    }

    /**
     * Send magic link email
     * @param {string} email
     * @returns {Promise<{success: boolean, token?: string, error?: string}>}
     */
    async sendMagicLink(email) {
        const token = this.generateToken(email);
        const link = `${this.baseUrl}/api/auth/verify?token=${token}`;

        if (this.resend) {
            try {
                await this.resend.emails.send({
                    from: this.fromEmail,
                    to: email,
                    subject: 'Your PBase Login Link',
                    html: `
                        <h2>Login to PBase</h2>
                        <p>Click the link below to log in. This link expires in 10 minutes.</p>
                        <p><a href="${link}" style="background:#e94560;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Log In to PBase</a></p>
                        <p style="color:#666;font-size:12px;">Or copy this link: ${link}</p>
                        <p style="color:#666;font-size:12px;">If you didn't request this, you can ignore this email.</p>
                    `,
                });
                console.log(`[MagicLink] Sent login link to ${email}`);
                return { success: true };
            } catch (err) {
                console.error('[MagicLink] Email send failed:', err);
                return { success: false, error: err.message };
            }
        } else {
            // No email service - log to console (dev mode)
            console.log(`[MagicLink] DEV MODE - Login link for ${email}:`);
            console.log(`  ${link}`);
            return { success: true, token, link }; // Return token in dev mode
        }
    }

    /**
     * Verify a magic link token
     * @param {string} token
     * @returns {{valid: boolean, email?: string, error?: string}}
     */
    verifyToken(token) {
        const data = this.tokens.get(token);

        if (!data) {
            return { valid: false, error: 'Invalid or expired token' };
        }

        if (Date.now() > data.expires) {
            this.tokens.delete(token);
            return { valid: false, error: 'Token expired' };
        }

        // Token is valid - delete it (one-time use)
        this.tokens.delete(token);

        return { valid: true, email: data.email };
    }

    /**
     * Create a JWT session token for a user
     * @param {object} user - { username, email, role, permissions }
     * @returns {string} JWT token
     */
    createSession(user) {
        return jwt.sign(
            {
                username: user.username,
                email: user.email,
                role: user.role,
            },
            this.jwtSecret,
            { expiresIn: this.jwtExpiry }
        );
    }

    /**
     * Verify a JWT session token
     * @param {string} token
     * @returns {{valid: boolean, user?: object, error?: string}}
     */
    verifySession(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return { valid: true, user: decoded };
        } catch (err) {
            return { valid: false, error: err.message };
        }
    }

    /**
     * Cleanup expired tokens
     */
    _cleanup() {
        const now = Date.now();
        for (const [token, data] of this.tokens) {
            if (now > data.expires) {
                this.tokens.delete(token);
            }
        }
    }
}
