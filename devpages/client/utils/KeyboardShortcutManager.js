/**
 * Keyboard Shortcut Manager
 * Centralized keyboard shortcut handling with introspection and debugging
 */

import { logMessage } from '/client/log/index.js';

class KeyboardShortcutManager {
    constructor() {
        this.shortcuts = new Map();
        this.isEnabled = true;
        this.debugMode = false;
        this.init();
    }

    init() {
        // Remove any existing keyboard listeners to prevent duplicates
        this.cleanup();
        
        // Add main keyboard listener
        document.addEventListener('keydown', this.handleKeydown.bind(this), true);
        
        // Register default shortcuts
        this.registerDefaultShortcuts();
        
        logMessage('Keyboard Shortcut Manager initialized', 'info', 'SHORTCUTS');
    }

    cleanup() {
        // Remove existing listeners (if any)
        document.removeEventListener('keydown', this.handleKeydown.bind(this), true);
    }

    registerDefaultShortcuts() {
        // View toggles - use TopBarController if available
        this.register('Alt+t', 'toggleEdit', 'Toggle Editor Panel', () => {
            if (window.topBarController?.actionHandlers?.has('toggleEdit')) {
                window.topBarController.actionHandlers.get('toggleEdit')();
                logMessage('Editor visibility toggled via Alt+T', 'info', 'SHORTCUTS');
            } else {
                logMessage('Editor toggle handler not available', 'warn', 'SHORTCUTS');
            }
        });

        this.register('Alt+p', 'togglePreview', 'Toggle Preview Panel', () => {
            if (window.topBarController?.actionHandlers?.has('togglePreview')) {
                window.topBarController.actionHandlers.get('togglePreview')();
                logMessage('Preview visibility toggled via Alt+P', 'info', 'SHORTCUTS');
            } else {
                logMessage('Preview toggle handler not available', 'warn', 'SHORTCUTS');
            }
        });

        this.register('Alt+l', 'toggleLog', 'Toggle Log Panel', () => {
            if (window.topBarController?.actionHandlers?.has('toggleLogVisibility')) {
                window.topBarController.actionHandlers.get('toggleLogVisibility')();
                logMessage('Log visibility toggled via Alt+L', 'info', 'SHORTCUTS');
            } else {
                logMessage('Log toggle handler not available', 'warn', 'SHORTCUTS');
            }
        });

        // File operations
        this.register('Ctrl+s', 'saveFile', 'Save Current File', (event) => {
            if (window.topBarController?.actionHandlers?.has('saveFile')) {
                window.topBarController.actionHandlers.get('saveFile')(event);
                logMessage('File save triggered via Ctrl+S', 'info', 'SHORTCUTS');
            } else {
                logMessage('Save handler not available', 'warn', 'SHORTCUTS');
            }
        });

        // Publish
        this.register('Ctrl+Shift+p', 'publish', 'Open Publish Modal', () => {
            if (window.openPublishModal) {
                window.openPublishModal();
                logMessage('Publish modal opened via Ctrl+Shift+P', 'info', 'SHORTCUTS');
            } else {
                logMessage('Publish modal not available', 'warn', 'SHORTCUTS');
            }
        });

        // Refresh
        this.register('Ctrl+r', 'refresh', 'Refresh Preview', (event) => {
            if (window.topBarController?.actionHandlers?.has('refreshPreview')) {
                window.topBarController.actionHandlers.get('refreshPreview')();
                logMessage('Preview refreshed via Ctrl+R', 'info', 'SHORTCUTS');
            } else {
                logMessage('Refresh handler not available', 'warn', 'SHORTCUTS');
            }
        });

        // Debug shortcuts
        this.register('Ctrl+Shift+d', 'debugShortcuts', 'Show Debug Panel', () => {
            this.handleDebugPanel();
        });

        this.register('Ctrl+Shift+s', 'settingsPanel', 'Show Settings Panel', () => {
            this.handleSettingsPanel();
        });

        this.register('Ctrl+Shift+i', 'toggleIntrospection', 'Toggle Button Introspection', () => {
            if (window.buttonIntrospection) {
                if (window.buttonIntrospection.isEnabled) {
                    window.buttonIntrospection.disable();
                } else {
                    window.buttonIntrospection.enable();
                }
            }
        });

        logMessage(`Registered ${this.shortcuts.size} keyboard shortcuts`, 'info', 'SHORTCUTS');
    }

    register(keyCombo, actionId, description, handler) {
        const shortcut = {
            keyCombo: keyCombo.toLowerCase(),
            actionId,
            description,
            handler,
            registered: new Date().toISOString()
        };

        this.shortcuts.set(keyCombo.toLowerCase(), shortcut);
        
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

        // Build key combination string
        const keyCombo = this.buildKeyCombo(event);
        
        if (this.debugMode) {
            logMessage(`Key pressed: ${keyCombo}`, 'debug', 'SHORTCUTS');
        }

        // Check if we have a handler for this combination
        const shortcut = this.shortcuts.get(keyCombo);
        if (shortcut) {
            event.preventDefault();
            event.stopPropagation();
            
            try {
                logMessage(`Executing shortcut: ${keyCombo} (${shortcut.description})`, 'info', 'SHORTCUTS');
                shortcut.handler(event);
                
                // Log introspection info if available
                if (window.buttonIntrospection) {
                    logMessage(`Shortcut executed: ${shortcut.actionId} - ${shortcut.description}`, 'info', 'INTROSPECTION');
                }
            } catch (error) {
                logMessage(`Error executing shortcut ${keyCombo}: ${error.message}`, 'error', 'SHORTCUTS');
            }
        }
    }

    buildKeyCombo(event) {
        const parts = [];
        
        if (event.ctrlKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        if (event.metaKey) parts.push('meta');
        
        // Add the main key
        let key = event.key.toLowerCase();
        
        // Handle special keys
        if (key === ' ') key = 'space';
        if (key === 'escape') key = 'esc';
        if (key === 'enter') key = 'enter';
        
        parts.push(key);
        
        return parts.join('+');
    }

    showDebugInfo() {
        logMessage('🎹 KEYBOARD SHORTCUTS DEBUG', 'info', 'SHORTCUTS');
        logMessage('============================', 'info', 'SHORTCUTS');
        logMessage(`Enabled: ${this.isEnabled}`, 'info', 'SHORTCUTS');
        logMessage(`Debug Mode: ${this.debugMode}`, 'info', 'SHORTCUTS');
        logMessage(`Total Shortcuts: ${this.shortcuts.size}`, 'info', 'SHORTCUTS');
        logMessage('', 'info', 'SHORTCUTS');
        
        logMessage('📋 REGISTERED SHORTCUTS:', 'info', 'SHORTCUTS');
        this.shortcuts.forEach((shortcut, keyCombo) => {
            logMessage(`${keyCombo.toUpperCase()} -> ${shortcut.description} (${shortcut.actionId})`, 'info', 'SHORTCUTS');
        });
        
        logMessage('', 'info', 'SHORTCUTS');
        logMessage('💡 TIP: Use Ctrl+Shift+I to toggle button introspection', 'info', 'SHORTCUTS');
        logMessage('💡 TIP: Shift+Click any button for detailed debug info', 'info', 'SHORTCUTS');
    }

    handleDebugPanel() {
        logMessage('Debug panel shortcut triggered (Ctrl+Shift+D)', 'info', 'SHORTCUTS');
        
        // Try auto-clean-panels loader first
        if (window.autoCleanPanelsLoader) {
            const panelInfo = window.autoCleanPanelsLoader.panels.find(p => p.shortcut === 'ctrl+shift+d');
            if (panelInfo) {
                const panelElement = panelInfo.panel.element;
                if (panelElement) {
                    const isVisible = panelElement.style.display !== 'none';
                    panelElement.style.display = isVisible ? 'none' : 'block';
                    logMessage(`Debug panel ${isVisible ? 'hidden' : 'shown'}`, 'info', 'SHORTCUTS');
                    return;
                }
            }
        }
        
        // Try workspace manager
        if (window.APP?.workspace?.simplified?.manager) {
            const workspace = window.APP.workspace.simplified.manager;
            if (workspace.togglePanel) {
                workspace.togglePanel('debug-panel');
                return;
            }
        }
        
        // Try modern panel integration
        if (window.modernPanelIntegration) {
            window.modernPanelIntegration.togglePanel('modern-debug');
            return;
        }
        
        // Fallback: Show debug info
        this.showDebugInfo();
        logMessage('Debug panel not found, showing keyboard shortcuts debug instead', 'warn', 'SHORTCUTS');
    }

    handleSettingsPanel() {
        logMessage('Settings panel shortcut triggered (Ctrl+Shift+S)', 'info', 'SHORTCUTS');
        
        // Try auto-clean-panels loader first
        if (window.autoCleanPanelsLoader) {
            const panelInfo = window.autoCleanPanelsLoader.panels.find(p => p.shortcut === 'ctrl+shift+s');
            if (panelInfo) {
                const panelElement = panelInfo.panel.element;
                if (panelElement) {
                    const isVisible = panelElement.style.display !== 'none';
                    panelElement.style.display = isVisible ? 'none' : 'block';
                    logMessage(`Settings panel ${isVisible ? 'hidden' : 'shown'}`, 'info', 'SHORTCUTS');
                    return;
                }
            }
        }
        
        // Try workspace manager
        if (window.APP?.workspace?.simplified?.manager) {
            const workspace = window.APP.workspace.simplified.manager;
            if (workspace.togglePanel) {
                workspace.togglePanel('settings-panel');
                return;
            }
        }
        
        // Try modern panel integration
        if (window.modernPanelIntegration) {
            window.modernPanelIntegration.togglePanel('modern-settings');
            return;
        }
        
        // Try direct settings access
        if (window.openSettingsModal) {
            window.openSettingsModal();
            return;
        }
        
        logMessage('Settings panel not found - no available settings interface', 'warn', 'SHORTCUTS');
    }

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
        return Array.from(this.shortcuts.entries()).map(([keyCombo, shortcut]) => ({
            keyCombo,
            ...shortcut
        }));
    }
}

// Create global instance
const keyboardShortcutManager = new KeyboardShortcutManager();

// Export for use in other modules
export { keyboardShortcutManager };

// Make available globally for console access
window.keyboardShortcutManager = keyboardShortcutManager;

logMessage('🎹 Keyboard Shortcut Manager loaded', 'info', 'SHORTCUTS');
