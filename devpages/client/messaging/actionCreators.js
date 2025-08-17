/**
 * Action Creators - Central export point for all Redux actions
 * Re-exports actions from various slices for easy importing
 */

// Import actions from slices based on what they actually export
import { clearError, setLoading, clearAuth, setToken, setAuthChecked, authThunks } from '/client/store/slices/authSlice.js';
import { fileActions } from '/client/store/slices/fileSlice.js';
import { uiActions } from '/client/store/uiSlice.js';
import { settingsActions } from '/client/store/slices/settingsSlice.js';
import { setContent, setModified } from '/client/store/slices/editorSlice.js';

// Import from pluginSlice - individual actions
import { setPluginsState, updatePluginSettings, registerPlugin, unregisterPlugin, setModuleLoaded, resetPluginState } from '/client/store/slices/pluginSlice.js';

// Create authActions object from individual auth actions
export const authActions = {
    clearError,
    setLoading,
    clearAuth,
    setToken,
    setAuthChecked
};

// Create pluginActions object from individual plugin actions
export const pluginActions = {
    setPluginsState,
    updatePluginSettings,
    registerPlugin,
    unregisterPlugin,
    setModuleLoaded,
    resetPluginState
};

// Re-export all actions for easy importing
export { authThunks };
export { fileActions };
export { uiActions };
export { settingsActions };

// Create editorActions object from individual editor actions
export const editorActions = {
    setContent,
    setModified
};

// Smart copy actions (from editor slice)
export const smartCopyActions = editorActions;

// Legacy exports for backward compatibility
export {
    fileActions as file,
    uiActions as ui,
    settingsActions as settings,
    pluginActions as plugin
};

// Export auth separately since it's created above
export { authActions as auth };
