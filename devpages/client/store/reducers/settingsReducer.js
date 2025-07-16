import { ActionTypes } from '/client/messaging/actionTypes.js';
import { eventBus } from '/client/eventBus.js';
import { createReducer, createPersister, loadFromStorage } from './reducerUtils.js';
import { publishService } from '/client/services/PublishService.js';

const PREVIEW_CSS_FILES_KEY = 'devpages_preview_css_files';
const ENABLE_ROOT_CSS_KEY = 'devpages_enable_root_css';
const CSS_BUNDLING_KEY = 'devpages_css_bundling_enabled';
const CSS_PREFIX_KEY = 'devpages_css_prefix';
const PUBLISH_MODE_KEY = 'devpages_publish_mode';
const PREVIEW_MODE_KEY = 'devpages_preview_mode';
const PAGE_THEME_DIR_KEY = 'devpages_page_theme_dir';
const PAGE_THEME_MODE_KEY = 'devpages_page_theme_mode';
const DESIGN_TOKENS_ACTIVE_THEME_KEY = 'devpages_active_theme';
const DESIGN_TOKENS_THEME_VARIANT_KEY = 'devpages_theme_variant';
const DESIGN_TOKENS_DIR_KEY = 'devpages_design_tokens_dir';
const CURRENT_CONTEXT_KEY = 'devpages_current_context';
const CSS_INJECTION_MODE_KEY = 'devpages_css_injection_mode';

/**
 * Load settings from localStorage with fallback to defaults
 */
function loadPersistedSettings() {
    const defaults = {
        preview: {
            cssFiles: [],
            activeCssFiles: [],
            enableRootCss: false,
            bundleCss: true,
            cssPrefix: '',
            renderMode: 'direct',
        },
        publish: {
            mode: 'local',
            bundleCss: true,
        },
        pageTheme: {
            themeDir: '',
            themeMode: 'light', // 'light' or 'dark'
        },
        designTokens: {
            activeTheme: 'corporate-blue',
            themeVariant: 'light', // 'light' or 'dark'
            spacingVariant: 'normal', // 'tight', 'normal', or 'comfortable'
            tokensDirectory: '/root/pj/md/themes'
        },
        currentContext: ''
    };

    try {
        // Load preview CSS files
        const savedCssFiles = localStorage.getItem(PREVIEW_CSS_FILES_KEY);
        if (savedCssFiles) {
            const parsed = JSON.parse(savedCssFiles);
            if (Array.isArray(parsed)) {
                defaults.preview.cssFiles = parsed;
            }
        }

        // Force disable root CSS (using theme system instead)
        defaults.preview.enableRootCss = false;
        // Clear the localStorage setting to prevent confusion
        localStorage.removeItem(ENABLE_ROOT_CSS_KEY);

        // Load CSS bundling preference
        const savedBundling = localStorage.getItem(CSS_BUNDLING_KEY);
        if (savedBundling !== null) {
            defaults.preview.bundleCss = savedBundling === 'true';
        }

        // Load CSS prefix
        const savedPrefix = localStorage.getItem(CSS_PREFIX_KEY);
        if (savedPrefix !== null) {
            defaults.preview.cssPrefix = savedPrefix;
        }

        // Load publish mode
        const savedPublishMode = localStorage.getItem(PUBLISH_MODE_KEY);
        if (savedPublishMode && ['local', 'spaces'].includes(savedPublishMode)) {
            defaults.publish.mode = savedPublishMode;
        }

        // Load preview mode
        const savedPreviewMode = localStorage.getItem(PREVIEW_MODE_KEY);
        if (savedPreviewMode && ['direct', 'iframe'].includes(savedPreviewMode)) {
            defaults.preview.renderMode = savedPreviewMode;
        }

        // Load CSS injection mode
        const savedCssInjectionMode = localStorage.getItem(CSS_INJECTION_MODE_KEY);
        if (savedCssInjectionMode && ['inject', 'bundle'].includes(savedCssInjectionMode)) {
            defaults.preview.cssInjectionMode = savedCssInjectionMode;
        } else {
            defaults.preview.cssInjectionMode = 'inject'; // Default to inject mode
        }

        // Load Page Theme settings
        const savedThemeDir = localStorage.getItem(PAGE_THEME_DIR_KEY);
        if (savedThemeDir) {
            defaults.pageTheme.themeDir = savedThemeDir;
        }

        const savedThemeMode = localStorage.getItem(PAGE_THEME_MODE_KEY);
        if (savedThemeMode && ['light', 'dark'].includes(savedThemeMode)) {
            defaults.pageTheme.themeMode = savedThemeMode;
        }

        // Load Design Tokens settings
        const savedActiveTheme = localStorage.getItem(DESIGN_TOKENS_ACTIVE_THEME_KEY);
        if (savedActiveTheme) {
            defaults.designTokens.activeTheme = savedActiveTheme;
        }

        const savedThemeVariant = localStorage.getItem(DESIGN_TOKENS_THEME_VARIANT_KEY);
        if (savedThemeVariant && ['light', 'dark'].includes(savedThemeVariant)) {
            defaults.designTokens.themeVariant = savedThemeVariant;
        }

        const savedSpacingVariant = localStorage.getItem('devpages_spacing_variant');
        if (savedSpacingVariant && ['tight', 'normal', 'comfortable'].includes(savedSpacingVariant)) {
            defaults.designTokens.spacingVariant = savedSpacingVariant;
        }

        const savedTokensDir = localStorage.getItem(DESIGN_TOKENS_DIR_KEY);
        if (savedTokensDir) {
            defaults.designTokens.tokensDirectory = savedTokensDir;
        }

        // Load current context
        const savedCurrentContext = localStorage.getItem(CURRENT_CONTEXT_KEY);
        if (savedCurrentContext) {
            defaults.currentContext = savedCurrentContext;
        }

        // Load dynamic preview settings (debounceDelay, animations, etc.)
        const savedPreviewSettings = localStorage.getItem('devpages_preview_settings');
        if (savedPreviewSettings) {
            try {
                const previewSettings = JSON.parse(savedPreviewSettings);
                if (previewSettings && typeof previewSettings === 'object') {
                    defaults.preview = { ...defaults.preview, ...previewSettings };
                    console.debug('[Settings] Loaded dynamic preview settings:', previewSettings);
                }
            } catch (e) {
                console.warn('[Settings] Failed to parse saved preview settings:', e);
            }
        } else {
            // Set default preview settings if none are saved
            defaults.preview = {
                ...defaults.preview,
                debounceDelay: 150,
                skipUnchanged: true,
                queueUpdates: true,
                showLoadingAnimation: true,
                showSuccessFeedback: true,
                smoothErrors: true,
                showRetryButton: true,
                errorTimeout: 5000,
                autoScroll: true
            };
        }

        console.debug('[Settings] Loaded persisted settings:', defaults);
        return defaults;
    } catch (error) {
        console.error('[Settings] Error loading persisted settings, using defaults:', error);
        return defaults;
    }
}

// Initialize state with persisted settings
const persistedSettings = loadPersistedSettings();

// Clean initial state with persisted values
const initialState = {
    selectedOrg: 'pixeljam-arcade', // Simple org selection
    preview: persistedSettings.preview,
    publish: persistedSettings.publish,
    pageTheme: persistedSettings.pageTheme,
    designTokens: persistedSettings.designTokens,
    currentContext: persistedSettings.currentContext,
};

// --- Settings Slice Reducer ---
export function settingsReducer(state = initialState, action) {
    const { type, payload } = action;
    const currentSettings = state;
    // Ensure preview state exists
    const currentPreviewState = currentSettings.preview || { ...initialState.preview }; 
    const currentPublishState = currentSettings.publish || { ...initialState.publish };
    const currentPageThemeState = currentSettings.pageTheme || { ...initialState.pageTheme };
    const currentDesignTokensState = currentSettings.designTokens || { ...initialState.designTokens };
    let nextState = currentSettings;
    let nextPreviewState = currentPreviewState;
    let nextPublishState = currentPublishState;
    let nextPageThemeState = currentPageThemeState;
    let nextDesignTokensState = currentDesignTokensState;
    let updated = false;
    let emitCssUpdateEvent = false;

    switch (type) {
        case ActionTypes.SETTINGS_ADD_PREVIEW_CSS:
            if (payload && typeof payload === 'string' && payload.trim()) {
                const currentFiles = currentPreviewState.cssFiles || [];
                if (!currentFiles.some(item => item.path === payload)) {
                    const newItem = { path: payload, enabled: true };
                    nextPreviewState = { ...currentPreviewState, cssFiles: [...currentFiles, newItem] };
                    updated = true; emitCssUpdateEvent = true;
                    console.debug(`[Reducer] Added preview CSS config:`, newItem);
                } else { console.warn(`[Reducer] Attempted to add duplicate CSS config path: "${payload}"`); }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_ADD_PREVIEW_CSS:`, payload); }
            break;

        case ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS:
            if (payload && typeof payload === 'string') {
                const currentFiles = currentPreviewState.cssFiles || [];
                const updatedFiles = currentFiles.filter(item => item.path !== payload);
                if (updatedFiles.length !== currentFiles.length) {
                    nextPreviewState = { ...currentPreviewState, cssFiles: updatedFiles };
                    updated = true; emitCssUpdateEvent = true;
                    console.debug(`[Reducer] Removed preview CSS config for path: "${payload}"`);
                } else { console.warn(`[Reducer] Attempted to remove non-existent CSS config path: "${payload}"`); }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_REMOVE_PREVIEW_CSS:`, payload); }
            break;

        case ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED:
             if (payload && typeof payload === 'string') {
                const currentFiles = currentPreviewState.cssFiles || [];
                let found = false;
                const updatedFiles = currentFiles.map(item => {
                    if (item.path === payload) {
                        found = true;
                        return { ...item, enabled: !item.enabled }; // Flip the enabled flag
                    }
                    return item;
                });
                if (found) {
                    nextPreviewState = { ...currentPreviewState, cssFiles: updatedFiles };
                    updated = true; emitCssUpdateEvent = true;
                     console.debug(`[Reducer] Toggled enabled state for preview CSS: "${payload}"`);
                } else { console.warn(`[Reducer] Path not found for toggle: "${payload}"`); }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED:`, payload); }
            break;

        case ActionTypes.SETTINGS_TOGGLE_ROOT_CSS_ENABLED: // No payload needed
            const currentEnableRoot = currentPreviewState.enableRootCss ?? true;
            const newEnableRoot = !currentEnableRoot;
            nextPreviewState = { ...currentPreviewState, enableRootCss: newEnableRoot };
            updated = true; emitCssUpdateEvent = true;
            console.debug(`[Reducer] Toggled enableRootCss to: ${newEnableRoot}`);
            // Persist this setting
            try { localStorage.setItem(ENABLE_ROOT_CSS_KEY, String(newEnableRoot)); } // Store as string
            catch (e) { console.error('[Reducer] Failed to save enableRootCss to localStorage:', e); }
            break;

        case ActionTypes.SETTINGS_SET_CSS_BUNDLING_ENABLED:
            if (typeof payload === 'boolean') {
                nextPreviewState = { ...currentPreviewState, bundleCss: payload };
                updated = true;
                console.debug(`[Reducer] Set CSS bundling enabled to: ${payload}`);
                // Persist this setting
                try { localStorage.setItem(CSS_BUNDLING_KEY, String(payload)); }
                catch (e) { console.error('[Reducer] Failed to save CSS bundling setting to localStorage:', e); }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_SET_CSS_BUNDLING_ENABLED:`, payload); }
            break;

        case ActionTypes.SETTINGS_SET_CSS_PREFIX:
            if (typeof payload === 'string') {
                nextPreviewState = { ...currentPreviewState, cssPrefix: payload };
                updated = true;
                console.debug(`[Reducer] Set CSS prefix to: "${payload}"`);
                // Persist this setting
                try { localStorage.setItem(CSS_PREFIX_KEY, payload); }
                catch (e) { console.error('[Reducer] Failed to save CSS prefix to localStorage:', e); }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_SET_CSS_PREFIX:`, payload); }
            break;

        case ActionTypes.SETTINGS_SET_PUBLISH_MODE:
            if (typeof payload === 'string' && ['local', 'spaces'].includes(payload)) {
                nextPublishState = { ...currentPublishState, mode: payload };
                updated = true;
                console.debug(`[Reducer] Set publish mode to: ${payload}`);
                // Persist this setting
                try { localStorage.setItem(PUBLISH_MODE_KEY, payload); }
                catch (e) { console.error('[Reducer] Failed to save publish mode to localStorage:', e); }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_SET_PUBLISH_MODE:`, payload); }
            break;

        case ActionTypes.SETTINGS_SET_PUBLISH_CSS_BUNDLING:
            if (typeof payload === 'boolean') {
                nextPublishState = { ...currentPublishState, bundleCss: payload };
                updated = true;
                console.debug(`[Reducer] Set publish CSS bundling to: ${payload}`);
                // Note: Publish CSS bundling is separate from preview bundling
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_SET_PUBLISH_CSS_BUNDLING:`, payload); }
            break;

        case ActionTypes.SETTINGS_SET_ACTIVE_PREVIEW_CSS:
             if (Array.isArray(payload)) {
                 // Check if the sorted arrays are different to avoid unnecessary updates
                 if (JSON.stringify(payload.sort()) !== JSON.stringify((currentPreviewState.activeCssFiles || []).sort())) {
                    nextPreviewState = { ...currentPreviewState, activeCssFiles: payload };
                    updated = true;
                    console.debug(`[Reducer] Updated active preview CSS files:`, payload);
                 }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_SET_ACTIVE_PREVIEW_CSS:`, payload); }
            break;

        case ActionTypes.SETTINGS_SET_PREVIEW_CSS_FILES:
            if (Array.isArray(payload)) {
                // Basic validation of payload structure
                const isValid = payload.every(item => typeof item.path === 'string' && typeof item.enabled === 'boolean');
                if (isValid) {
                    nextPreviewState = { ...currentPreviewState, cssFiles: payload };
                    updated = true; emitCssUpdateEvent = true;
                    console.debug(`[Reducer] Set preview CSS files configuration:`, payload);
                    // Persist the full list when set directly
                    try { localStorage.setItem(PREVIEW_CSS_FILES_KEY, JSON.stringify(payload)); } catch (e) { /* handle error */ }
                } else {
                    console.warn(`[Reducer] Invalid structure in payload for SETTINGS_SET_PREVIEW_CSS_FILES:`, payload);
                }
            } else { console.warn(`[Reducer] Invalid payload type for SETTINGS_SET_PREVIEW_CSS_FILES:`, payload); }
            break;

        case ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED:
            if (typeof payload === 'boolean') {
                if (currentPreviewState.enableRootCss !== payload) {
                    nextPreviewState = { ...currentPreviewState, enableRootCss: payload };
                    updated = true; emitCssUpdateEvent = true;
                    console.debug(`[Reducer] Set root CSS enabled state to:`, payload);
                    try { localStorage.setItem(ENABLE_ROOT_CSS_KEY, String(payload)); } // Store as string
                    catch (e) { console.error('[Reducer] Failed to save enableRootCss:', e); }
                }
            } else { console.warn(`[Reducer] Invalid payload type for SETTINGS_SET_ROOT_CSS_ENABLED:`, payload); }
            break;

        case ActionTypes.SETTINGS_SET_SELECTED_ORG:
            if (typeof payload === 'string' && (payload === 'pixeljam-arcade' || payload === 'nodeholder')) {
                if (state.selectedOrg !== payload) {
                    console.log(`[Settings] Changing selected org from '${state.selectedOrg}' to '${payload}'`);
                    
                    // Save to localStorage
                    try {
                        localStorage.setItem('devpages_selected_org', payload);
                        console.debug(`[Settings] Saved selected org to localStorage: ${payload}`);
                    } catch (e) {
                        console.error('[Settings] Failed to save selected org to localStorage:', e);
                    }
                    
                    return { 
                        ...state, 
                        selectedOrg: payload
                    };
                }
            } else {
                console.warn(`[Reducer] Invalid payload for SETTINGS_SET_SELECTED_ORG:`, payload);
            }
            break;

        case ActionTypes.SETTINGS_SET_PREVIEW_MODE:
            const newPreviewMode = action.payload;
            try {
                localStorage.setItem('devpages_preview_mode', newPreviewMode);
            } catch (e) {
                console.error('Error saving preview mode to localStorage:', e);
            }
            return {
                ...state,
                settings: {
                    ...state.settings,
                    preview: {
                        ...state.settings.preview,
                        renderMode: newPreviewMode
                    }
                }
            };

        case ActionTypes.SETTINGS_UPDATE_CSS_INJECTION_MODE:
            if (typeof payload === 'string' && ['inject', 'bundle'].includes(payload)) {
                nextPreviewState = { ...currentPreviewState, cssInjectionMode: payload };
                updated = true;
                console.debug(`[Reducer] Set CSS injection mode to: ${payload}`);
                // Persist this setting
                try { localStorage.setItem(CSS_INJECTION_MODE_KEY, payload); }
                catch (e) { console.error('[Reducer] Failed to save CSS injection mode to localStorage:', e); }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_UPDATE_CSS_INJECTION_MODE:`, payload); }
            break;

        case ActionTypes.SETTINGS_UPDATE_PREVIEW:
            if (payload && typeof payload === 'object') {
                nextPreviewState = { ...currentPreviewState, ...payload };
                updated = true;
                console.debug(`[Reducer] Updated preview settings:`, payload);
                
                // Persist preview settings to localStorage
                try {
                    const previewSettings = { ...currentPreviewState, ...payload };
                    localStorage.setItem('devpages_preview_settings', JSON.stringify(previewSettings));
                } catch (e) {
                    console.error('[Reducer] Failed to save preview settings to localStorage:', e);
                }
            } else { 
                console.warn(`[Reducer] Invalid payload for SETTINGS_UPDATE_PREVIEW:`, payload); 
            }
            break;

        case ActionTypes.SETTINGS_RESET_PREVIEW:
            if (payload && typeof payload === 'object') {
                nextPreviewState = { ...payload };
                updated = true;
                console.debug(`[Reducer] Reset preview settings to defaults:`, payload);
                
                // Clear persisted settings
                try {
                    localStorage.removeItem('devpages_preview_settings');
                } catch (e) {
                    console.error('[Reducer] Failed to clear preview settings from localStorage:', e);
                }
            } else {
                console.warn(`[Reducer] Invalid payload for SETTINGS_RESET_PREVIEW:`, payload);
            }
            break;

        case ActionTypes.SETTINGS_SET_PAGE_THEME_DIR:
            if (typeof payload === 'string') {
                nextPageThemeState = { ...currentPageThemeState, themeDir: payload };
                updated = true;
                try {
                    localStorage.setItem(PAGE_THEME_DIR_KEY, payload);
                } catch (e) {
                    console.error('[Reducer] Failed to save page theme directory:', e);
                }
            }
            break;

        case ActionTypes.SETTINGS_SET_PAGE_THEME_MODE:
            if (typeof payload === 'string' && ['light', 'dark'].includes(payload)) {
                nextPageThemeState = { ...currentPageThemeState, themeMode: payload };
                updated = true;
                try {
                    localStorage.setItem(PAGE_THEME_MODE_KEY, payload);
                } catch (e) {
                    console.error('[Reducer] Failed to save page theme mode:', e);
                }
            }
            break;

        case ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME:
            if (typeof payload === 'string' && payload.trim()) {
                nextDesignTokensState = { ...currentDesignTokensState, activeTheme: payload };
                updated = true;
                try {
                    localStorage.setItem(DESIGN_TOKENS_ACTIVE_THEME_KEY, payload);
                    console.debug(`[Reducer] Set active design theme to: ${payload}`);
                    
                    // DO NOT apply the theme here. This action's only responsibility
                    // is to set the active theme ID. The SETTINGS_SET_DESIGN_THEME_VARIANT
                    // action is the single source of truth for applying the data-theme attribute.
                    
                    // Emit theme change event
                    window.dispatchEvent(new CustomEvent('themeChanged', {
                        detail: { theme: payload, variant: currentDesignTokensState.themeVariant }
                    }));
                } catch (e) {
                    console.error('[Reducer] Failed to save active design theme:', e);
                }
            }
            break;

        case ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT:
            if (typeof payload === 'string' && ['light', 'dark'].includes(payload)) {
                nextDesignTokensState = { ...currentDesignTokensState, themeVariant: payload };
                updated = true;
                try {
                    localStorage.setItem(DESIGN_TOKENS_THEME_VARIANT_KEY, payload);
                    console.debug(`[Reducer] Set design theme variant to: ${payload}`);
                    
                    // Apply theme to document using only the variant (light/dark)
                    document.documentElement.setAttribute('data-theme', payload);
                    
                    // Emit theme change event
                    window.dispatchEvent(new CustomEvent('themeChanged', {
                        detail: { theme: currentDesignTokensState.activeTheme, variant: payload }
                    }));
                } catch (e) {
                    console.error('[Reducer] Failed to save design theme variant:', e);
                }
            }
            break;

        case ActionTypes.SETTINGS_SET_SPACING_VARIANT:
            if (typeof payload === 'string' && ['tight', 'normal', 'comfortable'].includes(payload)) {
                nextDesignTokensState = { ...currentDesignTokensState, spacingVariant: payload };
                updated = true;
                try {
                    localStorage.setItem('devpages_spacing_variant', payload);
                    console.debug(`[Reducer] Set spacing variant to: ${payload}`);
                    
                    // Apply spacing to document
                    document.documentElement.setAttribute('data-spacing', payload);
                    
                    // Emit spacing change event
                    window.dispatchEvent(new CustomEvent('spacingChanged', {
                        detail: { spacing: payload }
                    }));
                } catch (e) {
                    console.error('[Reducer] Failed to save spacing variant:', e);
                }
            }
            break;

        case ActionTypes.SETTINGS_SET_DESIGN_TOKENS_DIR:
            if (typeof payload === 'string') {
                nextDesignTokensState = { ...currentDesignTokensState, tokensDirectory: payload };
                updated = true;
                try {
                    localStorage.setItem(DESIGN_TOKENS_DIR_KEY, payload);
                    console.debug(`[Reducer] Set design tokens directory to: ${payload}`);
                } catch (e) {
                    console.error('[Reducer] Failed to save design tokens directory:', e);
                }
            }
            break;

        case ActionTypes.SETTINGS_SET_CURRENT_CONTEXT:
            if (typeof payload === 'string') {
                nextState = { ...currentSettings, currentContext: payload };
                updated = true;
                try {
                    localStorage.setItem(CURRENT_CONTEXT_KEY, payload);
                    console.debug(`[Reducer] Set current context to: ${payload}`);
                } catch (e) {
                    console.error('[Reducer] Failed to save current context:', e);
                }
            }
            break;

        default:
            // No change for unrecognized actions
            break;
    }

    // Update the overall settings state if any slice changed
    if (updated) {
        nextState = { 
            ...currentSettings, 
            preview: nextPreviewState,
            publish: nextPublishState,
            pageTheme: nextPageThemeState,
            designTokens: nextDesignTokensState,
        };
        
        // Persist the configured cssFiles list if it was modified by add/remove/toggle
        if (type === ActionTypes.SETTINGS_ADD_PREVIEW_CSS ||
            type === ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS ||
            type === ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED) {
             try {
                localStorage.setItem(PREVIEW_CSS_FILES_KEY, JSON.stringify(nextPreviewState.cssFiles));
                 console.debug(`[Reducer] Saved preview CSS config to localStorage:`, nextPreviewState.cssFiles);
            } catch (e) { console.error('[Reducer] Failed to save preview CSS config to localStorage:', e); }
        }
    }

    // --- Emit event AFTER calculating next state, if flagged ---
    if (emitCssUpdateEvent) {
        // Only emit if the CSS-related state actually changed
        const cssRelatedChanged = (
            JSON.stringify(currentPreviewState.cssFiles) !== JSON.stringify(nextPreviewState.cssFiles) ||
            currentPreviewState.enableRootCss !== nextPreviewState.enableRootCss ||
            JSON.stringify(currentPreviewState.activeCssFiles) !== JSON.stringify(nextPreviewState.activeCssFiles)
        );
        
        if (cssRelatedChanged) {
            // Use setTimeout to ensure state update completes before event handler runs
            setTimeout(() => {
                 // MODIFIED: Use console.debug directly for logging
                 console.debug('[Reducer] Emitting preview:cssSettingsChanged event.', 'SETTINGS'); // Removed extra 'debug' level arg
                 if (eventBus && typeof eventBus.emit === 'function') {
                     eventBus.emit('preview:cssSettingsChanged');
                 } else {
                     console.error('[Reducer] eventBus not available for emitting preview:cssSettingsChanged');
                 }
             }, 0);
        } else {
            console.debug('[Reducer] CSS update event flagged but no meaningful CSS state changes detected, skipping emission');
        }
    }
    // ----------------------------------------------------------

    // Ensure the settings slice always returns a valid object structure
    return nextState;
}
