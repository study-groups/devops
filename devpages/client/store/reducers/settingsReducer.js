import { ActionTypes } from '/client/messaging/messageQueue.js';
import { eventBus } from '/client/eventBus.js';

const PREVIEW_CSS_FILES_KEY = 'devpages_preview_css_files';
const ENABLE_ROOT_CSS_KEY = 'devpages_enable_root_css';

// Define the initial state for the settings slice
const initialState = {
    preview: {
        cssFiles: [], // Array of { path: string, enabled: boolean }
        activeCssFiles: [], // Array of strings (paths of currently active CSS)
        enableRootCss: true, // Whether the main global styles.css is enabled
    },
    // Add other setting categories here if needed
};

// --- Settings Slice Reducer ---
export function settingsReducer(state = initialState, action) {
    const { type, payload } = action;
    const currentSettings = state;
    // Ensure preview state exists
    const currentPreviewState = currentSettings.preview || { ...initialState.preview }; 
    let nextState = currentSettings;
    let nextPreviewState = currentPreviewState;
    let updated = false;
    let emitCssUpdateEvent = false; // Flag to trigger event emission

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
    }

    // Update the overall settings state if the preview slice changed
    if (updated) {
        nextState = { ...currentSettings, preview: nextPreviewState };
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
    }
    // ----------------------------------------------------------

    // Ensure the settings slice always returns a valid object structure
    return nextState;
}
