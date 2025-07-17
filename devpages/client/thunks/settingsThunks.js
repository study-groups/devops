/**
 * client/thunks/settingsThunks.js
 * Settings thunk action creators
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';

// Helper for logging within this module
function logSettings(message, level = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, 'SETTINGS');
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[SETTINGS] ${message}`);
    }
}

export const settingsThunks = {
    /**
     * Thunk for toggling preview CSS enabled state
     * @param {string} cssId - CSS file ID
     * @returns {Function} Thunk function
     */
    togglePreviewCssEnabled: (cssId) => async (dispatch, getState) => {
        try {
            logSettings(`Toggling preview CSS enabled for: ${cssId}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED, 
                payload: cssId 
            });
            
            // Persist to localStorage
            try {
                const state = getState();
                const cssFiles = state.settings?.preview?.cssFiles || [];
                localStorage.setItem('devpages_preview_css_files', JSON.stringify(cssFiles));
                logSettings(`Preview CSS files persisted to localStorage`);
            } catch (e) {
                logSettings(`Failed to persist preview CSS files: ${e.message}`, 'warning');
            }
            
            return true;
        } catch (error) {
            logSettings(`Error toggling preview CSS: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for adding preview CSS file
     * @param {string} cssPath - CSS file path
     * @returns {Function} Thunk function
     */
    addPreviewCss: (cssPath) => async (dispatch, getState) => {
        try {
            logSettings(`Adding preview CSS: ${cssPath}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_ADD_PREVIEW_CSS, 
                payload: cssPath 
            });
            
            // Persist to localStorage
            try {
                const state = getState();
                const cssFiles = state.settings?.preview?.cssFiles || [];
                localStorage.setItem('devpages_preview_css_files', JSON.stringify(cssFiles));
                logSettings(`Preview CSS files persisted to localStorage`);
            } catch (e) {
                logSettings(`Failed to persist preview CSS files: ${e.message}`, 'warning');
            }
            
            return true;
        } catch (error) {
            logSettings(`Error adding preview CSS: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for removing preview CSS file
     * @param {string} cssId - CSS file ID
     * @returns {Function} Thunk function
     */
    removePreviewCss: (cssId) => async (dispatch, getState) => {
        try {
            logSettings(`Removing preview CSS: ${cssId}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS, 
                payload: cssId 
            });
            
            // Persist to localStorage
            try {
                const state = getState();
                const cssFiles = state.settings?.preview?.cssFiles || [];
                localStorage.setItem('devpages_preview_css_files', JSON.stringify(cssFiles));
                logSettings(`Preview CSS files persisted to localStorage`);
            } catch (e) {
                logSettings(`Failed to persist preview CSS files: ${e.message}`, 'warning');
            }
            
            return true;
        } catch (error) {
            logSettings(`Error removing preview CSS: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for setting active preview CSS
     * @param {string} cssId - CSS file ID
     * @returns {Function} Thunk function
     */
    setActivePreviewCss: (cssId) => async (dispatch, getState) => {
        try {
            logSettings(`Setting active preview CSS: ${cssId}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_ACTIVE_PREVIEW_CSS, 
                payload: cssId 
            });
            
            return true;
        } catch (error) {
            logSettings(`Error setting active preview CSS: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for toggling root CSS enabled state
     * @returns {Function} Thunk function
     */
    toggleRootCssEnabled: () => async (dispatch, getState) => {
        try {
            const state = getState();
            const currentState = state.settings?.preview?.enableRootCss || true;
            const newState = !currentState;
            
            logSettings(`Toggling root CSS enabled to: ${newState}`);
            
            dispatch({ type: ActionTypes.SETTINGS_TOGGLE_ROOT_CSS_ENABLED });
            
            // Persist to localStorage
            try {
                localStorage.setItem('devpages_enable_root_css', newState.toString());
                logSettings(`Root CSS enabled state persisted to localStorage: ${newState}`);
            } catch (e) {
                logSettings(`Failed to persist root CSS enabled state: ${e.message}`, 'warning');
            }
            
            return newState;
        } catch (error) {
            logSettings(`Error toggling root CSS enabled: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for setting root CSS enabled state
     * @param {boolean} isEnabled - Whether root CSS is enabled
     * @returns {Function} Thunk function
     */
    setRootCssEnabled: (isEnabled) => async (dispatch, getState) => {
        try {
            logSettings(`Setting root CSS enabled to: ${isEnabled}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, 
                payload: isEnabled 
            });
            
            // Persist to localStorage
            try {
                localStorage.setItem('devpages_enable_root_css', isEnabled.toString());
                logSettings(`Root CSS enabled state persisted to localStorage: ${isEnabled}`);
            } catch (e) {
                logSettings(`Failed to persist root CSS enabled state: ${e.message}`, 'warning');
            }
            
            return isEnabled;
        } catch (error) {
            logSettings(`Error setting root CSS enabled: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for setting preview CSS files
     * @param {Array} files - Array of CSS file objects
     * @returns {Function} Thunk function
     */
    setPreviewCssFiles: (files) => async (dispatch, getState) => {
        try {
            logSettings(`Setting preview CSS files: ${files.length} files`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_PREVIEW_CSS_FILES, 
                payload: files 
            });
            
            // Persist to localStorage
            try {
                localStorage.setItem('devpages_preview_css_files', JSON.stringify(files));
                logSettings(`Preview CSS files persisted to localStorage`);
            } catch (e) {
                logSettings(`Failed to persist preview CSS files: ${e.message}`, 'warning');
            }
            
            return files;
        } catch (error) {
            logSettings(`Error setting preview CSS files: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for setting active design theme
     * @param {string} themeName - Theme name
     * @returns {Function} Thunk function
     */
    setActiveDesignTheme: (themeName) => async (dispatch, getState) => {
        try {
            logSettings(`Setting active design theme: ${themeName}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME, 
                payload: themeName 
            });
            
            return themeName;
        } catch (error) {
            logSettings(`Error setting active design theme: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for setting design theme variant
     * @param {string} variant - Theme variant
     * @returns {Function} Thunk function
     */
    setDesignThemeVariant: (variant) => async (dispatch, getState) => {
        try {
            logSettings(`Setting design theme variant: ${variant}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT, 
                payload: variant 
            });
            
            return variant;
        } catch (error) {
            logSettings(`Error setting design theme variant: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for setting design tokens directory
     * @param {string} directory - Directory path
     * @returns {Function} Thunk function
     */
    setDesignTokensDirectory: (directory) => async (dispatch, getState) => {
        try {
            logSettings(`Setting design tokens directory: ${directory}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_DESIGN_TOKENS_DIR, 
                payload: directory 
            });
            
            return directory;
        } catch (error) {
            logSettings(`Error setting design tokens directory: ${error.message}`, 'error');
            throw error;
        }
    }
}; 