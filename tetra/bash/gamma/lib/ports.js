/**
 * ports.js - Port allocation for match processes
 *
 * Manages a pool of ports (default 1600-1856, 256 ports)
 * for spawned game processes.
 */

'use strict';

const DEFAULT_PORT_BASE = 1600;
const DEFAULT_PORT_MAX = 1856;

class PortAllocator {
    constructor(base = DEFAULT_PORT_BASE, max = DEFAULT_PORT_MAX) {
        this.base = base;
        this.max = max;
        this.allocated = new Set();
    }

    allocate() {
        for (let port = this.base; port <= this.max; port++) {
            if (!this.allocated.has(port)) {
                this.allocated.add(port);
                return port;
            }
        }
        return null;  // All ports exhausted
    }

    release(port) {
        this.allocated.delete(port);
    }

    isAllocated(port) {
        return this.allocated.has(port);
    }

    next() {
        for (let port = this.base; port <= this.max; port++) {
            if (!this.allocated.has(port)) {
                return port;
            }
        }
        return null;
    }

    stats() {
        return {
            base: this.base,
            max: this.max,
            total: this.max - this.base + 1,
            allocated: this.allocated.size,
            available: (this.max - this.base + 1) - this.allocated.size,
            next: this.next()
        };
    }

    // Sync with existing matches (call on startup)
    sync(matches) {
        this.allocated.clear();
        for (const match of matches) {
            if (match.port >= this.base && match.port <= this.max) {
                this.allocated.add(match.port);
            }
        }
    }
}

module.exports = { PortAllocator, DEFAULT_PORT_BASE, DEFAULT_PORT_MAX };
