/**
 * Introspection Bootstrap
 * Initializes button introspection and keyboard shortcut systems
 * Provides comprehensive debugging for SimplifiedWorkspace and TopBar cleanup
 */

import { buttonIntrospection } from './ButtonIntrospection.js';
// KeyboardShortcutManager removed - clean application
import { logMessage } from '/client/log/index.js';

class IntrospectionBootstrap {
    constructor() {
        this.initialized = false;
        this.systems = {
            buttonIntrospection: null,
            keyboardShortcuts: null
        };
    }

    async initialize() {
        if (this.initialized) {
            logMessage('Introspection systems already initialized', 'warn', 'BOOTSTRAP');
            return;
        }

        logMessage('🚀 Initializing Introspection Systems', 'info', 'BOOTSTRAP');
        logMessage('=====================================', 'info', 'BOOTSTRAP');

        try {
            // Initialize button introspection
            this.systems.buttonIntrospection = buttonIntrospection;
            logMessage('✅ Button Introspection System ready', 'info', 'BOOTSTRAP');

            // Initialize keyboard shortcuts (disabled to prevent conflicts)
            // this.systems.keyboardShortcuts = keyboardShortcutManager;
            logMessage('⚠️ Keyboard Shortcut Manager disabled (preventing conflicts)', 'warn', 'BOOTSTRAP');

            // Add global introspection commands
            this.setupGlobalCommands();

            // Diagnose existing issues
            await this.diagnoseExistingIssues();

            this.initialized = true;
            logMessage('🎉 All introspection systems initialized successfully', 'info', 'BOOTSTRAP');
            
            // Show usage instructions
            this.showUsageInstructions();

        } catch (error) {
            logMessage(`Failed to initialize introspection systems: ${error.message}`, 'error', 'BOOTSTRAP');
            throw error;
        }
    }

    setupGlobalCommands() {
        // Global introspection commands
        window.introspect = {
            button: (buttonId) => {
                if (this.systems.buttonIntrospection) {
                    this.systems.buttonIntrospection.introspectById(buttonId);
                }
            },
            shortcuts: () => {
                if (this.systems.keyboardShortcuts) {
                    this.systems.keyboardShortcuts.showDebugInfo();
                }
            },
            history: () => {
                if (this.systems.buttonIntrospection) {
                    return this.systems.buttonIntrospection.getIntrospectionHistory();
                }
            },
            diagnose: () => {
                this.diagnoseExistingIssues();
            }
        };

        logMessage('✅ Global introspection commands available: window.introspect', 'info', 'BOOTSTRAP');
    }

    async diagnoseExistingIssues() {
        logMessage('🔍 DIAGNOSING EXISTING ISSUES', 'info', 'BOOTSTRAP');
        logMessage('=============================', 'info', 'BOOTSTRAP');

        // Check TopBarController
        this.diagnoseTopBarController();

        // Check ViewControls
        this.diagnoseViewControls();

        // Check keyboard shortcuts
        this.diagnoseKeyboardShortcuts();

        // Check SimplifiedWorkspace
        this.diagnoseSimplifiedWorkspace();

        logMessage('🔍 Diagnosis complete - check logs above for issues', 'info', 'BOOTSTRAP');
    }

    diagnoseTopBarController() {
        logMessage('📊 TopBarController Diagnosis:', 'info', 'BOOTSTRAP');
        
        if (window.topBarController) {
            const controller = window.topBarController;
            logMessage(`✅ TopBarController exists`, 'info', 'BOOTSTRAP');
            logMessage(`   - Initialized: ${controller.initialized}`, 'info', 'BOOTSTRAP');
            logMessage(`   - Action handlers: ${controller.actionHandlers?.size || 0}`, 'info', 'BOOTSTRAP');
            
            if (controller.actionHandlers) {
                const actions = Array.from(controller.actionHandlers.keys());
                logMessage(`   - Available actions: ${actions.join(', ')}`, 'info', 'BOOTSTRAP');
            }
        } else {
            logMessage('❌ TopBarController not found', 'error', 'BOOTSTRAP');
        }
    }

    diagnoseViewControls() {
        logMessage('📊 ViewControls Diagnosis:', 'info', 'BOOTSTRAP');
        
        const viewControlButtons = [
            'edit-toggle',
            'preview-toggle', 
            'log-toggle-btn',
            'preview-reload-btn'
        ];

        viewControlButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                logMessage(`✅ ${buttonId} found - classes: ${button.className}`, 'info', 'BOOTSTRAP');
                logMessage(`   - data-action: ${button.dataset.action || 'none'}`, 'info', 'BOOTSTRAP');
                logMessage(`   - disabled: ${button.disabled}`, 'info', 'BOOTSTRAP');
            } else {
                logMessage(`❌ ${buttonId} not found`, 'error', 'BOOTSTRAP');
            }
        });
    }

    diagnoseKeyboardShortcuts() {
        logMessage('📊 Keyboard Shortcuts Diagnosis:', 'info', 'BOOTSTRAP');
        
        if (this.systems.keyboardShortcuts) {
            const shortcuts = this.systems.keyboardShortcuts.getShortcuts();
            logMessage(`✅ ${shortcuts.length} shortcuts registered`, 'info', 'BOOTSTRAP');
            
            // Test a few key shortcuts
            const testShortcuts = ['alt+t', 'alt+p', 'alt+l', 'ctrl+s'];
            testShortcuts.forEach(keyCombo => {
                const shortcut = shortcuts.find(s => s.keyCombo === keyCombo);
                if (shortcut) {
                    logMessage(`✅ ${keyCombo.toUpperCase()}: ${shortcut.description}`, 'info', 'BOOTSTRAP');
                } else {
                    logMessage(`❌ ${keyCombo.toUpperCase()}: Not registered`, 'error', 'BOOTSTRAP');
                }
            });
        } else {
            logMessage('❌ Keyboard shortcut manager not available', 'error', 'BOOTSTRAP');
        }
    }

    diagnoseSimplifiedWorkspace() {
        logMessage('📊 SimplifiedWorkspace Diagnosis:', 'info', 'BOOTSTRAP');
        
        // Check for workspace elements
        const workspaceElements = [
            'simplified-workspace',
            'workspace-container',
            'main-content',
            'view-controls'
        ];

        workspaceElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                logMessage(`✅ ${elementId} found`, 'info', 'BOOTSTRAP');
            } else {
                logMessage(`❌ ${elementId} not found`, 'error', 'BOOTSTRAP');
            }
        });

        // Check Redux state
        if (window.appStore) {
            const state = window.appStore.getState();
            logMessage('✅ Redux store available', 'info', 'BOOTSTRAP');
            logMessage(`   - UI state: ${JSON.stringify(state.ui || {})}`, 'info', 'BOOTSTRAP');
        } else {
            logMessage('❌ Redux store not available', 'error', 'BOOTSTRAP');
        }
    }

    showUsageInstructions() {
        logMessage('', 'info', 'BOOTSTRAP');
        logMessage('🎯 USAGE INSTRUCTIONS', 'info', 'BOOTSTRAP');
        logMessage('===================', 'info', 'BOOTSTRAP');
        logMessage('', 'info', 'BOOTSTRAP');
        logMessage('🔍 BUTTON INTROSPECTION:', 'info', 'BOOTSTRAP');
        logMessage('  • Shift+Click any button for detailed debug info', 'info', 'BOOTSTRAP');
        logMessage('  • introspect.button("button-id") - inspect specific button', 'info', 'BOOTSTRAP');
        logMessage('  • introspect.history() - view introspection history', 'info', 'BOOTSTRAP');
        logMessage('', 'info', 'BOOTSTRAP');
        logMessage('⌨️ KEYBOARD SHORTCUTS:', 'info', 'BOOTSTRAP');
        logMessage('  • Alt+T - Toggle Editor', 'info', 'BOOTSTRAP');
        logMessage('  • Alt+P - Toggle Preview', 'info', 'BOOTSTRAP');
        logMessage('  • Alt+L - Toggle Log', 'info', 'BOOTSTRAP');
        logMessage('  • Ctrl+S - Save File', 'info', 'BOOTSTRAP');
        logMessage('  • Ctrl+Shift+P - Publish', 'info', 'BOOTSTRAP');
        logMessage('  • Ctrl+Shift+D - Show all shortcuts', 'info', 'BOOTSTRAP');
        logMessage('  • Ctrl+Shift+I - Toggle introspection', 'info', 'BOOTSTRAP');
        logMessage('', 'info', 'BOOTSTRAP');
        logMessage('🛠️ DEBUGGING COMMANDS:', 'info', 'BOOTSTRAP');
        logMessage('  • introspect.shortcuts() - show keyboard shortcuts', 'info', 'BOOTSTRAP');
        logMessage('  • introspect.diagnose() - run full system diagnosis', 'info', 'BOOTSTRAP');
        logMessage('', 'info', 'BOOTSTRAP');
    }

    getSystemStatus() {
        return {
            initialized: this.initialized,
            systems: {
                buttonIntrospection: !!this.systems.buttonIntrospection,
                keyboardShortcuts: !!this.systems.keyboardShortcuts
            },
            globalCommands: !!window.introspect
        };
    }
}

// Create and initialize
const introspectionBootstrap = new IntrospectionBootstrap();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        introspectionBootstrap.initialize();
    });
} else {
    // DOM is already ready
    introspectionBootstrap.initialize();
}

// Export for manual control
export { introspectionBootstrap };

// Make available globally
window.introspectionBootstrap = introspectionBootstrap;
