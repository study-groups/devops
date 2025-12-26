/**
 * Simple in-memory rate limiter
 * Uses sliding window algorithm
 */

'use strict';

class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000;      // 1 minute default
        this.maxRequests = options.maxRequests || 10;   // 10 requests per window
        this.clients = new Map();

        // Cleanup old entries every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    /**
     * Check if request is allowed
     * @param {string} key - Client identifier (IP, token, etc.)
     * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
     */
    check(key) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Get or create client record
        let client = this.clients.get(key);
        if (!client) {
            client = { requests: [] };
            this.clients.set(key, client);
        }

        // Remove old requests outside window
        client.requests = client.requests.filter(ts => ts > windowStart);

        // Check limit
        if (client.requests.length >= this.maxRequests) {
            const oldestRequest = client.requests[0];
            const resetMs = oldestRequest + this.windowMs - now;

            return {
                allowed: false,
                remaining: 0,
                resetMs: Math.max(0, resetMs)
            };
        }

        // Add this request
        client.requests.push(now);

        return {
            allowed: true,
            remaining: this.maxRequests - client.requests.length,
            resetMs: this.windowMs
        };
    }

    /**
     * Remove stale entries
     */
    cleanup() {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        for (const [key, client] of this.clients) {
            client.requests = client.requests.filter(ts => ts > windowStart);
            if (client.requests.length === 0) {
                this.clients.delete(key);
            }
        }
    }

    /**
     * Stop cleanup interval
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

module.exports = RateLimiter;
