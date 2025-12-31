/**
 * Terrain.Iframe - Shared iframe communication protocol
 *
 * Usage (simple):
 *   <script src="/js/terrain-iframe.js"></script>
 *   // Auto-sends ready, handles token injection
 *
 * Usage (with callbacks):
 *   <script src="/js/terrain-iframe.js"></script>
 *   <script>
 *     Terrain.Iframe.init({
 *       name: 'console',
 *       onReady: () => { ... },
 *       onMessage: (msg) => { ... }
 *     });
 *   </script>
 */

window.Terrain = window.Terrain || {};

Terrain.Iframe = {
    ready: false,
    name: null,
    onMessage: null,
    onReady: null,

    /**
     * Send message to parent window
     */
    send: function(data) {
        if (window.parent !== window) {
            window.parent.postMessage(data, '*');
        }
    },

    /**
     * Initialize with options
     * @param {Object} opts - { name, onMessage, onReady }
     */
    init: function(opts) {
        opts = opts || {};
        this.name = opts.name || this._detectName();
        this.onMessage = opts.onMessage || function(){};
        this.onReady = opts.onReady || function(){};

        // Listen for messages
        window.addEventListener('message', (e) => {
            if (e.data && typeof e.data === 'object') {
                // Handle token injection
                if (e.data.type === 'injectTokens' && e.data.tokens) {
                    Object.entries(e.data.tokens).forEach(([k, v]) => {
                        document.documentElement.style.setProperty('--' + k, v);
                    });
                }
                // Forward to callback
                if (this.onMessage) {
                    this.onMessage(e.data);
                }
            }
        });

        // Set ready when DOM is complete
        if (document.readyState === 'complete') {
            this._setReady();
        } else {
            window.addEventListener('load', () => this._setReady());
        }

        return this;
    },

    /**
     * Detect iframe name from title or filename
     */
    _detectName: function() {
        // Try document title
        if (document.title) {
            return document.title.toLowerCase();
        }
        // Try filename from URL
        const path = window.location.pathname;
        const match = path.match(/([^/]+)\.iframe\.html$/);
        if (match) {
            return match[1];
        }
        return 'iframe';
    },

    /**
     * Mark as ready and notify parent
     */
    _setReady: function() {
        if (this.ready) return;
        this.ready = true;

        if (this.onReady) {
            this.onReady();
        }

        this.send({ type: 'ready', from: this.name });
    }
};

// Auto-initialize on load (simple mode)
// Can be overridden by calling Terrain.Iframe.init() with options
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!Terrain.Iframe.ready) {
            Terrain.Iframe.init();
        }
    });
} else {
    // DOM already loaded
    setTimeout(() => {
        if (!Terrain.Iframe.ready) {
            Terrain.Iframe.init();
        }
    }, 0);
}
