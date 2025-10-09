// pdata/AuditLogger.js
// Redux-inspired audit logging with middleware hooks

import fs from 'fs-extra';
import path from 'path';

/**
 * AuditLogger - Event-based audit system with middleware hooks
 *
 * Events:
 * - auth.login.success / auth.login.failure
 * - auth.token.created / auth.token.validated / auth.token.expired
 * - file.read / file.write / file.delete / file.list
 * - user.created / user.deleted / user.password_changed / user.roles_changed
 * - capability.check / capability.denied
 * - path.resolved / path.denied
 * - symlink.created / symlink.followed
 */
class AuditLogger {
    constructor(config = {}) {
        this.enabled = config.enabled !== false; // Default enabled
        this.logLevel = config.logLevel || 'info'; // debug, info, warn, error
        this.hooks = []; // Middleware hooks
        this.persistPath = config.persistPath; // Optional: file path for audit log
        this.context = config.context || {}; // Global context (e.g., server ID)

        // Built-in hooks
        if (config.console !== false) {
            this.use(this._consoleHook.bind(this));
        }

        if (this.persistPath) {
            this.use(this._fileHook.bind(this));
        }
    }

    /**
     * Add a middleware hook
     * Hook signature: (event) => void | Promise<void>
     * Event shape: { type, level, timestamp, username, action, resource, result, metadata }
     */
    use(hook) {
        if (typeof hook !== 'function') {
            throw new Error('Hook must be a function');
        }
        this.hooks.push(hook);
        return this; // Chainable
    }

    /**
     * Log an audit event
     */
    async log(eventType, details = {}) {
        if (!this.enabled) return;

        const event = {
            type: eventType,
            level: details.level || 'info',
            timestamp: new Date().toISOString(),
            username: details.username || 'system',
            action: details.action,
            resource: details.resource,
            result: details.result || 'success', // success, failure, denied
            metadata: details.metadata || {},
            ...this.context
        };

        // Run all hooks
        for (const hook of this.hooks) {
            try {
                await hook(event);
            } catch (error) {
                console.error('[AuditLogger] Hook error:', error);
            }
        }
    }

    // Convenience methods for common events
    async auth(action, username, result, metadata = {}) {
        return this.log(`auth.${action}`, {
            username,
            action,
            result: result ? 'success' : 'failure',
            metadata
        });
    }

    async file(operation, username, resource, result = true, metadata = {}) {
        return this.log(`file.${operation}`, {
            username,
            action: operation,
            resource,
            result: result ? 'success' : 'failure',
            metadata
        });
    }

    async capability(username, action, resource, granted, metadata = {}) {
        return this.log(granted ? 'capability.check' : 'capability.denied', {
            username,
            action,
            resource,
            result: granted ? 'granted' : 'denied',
            metadata
        });
    }

    async user(operation, username, result = true, metadata = {}) {
        return this.log(`user.${operation}`, {
            username,
            action: operation,
            result: result ? 'success' : 'failure',
            metadata
        });
    }

    async path(operation, username, resource, result = true, metadata = {}) {
        return this.log(`path.${operation}`, {
            username,
            action: operation,
            resource,
            result: result ? 'success' : 'failure',
            metadata
        });
    }

    async symlink(operation, username, source, target, result = true, metadata = {}) {
        return this.log(`symlink.${operation}`, {
            username,
            action: operation,
            resource: source,
            result: result ? 'success' : 'failure',
            metadata: { ...metadata, target }
        });
    }

    // Built-in hooks

    _consoleHook(event) {
        const { type, level, timestamp, username, action, resource, result, metadata } = event;

        const color = {
            debug: '\x1b[36m', // Cyan
            info: '\x1b[32m',  // Green
            warn: '\x1b[33m',  // Yellow
            error: '\x1b[31m'  // Red
        }[level] || '';
        const reset = '\x1b[0m';

        const metaStr = Object.keys(metadata).length > 0
            ? ` | ${JSON.stringify(metadata)}`
            : '';

        console.log(
            `${color}[AUDIT ${timestamp}]${reset} ` +
            `${type} | user=${username} | action=${action || 'N/A'} | ` +
            `resource=${resource || 'N/A'} | result=${result}${metaStr}`
        );
    }

    async _fileHook(event) {
        if (!this.persistPath) return;

        try {
            const logDir = path.dirname(this.persistPath);
            await fs.ensureDir(logDir);

            const logLine = JSON.stringify(event) + '\n';
            await fs.appendFile(this.persistPath, logLine, 'utf8');
        } catch (error) {
            console.error('[AuditLogger] File persistence error:', error);
        }
    }

    // Query interface for audit logs (if persisted)
    async query(filters = {}) {
        if (!this.persistPath || !await fs.pathExists(this.persistPath)) {
            return [];
        }

        const content = await fs.readFile(this.persistPath, 'utf8');
        const events = content.split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));

        let filtered = events;

        if (filters.username) {
            filtered = filtered.filter(e => e.username === filters.username);
        }
        if (filters.type) {
            filtered = filtered.filter(e => e.type === filters.type);
        }
        if (filters.result) {
            filtered = filtered.filter(e => e.result === filters.result);
        }
        if (filters.after) {
            filtered = filtered.filter(e => new Date(e.timestamp) > new Date(filters.after));
        }
        if (filters.before) {
            filtered = filtered.filter(e => new Date(e.timestamp) < new Date(filters.before));
        }

        return filtered;
    }
}

export { AuditLogger };
