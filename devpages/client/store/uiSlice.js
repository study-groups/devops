/**
 * @file uiSlice.js
 * @description UI slice for Redux using enhanced reducer utils
 * Manages UI state (viewMode, log visibility, theme) with automatic persistence
 */

import { createSettingsSlice } from './reducers/enhancedReducerUtils.js';

// --- Default UI Settings (loaded automatically from localStorage) ---
const defaultUIState = {
    theme: 'light',
    viewMode: 'preview',        // 'preview', 'split', 'editor'
    logVisible: false,
    logHeight: 120,             // pixels
    logMenuVisible: false,
    leftSidebarVisible: false,
    textVisible: true,
    previewVisible: true,
    contextManagerVisible: true, // PathManager should ALWAYS be visible
    colorScheme: 'system',      // 'light', 'dark', 'system'
    designDensity: 'normal',    // 'compact', 'normal', 'spacious'
};

// --- Create Enhanced UI Slice with Auto-Persistence ---
const uiSlice = createSettingsSlice('ui', defaultUIState);

// Export reducer and actions
export const uiReducer = uiSlice.reducer;
export const uiActions = uiSlice.actions;
export const uiBoundActions = uiSlice.boundActions;

// --- Enhanced UI Thunks with Auto-Persistence ---
export const uiThunks = {
    // Set view mode (automatically persisted)
    setViewMode: (mode) => uiActions.updateSetting({ 
        key: 'viewMode', 
        value: mode 
    }),
    
    // Toggle log visibility (automatically persisted)
    toggleLogVisibility: () => (dispatch, getState) => {
        const { logVisible } = getState().ui;
        dispatch(uiActions.updateSetting({ key: 'logVisible', value: !logVisible }));
    },

    toggleTextVisibility: () => (dispatch, getState) => {
        const { textVisible } = getState().ui;
        dispatch(uiActions.updateSetting({ key: 'textVisible', value: !textVisible }));
    },
    
    // Toggle context manager visibility
    toggleContextManager: () => (dispatch, getState) => {
        const { contextManagerVisible } = getState().ui;
        dispatch(uiActions.updateSetting({ key: 'contextManagerVisible', value: !contextManagerVisible }));
    },

    // Set log height (automatically persisted)
    setLogHeight: (height) => uiActions.updateSetting({ 
        key: 'logHeight', 
        value: height 
    }),
    
    // Toggle log menu (automatically persisted)
    toggleLogMenu: () => (dispatch, getState) => {
        const currentState = getState().ui?.logMenuVisible || false;
        dispatch(uiActions.updateSetting({ 
            key: 'logMenuVisible', 
            value: !currentState 
        }));
    },
    
    // Set theme (automatically persisted)
    setTheme: (theme) => uiActions.updateSetting({ 
        key: 'theme', 
        value: theme 
    }),
    
    // Toggle theme (automatically persisted)
    toggleTheme: () => (dispatch, getState) => {
        const currentTheme = getState().ui?.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        dispatch(uiActions.updateSetting({ 
            key: 'theme', 
            value: newTheme 
        }));
    },
    
    // Legacy compatibility - auto-loaded now
    applyInitialUIState: () => (dispatch) => {
        console.log('[UISlice] Using enhanced auto-persistence - no manual loading needed');
    }
};

// Export legacy actions for compatibility
export const { setTheme, toggleTheme } = {
    setTheme: uiThunks.setTheme,
    toggleTheme: uiThunks.toggleTheme
};

console.log('[uiSlice] ✅ Migrated to enhanced Redux pattern with auto-persistence.'); 