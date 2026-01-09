/**
 * Console Tools Registry - IIFE Module Discovery System
 *
 * Provides a registry where IIFE-based console utilities can self-register
 * with metadata, enabling automatic discovery by the ConsoleToolsPanel.
 *
 * Load this file BEFORE any console tool IIFEs.
 *
 * Usage for tool authors:
 *   window.consoleTools.register({
 *       name: 'mytool',
 *       description: 'What this tool does',
 *       icon: '🔧',  // optional emoji
 *       toggle: () => mytool.toggle(),  // optional on/off function
 *       isEnabled: () => mytool.isOn,   // optional state getter
 *       commands: [
 *           { name: 'run', fn: () => mytool.run(), description: 'Run the tool' },
 *           { name: 'help', fn: () => mytool.help(), description: 'Show help' }
 *       ]
 *   });
 */
(function(global) {
    'use strict';

    const consoleTools = {
        _tools: {},
        _listeners: [],

        /**
         * Register a console tool
         * @param {Object} config - Tool configuration
         * @param {string} config.name - Unique tool name (used as key)
         * @param {string} config.description - Human-readable description
         * @param {string} [config.icon] - Optional emoji icon
         * @param {Function} [config.toggle] - Function to toggle tool on/off
         * @param {Function} [config.isEnabled] - Returns current enabled state
         * @param {Array} config.commands - Array of {name, fn, description}
         */
        register(config) {
            if (!config.name) {
                console.warn('[consoleTools] Registration failed: name required');
                return;
            }

            this._tools[config.name] = {
                name: config.name,
                description: config.description || '',
                icon: config.icon || '',
                toggle: config.toggle || null,
                isEnabled: config.isEnabled || (() => false),
                commands: config.commands || []
            };

            console.log(
                `%c[consoleTools]%c Registered: ${config.icon || ''} ${config.name}`,
                'color: #888',
                'color: #4CAF50'
            );

            this._notify();
        },

        /**
         * Unregister a tool
         * @param {string} name - Tool name to remove
         */
        unregister(name) {
            if (this._tools[name]) {
                delete this._tools[name];
                this._notify();
            }
        },

        /**
         * Get a specific tool by name
         * @param {string} name - Tool name
         * @returns {Object|undefined} Tool config or undefined
         */
        get(name) {
            return this._tools[name];
        },

        /**
         * List all registered tools
         * @returns {Array} Array of tool configs
         */
        list() {
            return Object.values(this._tools);
        },

        /**
         * Subscribe to registry changes
         * @param {Function} callback - Called with tool list on changes
         * @returns {Function} Unsubscribe function
         */
        onChange(callback) {
            this._listeners.push(callback);
            return () => {
                this._listeners = this._listeners.filter(fn => fn !== callback);
            };
        },

        /**
         * Notify all listeners of changes
         * @private
         */
        _notify() {
            const tools = this.list();
            this._listeners.forEach(fn => {
                try {
                    fn(tools);
                } catch (e) {
                    console.error('[consoleTools] Listener error:', e);
                }
            });
        },

        /**
         * Show help in console
         */
        help() {
            const tools = this.list();
            console.log(`%c
╔═══════════════════════════════════════════════════════╗
║  CONSOLE TOOLS REGISTRY                               ║
╠═══════════════════════════════════════════════════════╣
║  consoleTools.list()      List all registered tools   ║
║  consoleTools.get(name)   Get a specific tool         ║
║  consoleTools.help()      Show this help              ║
╚═══════════════════════════════════════════════════════╝
`, 'color: #2196F3; font-family: monospace');

            if (tools.length > 0) {
                console.log('%cRegistered Tools:', 'font-weight: bold');
                tools.forEach(tool => {
                    console.log(`  ${tool.icon || '•'} ${tool.name}: ${tool.description}`);
                    if (tool.commands.length > 0) {
                        console.log(`    Commands: ${tool.commands.map(c => c.name).join(', ')}`);
                    }
                });
            } else {
                console.log('%cNo tools registered yet.', 'color: #888');
            }
        }
    };

    // Expose globally
    global.consoleTools = consoleTools;

    // Startup message
    console.log('%c[consoleTools] Registry loaded', 'color: #888; font-size: 10px');

})(typeof window !== 'undefined' ? window : this);
