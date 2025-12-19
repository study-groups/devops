/**
 * Terrain Events Module
 * Pub/sub event bus for decoupled module communication
 */
(function() {
    'use strict';

    const listeners = {};

    const TerrainEvents = {
        /**
         * Subscribe to an event
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         * @returns {Function} Unsubscribe function
         */
        on: function(event, callback) {
            if (!listeners[event]) {
                listeners[event] = [];
            }
            listeners[event].push(callback);

            // Return unsubscribe function
            return function() {
                const index = listeners[event].indexOf(callback);
                if (index > -1) {
                    listeners[event].splice(index, 1);
                }
            };
        },

        /**
         * Subscribe to an event (one-time)
         * @param {string} event - Event name
         * @param {Function} callback - Handler function
         */
        once: function(event, callback) {
            const unsubscribe = this.on(event, function(...args) {
                unsubscribe();
                callback.apply(this, args);
            });
        },

        /**
         * Emit an event
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        emit: function(event, data) {
            if (listeners[event]) {
                listeners[event].forEach(callback => {
                    try {
                        callback(data);
                    } catch (e) {
                        console.error(`[Terrain.Events] Error in ${event} handler:`, e);
                    }
                });
            }
        },

        /**
         * Remove all listeners for an event
         * @param {string} event - Event name (optional, removes all if not provided)
         */
        off: function(event) {
            if (event) {
                delete listeners[event];
            } else {
                Object.keys(listeners).forEach(key => delete listeners[key]);
            }
        },

        // ================================
        // DOM Binding (data-terrain-* attributes)
        // ================================

        /**
         * DOM bindings registry
         */
        _bindings: new WeakMap(),
        _observer: null,

        /**
         * Initialize DOM bindings
         * Scans for data-terrain-* attributes and sets up reactive updates
         */
        bindDOM: function() {
            this.scanBindings();
            this.setupMutationObserver();
            console.log('[Terrain.Events] DOM bindings initialized');
        },

        /**
         * Scan document for data-terrain-bind attributes
         */
        scanBindings: function() {
            // Bind elements to state paths
            document.querySelectorAll('[data-terrain-bind]').forEach(el => {
                this.bindElement(el);
            });

            // Bind action elements
            document.querySelectorAll('[data-action]').forEach(el => {
                this.bindAction(el);
            });
        },

        /**
         * Bind an element to a state path
         * @param {Element} el - DOM element with data-terrain-bind
         */
        bindElement: function(el) {
            if (this._bindings.has(el)) return; // Already bound

            const path = el.dataset.terrainBind;
            const format = el.dataset.terrainFormat || 'text';

            if (!path) return;

            const State = window.Terrain.State;
            if (!State) {
                console.warn('[Terrain.Events] State not available for binding');
                return;
            }

            // Set initial value
            this.updateElement(el, State.get(path), format);

            // Subscribe to state changes
            const unsubscribe = this.on(this.EVENTS.STATE_CHANGE, (data) => {
                // Update if this path changed or if it's a bulk update
                if (!data || !data.path || data.path === path || data.path === '*' || path.startsWith(data.path + '.')) {
                    this.updateElement(el, State.get(path), format);
                }
            });

            // Store binding info
            this._bindings.set(el, { path, format, unsubscribe });
        },

        /**
         * Update element based on format type
         * @param {Element} el - DOM element
         * @param {*} value - Value to set
         * @param {string} format - Format type
         */
        updateElement: function(el, value, format) {
            switch (format) {
                case 'text':
                    el.textContent = value ?? '';
                    break;
                case 'html':
                    el.innerHTML = value ?? '';
                    break;
                case 'value':
                    el.value = value ?? '';
                    break;
                case 'visible':
                    el.classList.toggle('hidden', !value);
                    break;
                case 'hidden':
                    el.classList.toggle('hidden', !!value);
                    break;
                case 'toggle':
                    el.classList.toggle('active', !!value);
                    break;
                case 'class':
                    el.className = value ?? '';
                    break;
                case 'attr':
                    // Format: data-terrain-attr="attrName"
                    const attrName = el.dataset.terrainAttr;
                    if (attrName) {
                        if (value != null) {
                            el.setAttribute(attrName, value);
                        } else {
                            el.removeAttribute(attrName);
                        }
                    }
                    break;
                default:
                    el.textContent = value ?? '';
            }
        },

        /**
         * Bind an action element
         * @param {Element} el - DOM element with data-action
         */
        bindAction: function(el) {
            if (el._actionBound) return; // Already bound

            const actionSpec = el.dataset.action;
            if (!actionSpec) return;

            // Parse action: "EVENT_NAME" or "EVENT_NAME:payload"
            const [eventName, ...payloadParts] = actionSpec.split(':');
            const payloadStr = payloadParts.join(':');

            el.addEventListener('click', (e) => {
                e.preventDefault();
                let payload = {};

                if (payloadStr) {
                    try {
                        payload = JSON.parse(payloadStr);
                    } catch {
                        payload = { value: payloadStr };
                    }
                }

                this.emit(eventName, payload);
            });

            el._actionBound = true;
        },

        /**
         * Setup mutation observer for dynamically added elements
         */
        setupMutationObserver: function() {
            if (this._observer) return; // Already set up

            this._observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.scanNodeBindings(node);
                        }
                    });
                });
            });

            this._observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        },

        /**
         * Scan a node and its children for bindings
         * @param {Node} node - DOM node to scan
         */
        scanNodeBindings: function(node) {
            if (node.dataset) {
                if (node.dataset.terrainBind) {
                    this.bindElement(node);
                }
                if (node.dataset.action) {
                    this.bindAction(node);
                }
            }

            // Scan children
            if (node.querySelectorAll) {
                node.querySelectorAll('[data-terrain-bind]').forEach(el => {
                    this.bindElement(el);
                });
                node.querySelectorAll('[data-action]').forEach(el => {
                    this.bindAction(el);
                });
            }
        }
    };

    // Standard event names
    TerrainEvents.EVENTS = {
        // Lifecycle
        READY: 'terrain:ready',
        DESTROY: 'terrain:destroy',

        // State
        STATE_CHANGE: 'state:change',
        STATE_LOADED: 'state:loaded',
        STATE_SAVED: 'state:saved',

        // Canvas
        CANVAS_PAN: 'canvas:pan',
        CANVAS_TRANSFORM: 'canvas:transform',

        // Projects
        PROJECT_ADD: 'project:add',
        PROJECT_UPDATE: 'project:update',
        PROJECT_DELETE: 'project:delete',
        PROJECT_MOVE: 'project:move',

        // UI
        UI_TOGGLE: 'ui:toggle',
        CONFIG_OPEN: 'config:open',
        CONFIG_CLOSE: 'config:close',

        // Toasts
        TOAST_STACK_UPDATE: 'toast:stack:update'
    };

    // Export to window.Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.Events = TerrainEvents;

})();
