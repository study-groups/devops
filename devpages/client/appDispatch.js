/**
 * appDispatch.js - StateKit-compatible dispatch wrapper
 * Provides a clean interface for dispatching actions using StateKit patterns
 */

import { appStore } from '/client/appState.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('SYSTEM', 'AppDispatch');

// Import all the slice actions and thunks for easy access
import { authThunks } from '/client/store/slices/authSlice.js';
import { logThunks } from '/client/store/slices/logSlice.js';
import { pathThunks } from '/client/store/slices/pathSlice.js';

/**
 * Enhanced dispatch function that wraps appStore.dispatch
 * Supports both plain actions and thunk actions (async)
 * 
 * @param {object|function} action - Action object or thunk function
 * @returns {Promise|any} - Returns promise for thunks, action result for plain actions
 */
export const appDispatch = (action) => {
    try {
        // Handle thunk actions (functions)
        if (typeof action === 'function') {
            // Thunk actions receive dispatch and getState as arguments
            return action(appStore.dispatch, appStore.getState);
        }
        
        // Handle plain action objects
        if (action && typeof action === 'object' && action.type) {
            return appStore.dispatch(action);
        }
        
        // Invalid action
        throw new Error('appDispatch expects an action object or thunk function');
        
    } catch (error) {
        log.error('DISPATCH_ERROR', `appDispatch error: ${error.message}`, { action });
        throw error;
    }
};

/**
 * Convenient action dispatchers organized by domain
 * These provide pre-bound action creators for common operations
 */
export const dispatchers = {
    // Authentication actions
    auth: {
        login: (credentials) => appDispatch(authThunks.login(credentials)),
        logout: () => appDispatch(authThunks.logoutAsync()),
        checkAuth: () => appDispatch(authThunks.checkAuth()),
        refreshSession: () => appDispatch(authThunks.refreshSession()),
    },
    
    // Path/File system actions  
    path: {
        fetchListing: (pathname, isDirectory = true) => 
            appDispatch(pathThunks.fetchListingByPath({ pathname, isDirectory })),
    },
    
    // Logging actions
    log: {
        addEntry: (entry) => appDispatch(logThunks.addEntry(entry)),
        addBulkEntries: (entries, options) => appDispatch(logThunks.addBulkEntries(entries, options)),
        clearLog: () => appDispatch(logThunks.clearLog()),
    },
    
    // Legacy actions for backward compatibility
    legacy: {
        // Panel actions
        openSettingsPanel: (payload) => appDispatch({
            type: ActionTypes.SETTINGS_OPEN_PANEL,
            payload
        }),
        
        // File actions (until they're migrated to thunks)
        saveFile: () => {
            // For now, use the eventBus until file slice is fully implemented
            return import('/client/eventBus.js').then(({ eventBus }) => {
                eventBus.emit('file:save');
                return { success: true, action: 'file:save' };
            });
        },
        
        // Generic state update
        updateState: (payload) => appDispatch({
            type: ActionTypes.STATE_UPDATE,
            payload
        }),
    }
};

/**
 * Async-aware dispatch helper for use in components
 * Automatically handles loading states and errors
 * 
 * @param {function|object} action - Action to dispatch
 * @param {object} options - Options for handling the dispatch
 * @returns {Promise<any>}
 */
export const safeDispatch = async (action, options = {}) => {
    const {
        onLoading = null,
        onSuccess = null,
        onError = null,
        showErrorAlert = false
    } = options;
    
    try {
        if (onLoading) onLoading(true);
        
        const result = await appDispatch(action);
        
        if (onSuccess) onSuccess(result);
        return result;
        
    } catch (error) {
        log.error('SAFE_DISPATCH_ERROR', `safeDispatch error: ${error.message}`);
        
        if (onError) {
            onError(error);
        } else if (showErrorAlert) {
            alert(`Error: ${error.message}`);
        }
        
        throw error;
    } finally {
        if (onLoading) onLoading(false);
    }
};

/**
 * Batch dispatch multiple actions
 * Useful for coordinating multiple state updates
 * 
 * @param {Array<object|function>} actions - Array of actions to dispatch
 * @param {object} options - Batch options
 * @returns {Promise<Array>}
 */
export const batchDispatch = async (actions, options = {}) => {
    const { 
        sequential = false, // If true, wait for each action before dispatching next
        continueOnError = true // If false, stop on first error
    } = options;
    
    if (sequential) {
        const results = [];
        for (const action of actions) {
            try {
                const result = await appDispatch(action);
                results.push(result);
            } catch (error) {
                if (!continueOnError) throw error;
                results.push({ error: error.message });
            }
        }
        return results;
    } else {
        // Dispatch all actions in parallel
        const promises = actions.map(action => 
            appDispatch(action).catch(error => 
                continueOnError ? { error: error.message } : Promise.reject(error)
            )
        );
        return Promise.all(promises);
    }
};

// Default export is the main dispatch function
export default appDispatch;

// Expose appStore for direct access when needed
export { appStore } from '/client/appState.js';

log.info('INITIALIZED', 'appDispatch module initialized with StateKit integration'); 