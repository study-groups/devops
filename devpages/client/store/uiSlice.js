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
const uiSlice = createSettingsSlice('ui', defaultUIState, {
    reducers: {
        toggleLogVisibility: (state) => ({
            ...state,
            logVisible: !state.logVisible,
        }),
        toggleTextVisibility: (state) => ({
            ...state,
            textVisible: !state.textVisible,
        }),
        toggleContextManager: (state) => ({
            ...state,
            contextManagerVisible: !state.contextManagerVisible,
        }),
        toggleLogMenu: (state) => ({
            ...state,
            logMenuVisible: !state.logMenuVisible,
        }),
    }
});

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
    
    // Set log height (automatically persisted)
    setLogHeight: (height) => uiActions.updateSetting({ 
        key: 'logHeight', 
        value: height 
    }),
    
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
    }
};

// Export legacy actions for compatibility
export const { setTheme, toggleTheme } = {
    setTheme: uiThunks.setTheme,
    toggleTheme: uiThunks.toggleTheme
};

console.log('[uiSlice] ✅ Migrated to enhanced Redux pattern with auto-persistence.'); 