// iframe-base.js - Shared iframe utilities and base functionality
// Include this in any iframe to get: loading states, error handling, parent communication

const IframeBase = {
    // =========================================================================
    // STATE
    // =========================================================================
    state: {
        loading: false,
        error: null,
        org: null,
        env: null
    },

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize iframe with optional config
     * @param {Object} config - { onStateChange, onError }
     */
    init(config = {}) {
        this.config = config;

        // Parse URL params for initial state
        const params = new URLSearchParams(window.location.search);
        this.state.org = params.get('org') || 'tetra';
        this.state.env = params.get('env') || 'local';

        // Listen for parent messages
        window.addEventListener('message', (e) => this._handleMessage(e));

        // Set up global error handler
        window.onerror = (msg, url, line, col, error) => {
            this.setError({ message: msg, url, line, col, stack: error?.stack });
            return true;
        };

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.setError({ message: e.reason?.message || 'Unhandled promise rejection', stack: e.reason?.stack });
        });

        return this;
    },

    // =========================================================================
    // LOADING STATE
    // =========================================================================

    /**
     * Set loading state and optionally show overlay
     */
    setLoading(loading, message = 'Loading...') {
        this.state.loading = loading;

        let overlay = document.getElementById('iframe-loading-overlay');
        if (loading) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'iframe-loading-overlay';
                overlay.innerHTML = `
                    <div class="iframe-loading-content">
                        <div class="iframe-spinner"></div>
                        <div class="iframe-loading-text">${message}</div>
                    </div>
                `;
                document.body.appendChild(overlay);
            } else {
                overlay.querySelector('.iframe-loading-text').textContent = message;
                overlay.style.display = 'flex';
            }
        } else if (overlay) {
            overlay.style.display = 'none';
        }
    },

    // =========================================================================
    // ERROR HANDLING
    // =========================================================================

    /**
     * Set error state and show error UI
     */
    setError(error) {
        this.state.error = error;

        if (this.config.onError) {
            this.config.onError(error);
        }

        // Show error UI
        let errorEl = document.getElementById('iframe-error-boundary');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'iframe-error-boundary';
            document.body.appendChild(errorEl);
        }

        if (error) {
            errorEl.innerHTML = `
                <div class="iframe-error-content">
                    <div class="iframe-error-icon">⚠</div>
                    <div class="iframe-error-message">${this._escapeHtml(error.message)}</div>
                    ${error.stack ? `<pre class="iframe-error-stack">${this._escapeHtml(error.stack)}</pre>` : ''}
                    <button class="iframe-error-dismiss" onclick="IframeBase.clearError()">Dismiss</button>
                </div>
            `;
            errorEl.style.display = 'flex';
        } else {
            errorEl.style.display = 'none';
        }
    },

    clearError() {
        this.state.error = null;
        const errorEl = document.getElementById('iframe-error-boundary');
        if (errorEl) errorEl.style.display = 'none';
    },

    // =========================================================================
    // PARENT COMMUNICATION
    // =========================================================================

    /**
     * Send message to parent dashboard
     */
    postToParent(type, data) {
        if (window.parent !== window) {
            window.parent.postMessage({ type, ...data }, '*');
        }
    },

    /**
     * Handle incoming messages from parent
     */
    _handleMessage(event) {
        const { type, ...data } = event.data || {};

        switch (type) {
            case 'state':
                // Parent sent state update
                if (data.org) this.state.org = data.org;
                if (data.env) this.state.env = data.env;
                if (this.config.onStateChange) {
                    this.config.onStateChange(this.state);
                }
                break;
            case 'refresh':
                // Parent requested refresh
                if (this.config.onRefresh) {
                    this.config.onRefresh();
                }
                break;
        }
    },

    // =========================================================================
    // API HELPERS
    // =========================================================================

    /**
     * Build API URL with org/env params
     */
    apiUrl(endpoint) {
        const base = endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`;
        return `${base}?org=${encodeURIComponent(this.state.org)}&env=${encodeURIComponent(this.state.env)}`;
    },

    /**
     * Fetch with automatic loading state and error handling
     */
    async fetch(url, options = {}) {
        const { showLoading = true, loadingMessage = 'Loading...' } = options;

        if (showLoading) this.setLoading(true, loadingMessage);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            this.setError(error);
            throw error;
        } finally {
            if (showLoading) this.setLoading(false);
        }
    },

    // =========================================================================
    // UI UTILITIES
    // =========================================================================

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    /**
     * Format duration to human readable
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
        return `${(ms / 3600000).toFixed(1)}h`;
    },

    /**
     * Format relative time
     */
    formatRelativeTime(date) {
        const now = new Date();
        const d = new Date(date);
        const diff = now - d;

        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    },

    /**
     * Escape HTML to prevent XSS
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // =========================================================================
    // CSS INJECTION
    // =========================================================================

    /**
     * Inject base styles for loading/error overlays
     * Call this once in your iframe's script
     */
    injectStyles() {
        if (document.getElementById('iframe-base-styles')) return;

        const style = document.createElement('style');
        style.id = 'iframe-base-styles';
        style.textContent = `
            /* Loading Overlay */
            #iframe-loading-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            .iframe-loading-content {
                text-align: center;
                color: var(--ink, #fff);
            }
            .iframe-spinner {
                width: 24px;
                height: 24px;
                border: 2px solid var(--border, #444);
                border-top-color: var(--four, #88f);
                border-radius: 50%;
                animation: iframe-spin 0.8s linear infinite;
                margin: 0 auto 8px;
            }
            .iframe-loading-text {
                font-size: 11px;
                color: var(--ink-muted, #888);
            }
            @keyframes iframe-spin {
                to { transform: rotate(360deg); }
            }

            /* Error Boundary */
            #iframe-error-boundary {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.85);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            .iframe-error-content {
                background: var(--paper-mid, #1a1a1a);
                border: 1px solid var(--one, #f44);
                border-radius: 4px;
                padding: 16px;
                max-width: 400px;
                text-align: center;
            }
            .iframe-error-icon {
                font-size: 24px;
                color: var(--one, #f44);
                margin-bottom: 8px;
            }
            .iframe-error-message {
                color: var(--ink, #fff);
                font-size: 12px;
                margin-bottom: 8px;
            }
            .iframe-error-stack {
                background: var(--paper-dark, #111);
                color: var(--ink-muted, #888);
                font-size: 9px;
                padding: 8px;
                text-align: left;
                max-height: 100px;
                overflow: auto;
                margin-bottom: 12px;
                white-space: pre-wrap;
                word-break: break-all;
            }
            .iframe-error-dismiss {
                background: var(--paper-mid, #1a1a1a);
                border: 1px solid var(--border, #444);
                color: var(--ink, #fff);
                padding: 6px 16px;
                cursor: pointer;
                border-radius: 2px;
            }
            .iframe-error-dismiss:hover {
                border-color: var(--four, #88f);
            }
        `;
        document.head.appendChild(style);
    }
};

// Auto-inject styles when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => IframeBase.injectStyles());
} else {
    IframeBase.injectStyles();
}
