/**
 * @file settingsSlice.js  
 * @description Settings slice for Redux using enhanced reducer utils
 * Manages application settings with automatic persistence
 */

import { createSettingsSlice } from '../reducers/enhancedReducerUtils.js';
import { themeService } from '../../services/ThemeService.js';

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
    theme: {
        // Current theme settings
        mode: 'light',                    // 'light' | 'dark' | 'auto'
        activeTheme: 'devpages-light',    // Active theme ID

        // Theme preferences
        autoSwitchTheme: false,           // Auto switch based on time
        syncWithOS: false,                // Sync with OS dark mode preference
        transitionDuration: 200,          // Theme transition duration (ms)

        // Auto-switch schedule (if autoSwitchTheme is true)
        schedule: {
            lightThemeStart: '07:00',     // Time to switch to light theme
            darkThemeStart: '19:00',      // Time to switch to dark theme
        },

        // Token overrides (applied on top of active theme)
        tokenOverrides: {
            colors: {},
            typography: {},
            spacing: {},
        },

        // Embed configuration
        embedConfig: {
            enabled: true,                // Enable theme in embeds/iframes
            syncWithParent: true,         // Sync embed themes with parent
            isolationMethod: 'shadow-dom', // 'shadow-dom' | 'iframe' | 'scoped-css'
        },
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

    addPreviewCssFile: (filePath) => (dispatch, getState) => {
        const { cssFiles } = getState().settings.preview;
        const newFile = { id: `css-${Date.now()}`, path: filePath, enabled: true };
        const newFiles = [...cssFiles, newFile];
        dispatch(settingsActions.updateNestedSetting({ path: 'preview.cssFiles', value: newFiles }));
    },

    removePreviewCssFile: (fileId) => (dispatch, getState) => {
        const { cssFiles } = getState().settings.preview;
        const newFiles = cssFiles.filter(file => file.id !== fileId);
        dispatch(settingsActions.updateNestedSetting({ path: 'preview.cssFiles', value: newFiles }));
    },

    togglePreviewCssFile: (fileId) => (dispatch, getState) => {
        const { cssFiles } = getState().settings.preview;
        const newFiles = cssFiles.map(file => 
            file.id === fileId ? { ...file, enabled: !file.enabled } : file
        );
        dispatch(settingsActions.updateNestedSetting({ path: 'preview.cssFiles', value: newFiles }));
    },

    setPreviewCssFiles: (files) => (dispatch) => {
        dispatch(settingsActions.updateNestedSetting({ path: 'preview.cssFiles', value: files }));
    },

    // Theme management actions - connected to themeService
    setThemeMode: (mode) => async (dispatch) => {
        dispatch(settingsActions.updateNestedSetting({ path: 'theme.mode', value: mode }));
        // Apply via themeService
        const themeId = mode === 'light' ? 'devpages-light' : 'devpages-dark';
        await themeService.loadTheme(themeId);
    },

    setActiveTheme: (themeId) => async (dispatch) => {
        dispatch(settingsActions.updateNestedSetting({ path: 'theme.activeTheme', value: themeId }));
        // Apply via themeService
        await themeService.loadTheme(themeId);
    },

    toggleThemeMode: () => async (dispatch, getState) => {
        const currentMode = getState().settings.theme.mode;
        const newMode = currentMode === 'light' ? 'dark' : 'light';
        dispatch(settingsActions.updateNestedSetting({ path: 'theme.mode', value: newMode }));
        // Apply via themeService
        await themeService.toggleMode();
    },

    setSyncWithOS: (enabled) => (dispatch) => {
        dispatch(settingsActions.updateNestedSetting({ path: 'theme.syncWithOS', value: enabled }));
    },

    setAutoSwitchTheme: (enabled) => (dispatch) => {
        dispatch(settingsActions.updateNestedSetting({ path: 'theme.autoSwitchTheme', value: enabled }));
    },

    updateThemeSchedule: (schedule) => (dispatch) => {
        dispatch(settingsActions.updateNestedSetting({ path: 'theme.schedule', value: schedule }));
    },

    updateTokenOverride: (category, tokenName, value) => (dispatch, getState) => {
        const overrides = getState().settings.theme.tokenOverrides[category] || {};
        const updated = { ...overrides, [tokenName]: value };
        dispatch(settingsActions.updateNestedSetting({
            path: `theme.tokenOverrides.${category}`,
            value: updated
        }));
    },

    clearTokenOverrides: () => (dispatch) => {
        dispatch(settingsActions.updateNestedSetting({
            path: 'theme.tokenOverrides',
            value: { colors: {}, typography: {}, spacing: {} }
        }));
    },

    updateEmbedConfig: (updates) => (dispatch, getState) => {
        const current = getState().settings.theme.embedConfig;
        dispatch(settingsActions.updateNestedSetting({
            path: 'theme.embedConfig',
            value: { ...current, ...updates }
        }));
    },

    // Legacy compatibility - will be auto-persisted
    loadInitialSettings: () => (dispatch) => {
        // Settings are now automatically loaded from localStorage
        console.log('[SettingsSlice] Using enhanced auto-persistence - no manual loading needed');
    }
};

console.log('[settingsSlice] ✅ Migrated to enhanced Redux pattern with auto-persistence.'); 