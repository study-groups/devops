/**
 * @file settingsSlice.js  
 * @description Settings slice for Redux using enhanced reducer utils
 * Manages application settings with automatic persistence
 */

import { createSettingsSlice } from '../reducers/enhancedReducerUtils.js';

// --- Default Settings (without localStorage direct access) ---
const defaultSettings = {
    preview: {
        cssFiles: [],
        activeCssFiles: [],
        enableRootCss: true,  // Default to true, will be loaded from localStorage via enhancedReducerUtils
        bundleCss: true,      // Default to true, will be loaded from localStorage via enhancedReducerUtils  
        cssPrefix: '',        // Default empty, will be loaded from localStorage via enhancedReducerUtils
        renderMode: 'direct',
        cssInjectionMode: 'inject', // Default to inject, will be loaded from localStorage via enhancedReducerUtils
        debounceDelay: 150,
        skipUnchanged: true,
    },
    publish: {
        mode: 'local',        // Default to local, will be loaded from localStorage via enhancedReducerUtils
        bundleCss: true,
    },
    currentContext: null,
    selectedOrg: 'pixeljam-arcade', // Default org
};

// --- Create Enhanced Settings Slice with Auto-Persistence ---
const settingsSlice = createSettingsSlice('settings', defaultSettings);

// Export reducer and actions
export const settingsReducer = settingsSlice.reducer;
export const settingsActions = settingsSlice.actions;
export const settingsBoundActions = settingsSlice.boundActions;

// --- Enhanced Thunks with Auto-Persistence ---
export const settingsThunks = {
    // Update preview settings (automatically persisted)
    updatePreview: (updates) => settingsActions.updateSetting({ 
        key: 'preview', 
        value: updates 
    }),
    
    // Update publish settings (automatically persisted)  
    updatePublish: (updates) => settingsActions.updateSetting({
        key: 'publish',
        value: updates
    }),
    
    // Set current context (automatically persisted)
    setCurrentContext: (context) => settingsActions.updateSetting({
        key: 'currentContext', 
        value: context
    }),
    
    // Set selected organization (automatically persisted)
    setSelectedOrg: (org) => settingsActions.updateSetting({
        key: 'selectedOrg',
        value: org
    }),
    
    // Legacy compatibility - will be auto-persisted
    loadInitialSettings: () => (dispatch) => {
        // Settings are now automatically loaded from localStorage
        console.log('[SettingsSlice] Using enhanced auto-persistence - no manual loading needed');
    }
};

console.log('[settingsSlice] ✅ Migrated to enhanced Redux pattern with auto-persistence.'); 