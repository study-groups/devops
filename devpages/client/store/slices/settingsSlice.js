/**
 * @file settingsSlice.js  
 * @description Settings slice for Redux
 * Manages application settings including preview, publish, design tokens, etc.
 */

// --- Action Types ---
const UPDATE_PREVIEW = 'settings/updatePreview';
const RESET_PREVIEW = 'settings/resetPreview';
const SET_PREVIEW_CSS_FILES = 'settings/setPreviewCssFiles';
const ADD_PREVIEW_CSS = 'settings/addPreviewCss';
const REMOVE_PREVIEW_CSS = 'settings/removePreviewCss';
const TOGGLE_PREVIEW_CSS_ENABLED = 'settings/togglePreviewCssEnabled';
const UPDATE_CSS_INJECTION_MODE = 'settings/updateCssInjectionMode';
const UPDATE_PUBLISH = 'settings/updatePublish';
const UPDATE_PAGE_THEME = 'settings/updatePageTheme';
const UPDATE_DESIGN_TOKENS = 'settings/updateDesignTokens';
const SET_CURRENT_CONTEXT = 'settings/setCurrentContext';
const SET_SELECTED_ORG = 'settings/setSelectedOrg';

// --- Initial State ---
const defaultSettings = {
    preview: {
        cssFiles: [],
        activeCssFiles: [],
        enableRootCss: localStorage.getItem('devpages_enable_root_css') === 'true',
        bundleCss: localStorage.getItem('devpages_css_bundling_enabled') !== 'false',
        cssPrefix: localStorage.getItem('devpages_css_prefix') || '',
        renderMode: 'direct',
        cssInjectionMode: localStorage.getItem('devpages_css_injection_mode') || 'inject',
        debounceDelay: 150,
        skipUnchanged: true,
        //... other preview settings
    },
    publish: {
        mode: localStorage.getItem('devpages_publish_mode') || 'local',
        bundleCss: true,
    },
    //... other settings categories
};

// --- Reducer ---
export function settingsReducer(state = defaultSettings, action) {
    switch (action.type) {
        case UPDATE_PREVIEW:
            return { ...state, preview: { ...state.preview, ...action.payload } };
        // ... other cases
        default:
            return state;
    }
}

// --- Action Creators ---
export const settingsActions = {
    updatePreview: (payload) => ({ type: UPDATE_PREVIEW, payload }),
    // ... other action creators
};


// --- Thunks ---
export const settingsThunks = {
    loadInitialSettings: () => (dispatch) => {
        dispatch(settingsThunks.loadPreviewCssFiles());
    },
    loadPreviewCssFiles: () => (dispatch) => {
        try {
            const stored = localStorage.getItem('devpages_preview_css_files');
            if (stored) {
                dispatch({ type: SET_PREVIEW_CSS_FILES, payload: JSON.parse(stored) });
            }
        } catch (e) {
            console.warn('[Settings] Failed to load preview CSS files:', e);
        }
    },
    savePreviewCssFiles: () => (dispatch, getState) => {
        const { cssFiles } = getState().settings.preview;
        localStorage.setItem('devpages_preview_css_files', JSON.stringify(cssFiles));
    }
};

console.log('[settingsSlice] Migrated to standard Redux pattern.'); 