/**
 * @file publishSlice.js
 * @description Publish slice using StateKit createSlice pattern
 * Manages publishing settings and operations
 */

import { createSlice } from '/packages/devpages-statekit/src/index.js';

// Storage keys for persistence
const STORAGE_KEYS = {
    PUBLISH_MODE: 'devpages_publish_mode',
    PUBLISH_SETTINGS: 'devpages_publish_settings'
};

// Helper function to load persisted publish settings
function loadPublishSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.PUBLISH_SETTINGS);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.warn('[PublishSlice] Failed to load publish settings:', e);
        return {};
    }
}

// Default publish settings
const defaultSettings = {
    mode: localStorage.getItem(STORAGE_KEYS.PUBLISH_MODE) || 'local',
    bundleCss: true,
    minifyOutput: false,
    includeSourceMaps: false,
    publishDirectory: '',
    remoteEndpoint: '',
    authToken: '',
    lastPublishTime: null,
    isPublishing: false,
    publishHistory: [],
    ...loadPublishSettings()
};

const publishSlice = createSlice({
    name: 'publish',
    initialState: defaultSettings,
    reducers: {
        // Set publish mode (local/remote)
        setPublishMode: (state, action) => {
            const mode = action.payload;
            if (['local', 'remote'].includes(mode)) {
                state.mode = mode;
                try {
                    localStorage.setItem(STORAGE_KEYS.PUBLISH_MODE, mode);
                } catch (e) {
                    console.error('[PublishSlice] Failed to persist publish mode:', e);
                }
            }
        },

        // Update publish settings
        updateSettings: (state, action) => {
            const settings = action.payload;
            Object.assign(state, settings);
            
            // Persist settings to localStorage
            try {
                const settingsToPersist = {
                    bundleCss: state.bundleCss,
                    minifyOutput: state.minifyOutput,
                    includeSourceMaps: state.includeSourceMaps,
                    publishDirectory: state.publishDirectory,
                    remoteEndpoint: state.remoteEndpoint,
                    authToken: state.authToken
                };
                localStorage.setItem(STORAGE_KEYS.PUBLISH_SETTINGS, JSON.stringify(settingsToPersist));
            } catch (e) {
                console.error('[PublishSlice] Failed to persist publish settings:', e);
            }
        },

        // Start publishing process
        startPublishing: (state) => {
            state.isPublishing = true;
        },

        // Finish publishing process
        finishPublishing: (state, action) => {
            state.isPublishing = false;
            state.lastPublishTime = new Date().toISOString();
            
            // Add to publish history
            const publishEntry = {
                timestamp: state.lastPublishTime,
                mode: state.mode,
                success: action.payload?.success || false,
                error: action.payload?.error || null,
                filesCount: action.payload?.filesCount || 0
            };
            
            state.publishHistory.unshift(publishEntry);
            
            // Keep only the last 10 publish entries
            if (state.publishHistory.length > 10) {
                state.publishHistory = state.publishHistory.slice(0, 10);
            }
        },

        // Clear publish history
        clearHistory: (state) => {
            state.publishHistory = [];
        },

        // Set CSS bundling preference
        setBundleCss: (state, action) => {
            state.bundleCss = action.payload;
            try {
                const settings = loadPublishSettings();
                settings.bundleCss = action.payload;
                localStorage.setItem(STORAGE_KEYS.PUBLISH_SETTINGS, JSON.stringify(settings));
            } catch (e) {
                console.error('[PublishSlice] Failed to persist CSS bundling setting:', e);
            }
        },

        // Set minification preference
        setMinifyOutput: (state, action) => {
            state.minifyOutput = action.payload;
            try {
                const settings = loadPublishSettings();
                settings.minifyOutput = action.payload;
                localStorage.setItem(STORAGE_KEYS.PUBLISH_SETTINGS, JSON.stringify(settings));
            } catch (e) {
                console.error('[PublishSlice] Failed to persist minify setting:', e);
            }
        },

        // Set source maps preference
        setIncludeSourceMaps: (state, action) => {
            state.includeSourceMaps = action.payload;
            try {
                const settings = loadPublishSettings();
                settings.includeSourceMaps = action.payload;
                localStorage.setItem(STORAGE_KEYS.PUBLISH_SETTINGS, JSON.stringify(settings));
            } catch (e) {
                console.error('[PublishSlice] Failed to persist source maps setting:', e);
            }
        },

        // Set publish directory
        setPublishDirectory: (state, action) => {
            state.publishDirectory = action.payload;
            try {
                const settings = loadPublishSettings();
                settings.publishDirectory = action.payload;
                localStorage.setItem(STORAGE_KEYS.PUBLISH_SETTINGS, JSON.stringify(settings));
            } catch (e) {
                console.error('[PublishSlice] Failed to persist publish directory:', e);
            }
        },

        // Set remote endpoint
        setRemoteEndpoint: (state, action) => {
            state.remoteEndpoint = action.payload;
            try {
                const settings = loadPublishSettings();
                settings.remoteEndpoint = action.payload;
                localStorage.setItem(STORAGE_KEYS.PUBLISH_SETTINGS, JSON.stringify(settings));
            } catch (e) {
                console.error('[PublishSlice] Failed to persist remote endpoint:', e);
            }
        },

        // Set auth token
        setAuthToken: (state, action) => {
            state.authToken = action.payload;
            try {
                const settings = loadPublishSettings();
                settings.authToken = action.payload;
                localStorage.setItem(STORAGE_KEYS.PUBLISH_SETTINGS, JSON.stringify(settings));
            } catch (e) {
                console.error('[PublishSlice] Failed to persist auth token:', e);
            }
        },

        // Reset all settings to defaults
        resetSettings: (state) => {
            Object.assign(state, {
                mode: 'local',
                bundleCss: true,
                minifyOutput: false,
                includeSourceMaps: false,
                publishDirectory: '',
                remoteEndpoint: '',
                authToken: '',
                lastPublishTime: null,
                isPublishing: false,
                publishHistory: []
            });
            
            try {
                localStorage.removeItem(STORAGE_KEYS.PUBLISH_MODE);
                localStorage.removeItem(STORAGE_KEYS.PUBLISH_SETTINGS);
            } catch (e) {
                console.error('[PublishSlice] Failed to clear persisted settings:', e);
            }
        }
    }
});

export const {
    setPublishMode,
    updateSettings,
    startPublishing,
    finishPublishing,
    clearHistory,
    setBundleCss,
    setMinifyOutput,
    setIncludeSourceMaps,
    setPublishDirectory,
    setRemoteEndpoint,
    setAuthToken,
    resetSettings
} = publishSlice.actions;

export { publishSlice };
export default publishSlice.reducer; 