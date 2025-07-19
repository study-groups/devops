/**
 * @file settingsSlice.js  
 * @description Settings slice using StateKit createSlice pattern
 * Manages application settings including preview, publish, design tokens, etc.
 */

import { createSlice } from '/packages/devpages-statekit/src/index.js';

// Storage keys for persistence
const STORAGE_KEYS = {
    PREVIEW_CSS_FILES: 'devpages_preview_css_files',
    ENABLE_ROOT_CSS: 'devpages_enable_root_css',
    CSS_BUNDLING: 'devpages_css_bundling_enabled',
    CSS_PREFIX: 'devpages_css_prefix',
    PUBLISH_MODE: 'devpages_publish_mode',
    PREVIEW_MODE: 'devpages_preview_mode',
    PAGE_THEME_DIR: 'devpages_page_theme_dir',
    PAGE_THEME_MODE: 'devpages_page_theme_mode',
    DESIGN_TOKENS_ACTIVE_THEME: 'devpages_active_theme',
    DESIGN_TOKENS_THEME_VARIANT: 'devpages_theme_variant',
    DESIGN_TOKENS_DIR: 'devpages_design_tokens_dir',
    CURRENT_CONTEXT: 'devpages_current_context',
    CSS_INJECTION_MODE: 'devpages_css_injection_mode',
    PREVIEW_SETTINGS: 'devpages_preview_settings'
};

// Helper functions to load persisted settings
function loadPreviewCssFiles() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.PREVIEW_CSS_FILES);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.warn('[SettingsSlice] Failed to load preview CSS files:', e);
        return [];
    }
}

function loadPreviewSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.PREVIEW_SETTINGS);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.warn('[SettingsSlice] Failed to load preview settings:', e);
        return {};
    }
}

// Default settings
const defaultSettings = {
    preview: {
        cssFiles: [], // Initial state is empty, will be loaded by thunk
        activeCssFiles: [],
        enableRootCss: localStorage.getItem(STORAGE_KEYS.ENABLE_ROOT_CSS) === 'true',
        bundleCss: localStorage.getItem(STORAGE_KEYS.CSS_BUNDLING) !== 'false',
        cssPrefix: localStorage.getItem(STORAGE_KEYS.CSS_PREFIX) || '',
        renderMode: 'direct',
        cssInjectionMode: localStorage.getItem(STORAGE_KEYS.CSS_INJECTION_MODE) || 'inject',
        // Default preview behavior settings
        debounceDelay: 150,
        skipUnchanged: true,
        queueUpdates: true,
        showLoadingAnimation: true,
        showSuccessFeedback: true,
        smoothErrors: true,
        showRetryButton: true,
        errorTimeout: 5000,
        autoScroll: true,
        showShimmerEffect: true,
        ...loadPreviewSettings()
    },
    publish: {
        mode: localStorage.getItem(STORAGE_KEYS.PUBLISH_MODE) || 'local',
        bundleCss: true,
    },
    pageTheme: {
        themeDir: localStorage.getItem(STORAGE_KEYS.PAGE_THEME_DIR) || '',
        themeMode: localStorage.getItem(STORAGE_KEYS.PAGE_THEME_MODE) || 'light',
    },
    designTokens: {
        activeTheme: localStorage.getItem(STORAGE_KEYS.DESIGN_TOKENS_ACTIVE_THEME) || 'corporate-blue',
        themeVariant: localStorage.getItem(STORAGE_KEYS.DESIGN_TOKENS_THEME_VARIANT) || 'light',
        spacingVariant: localStorage.getItem('devpages_spacing_variant') || 'normal',
        tokensDirectory: localStorage.getItem(STORAGE_KEYS.DESIGN_TOKENS_DIR) || '/root/pj/md/themes'
    },
    currentContext: localStorage.getItem(STORAGE_KEYS.CURRENT_CONTEXT) || '',
    selectedOrg: 'pixeljam-arcade'
};

// Load persisted CSS files is now handled by a thunk

// Define thunks separately to avoid circular references within createSlice
const settingsThunks = {
    loadInitialSettings: () => (dispatch, getState) => {
        // Now it can safely dispatch another thunk from this same object
        dispatch(settingsThunks.loadPreviewCssFiles());
    },
    loadPreviewCssFiles: () => (dispatch, getState) => {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.PREVIEW_CSS_FILES);
            if (stored) {
                const cssFiles = JSON.parse(stored);
                dispatch(settingsSlice.actions.setPreviewCssFiles(cssFiles));
            }
        } catch (e) {
            console.warn('[SettingsSlice] Failed to load or parse preview CSS files from localStorage:', e);
            dispatch(settingsSlice.actions.setPreviewCssFiles([]));
        }
    },
    savePreviewCssFiles: () => (dispatch, getState) => {
        const { cssFiles } = getState().settings.preview;
        try {
            localStorage.setItem(STORAGE_KEYS.PREVIEW_CSS_FILES, JSON.stringify(cssFiles));
        } catch (e) {
            console.error('[SettingsSlice] Failed to persist CSS files:', e);
        }
    }
};

const settingsSlice = createSlice({
    name: 'settings',
    initialState: defaultSettings,
    reducers: {
        // Preview settings
        updatePreview: (state, action) => {
            state.preview = { ...state.preview, ...action.payload };
            // Persist to localStorage
            try {
                localStorage.setItem(STORAGE_KEYS.PREVIEW_SETTINGS, JSON.stringify(state.preview));
            } catch (e) {
                console.error('[SettingsSlice] Failed to persist preview settings:', e);
            }
        },

        resetPreview: (state, action) => {
            const defaultPreviewSettings = action.payload || {
                smoothErrors: true,
                showRetryButton: true,
                errorTimeout: 5000,
                debounceDelay: 150,
                skipUnchanged: true,
                queueUpdates: true,
                showLoadingAnimation: true,
                showSuccessFeedback: true,
                showShimmerEffect: true,
                autoScroll: true
            };
            state.preview = { ...state.preview, ...defaultPreviewSettings };
            try {
                localStorage.setItem(STORAGE_KEYS.PREVIEW_SETTINGS, JSON.stringify(state.preview));
            } catch (e) {
                console.error('[SettingsSlice] Failed to persist preview settings:', e);
            }
        },

        // CSS file management
        setPreviewCssFiles: (state, action) => {
            state.preview.cssFiles = action.payload;
        },
        addPreviewCss: (state, action) => {
            const { path, enabled = true } = action.payload;
            const existingIndex = state.preview.cssFiles.findIndex(file => file.path === path);
            
            if (existingIndex === -1) {
                state.preview.cssFiles.push({ path, enabled });
            } else {
                state.preview.cssFiles[existingIndex].enabled = enabled;
            }
        },

        removePreviewCss: (state, action) => {
            const path = action.payload;
            state.preview.cssFiles = state.preview.cssFiles.filter(file => file.path !== path);
        },

        togglePreviewCssEnabled: (state, action) => {
            const path = action.payload;
            const file = state.preview.cssFiles.find(file => file.path === path);
            if (file) {
                file.enabled = !file.enabled;
            }
        },

        updateCssInjectionMode: (state, action) => {
            const mode = action.payload;
            if (['inject', 'bundle'].includes(mode)) {
                state.preview.cssInjectionMode = mode;
                try {
                    localStorage.setItem(STORAGE_KEYS.CSS_INJECTION_MODE, mode);
                } catch (e) {
                    console.error('[SettingsSlice] Failed to persist CSS injection mode:', e);
                }
            }
        },

        // Publish settings
        updatePublish: (state, action) => {
            state.publish = { ...state.publish, ...action.payload };
            if (action.payload.mode) {
                try {
                    localStorage.setItem(STORAGE_KEYS.PUBLISH_MODE, action.payload.mode);
                } catch (e) {
                    console.error('[SettingsSlice] Failed to persist publish mode:', e);
                }
            }
        },

        // Page theme settings
        updatePageTheme: (state, action) => {
            state.pageTheme = { ...state.pageTheme, ...action.payload };
            if (action.payload.themeDir) {
                try {
                    localStorage.setItem(STORAGE_KEYS.PAGE_THEME_DIR, action.payload.themeDir);
                } catch (e) {
                    console.error('[SettingsSlice] Failed to persist theme dir:', e);
                }
            }
            if (action.payload.themeMode) {
                try {
                    localStorage.setItem(STORAGE_KEYS.PAGE_THEME_MODE, action.payload.themeMode);
                } catch (e) {
                    console.error('[SettingsSlice] Failed to persist theme mode:', e);
                }
            }
        },

        // Design tokens settings
        updateDesignTokens: (state, action) => {
            state.designTokens = { ...state.designTokens, ...action.payload };
            
            // Persist individual settings
            if (action.payload.activeTheme) {
                try {
                    localStorage.setItem(STORAGE_KEYS.DESIGN_TOKENS_ACTIVE_THEME, action.payload.activeTheme);
                } catch (e) {
                    console.error('[SettingsSlice] Failed to persist active theme:', e);
                }
            }
            if (action.payload.themeVariant) {
                try {
                    localStorage.setItem(STORAGE_KEYS.DESIGN_TOKENS_THEME_VARIANT, action.payload.themeVariant);
                } catch (e) {
                    console.error('[SettingsSlice] Failed to persist theme variant:', e);
                }
            }
            if (action.payload.spacingVariant) {
                try {
                    localStorage.setItem('devpages_spacing_variant', action.payload.spacingVariant);
                } catch (e) {
                    console.error('[SettingsSlice] Failed to persist spacing variant:', e);
                }
            }
            if (action.payload.tokensDirectory) {
                try {
                    localStorage.setItem(STORAGE_KEYS.DESIGN_TOKENS_DIR, action.payload.tokensDirectory);
                } catch (e) {
                    console.error('[SettingsSlice] Failed to persist tokens directory:', e);
                }
            }
        },

        // Current context
        setCurrentContext: (state, action) => {
            state.currentContext = action.payload;
            try {
                localStorage.setItem(STORAGE_KEYS.CURRENT_CONTEXT, action.payload);
            } catch (e) {
                console.error('[SettingsSlice] Failed to persist current context:', e);
            }
        },

        // Organization selection
        setSelectedOrg: (state, action) => {
            state.selectedOrg = action.payload;
        },

        // General setting update
        updateSetting: (state, action) => {
            const { path, value } = action.payload;
            const keys = path.split('.');
            let current = state;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
        }
    },
    extraReducers: (builder) => {
        // This is where you would handle actions from other slices if needed
    },
    thunks: settingsThunks
});

export const { 
    updatePreview, 
    resetPreview,
    addPreviewCss, 
    removePreviewCss, 
    togglePreviewCssEnabled,
    updateCssInjectionMode,
    updatePublish, 
    updatePageTheme, 
    updateDesignTokens, 
    setCurrentContext, 
    setSelectedOrg,
    updateSetting,
    setPreviewCssFiles
} = settingsSlice.actions;

export { settingsThunks };
export const settingsReducer = settingsSlice.reducer;

export default settingsSlice; 