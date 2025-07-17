/**
 * client/thunks/uiThunks.js
 * UI thunk action creators
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';

// Helper for logging within this module
function logUI(message, level = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, 'UI');
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[UI] ${message}`);
    }
}

export const uiThunks = {
    /**
     * Thunk for setting view mode with persistence
     * @param {string} mode - View mode ('preview', 'split', 'editor')
     * @returns {Function} Thunk function
     */
    setViewMode: (mode) => async (dispatch, getState) => {
        try {
            logUI(`Setting view mode to: ${mode}`);
            
            // Validate mode
            const validModes = ['preview', 'split', 'editor'];
            if (!validModes.includes(mode)) {
                throw new Error(`Invalid view mode: ${mode}`);
            }
            
            // Dispatch the action
            dispatch({ type: ActionTypes.UI_SET_VIEW_MODE, payload: mode });
            
            // Persist to localStorage
            try {
                localStorage.setItem('appViewMode', mode);
                logUI(`View mode persisted to localStorage: ${mode}`);
            } catch (e) {
                logUI(`Failed to persist view mode: ${e.message}`, 'warning');
            }
            
            return mode;
        } catch (error) {
            logUI(`Error setting view mode: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for toggling log visibility with persistence
     * @returns {Function} Thunk function
     */
    toggleLogVisibility: () => async (dispatch, getState) => {
        try {
            const state = getState();
            const currentVisibility = state.ui?.logVisible || false;
            const newVisibility = !currentVisibility;
            
            logUI(`Toggling log visibility to: ${newVisibility}`);
            
            dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
            
            // Persist to localStorage
            try {
                localStorage.setItem('log_panel_visible', JSON.stringify(newVisibility));
                logUI(`Log visibility persisted to localStorage: ${newVisibility}`);
            } catch (e) {
                logUI(`Failed to persist log visibility: ${e.message}`, 'warning');
            }
            
            return newVisibility;
        } catch (error) {
            logUI(`Error toggling log visibility: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for setting log height with persistence
     * @param {number} height - Log panel height in pixels
     * @returns {Function} Thunk function
     */
    setLogHeight: (height) => async (dispatch, getState) => {
        try {
            logUI(`Setting log height to: ${height}px`);
            
            // Validate height
            if (typeof height !== 'number' || height < 100 || height > 800) {
                throw new Error(`Invalid log height: ${height}. Must be between 100-800px`);
            }
            
            dispatch({ type: ActionTypes.UI_SET_LOG_HEIGHT, payload: height });
            
            // Persist to localStorage
            try {
                localStorage.setItem('log_panel_height', height.toString());
                logUI(`Log height persisted to localStorage: ${height}`);
            } catch (e) {
                logUI(`Failed to persist log height: ${e.message}`, 'warning');
            }
            
            return height;
        } catch (error) {
            logUI(`Error setting log height: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for toggling log menu
     * @returns {Function} Thunk function
     */
    toggleLogMenu: () => async (dispatch, getState) => {
        try {
            const state = getState();
            const currentMenuState = state.ui?.logMenuVisible || false;
            const newMenuState = !currentMenuState;
            
            logUI(`Toggling log menu to: ${newMenuState}`);
            
            dispatch({ type: ActionTypes.UI_TOGGLE_LOG_MENU });
            
            return newMenuState;
        } catch (error) {
            logUI(`Error toggling log menu: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for applying initial UI state from localStorage
     * @returns {Function} Thunk function
     */
    applyInitialUIState: () => async (dispatch, getState) => {
        try {
            logUI('Applying initial UI state from localStorage');
            
            // Load view mode
            try {
                const storedViewMode = localStorage.getItem('appViewMode');
                if (storedViewMode && ['preview', 'split', 'editor'].includes(storedViewMode)) {
                    dispatch({ type: ActionTypes.UI_SET_VIEW_MODE, payload: storedViewMode });
                    logUI(`Loaded view mode from localStorage: ${storedViewMode}`);
                }
            } catch (e) {
                logUI(`Failed to load view mode: ${e.message}`, 'warning');
            }
            
            // Load log visibility
            try {
                const storedLogVisible = localStorage.getItem('log_panel_visible');
                if (storedLogVisible !== null) {
                    const logVisible = JSON.parse(storedLogVisible);
                    if (logVisible) {
                        dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
                    }
                    logUI(`Loaded log visibility from localStorage: ${logVisible}`);
                }
            } catch (e) {
                logUI(`Failed to load log visibility: ${e.message}`, 'warning');
            }
            
            // Load log height
            try {
                const storedLogHeight = localStorage.getItem('log_panel_height');
                if (storedLogHeight !== null) {
                    const logHeight = parseInt(storedLogHeight, 10);
                    if (!isNaN(logHeight) && logHeight >= 100 && logHeight <= 800) {
                        dispatch({ type: ActionTypes.UI_SET_LOG_HEIGHT, payload: logHeight });
                        logUI(`Loaded log height from localStorage: ${logHeight}`);
                    }
                }
            } catch (e) {
                logUI(`Failed to load log height: ${e.message}`, 'warning');
            }
            
            logUI('Initial UI state applied successfully');
        } catch (error) {
            logUI(`Error applying initial UI state: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for refreshing preview
     * @returns {Function} Thunk function
     */
    refreshPreview: () => async (dispatch, getState) => {
        try {
            logUI('Refreshing preview...');
            
            // This could trigger a preview refresh event
            // For now, just log the action
            logUI('Preview refresh requested');
            
            // You could dispatch a preview refresh action here
            // dispatch({ type: ActionTypes.PREVIEW_REFRESH });
            
            return true;
        } catch (error) {
            logUI(`Error refreshing preview: ${error.message}`, 'error');
            throw error;
        }
    }
}; 