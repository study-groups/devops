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

        // Expose the debug interface so it's available immediately
        this.exposeDebugInterface();
        
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
        let key = event.key ? event.key.toLowerCase() : '';
        
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
        logMessage('🔧 TIP: Type APP.debug.help() in console for system commands', 'info', 'SHORTCUTS');
    }

    // System-wide debug interface
    exposeDebugInterface() {
        // Ensure APP object exists
        if (!window.APP) window.APP = {};
        
        if (!window.APP.debug) {
            window.APP.debug = {
                help: () => {
                    console.log(`
🔧 DEBUG SYSTEM COMMANDS:
=========================
APP.debug.shortcuts()     - Show all keyboard shortcuts
APP.debug.buttons()        - List all buttons with actions  
APP.debug.redux()          - Show Redux store state
APP.debug.panels()         - Show panel system status
APP.debug.css()            - Analyze CSS loading issues
APP.debug.health()         - System health check
APP.debug.export()         - Export debug data

🎹 KEYBOARD SHORTCUTS:
=====================
Ctrl+Shift+D          - Debug panel
Ctrl+Shift+S          - Settings panel
Ctrl+Shift+I          - Toggle button introspection
Shift+Click           - Inspect any button
                    `);
                },

                shortcuts: () => {
                    if (window.keyboardShortcutManager) {
                        window.keyboardShortcutManager.showDebugInfo();
                    } else {
                        console.log('❌ KeyboardShortcutManager not available');
                    }
                },

                buttons: () => {
                    const buttons = document.querySelectorAll('button, .btn, [role="button"]');
                    console.log(`🔍 Found ${buttons.length} buttons:`);
                    buttons.forEach((btn, i) => {
                        const id = btn.id || `button-${i}`;
                        const action = btn.dataset.action || 'no-action';
                        const text = btn.textContent?.trim() || 'no-text';
                        console.log(`  ${i + 1}. #${id} | ${action} | "${text}"`);
                    });
                },

                redux: () => {
                    const state = window.keyboardShortcutManager?.getReduxState?.() || 
                                 (window.APP?.store?.getState ? window.APP.store.getState() : null);
                    if (state) {
                        console.log('🏪 Redux State Keys:', Object.keys(state));
                        console.log('📊 Full State:', state);
                    } else {
                        console.log('❌ Redux store not available');
                    }
                },

                panels: () => {
                    console.log('🗂️ Panel Systems Status:');
                    
                    // Use new DebugDock API for panel information
                    if (window.APP?.debugDock) {
                        const debugPanels = window.APP.debugDock.getPanels();
                        console.log('  Debug Panels:', debugPanels);
                    }

                    console.log('  Simplified Workspace:', !!window.APP?.workspace?.simplified);
                    console.log('  Button Introspection:', !!window.buttonIntrospection);
                },

                css: () => {
                    console.log('🎨 CSS LOADING ANALYSIS:');
                    console.log('========================');
                    
                    // Get all stylesheet links
                    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
                    const preloads = Array.from(document.querySelectorAll('link[rel="preload"][as="style"]'));
                    
                    console.log(`📊 Total Stylesheets: ${stylesheets.length}`);
                    console.log(`📊 Total Preloads: ${preloads.length}`);
                    
                    // Categorize stylesheets
                    const bundles = stylesheets.filter(link => link.href.includes('bundle.css'));
                    const individual = stylesheets.filter(link => !link.href.includes('bundle.css'));
                    
                    console.log('\n🎯 BUNDLES:');
                    bundles.forEach(link => {
                        const name = link.href.split('/').pop();
                        const loaded = link.sheet ? '✅' : '❌';
                        console.log(`  ${loaded} ${name}`);
                    });
                    
                    console.log('\n📄 INDIVIDUAL FILES:');
                    individual.forEach(link => {
                        const name = link.href.split('/').pop();
                        const loaded = link.sheet ? '✅' : '❌';
                        const bundled = this.isFileBundled(name);
                        const warning = bundled ? ' ⚠️ DUPLICATE (also in bundle)' : '';
                        console.log(`  ${loaded} ${name}${warning}`);
                    });
                    
                    console.log('\n🔍 PRELOADS:');
                    preloads.forEach(link => {
                        const name = link.href.split('/').pop();
                        const used = stylesheets.some(s => s.href === link.href);
                        const status = used ? '✅ USED' : '❌ UNUSED';
                        console.log(`  ${status} ${name}`);
                    });
                    
                    // Check for potential issues
                    const issues = [];
                    if (individual.some(link => this.isFileBundled(link.href.split('/').pop()))) {
                        issues.push('Duplicate loading detected (files loaded both individually and in bundles)');
                    }
                    if (preloads.some(link => !stylesheets.some(s => s.href === link.href))) {
                        issues.push('Unused preloads detected');
                    }
                    
                    if (issues.length > 0) {
                        console.log('\n⚠️ ISSUES FOUND:');
                        issues.forEach(issue => console.log(`  • ${issue}`));
                    } else {
                        console.log('\n✅ No CSS loading issues detected');
                    }
                },

                health: () => {
                    console.log('🏥 System Health Check:');
                    const checks = {
                        'Keyboard Shortcuts': !!window.keyboardShortcutManager,
                        'Button Introspection': !!window.buttonIntrospection,
                        'Redux Store': !!(window.APP?.store?.getState),
                        'Debug Dock': !!window.APP?.debugDock,
                        'Log System': !!window.APP?.services?.log
                    };
                    
                    Object.entries(checks).forEach(([system, healthy]) => {
                        console.log(`  ${healthy ? '✅' : '❌'} ${system}`);
                    });
                },

                export: () => {
                    const debugData = {
                        timestamp: new Date().toISOString(),
                        shortcuts: window.keyboardShortcutManager?.getShortcuts() || [],
                        buttonsCount: document.querySelectorAll('button').length,
                        systemHealth: {
                            keyboardShortcuts: !!window.keyboardShortcutManager,
                            buttonIntrospection: !!window.buttonIntrospection,
                            reduxStore: !!(window.APP?.store?.getState),
                            debugDock: !!window.APP?.debugDock
                        }
                    };
                    
                    console.log('📤 Debug Data Export:', debugData);
                    return debugData;
                }
            };
            
            console.log('🔧 Debug interface available! Type APP.debug.help() for commands');
        }
    }

    // Helper method for CSS analysis
    isFileBundled(filename) {
        // Files that are included in bundles
        const bundledFiles = [
            'design-system.css', 'typography.css', 'components-base.css', 
            'utilities.css', 'icons.css', 'ui-system.css',  // core bundle
            'workspace-layout.css', 'topBar.css', 'auth-display.css',  // layout bundle
            'log.css', 'file-browser.css', 'dom-inspector-core.css', 
            'context-manager.css', 'splash-screen.css', 'viewControls.css',  // features bundle
            'settings.css', 'BasePanel.css', 'EditorPanel.css', 'PreviewPanel.css',
            'JavaScriptPanel.css', 'HtmlPanel.css', 'scrollbars.css', 'subpanel.css'  // panels bundle
        ];
        
        return bundledFiles.some(bundled => filename.includes(bundled));
    }

    handleDebugPanel() {
        logMessage('Debug panel shortcut triggered (Ctrl+Shift+D)', 'info', 'SHORTCUTS');
        
        // Fallback debug methods
        const debugMethods = [
            () => {
                // Try to open debug dock directly
                if (window.APP?.debugDock) {
                    logMessage('Attempting to open debug dock directly', 'debug', 'SHORTCUTS');
                    window.APP.debugDock.toggle();
                    return true;
                }
                return false;
            },
            () => {
                // Try workspace manager toggle
                if (window.APP?.workspace?.simplified?.manager) {
                    logMessage('Attempting to toggle debug panel via workspace manager', 'debug', 'SHORTCUTS');
                    window.APP.workspace.simplified.manager.togglePanel('debug-panel');
                    return true;
                }
                return false;
            },
            () => {
                // Fallback: show debug info
                logMessage('Falling back to debug info display', 'warn', 'SHORTCUTS');
                this.showDebugInfo();
                return true;
            }
        ];

        // Try each debug method until one succeeds
        for (const method of debugMethods) {
            if (method()) {
                return;
            }
        }

        // If all methods fail
        logMessage('Debug panel not found, no fallback methods worked', 'error', 'SHORTCUTS');
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

// Create global instance but don't auto-initialize
const keyboardShortcutManager = new KeyboardShortcutManager();

// Export for use in other modules
export { keyboardShortcutManager };

// Make available globally for console access (but don't initialize)
window.keyboardShortcutManager = keyboardShortcutManager;

logMessage('🎹 Keyboard Shortcut Manager loaded (not initialized)', 'info', 'SHORTCUTS');
