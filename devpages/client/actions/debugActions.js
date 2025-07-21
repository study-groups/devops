/**
 * Debug action handlers
 * Responsible for debugging and development operations
 */
import { appStore } from '/client/appState.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('DebugActions');

export const debugActionHandlers = {
    /**
     * Runs a comprehensive diagnostic on the UI
     */
    runDebugUI: async () => {
        log.info('ACTION', 'RUN_DEBUG_UI', 'Triggering runAllDiagnostics...');
        try {
            await window.dev?.runAllDiagnostics?.(); 
        } catch (e) { 
            log.error('ACTION', 'RUN_DEBUG_UI_FAILED', `runAllDiagnostics failed: ${e.message}`, e);
        }
    },

    /**
     * Shows application information
     */
    showAppInfo: async () => {
        log.info('ACTION', 'SHOW_APP_INFO', 'Triggering showAppInfo...');
        try {
            window.dev?.showAppInfo?.();
        } catch (e) { 
            log.error('ACTION', 'SHOW_APP_INFO_FAILED', `showAppInfo failed: ${e.message}`, e);
        }
    },

    /**
     * Debug all API endpoints
     */
    debugAllApiEndpoints: async () => {
        log.info('ACTION', 'DEBUG_ALL_API_ENDPOINTS', 'Triggering debugAllApiEndpoints...');
        try {
            await window.dev?.debugAllApiEndpoints?.(); 
        } catch (e) { 
            log.error('ACTION', 'DEBUG_ALL_API_ENDPOINTS_FAILED', `debugAllApiEndpoints failed: ${e.message}`, e);
        }
    },

    /**
     * Debug URL parameters
     */
    debugUrlParameters: async () => {
        log.info('ACTION', 'DEBUG_URL_PARAMETERS', 'Triggering debugUrlParameters...');
        try {
            window.dev?.debugUrlParameters?.(); 
        } catch (e) { 
            log.error('ACTION', 'DEBUG_URL_PARAMETERS_FAILED', `debugUrlParameters failed: ${e.message}`, e);
        }
    },

    /**
     * Debug file list
     */
    debugFileList: async () => {
        log.info('ACTION', 'DEBUG_FILE_LIST', 'Triggering debugFileList...');
        try {
            window.dev?.debugFileList?.(); 
        } catch (e) { 
            log.error('ACTION', 'DEBUG_FILE_LIST_FAILED', `debugFileList failed: ${e.message}`, e);
        }
    },

    /**
     * Debug authentication state
     */
    debugAuthState: async () => {
        log.info('ACTION', 'DEBUG_AUTH_STATE', 'Debugging Auth State...');
        try {
            const currentState = appStore.getState().auth;
            log.info('ACTION', 'DEBUG_AUTH_STATE_DATA', `Current Auth State (from appState): ${JSON.stringify(currentState)}`);
            log.info('ACTION', 'DEBUG_AUTH_STATE_STATUS', `Is Authenticated: ${currentState.isAuthenticated}`);
        } catch (error) {
            log.error('ACTION', 'DEBUG_AUTH_STATE_FAILED', `Error loading auth state: ${error.message}`, error);
        }
    }
}; 