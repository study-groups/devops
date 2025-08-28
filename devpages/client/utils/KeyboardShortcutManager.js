/**
 * Clean Keyboard Shortcut Manager
 * ONLY handles keyboard shortcuts - nothing else!
 */

import { logMessage } from '../log/index.js';

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
        
        logMessage('Keyboard Shortcut Manager initialized', 'info', 'SHORTCUTS');
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
            logMessage(`Registered shortcut: ${keyCombo} -> ${description}`, 'debug', 'SHORTCUTS');
        }
    }

    unregister(keyCombo) {
        const removed = this.shortcuts.delete(keyCombo.toLowerCase());
        if (removed) {
            logMessage(`Unregistered shortcut: ${keyCombo}`, 'info', 'SHORTCUTS');
        }
        return removed;
    }

    handleKeydown(event) {
        if (!this.isEnabled) return;

        const keyCombo = this.buildKeyCombo(event);
        
        if (this.debugMode) {
            logMessage(`Key pressed: ${keyCombo}`, 'debug', 'SHORTCUTS');
        }

        const shortcut = this.shortcuts.get(keyCombo);
        if (shortcut) {
            event.preventDefault();
            event.stopPropagation();
            
            try {
                shortcut.handler();
                if (this.debugMode) {
                    logMessage(`Executed shortcut: ${shortcut.actionId} - ${shortcut.description}`, 'info', 'SHORTCUTS');
                }
            } catch (error) {
                logMessage(`Error executing shortcut ${keyCombo}: ${error.message}`, 'error', 'SHORTCUTS');
            }
        }
    }

    buildKeyCombo(event) {
        const parts = [];
        
        if (event.ctrlKey || event.metaKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        
        // Add the main key (not modifier keys)
        const key = event.key.toLowerCase();
        if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
            parts.push(key);
        }
        
        return parts.join('+');
    }

    registerDefaultShortcuts() {
        // Editor toggle
        this.register('alt+t', 'toggleEdit', 'Toggle Editor Panel', () => {
            if (window.topBarController?.actionHandlers?.has('toggleEdit')) {
                window.topBarController.actionHandlers.get('toggleEdit')();
            } else {
                logMessage('Editor toggle handler not available', 'warn', 'SHORTCUTS');
            }
        });

        // Preview toggle
        this.register('alt+p', 'togglePreview', 'Toggle Preview Panel', () => {
            if (window.topBarController?.actionHandlers?.has('togglePreview')) {
                window.topBarController.actionHandlers.get('togglePreview')();
            } else {
                logMessage('Preview toggle handler not available', 'warn', 'SHORTCUTS');
            }
        });

        // Log toggle
        this.register('alt+l', 'toggleLog', 'Toggle Log Panel', () => {
            if (window.topBarController?.actionHandlers?.has('toggleLog')) {
                window.topBarController.actionHandlers.get('toggleLog')();
            } else {
                logMessage('Log toggle handler not available', 'warn', 'SHORTCUTS');
            }
        });

        // Save
        this.register('ctrl+s', 'save', 'Save Current File', () => {
            if (window.topBarController?.actionHandlers?.has('save')) {
                window.topBarController.actionHandlers.get('save')();
            } else {
                logMessage('Save handler not available', 'warn', 'SHORTCUTS');
            }
        });

        // Publish
        this.register('ctrl+shift+p', 'publish', 'Open Publish Modal', () => {
            if (window.topBarController?.actionHandlers?.has('publish')) {
                window.topBarController.actionHandlers.get('publish')();
            } else {
                logMessage('Publish modal not available', 'warn', 'SHORTCUTS');
            }
        });

        // Refresh
        this.register('f5', 'refresh', 'Refresh Current View', () => {
            if (window.topBarController?.actionHandlers?.has('refresh')) {
                window.topBarController.actionHandlers.get('refresh')();
            } else {
                logMessage('Refresh handler not available', 'warn', 'SHORTCUTS');
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

        logMessage(`Registered ${this.shortcuts.size} keyboard shortcuts`, 'info', 'SHORTCUTS');
    }

    handleDebugPanel() {
        // Try different debug panel methods
        if (window.APP?.debugDock?.toggle) {
            window.APP.debugDock.toggle();
        } else if (window.APP?.workspace?.simplified?.manager?.togglePanel) {
            window.APP.workspace.simplified.manager.togglePanel('debug-panel');
        } else {
            logMessage('Debug panel not found', 'warn', 'SHORTCUTS');
        }
    }

    handleSettingsPanel() {
        // Try different settings panel methods
        if (window.APP?.workspace?.togglePanel) {
            window.APP.workspace.togglePanel('settings-panel');
        } else if (window.modernPanelIntegration?.togglePanel) {
            window.modernPanelIntegration.togglePanel('modern-settings');
        } else if (window.openSettingsModal) {
            window.openSettingsModal();
        } else {
            logMessage('Settings panel not found', 'warn', 'SHORTCUTS');
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
        logMessage('Keyboard shortcuts enabled', 'info', 'SHORTCUTS');
    }

    disable() {
        this.isEnabled = false;
        logMessage('Keyboard shortcuts disabled', 'info', 'SHORTCUTS');
    }

    enableDebugMode() {
        this.debugMode = true;
        logMessage('Keyboard shortcuts debug mode enabled', 'info', 'SHORTCUTS');
    }

    disableDebugMode() {
        this.debugMode = false;
        logMessage('Keyboard shortcuts debug mode disabled', 'info', 'SHORTCUTS');
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
