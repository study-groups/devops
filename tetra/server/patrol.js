/**
 * TSM Patrol Loop - Service supervision for tetra-4444
 *
 * Runs on deployed servers to:
 * - Periodically check all enabled services
 * - Restart any crashed services
 * - Expose status via API
 */

const { exec } = require('child_process');

class PatrolLoop {
    constructor(options = {}) {
        this.interval = options.interval || 30000; // 30 seconds default
        this.maxLogEntries = options.maxLogEntries || 100;
        this.running = false;
        this.timer = null;
        this.log = [];
        this.stats = {
            checks: 0,
            restarts: 0,
            lastCheck: null
        };
    }

    start() {
        if (this.running) return;

        this.running = true;
        console.log(`🔄 Patrol starting (interval: ${this.interval/1000}s)`);

        // Initial check
        this.check();

        // Schedule periodic checks
        this.timer = setInterval(() => this.check(), this.interval);
    }

    stop() {
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log('🛑 Patrol stopped');
    }

    check() {
        const checkTime = Date.now();
        this.stats.checks++;
        this.stats.lastCheck = checkTime;

        exec('source ~/tetra/tetra.sh && tsm patrol --once --json',
            { shell: '/bin/bash', timeout: 30000 },
            (err, stdout, stderr) => {
                if (err) {
                    this._addLog({
                        time: checkTime,
                        type: 'error',
                        message: err.message
                    });
                    return;
                }

                try {
                    const result = JSON.parse(stdout.trim());

                    if (result.restarted && result.restarted.length > 0) {
                        this.stats.restarts += result.restarted.length;
                        this._addLog({
                            time: checkTime,
                            type: 'restart',
                            services: result.restarted
                        });
                        console.log(`🔄 Restarted: ${result.restarted.join(', ')}`);
                    }
                } catch (parseErr) {
                    // Non-JSON output is fine - means nothing to report
                }
            }
        );
    }

    _addLog(entry) {
        this.log.push(entry);
        // Trim log to max entries
        if (this.log.length > this.maxLogEntries) {
            this.log = this.log.slice(-this.maxLogEntries);
        }
    }

    getLog() {
        return this.log;
    }

    getStats() {
        return {
            ...this.stats,
            running: this.running,
            interval: this.interval,
            logEntries: this.log.length
        };
    }

    // Force an immediate check
    checkNow() {
        this.check();
        return { triggered: true, time: Date.now() };
    }
}

module.exports = PatrolLoop;
