// pdata/adapters/LogAdapter.js
// Standalone Node.js logging adapter - Lua aggregator compatible

import fs from 'fs-extra';
import path from 'path';

/**
 * LogAdapter - File-based logging with rotation
 *
 * Design:
 * - Writes to Tetra-compatible log directory structure
 * - JSON lines format (easy for Lua to parse)
 * - Auto-rotation based on line count (like TSM_LOG_MAX_LINES)
 * - Prometheus text export (optional)
 * - Future: Lua aggregator can watch these files
 */
class LogAdapter {
    constructor(config = {}) {
        // Use Tetra log directory if available, otherwise local
        this.logDir = config.logDir || process.env.TSM_LOGS_DIR || './logs';
        this.logName = config.logName || 'pdata';
        this.maxLines = config.maxLines || parseInt(process.env.TSM_LOG_MAX_LINES || '1000');
        this.maxFiles = config.maxFiles || 10;
        this.enableMetrics = config.enableMetrics !== false;
        this.metricsPath = config.metricsPath;

        // In-memory metrics (for Prometheus export)
        this.metrics = {
            auth_attempts_total: {},
            auth_failures_total: {},
            file_operations_total: {},
            capability_denials_total: {},
            symlinks_created_total: 0,
            symlinks_followed_total: 0
        };

        // Ensure log directory exists
        fs.ensureDirSync(this.logDir);
    }

    /**
     * Main log method - use as audit hook
     * Usage: pdata.audit.use(logAdapter.log.bind(logAdapter))
     */
    async log(event) {
        // Update metrics
        if (this.enableMetrics) {
            this._updateMetrics(event);
        }

        // Write to log file
        await this._writeLog(event);

        // Export metrics if path configured
        if (this.metricsPath) {
            await this._exportMetrics();
        }
    }

    /**
     * Write JSON line to log file with rotation
     */
    async _writeLog(event) {
        const logFile = path.join(this.logDir, `${this.logName}.log`);

        // JSON lines format (newline-delimited JSON)
        const logLine = JSON.stringify(event) + '\n';

        await fs.appendFile(logFile, logLine);

        // Check if rotation needed
        const lines = await this._countLines(logFile);
        if (lines >= this.maxLines) {
            await this._rotateLog(logFile);
        }
    }

    /**
     * Count lines in file
     */
    async _countLines(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return content.split('\n').filter(line => line.trim()).length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Rotate log file (similar to Tetra log rotation)
     */
    async _rotateLog(logFile) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const basename = path.basename(logFile, '.log');
        const rotatedFile = path.join(
            this.logDir,
            `${basename}-${timestamp}.log`
        );

        await fs.move(logFile, rotatedFile);
        console.log(`[LogAdapter] Rotated ${logFile} -> ${rotatedFile}`);

        // Clean up old rotated files
        await this._cleanOldLogs(basename);
    }

    /**
     * Remove old rotated logs beyond maxFiles
     */
    async _cleanOldLogs(basename) {
        const files = await fs.readdir(this.logDir);
        const rotatedFiles = files
            .filter(f => f.startsWith(`${basename}-`) && f.endsWith('.log'))
            .map(f => ({
                name: f,
                path: path.join(this.logDir, f),
                time: fs.statSync(path.join(this.logDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        if (rotatedFiles.length > this.maxFiles) {
            const toDelete = rotatedFiles.slice(this.maxFiles);
            for (const file of toDelete) {
                await fs.remove(file.path);
                console.log(`[LogAdapter] Deleted old log: ${file.name}`);
            }
        }
    }

    /**
     * Update in-memory metrics from event
     */
    _updateMetrics(event) {
        const { type, username, action, result } = event;

        // Auth metrics
        if (type.startsWith('auth.')) {
            this.metrics.auth_attempts_total[username] =
                (this.metrics.auth_attempts_total[username] || 0) + 1;

            if (result === 'failure') {
                this.metrics.auth_failures_total[username] =
                    (this.metrics.auth_failures_total[username] || 0) + 1;
            }
        }

        // File operation metrics
        if (type.startsWith('file.')) {
            this.metrics.file_operations_total[action] =
                (this.metrics.file_operations_total[action] || 0) + 1;
        }

        // Capability denials
        if (result === 'denied') {
            this.metrics.capability_denials_total[action] =
                (this.metrics.capability_denials_total[action] || 0) + 1;
        }

        // Symlink operations
        if (type === 'symlink.created') {
            this.metrics.symlinks_created_total++;
        }
        if (type === 'symlink.followed') {
            this.metrics.symlinks_followed_total++;
        }
    }

    /**
     * Export metrics in Prometheus text format
     * See: https://prometheus.io/docs/instrumenting/exposition_formats/
     */
    async _exportMetrics() {
        if (!this.metricsPath) return;

        const lines = [];

        // Auth attempts by user
        lines.push('# HELP pdata_auth_attempts_total Total authentication attempts');
        lines.push('# TYPE pdata_auth_attempts_total counter');
        for (const [username, count] of Object.entries(this.metrics.auth_attempts_total)) {
            lines.push(`pdata_auth_attempts_total{username="${username}"} ${count}`);
        }

        // Auth failures by user
        lines.push('# HELP pdata_auth_failures_total Total authentication failures');
        lines.push('# TYPE pdata_auth_failures_total counter');
        for (const [username, count] of Object.entries(this.metrics.auth_failures_total)) {
            lines.push(`pdata_auth_failures_total{username="${username}"} ${count}`);
        }

        // File operations by type
        lines.push('# HELP pdata_file_operations_total Total file operations');
        lines.push('# TYPE pdata_file_operations_total counter');
        for (const [operation, count] of Object.entries(this.metrics.file_operations_total)) {
            lines.push(`pdata_file_operations_total{operation="${operation}"} ${count}`);
        }

        // Capability denials by action
        lines.push('# HELP pdata_capability_denials_total Total capability denials');
        lines.push('# TYPE pdata_capability_denials_total counter');
        for (const [action, count] of Object.entries(this.metrics.capability_denials_total)) {
            lines.push(`pdata_capability_denials_total{action="${action}"} ${count}`);
        }

        // Symlinks created
        lines.push('# HELP pdata_symlinks_created_total Total symlinks created');
        lines.push('# TYPE pdata_symlinks_created_total counter');
        lines.push(`pdata_symlinks_created_total ${this.metrics.symlinks_created_total}`);

        // Symlinks followed
        lines.push('# HELP pdata_symlinks_followed_total Total symlinks followed');
        lines.push('# TYPE pdata_symlinks_followed_total counter');
        lines.push(`pdata_symlinks_followed_total ${this.metrics.symlinks_followed_total}`);

        await fs.writeFile(this.metricsPath, lines.join('\n') + '\n');
    }

    /**
     * Get current metrics snapshot (for debugging/monitoring)
     */
    getMetrics() {
        return JSON.parse(JSON.stringify(this.metrics));
    }

    /**
     * Reset metrics (useful for testing)
     */
    resetMetrics() {
        this.metrics = {
            auth_attempts_total: {},
            auth_failures_total: {},
            file_operations_total: {},
            capability_denials_total: {},
            symlinks_created_total: 0,
            symlinks_followed_total: 0
        };
    }
}

export { LogAdapter };
