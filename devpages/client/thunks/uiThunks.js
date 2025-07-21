/**
 * client/thunks/uiThunks.js
 * UI thunk action creators
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('UIThunks');

export const uiThunks = {
    /**
     * Thunk for setting view mode with persistence
     * @param {string} mode - View mode ('preview', 'split', 'editor')
     * @returns {Function} Thunk function
     */
    setViewMode: (mode) => async (dispatch, getState) => {
        try {
            log.info('UI', 'SET_VIEW_MODE', `Setting view mode to: ${mode}`);
            
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
                log.info('UI', 'PERSIST_VIEW_MODE_SUCCESS', `View mode persisted to localStorage: ${mode}`);
            } catch (e) {
                log.warn('UI', 'PERSIST_VIEW_MODE_FAILED', `Failed to persist view mode: ${e.message}`, e);
            }
            
            return mode;
        } catch (error) {
            log.error('UI', 'SET_VIEW_MODE_ERROR', `Error setting view mode: ${error.message}`, error);
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
            
            log.info('UI', 'TOGGLE_LOG_VISIBILITY', `Toggling log visibility to: ${newVisibility}`);
            
            dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
            
            // Persist to localStorage
            try {
                localStorage.setItem('log_panel_visible', JSON.stringify(newVisibility));
                log.info('UI', 'PERSIST_LOG_VISIBILITY_SUCCESS', `Log visibility persisted to localStorage: ${newVisibility}`);
            } catch (e) {
                log.warn('UI', 'PERSIST_LOG_VISIBILITY_FAILED', `Failed to persist log visibility: ${e.message}`, e);
            }
            
            return newVisibility;
        } catch (error) {
            log.error('UI', 'TOGGLE_LOG_VISIBILITY_ERROR', `Error toggling log visibility: ${error.message}`, error);
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
            log.info('UI', 'SET_LOG_HEIGHT', `Setting log height to: ${height}px`);
            
            // Validate height
            if (typeof height !== 'number' || height < 100 || height > 800) {
                throw new Error(`Invalid log height: ${height}. Must be between 100-800px`);
            }
            
            dispatch({ type: ActionTypes.UI_SET_LOG_HEIGHT, payload: height });
            
            // Persist to localStorage
            try {
                localStorage.setItem('log_panel_height', height.toString());
                log.info('UI', 'PERSIST_LOG_HEIGHT_SUCCESS', `Log height persisted to localStorage: ${height}`);
            } catch (e) {
                log.warn('UI', 'PERSIST_LOG_HEIGHT_FAILED', `Failed to persist log height: ${e.message}`, e);
            }
            
            return height;
        } catch (error) {
            log.error('UI', 'SET_LOG_HEIGHT_ERROR', `Error setting log height: ${error.message}`, error);
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
            
            log.info('UI', 'TOGGLE_LOG_MENU', `Toggling log menu to: ${newMenuState}`);
            
            dispatch({ type: ActionTypes.UI_TOGGLE_LOG_MENU });
            
            return newMenuState;
        } catch (error) {
            log.error('UI', 'TOGGLE_LOG_MENU_ERROR', `Error toggling log menu: ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Thunk for applying initial UI state from localStorage
     * @returns {Function} Thunk function
     */
    applyInitialUIState: () => async (dispatch, getState) => {
        try {
            log.info('UI', 'APPLY_INITIAL_STATE', 'Applying initial UI state from localStorage');
            
            // Load view mode
            try {
                const storedViewMode = localStorage.getItem('appViewMode');
                if (storedViewMode && ['preview', 'split', 'editor'].includes(storedViewMode)) {
                    dispatch({ type: ActionTypes.UI_SET_VIEW_MODE, payload: storedViewMode });
                    log.info('UI', 'LOAD_VIEW_MODE_SUCCESS', `Loaded view mode from localStorage: ${storedViewMode}`);
                }
            } catch (e) {
                log.warn('UI', 'LOAD_VIEW_MODE_FAILED', `Failed to load view mode: ${e.message}`, e);
            }
            
            // Load log visibility
            try {
                const storedLogVisible = localStorage.getItem('log_panel_visible');
                if (storedLogVisible !== null) {
                    const logVisible = JSON.parse(storedLogVisible);
                    if (logVisible) {
                        dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
                    }
                    log.info('UI', 'LOAD_LOG_VISIBILITY_SUCCESS', `Loaded log visibility from localStorage: ${logVisible}`);
                }
            } catch (e) {
                log.warn('UI', 'LOAD_LOG_VISIBILITY_FAILED', `Failed to load log visibility: ${e.message}`, e);
            }
            
            // Load log height
            try {
                const storedLogHeight = localStorage.getItem('log_panel_height');
                if (storedLogHeight !== null) {
                    const logHeight = parseInt(storedLogHeight, 10);
                    if (!isNaN(logHeight) && logHeight >= 100 && logHeight <= 800) {
                        dispatch({ type: ActionTypes.UI_SET_LOG_HEIGHT, payload: logHeight });
                        log.info('UI', 'LOAD_LOG_HEIGHT_SUCCESS', `Loaded log height from localStorage: ${logHeight}`);
                    }
                }
            } catch (e) {
                log.warn('UI', 'LOAD_LOG_HEIGHT_FAILED', `Failed to load log height: ${e.message}`, e);
            }
            
            log.info('UI', 'APPLY_INITIAL_STATE_SUCCESS', 'Initial UI state applied successfully');
        } catch (error) {
            log.error('UI', 'APPLY_INITIAL_STATE_ERROR', `Error applying initial UI state: ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Thunk for refreshing preview
     * @returns {Function} Thunk function
     */
    refreshPreview: () => async (dispatch, getState) => {
        try {
            log.info('UI', 'REFRESH_PREVIEW', 'Refreshing preview...');
            
            // This could trigger a preview refresh event
            // For now, just log the action
            log.info('UI', 'REFRESH_PREVIEW_REQUESTED', 'Preview refresh requested');
            
            // You could dispatch a preview refresh action here
            // dispatch({ type: ActionTypes.PREVIEW_REFRESH });
            
            return true;
        } catch (error) {
            log.error('UI', 'REFRESH_PREVIEW_ERROR', `Error refreshing preview: ${error.message}`, error);
            throw error;
        }
    }
}; 