/**
 * Clean Keyboard Shortcut Manager
 * ONLY handles keyboard shortcuts - nothing else!
 */

// Use the unified logging system
let log;

function getLogger() {
    if (!log && window.APP?.services?.log) {
        log = window.APP.services.log.createLogger('UI', 'KeyboardShortcuts');
    }
    return log || {
        info: (action, msg) => console.log(`[UI][KeyboardShortcuts][${action}] ${msg}`),
        warn: (action, msg) => console.warn(`[UI][KeyboardShortcuts][${action}] ${msg}`),
        debug: (action, msg) => console.debug(`[UI][KeyboardShortcuts][${action}] ${msg}`),
        error: (action, msg) => console.error(`[UI][KeyboardShortcuts][${action}] ${msg}`)
    };
}

class KeyboardShortcutManager {
    constructor() {
        this.shortcuts = new Map();
        this.isEnabled = true;
        this.debugMode = false;
        this.boundHandler = this.handleKeydown.bind(this);
        this.init();
    }

    init() {
        // Clean up any existing listeners
        this.cleanup();
        
        // Add keyboard listener
        document.addEventListener('keydown', this.boundHandler, true);
        
        // Register default shortcuts
        this.registerDefaultShortcuts();
        
        getLogger().info('INIT_COMPLETE', 'Keyboard Shortcut Manager initialized');
    }

    cleanup() {
        document.removeEventListener('keydown', this.boundHandler, true);
    }

    register(keyCombo, actionId, description, handler) {
        const normalizedCombo = keyCombo.toLowerCase();
        this.shortcuts.set(normalizedCombo, {
            keyCombo: normalizedCombo,
            actionId,
            description,
            handler
        });

        if (this.debugMode) {
            getLogger().debug('REGISTER_SHORTCUT', `${keyCombo} -> ${description}`);
        }
    }

    unregister(keyCombo) {
        const removed = this.shortcuts.delete(keyCombo.toLowerCase());
        if (removed) {
            getLogger().info('UNREGISTER_SHORTCUT', `Shortcut ${keyCombo}`);
        }
        return removed;
    }

    handleKeydown(event) {
        if (!this.isEnabled) return;

        const keyCombo = this.buildKeyCombo(event);
        
        if (this.debugMode) {
            getLogger().debug('KEY_PRESSED', `${keyCombo}`);
        }

        const shortcut = this.shortcuts.get(keyCombo);
        if (shortcut) {
            event.preventDefault();
            event.stopPropagation();
            
            try {
                shortcut.handler();
                if (this.debugMode) {
                    getLogger().info('EXECUTE_SHORTCUT', `${shortcut.actionId} - ${shortcut.description}`);
                }
            } catch (error) {
                getLogger().error('SHORTCUT_ERROR', `Shortcut ${keyCombo}: ${error.message}`);
            }
        }
    }

    buildKeyCombo(event) {
        const parts = [];

        if (event.ctrlKey || event.metaKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');

        // Add the main key (not modifier keys)
        if (event.key) {
            const key = event.key.toLowerCase();
            if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
                parts.push(key);
            }
        }

        return parts.join('+');
    }

    registerDefaultShortcuts() {
        // Editor toggle
        this.register('alt+t', 'toggleEdit', 'Toggle Editor Panel', () => {
            if (window.topBarController?.actionHandlers?.has('toggleEdit')) {
                window.topBarController.actionHandlers.get('toggleEdit')();
            } else {
                getLogger().warn('HANDLER_MISSING', 'Editor toggle handler not available');
            }
        });

        // Preview toggle
        this.register('alt+p', 'togglePreview', 'Toggle Preview Panel', () => {
            if (window.topBarController?.actionHandlers?.has('togglePreview')) {
                window.topBarController.actionHandlers.get('togglePreview')();
            } else {
                getLogger().warn('HANDLER_MISSING', 'Preview toggle handler not available');
            }
        });

        // Log toggle
        this.register('alt+l', 'toggleLog', 'Toggle Log Panel', () => {
            if (window.topBarController?.actionHandlers?.has('toggleLogVisibility')) {
                window.topBarController.actionHandlers.get('toggleLogVisibility')();
            } else {
                getLogger().warn('HANDLER_MISSING', 'Log toggle handler not available');
            }
        });

        // Save
        this.register('ctrl+s', 'save', 'Save Current File', () => {
            if (window.topBarController?.actionHandlers?.has('saveFile')) {
                window.topBarController.actionHandlers.get('saveFile')();
            } else {
                getLogger().warn('HANDLER_MISSING', 'Save handler not available');
            }
        });

        // New file
        this.register('ctrl+n', 'newFile', 'New File', () => {
            import('../components/trays/index.js').then(({ topBarTray }) => {
                topBarTray.toggle('new-file');
            }).catch((error) => {
                getLogger().warn('HANDLER_MISSING', `New file tray not available: ${error.message}`);
            });
        });

        // Publish
        this.register('ctrl+shift+p', 'publish', 'Open Publish Tray', () => {
            import('../components/trays/index.js').then(({ topBarTray }) => {
                topBarTray.toggle('publish');
            }).catch((error) => {
                getLogger().warn('HANDLER_MISSING', `Publish tray not available: ${error.message}`);
            });
        });

        // Refresh
        this.register('f5', 'refresh', 'Refresh Current View', () => {
            if (window.topBarController?.actionHandlers?.has('refreshPreview')) {
                window.topBarController.actionHandlers.get('refreshPreview')();
            } else {
                getLogger().warn('HANDLER_MISSING', 'Refresh handler not available');
            }
        });

        // Debug panel
        this.register('ctrl+shift+d', 'debugPanel', 'Toggle Debug Panel', () => {
            this.handleDebugPanel();
        });

        // Settings panel
        this.register('ctrl+shift+s', 'settingsPanel', 'Toggle Settings Panel', () => {
            this.handleSettingsPanel();
        });

        // Help
        this.register('ctrl+shift+h', 'help', 'Show Keyboard Shortcuts', () => {
            this.showHelp();
        });

        getLogger().info('SHORTCUTS_READY', `Registered ${this.shortcuts.size} keyboard shortcuts`);
    }

    handleDebugPanel() {
        // Try different debug panel methods
        if (window.APP?.debugDock?.toggle) {
            window.APP.debugDock.toggle();
        } else if (window.APP?.workspace?.simplified?.manager?.togglePanel) {
            window.APP.workspace.simplified.manager.togglePanel('debug-panel');
        } else {
            getLogger().warn('PANEL_MISSING', 'Debug panel not found');
        }
    }

    handleSettingsPanel() {
        // Try different settings panel methods
        if (window.APP?.workspace?.togglePanel) {
            window.APP.workspace.togglePanel('app-settings');
        } else if (window.APP?.workspace?.simplified?.manager?.togglePanel) {
            window.APP.workspace.simplified.manager.togglePanel('app-settings');
        } else if (window.modernPanelIntegration?.togglePanel) {
            window.modernPanelIntegration.togglePanel('app-settings');
        } else {
            getLogger().warn('PANEL_MISSING', 'Settings panel not found');
        }
    }

    showHelp() {
        console.group('🎹 Keyboard Shortcuts');
        for (const [combo, shortcut] of this.shortcuts.entries()) {
            console.log(`${combo.toUpperCase()}: ${shortcut.description}`);
        }
        console.groupEnd();
    }

    // Simple API methods
    enable() {
        this.isEnabled = true;
        getLogger().info('SHORTCUTS_ENABLED', 'Keyboard shortcuts enabled');
    }

    disable() {
        this.isEnabled = false;
        getLogger().info('SHORTCUTS_DISABLED', 'Keyboard shortcuts disabled');
    }

    enableDebugMode() {
        this.debugMode = true;
        getLogger().info('DEBUG_ENABLED', 'Debug mode enabled');
    }

    disableDebugMode() {
        this.debugMode = false;
        getLogger().info('DEBUG_DISABLED', 'Debug mode disabled');
    }

    getShortcuts() {
        return Array.from(this.shortcuts.values()).map(shortcut => ({
            keyCombo: shortcut.keyCombo,
            actionId: shortcut.actionId,
            description: shortcut.description
        }));
    }
}

// Create global instance
const keyboardShortcutManager = new KeyboardShortcutManager();

// Expose globally for debugging
if (typeof window !== 'undefined') {
    window.keyboardShortcutManager = keyboardShortcutManager;
    
    // Simple debug interface
    window.APP = window.APP || {};
    window.APP.debug = window.APP.debug || {};
    
    window.APP.debug.shortcuts = {
        list: () => keyboardShortcutManager.showHelp(),
        enable: () => keyboardShortcutManager.enable(),
        disable: () => keyboardShortcutManager.disable(),
        debug: (enabled) => enabled ? keyboardShortcutManager.enableDebugMode() : keyboardShortcutManager.disableDebugMode()
    };
}

export default keyboardShortcutManager;

// Factory function for component system integration
export function initializeKeyboardShortcuts() {
    return keyboardShortcutManager;
}
