/**
 * iframe-init.js - Common utilities for dashboard iframes
 *
 * Complements terrain-iframe.js with:
 * - API fetching with loading states
 * - Common UI patterns (refresh, loading, errors)
 * - Helper functions for rendering
 *
 * Usage:
 *   IframeUtils.fetch('/api/data')
 *   IframeUtils.loading('#container')
 *   IframeUtils.error('#container', 'Failed to load')
 *   IframeUtils.autoRefresh(loadData, 30000)
 */

window.IframeUtils = {
    // ========================================================================
    // API Fetching
    // ========================================================================

    /**
     * Fetch with automatic org/env params and error handling
     * @param {string} endpoint - API endpoint
     * @param {Object} opts - fetch options + { params: {} }
     * @returns {Promise<any>} - JSON response
     */
    async fetch(endpoint, opts = {}) {
        const state = Terrain?.State || { org: 'tetra', env: 'local', user: '' };
        const params = new URLSearchParams({
            org: state.org,
            env: state.env,
            ...opts.params
        });
        if (state.user) params.set('user', state.user);

        const url = endpoint.includes('?')
            ? `${endpoint}&${params}`
            : `${endpoint}?${params}`;

        const res = await fetch(url, opts);
        if (!res.ok) {
            throw new Error(`${res.status} ${res.statusText}`);
        }
        return res.json();
    },

    /**
     * Fetch with loading/error UI handling
     * @param {string} endpoint - API endpoint
     * @param {string|Element} container - Container selector or element
     * @param {Function} render - Render function(data, container)
     */
    async fetchAndRender(endpoint, container, render) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) return;

        this.loading(el);
        try {
            const data = await this.fetch(endpoint);
            render(data, el);
        } catch (err) {
            this.error(el, err.message);
        }
    },

    // ========================================================================
    // Loading States
    // ========================================================================

    /**
     * Show loading state
     * @param {string|Element} container
     * @param {string} message
     */
    loading(container, message = 'Loading...') {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (el) {
            el.innerHTML = `<div class="empty">${message}</div>`;
        }
    },

    /**
     * Show error state
     * @param {string|Element} container
     * @param {string} message
     */
    error(container, message = 'Error loading data') {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (el) {
            el.innerHTML = `<div class="empty text-error">${message}</div>`;
        }
    },

    /**
     * Show empty state
     * @param {string|Element} container
     * @param {string} message
     */
    empty(container, message = 'No data') {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (el) {
            el.innerHTML = `<div class="empty">${message}</div>`;
        }
    },

    // ========================================================================
    // Status Indicators
    // ========================================================================

    /**
     * Update status dot
     * @param {string} status - 'connected' | 'disconnected' | 'loading'
     */
    setStatus(status) {
        const dot = document.querySelector('.status-dot');
        if (dot) {
            dot.classList.remove('connected', 'disconnected', 'loading');
            dot.classList.add(status);
        }
    },

    // ========================================================================
    // Auto Refresh
    // ========================================================================

    _refreshInterval: null,
    _refreshFn: null,

    /**
     * Setup auto-refresh
     * @param {Function} loadFn - Function to call on refresh
     * @param {number} interval - Interval in ms (0 to disable)
     */
    autoRefresh(loadFn, interval = 30000) {
        this._refreshFn = loadFn;

        // Clear existing
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = null;
        }

        // Setup new interval
        if (interval > 0) {
            this._refreshInterval = setInterval(loadFn, interval);
        }

        // Also register refresh action handler
        Terrain?.Iframe?.on('refresh', () => {
            if (this._refreshFn) this._refreshFn();
        });
    },

    /**
     * Manual refresh trigger
     */
    refresh() {
        if (this._refreshFn) this._refreshFn();
    },

    // ========================================================================
    // Rendering Helpers
    // ========================================================================

    /**
     * Escape HTML
     * @param {string} str
     * @returns {string}
     */
    escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Format timestamp
     * @param {string|number|Date} ts
     * @returns {string}
     */
    formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    /**
     * Format relative time
     * @param {string|number|Date} ts
     * @returns {string}
     */
    formatRelative(ts) {
        const now = Date.now();
        const then = new Date(ts).getTime();
        const diff = now - then;

        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    },

    /**
     * Format duration
     * @param {number} ms - Duration in milliseconds
     * @returns {string}
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
        return `${Math.floor(ms / 3600000)}h`;
    },

    /**
     * Format bytes
     * @param {number} bytes
     * @returns {string}
     */
    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
        if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}MB`;
        return `${(bytes / 1073741824).toFixed(1)}GB`;
    },

    // ========================================================================
    // Environment Helpers
    // ========================================================================

    /**
     * Check if current env is remote (not local)
     * @returns {boolean}
     */
    isRemote() {
        return (Terrain?.State?.env || 'local') !== 'local';
    },

    /**
     * Check if current env is production
     * @returns {boolean}
     */
    isProd() {
        const env = Terrain?.State?.env || 'local';
        return env === 'prod' || env === 'production';
    },

    /**
     * Get current state
     * @returns {Object} { org, env, user }
     */
    getState() {
        return {
            org: Terrain?.State?.org || 'tetra',
            env: Terrain?.State?.env || 'local',
            user: Terrain?.State?.user || ''
        };
    },

    // ========================================================================
    // DOM Helpers
    // ========================================================================

    /**
     * Query selector shorthand
     * @param {string} sel
     * @returns {Element}
     */
    $(sel) {
        return document.querySelector(sel);
    },

    /**
     * Query selector all shorthand
     * @param {string} sel
     * @returns {NodeList}
     */
    $$(sel) {
        return document.querySelectorAll(sel);
    },

    /**
     * Create element with HTML
     * @param {string} html
     * @returns {Element}
     */
    createElement(html) {
        const div = document.createElement('div');
        div.innerHTML = html.trim();
        return div.firstChild;
    }
};

// Shorthand aliases
window.$ = IframeUtils.$.bind(IframeUtils);
window.$$ = IframeUtils.$$.bind(IframeUtils);
