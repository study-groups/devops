/**
 * TetraUI - Dashboard Component Library
 *
 * Include all TetraUI components with a single script tag:
 *   <script src="js/tetra-ui/index.js"></script>
 *
 * Or load components individually:
 *   <script src="js/tetra-ui/core.js"></script>
 *   <script src="js/tetra-ui/spinner.js"></script>
 *   etc.
 *
 * Components:
 *   TetraUI.dom        - DOM utilities (esc, el, cache)
 *   TetraUI.fmt        - Formatting (bytes, duration, relTime)
 *   TetraUI.Spinner    - Loading indicators
 *   TetraUI.Tabs       - Tab navigation
 *   TetraUI.Card       - Stat/status cards
 *   TetraUI.Store      - State management
 *   TetraUI.events     - Event bus
 *   TetraUI.Editor     - CodeMirror wrapper
 *   TetraUI.TerminalOutput - Terminal display with ANSI
 *   TetraUI.ansi       - ANSI color utilities
 */

(function() {
    'use strict';

    // This file serves as documentation and version marker.
    // Components are loaded via individual script tags.

    window.TetraUI = window.TetraUI || {};

    TetraUI.VERSION = '1.0.0';

    TetraUI.components = [
        'core',
        'spinner',
        'tabs',
        'cards',
        'store',
        'events',
        'editor',
        'terminal-output'
    ];

    /**
     * Check if all components are loaded
     */
    TetraUI.ready = function() {
        return !!(
            TetraUI.dom &&
            TetraUI.Spinner &&
            TetraUI.TerminalOutput
        );
    };

    /**
     * Load a component dynamically
     * @param {string} name - Component name
     * @param {Function} callback - Called when loaded
     */
    TetraUI.load = function(name, callback) {
        var script = document.createElement('script');
        script.src = 'js/tetra-ui/' + name + '.js';
        script.onload = callback;
        document.head.appendChild(script);
    };

    /**
     * Load all components
     * @param {Function} callback - Called when all loaded
     */
    TetraUI.loadAll = function(callback) {
        var loaded = 0;
        var components = this.components;

        components.forEach(function(name) {
            TetraUI.load(name, function() {
                loaded++;
                if (loaded === components.length && callback) {
                    callback();
                }
            });
        });
    };

})();
