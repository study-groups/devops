/**
 * Terrain Iframe Manager Module
 * Handles iframe registration, messaging, and token injection
 */
(function() {
    'use strict';

    const Events = window.Terrain.Events;
    const State = window.Terrain.State;

    // Registry of all active iframes
    const registry = new Map();  // id -> { source, nodeIndex, node, ready, registeredAt }

    const TerrainIframeManager = {
        /**
         * Handle incoming iframe message
         */
        handleMessage: function(event) {
            const data = event.data;
            const source = event.source;

            // Find which iframe sent this message
            let senderIndex = null;
            document.querySelectorAll('.node-iframe').forEach((iframe) => {
                if (iframe.contentWindow === source) {
                    const card = iframe.closest('.terrain-node');
                    senderIndex = parseInt(card?.dataset.index);
                }
            });

            // Handle registration
            if (data.type === 'ready') {
                const node = senderIndex !== null ? State.nodes.get(senderIndex) : null;
                const id = data.from || (node ? node.id : 'unknown-' + Date.now());

                registry.set(id, {
                    source: source,
                    nodeIndex: senderIndex,
                    node: node,
                    ready: true,
                    registeredAt: Date.now()
                });

                console.log('[IframeManager] Iframe registered:', id);

                // Update CLI targets
                if (Terrain.CLI) {
                    Terrain.CLI.updateTargets(senderIndex);
                }

                // Inject tokens when iframe is ready
                if (senderIndex !== null) {
                    const card = document.querySelector(`[data-index="${senderIndex}"]`);
                    const iframe = card?.querySelector('.node-iframe');
                    if (iframe) {
                        this.injectTokens(iframe);
                    }
                    if (Terrain.CLI) {
                        Terrain.CLI.updateStatus(senderIndex, 'active', 'connected: ' + id);
                    }
                }
            }

            // Log to CLI if node is expanded
            if (senderIndex !== null && Terrain.CLI) {
                Terrain.CLI.log(senderIndex, 'in', data);
            }
        },

        /**
         * Get list of registered iframe IDs
         */
        getTargets: function() {
            return Array.from(registry.keys());
        },

        /**
         * Get registry entry by ID
         */
        get: function(id) {
            return registry.get(id);
        },

        /**
         * Send message to a node's iframe
         */
        sendToNode: function(index, data) {
            const card = document.querySelector(`[data-index="${index}"]`);
            const iframe = card?.querySelector('.node-iframe');
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(data, '*');
                return true;
            }
            return false;
        },

        /**
         * Send message to a specific target by ID
         */
        sendToTarget: function(targetId, data) {
            const entry = registry.get(targetId);
            if (entry && entry.source) {
                entry.source.postMessage(data, '*');
                return true;
            }
            return false;
        },

        /**
         * Broadcast message to all registered iframes
         */
        broadcast: function(data) {
            registry.forEach((entry) => {
                if (entry.source) {
                    entry.source.postMessage(data, '*');
                }
            });
        },

        /**
         * Extract CSS tokens from parent document
         */
        extractTokens: function() {
            const style = getComputedStyle(document.documentElement);
            const tokenNames = [
                // Backgrounds (TUT-compatible)
                'bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-hover',
                // Borders (TUT-compatible)
                'border', 'border-visible', 'border-active',
                // Text (TUT-compatible)
                'text-primary', 'text-secondary', 'text-muted', 'text-code',
                // Accents & Status (TUT-compatible)
                'accent-primary', 'accent-secondary', 'success', 'error', 'warning',
                // Typography
                'font-primary', 'font-secondary', 'font-code',
                // Curves
                'curve-sm', 'curve-md', 'curve-lg',
                // Gaps
                'gap-xs', 'gap-sm', 'gap-md', 'gap-lg', 'gap-xl',
                // Tempo
                'tempo-fast', 'tempo-normal', 'tempo-slow'
            ];

            const tokens = {};
            tokenNames.forEach(name => {
                const value = style.getPropertyValue('--' + name).trim();
                if (value) {
                    tokens[name] = value;
                }
            });
            return tokens;
        },

        /**
         * Inject CSS tokens into an iframe
         */
        injectTokens: function(iframe) {
            if (!iframe?.contentWindow) return;
            const tokens = this.extractTokens();
            iframe.contentWindow.postMessage({
                type: 'injectTokens',
                tokens: tokens
            }, '*');
            console.log('[IframeManager] Injected tokens:', Object.keys(tokens).length);
        },

        /**
         * Inject tokens to all registered iframes
         */
        refreshAllTokens: function() {
            const tokens = this.extractTokens();
            registry.forEach((entry) => {
                if (entry.source) {
                    entry.source.postMessage({
                        type: 'injectTokens',
                        tokens: tokens
                    }, '*');
                }
            });
        },

        /**
         * Unregister an iframe
         */
        unregister: function(id) {
            registry.delete(id);
        },

        /**
         * Clear all registrations
         */
        clear: function() {
            registry.clear();
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.IframeManager = TerrainIframeManager;

})();
