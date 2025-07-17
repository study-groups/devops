/**
 * StateKit DevTools Integration for DevPages
 * Provides easy access to DevTools functionality in the browser console
 */

import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';

// Check if DevTools are available
let devTools = null;
let consolePanel = null;

// Try to get DevTools from window (if middleware is loaded)
if (typeof window !== 'undefined' && window.__STATEKIT_DEVTOOLS__) {
    devTools = window.__STATEKIT_DEVTOOLS__;
    consolePanel = window.__STATEKIT_PANEL__;
}

/**
 * Initialize DevTools for the app
 * This should be called after the store is created
 */
export function initDevTools() {
    if (!devTools) {
        logMessage('DevTools middleware not found. Add createDevTools() to your middleware array.', 'warn', 'DEVTOOLS');
        return;
    }

    logMessage('DevTools initialized', 'info', 'DEVTOOLS');
    
    // Expose useful functions to window for easy debugging
    window.devTools = {
        // Basic DevTools access
        getHistory: () => devTools.getActionHistory(),
        getMetrics: () => devTools.getPerformanceMetrics(),
        timeTravel: (index) => devTools.timeTravel(index),
        replayAction: (index) => devTools.replayAction(index),
        clearHistory: () => devTools.clearHistory(),
        
        // Quick state inspection
        getState: () => appStore.getState(),
        getStateSlice: (sliceName) => {
            const state = appStore.getState();
            return state[sliceName];
        },
        
        // Action helpers
        dispatch: (action) => appStore.dispatch(action),
        
        // Console panel shortcuts
        showHistory: () => {
            if (consolePanel) {
                consolePanel.showHistory();
            } else {
                console.log('Console panel not available');
            }
        },
        showPerformance: () => {
            if (consolePanel) {
                consolePanel.showPerformance();
            } else {
                console.log('Console panel not available');
            }
        }
    };

    // Add keyboard shortcut for DevTools (Ctrl+Shift+T)
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'T') {
            event.preventDefault();
            console.log('🔧 DevTools Keyboard Shortcuts:');
            console.log('  devTools.getHistory() - Show action history');
            console.log('  devTools.getMetrics() - Show performance metrics');
            console.log('  devTools.timeTravel(index) - Time travel to action');
            console.log('  devTools.replayAction(index) - Replay an action');
            console.log('  devTools.getState() - Get current state');
            console.log('  devTools.getStateSlice("auth") - Get specific slice');
            console.log('  devTools.showHistory() - Show history in console');
            console.log('  devTools.showPerformance() - Show metrics in console');
        }
    });

    logMessage('DevTools keyboard shortcuts: Ctrl+Shift+T', 'info', 'DEVTOOLS');
}

/**
 * Create a simple DevTools UI panel
 * @param {HTMLElement} container - Container element for the UI
 */
export function createDevToolsUI(container) {
    if (!devTools) {
        logMessage('DevTools not available for UI creation', 'warn', 'DEVTOOLS');
        return;
    }

    // Import the UI creator dynamically
    import('/node_modules/devpages/dist/devtools.esm.js').then(module => {
        const { createDevToolsUI } = module;
        const ui = createDevToolsUI(devTools, container);
        
        // Expose UI to window
        window.devToolsUI = ui;
        
        logMessage('DevTools UI created', 'info', 'DEVTOOLS');
    }).catch(error => {
        logMessage('Failed to create DevTools UI: ' + error.message, 'error', 'DEVTOOLS');
    });
}

/**
 * Enhanced logging middleware that integrates with DevTools
 */
export function createEnhancedLogger(options = {}) {
    return ({ getState }) => next => action => {
        const startTime = Date.now();
        const prevState = getState();
        
        // Log the action
        logMessage(`Action: ${action.type}`, 'debug', 'DEVTOOLS', action);
        
        const result = next(action);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        const nextState = getState();
        
        // Log performance if action took significant time
        if (duration > 10) {
            logMessage(`Slow action: ${action.type} took ${duration}ms`, 'warn', 'DEVTOOLS');
        }
        
        // Log state changes
        if (prevState !== nextState) {
            logMessage(`State updated after: ${action.type}`, 'debug', 'DEVTOOLS', {
                action: action.type,
                duration: duration,
                stateKeys: Object.keys(nextState)
            });
        }
        
        return result;
    };
}

// Auto-initialize if DevTools are available
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDevTools);
    } else {
        initDevTools();
    }
} 