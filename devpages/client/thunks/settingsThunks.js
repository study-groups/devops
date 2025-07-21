/**
 * client/thunks/settingsThunks.js
 * Settings thunk action creators
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';
import { settingsThunks as settingsSliceThunks } from '/client/store/slices/settingsSlice.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('SettingsThunks');

export const settingsThunks = {
    /**
     * Thunk for toggling preview CSS enabled state
     * @param {string} cssId - CSS file ID
     * @returns {Function} Thunk function
     */
    togglePreviewCssEnabled: (cssId) => async (dispatch, getState) => {
        try {
            log.info('SETTINGS', 'TOGGLE_PREVIEW_CSS', `Toggling preview CSS enabled for: ${cssId}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED, 
                payload: cssId 
            });
            
            // Persist to localStorage via the new thunk
            dispatch(settingsSliceThunks.savePreviewCssFiles());
            
            return true;
        } catch (error) {
            log.error('SETTINGS', 'TOGGLE_PREVIEW_CSS_ERROR', `Error toggling preview CSS: ${error.message}`, error);
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
            log.info('SETTINGS', 'ADD_PREVIEW_CSS', `Adding preview CSS: ${cssPath}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_ADD_PREVIEW_CSS, 
                payload: cssPath 
            });
            
            // Persist to localStorage via the new thunk
            dispatch(settingsSliceThunks.savePreviewCssFiles());
            
            return true;
        } catch (error) {
            log.error('SETTINGS', 'ADD_PREVIEW_CSS_ERROR', `Error adding preview CSS: ${error.message}`, error);
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
            log.info('SETTINGS', 'REMOVE_PREVIEW_CSS', `Removing preview CSS: ${cssId}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS, 
                payload: cssId 
            });
            
            // Persist to localStorage via the new thunk
            dispatch(settingsSliceThunks.savePreviewCssFiles());
            
            return true;
        } catch (error) {
            log.error('SETTINGS', 'REMOVE_PREVIEW_CSS_ERROR', `Error removing preview CSS: ${error.message}`, error);
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
            log.info('SETTINGS', 'SET_ACTIVE_PREVIEW_CSS', `Setting active preview CSS: ${cssId}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_ACTIVE_PREVIEW_CSS, 
                payload: cssId 
            });
            
            return true;
        } catch (error) {
            log.error('SETTINGS', 'SET_ACTIVE_PREVIEW_CSS_ERROR', `Error setting active preview CSS: ${error.message}`, error);
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
            
            log.info('SETTINGS', 'TOGGLE_ROOT_CSS', `Toggling root CSS enabled to: ${newState}`);
            
            dispatch({ type: ActionTypes.SETTINGS_TOGGLE_ROOT_CSS_ENABLED });
            
            // Persist to localStorage
            try {
                localStorage.setItem('devpages_enable_root_css', newState.toString());
                log.info('SETTINGS', 'PERSIST_ROOT_CSS_SUCCESS', `Root CSS enabled state persisted to localStorage: ${newState}`);
            } catch (e) {
                log.warn('SETTINGS', 'PERSIST_ROOT_CSS_FAILED', `Failed to persist root CSS enabled state: ${e.message}`, e);
            }
            
            return newState;
        } catch (error) {
            log.error('SETTINGS', 'TOGGLE_ROOT_CSS_ERROR', `Error toggling root CSS enabled: ${error.message}`, error);
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
            log.info('SETTINGS', 'SET_ROOT_CSS', `Setting root CSS enabled to: ${isEnabled}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, 
                payload: isEnabled 
            });
            
            // Persist to localStorage
            try {
                localStorage.setItem('devpages_enable_root_css', isEnabled.toString());
                log.info('SETTINGS', 'PERSIST_ROOT_CSS_SUCCESS', `Root CSS enabled state persisted to localStorage: ${isEnabled}`);
            } catch (e) {
                log.warn('SETTINGS', 'PERSIST_ROOT_CSS_FAILED', `Failed to persist root CSS enabled state: ${e.message}`, e);
            }
            
            return isEnabled;
        } catch (error) {
            log.error('SETTINGS', 'SET_ROOT_CSS_ERROR', `Error setting root CSS enabled: ${error.message}`, error);
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
            log.info('SETTINGS', 'SET_PREVIEW_CSS_FILES', `Setting preview CSS files: ${files.length} files`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_PREVIEW_CSS_FILES, 
                payload: files 
            });
            
            // Persist to localStorage via the new thunk
            dispatch(settingsSliceThunks.savePreviewCssFiles());
            
            return files;
        } catch (error) {
            log.error('SETTINGS', 'SET_PREVIEW_CSS_FILES_ERROR', `Error setting preview CSS files: ${error.message}`, error);
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
            log.info('SETTINGS', 'SET_ACTIVE_DESIGN_THEME', `Setting active design theme: ${themeName}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME, 
                payload: themeName 
            });
            
            return themeName;
        } catch (error) {
            log.error('SETTINGS', 'SET_ACTIVE_DESIGN_THEME_ERROR', `Error setting active design theme: ${error.message}`, error);
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
            log.info('SETTINGS', 'SET_DESIGN_THEME_VARIANT', `Setting design theme variant: ${variant}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT, 
                payload: variant 
            });
            
            return variant;
        } catch (error) {
            log.error('SETTINGS', 'SET_DESIGN_THEME_VARIANT_ERROR', `Error setting design theme variant: ${error.message}`, error);
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
            log.info('SETTINGS', 'SET_DESIGN_TOKENS_DIRECTORY', `Setting design tokens directory: ${directory}`);
            
            dispatch({ 
                type: ActionTypes.SETTINGS_SET_DESIGN_TOKENS_DIR, 
                payload: directory 
            });
            
            return directory;
        } catch (error) {
            log.error('SETTINGS', 'SET_DESIGN_TOKENS_DIRECTORY_ERROR', `Error setting design tokens directory: ${error.message}`, error);
            throw error;
        }
    }
}; 