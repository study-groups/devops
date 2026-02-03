/**
 * InviteStore - JSON-file-backed invite token CRUD
 * Stores tokens in $PD_DIR/invites.json
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class InviteStore {
    constructor(pdDir) {
        this.filePath = path.join(pdDir, 'invites.json');
        this._ensureFile();
    }

    _ensureFile() {
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify({ tokens: {} }, null, 2));
        }
    }

    _read() {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
    }

    _write(data) {
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    /**
     * Create a new invite token
     * @param {object} opts - { email, role, createdBy, ttl }
     * @param {string} baseUrl - Base URL for generating invite link
     * @returns {{ id: string, url: string }}
     */
    create({ email, role = 'user', createdBy = 'admin', ttl = 7 * 24 * 60 * 60 * 1000 }, baseUrl) {
        const id = crypto.randomBytes(16).toString('hex');
        const data = this._read();

        data.tokens[id] = {
            email,
            role,
            createdBy,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + ttl).toISOString(),
            usedAt: null,
            revokedAt: null,
        };

        this._write(data);

        return {
            id,
            url: `${baseUrl}/invite/${id}`,
        };
    }

    /**
     * Verify a token is valid (not expired, not revoked, not used)
     * @param {string} id
     * @returns {object|null} Token data or null
     */
    verify(id) {
        const data = this._read();
        const token = data.tokens[id];

        if (!token) return null;
        if (token.revokedAt) return null;
        if (token.usedAt) return null;
        if (new Date(token.expiresAt) < new Date()) return null;

        return token;
    }

    /**
     * Mark a token as used
     * @param {string} id
     */
    markUsed(id) {
        const data = this._read();
        if (data.tokens[id]) {
            data.tokens[id].usedAt = new Date().toISOString();
            this._write(data);
        }
    }

    /**
     * Revoke a token
     * @param {string} id
     */
    revoke(id) {
        const data = this._read();
        if (!data.tokens[id]) return false;
        data.tokens[id].revokedAt = new Date().toISOString();
        this._write(data);
        return true;
    }

    /**
     * List all tokens with computed status
     * @returns {Array}
     */
    list() {
        const data = this._read();
        return Object.entries(data.tokens).map(([id, t]) => {
            let status = 'active';
            if (t.revokedAt) status = 'revoked';
            else if (t.usedAt) status = 'used';
            else if (new Date(t.expiresAt) < new Date()) status = 'expired';

            return { id, ...t, status };
        });
    }

    /**
     * Remove expired+used tokens older than 30 days
     */
    cleanup() {
        const data = this._read();
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        let removed = 0;

        for (const [id, t] of Object.entries(data.tokens)) {
            const isInactive = t.revokedAt || t.usedAt || new Date(t.expiresAt) < new Date();
            const isOld = new Date(t.createdAt) < cutoff;
            if (isInactive && isOld) {
                delete data.tokens[id];
                removed++;
            }
        }

        if (removed > 0) this._write(data);
        return removed;
    }
}
