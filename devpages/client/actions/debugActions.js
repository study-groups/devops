/**
 * Debug action handlers
 * Responsible for debugging and development operations
 */
import { appStore } from '/client/appState.js';

// Helper for logging within this module
function logAction(message, level = 'debug') {
    const type = 'ACTION'
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

export const debugActionHandlers = {
    /**
     * Runs a comprehensive diagnostic on the UI
     */
    runDebugUI: async () => {
        logAction('Triggering runAllDiagnostics...');
        try {
            await window.dev?.runAllDiagnostics?.(); 
        } catch (e) { 
            logAction(`runAllDiagnostics failed: ${e.message}`, 'error'); 
        }
    },

    /**
     * Shows application information
     */
    showAppInfo: async () => {
        logAction('Triggering showAppInfo...');
        try {
            window.dev?.showAppInfo?.();
        } catch (e) { 
            logAction(`showAppInfo failed: ${e.message}`, 'error'); 
        }
    },

    /**
     * Debug all API endpoints
     */
    debugAllApiEndpoints: async () => {
        logAction('Triggering debugAllApiEndpoints...');
        try {
            await window.dev?.debugAllApiEndpoints?.(); 
        } catch (e) { 
            logAction(`debugAllApiEndpoints failed: ${e.message}`, 'error'); 
        }
    },

    /**
     * Debug URL parameters
     */
    debugUrlParameters: async () => {
        logAction('Triggering debugUrlParameters...');
        try {
            window.dev?.debugUrlParameters?.(); 
        } catch (e) { 
            logAction(`debugUrlParameters failed: ${e.message}`, 'error'); 
        }
    },

    /**
     * Debug file list
     */
    debugFileList: async () => {
        logAction('Triggering debugFileList...');
        try {
            window.dev?.debugFileList?.(); 
        } catch (e) { 
            logAction(`debugFileList failed: ${e.message}`, 'error'); 
        }
    },

    /**
     * Debug authentication state
     */
    debugAuthState: async () => {
        logAction('Debugging Auth State...');
        try {
            const currentState = appStore.getState().auth;
            logAction(`Current Auth State (from appState): ${JSON.stringify(currentState)}`);
            logAction(`Is Authenticated: ${currentState.isAuthenticated}`);
        } catch (error) {
            logAction(`Error loading auth state: ${error.message}`, 'error');
        }
    }
}; 