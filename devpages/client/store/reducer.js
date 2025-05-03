import { appStore } from '/client/appState.js'; // Need access to appStore to call update
import { ActionTypes } from '/client/messaging/messageQueue.js';
import { SMART_COPY_B_KEY } from '/client/appState.js';
import { createStore } from '/client/statekit/statekit.js';
import { eventBus } from '/client/eventBus.js'; // <<< Import eventBus

// <<< NEW: Key for localStorage persistence (should match appState.js) >>>
const LOG_VISIBLE_KEY = 'logVisible';
// <<< NEW: Key for persisting plugin state (should match appState.js) >>>
const PLUGINS_STATE_KEY = 'pluginsEnabledState';
// <<< NEW: Key for persisting preview CSS file list >>>
const PREVIEW_CSS_FILES_KEY = 'devpages_preview_css_files';
// <<< NEW: Key for persisting root CSS enabled state >>>
const ENABLE_ROOT_CSS_KEY = 'devpages_enable_root_css';
// <<< NEW: Key for persisting settings panel state >>>
const SETTINGS_PANEL_STATE_KEY = 'devpages_settings_panel_state';

// Create the application state store instance

// --- Auth Slice Reducer ---
function authReducer(state, action) {
    const { type, payload } = action;
    let nextState = state; // Start with current slice state

    switch (type) {
        case ActionTypes.AUTH_INIT_START:
            nextState = { ...state, isInitializing: true, error: null };
            break;
        case ActionTypes.AUTH_INIT_COMPLETE:
            nextState = {
                ...state,
                isInitializing: false,
                isAuthenticated: payload.isAuthenticated,
                user: payload.user || null,
                error: payload.error || null,
            };
            break;
        case ActionTypes.AUTH_LOGIN_SUCCESS:
            nextState = {
                ...state,
                isInitializing: false,
                isAuthenticated: true,
                user: payload.user,
                error: null,
            };
            break;
        case ActionTypes.AUTH_LOGIN_FAILURE:
            nextState = {
                ...state,
                isInitializing: false,
                isAuthenticated: false,
                user: null,
                error: payload.error,
            };
            break;
        case ActionTypes.AUTH_LOGOUT:
            nextState = {
                ...state,
                isAuthenticated: false,
                user: null,
                error: null,
                isInitializing: false,
            };
            break;
        // No default needed, returns original 'state' if no case matches
    }
    return nextState;
}

// --- UI Slice Reducer ---
function uiReducer(state, action) {
    const { type, payload } = action;
    let nextState = state;

    switch (type) {
        case ActionTypes.UI_SET_LOADING:
            nextState = { ...state, isLoading: !!payload };
            break;

        case ActionTypes.UI_SET_LOG_VISIBILITY:
            const newVisibility = !!payload;
            nextState = { ...state, logVisible: newVisibility };
            try {
                localStorage.setItem(LOG_VISIBLE_KEY, newVisibility);
                // console.debug(`[Reducer] Saved logVisible=${newVisibility} to localStorage.`); // Keep or remove debug logs as desired
            } catch (e) { console.error('[Reducer] Failed to save log visibility state to localStorage:', e); }
            break;

        case ActionTypes.UI_TOGGLE_LOG_VISIBILITY:
            const toggledVisibility = !state.logVisible;
            nextState = { ...state, logVisible: toggledVisibility };
            try {
                localStorage.setItem(LOG_VISIBLE_KEY, toggledVisibility);
                // console.debug(`[Reducer] Saved logVisible=${toggledVisibility} to localStorage via toggle.`);
            } catch (e) { console.error('[Reducer] Failed to save log visibility state to localStorage:', e); }
            break;

        case ActionTypes.UI_SET_VIEW_MODE:
            if (payload && ['editor', 'preview', 'split'].includes(payload.viewMode)) {
                nextState = { ...state, viewMode: payload.viewMode };
                // Optionally save to localStorage here too if needed
                // try { localStorage.setItem('viewMode', payload.viewMode); } catch(e) {}\
            }
            break;
    }
    return nextState;
}

// --- Settings Panel Slice Reducer ---
function settingsPanelReducer(state, action) {
    const { type, payload } = action;
    let nextState = state;
    let shouldPersist = false;

    switch(type) {
        case ActionTypes.SETTINGS_PANEL_TOGGLE:
            const newPanelState = { ...state, visible: !state.visible };
            
            // Save the entire app state (or relevant parts) to localStorage
            try {
                const currentAppState = appStore.getState();
                const stateToSave = {
                    ...JSON.parse(localStorage.getItem('devpages_app_state') || '{}'),
                    settingsPanel: newPanelState
                };
                localStorage.setItem('devpages_app_state', JSON.stringify(stateToSave));
            } catch (e) {
                console.error('[Reducer] Failed to save app state:', e);
            }
            
            return newPanelState;
        case ActionTypes.SETTINGS_PANEL_SET_POSITION:
            if (payload && typeof payload.x === 'number' && typeof payload.y === 'number') {
                nextState = { ...state, position: payload };
                shouldPersist = true;
            }
            break;
        case ActionTypes.SETTINGS_PANEL_SET_SIZE:
            if (payload && typeof payload.width === 'number' && typeof payload.height === 'number') {
                nextState = { ...state, size: payload };
                shouldPersist = true;
            }
            break;
        case ActionTypes.SETTINGS_PANEL_TOGGLE_SECTION:
            if (payload && typeof payload.sectionId === 'string') {
                const currentSections = state.collapsedSections || {};
                nextState = {
                    ...state,
                    collapsedSections: {
                        ...currentSections,
                        [payload.sectionId]: !currentSections[payload.sectionId]
                    }
                };
                shouldPersist = true;
            }
            break;
        case ActionTypes.SETTINGS_PANEL_SET_STATE:
            if (payload && typeof payload === 'object') {
                nextState = { ...state, ...payload };
            }
            break;
    }

    // Persist settings panel state
    if (shouldPersist) {
        try {
            localStorage.setItem(SETTINGS_PANEL_STATE_KEY, JSON.stringify(nextState));
        } catch (e) {
            console.error('[Reducer] Failed to save settings panel state:', e);
        }
    }
    
    return nextState;
}


// --- File Slice Reducer (Refactored) ---
function fileReducer(state, action) {
    const { type, payload } = action;
    let nextState = state;

    switch(type) {
        case ActionTypes.FS_INIT_START:
            // Reset most things, keep availableTopLevelDirs if already loaded? No, reset fully.
            nextState = {
                ...state,
                isInitialized: false,
                isLoading: true,
                isSaving: false,
                currentPathname: null,
                isDirectorySelected: false,
                currentListing: { pathname: null, dirs: [], files: [] },
                parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] },
                availableTopLevelDirs: [],
                error: null
            };
            break;
        case ActionTypes.FS_INIT_COMPLETE:
            // Mark as initialized, clear loading unless payload overrides
            // IMPORTANT: Ensure availableTopLevelDirs is preserved if already set by an earlier action
            nextState = {
                ...state,
                isInitialized: true,
                isLoading: payload?.isLoading ?? false, // Allow setting loading if needed
                error: payload?.error || null,
                availableTopLevelDirs: state.availableTopLevelDirs // << Ensure this isn't reset
            };
            break;
        case ActionTypes.FS_SET_STATE:
            // Directly merge payload into the file state
            // Be careful: ensure payload contains valid fields for the file slice
            nextState = { ...state, ...payload };
            break;
        case ActionTypes.FS_LOAD_TOP_DIRS_START:
            nextState = { ...state, isLoading: true, error: null };
            break;
        case ActionTypes.FS_LOAD_TOP_DIRS_ERROR:
            nextState = { ...state, isLoading: false, error: payload.error || 'Failed to load top-level directories.', availableTopLevelDirs: [] };
            break;
        case ActionTypes.FS_SET_TOP_DIRS:
             const topDirs = Array.isArray(payload) ? payload : [];
             // Ensure this log is clear
             console.debug(`[Reducer FS_SET_TOP_DIRS] Handling action. Payload received:`, payload, `Updating availableTopLevelDirs to:`, topDirs);
             nextState = {
                ...state,
                availableTopLevelDirs: topDirs,
             };
            break;
        case ActionTypes.FS_LOAD_LISTING_START:
             // If loading a listing, we are implicitly selecting a directory
             // Also clear parent listing as it might become invalid
            nextState = { ...state, isLoading: true, error: null, parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] } };
            break;
        case ActionTypes.FS_LOAD_LISTING_SUCCESS:
            const newListing = payload.listing || { dirs: [], files: [] };
            // --- Check if this is the root listing ---
            const isRootListing = payload.pathname === '' || payload.pathname === null;
            if (isRootListing) {
                 const rootDirs = Array.isArray(payload.listing?.dirs) ? payload.listing.dirs : [];
                 console.debug(`[Reducer FS_LOAD_LISTING_SUCCESS] Root listing SUCCESS detected. Setting availableTopLevelDirs to:`, rootDirs);
                 nextState = { ...state, availableTopLevelDirs: rootDirs };
            }
            // Merge the rest of the state updates
            nextState = {
                ...state,
                isLoading: false,
                currentListing: { pathname: payload.pathname, dirs: newListing.dirs, files: newListing.files },
                error: null,
                currentPathname: payload.pathname,
                isDirectorySelected: true,
            };
            break;
        case ActionTypes.FS_LOAD_LISTING_ERROR:
             // Clear listing, keep path? Maybe reset path too? Let's keep path for now.
            nextState = {
                ...state,
                isLoading: false,
                currentListing: { pathname: state.currentPathname, dirs: [], files: [] }, // Keep pathname context but clear listing
                error: payload.error || 'Failed to load listing.'
            };
            break;
         // <<< NEW: Handle setting parent listing explicitly >>>
         case ActionTypes.FS_SET_PARENT_LISTING:
             const parentList = payload.listing || { dirs: [], files: [] };
             nextState = {
                 ...state,
                 // Don't change main isLoading flag here, parent listing load is secondary
                 parentListing: {
                     pathname: payload.pathname,
                     triggeringPath: payload.triggeringPath, // Store which path requested this
                     dirs: parentList.dirs,
                     files: parentList.files // Include files even if unused by ContextManager
                 },
                 // Potentially clear error if parent load succeeds? TBD
             };
             break;
        case ActionTypes.FS_LOAD_FILE_START:
            nextState = { ...state, isLoading: true, isSaving: false, error: null };
            break;
        case ActionTypes.FS_LOAD_FILE_SUCCESS:
            // File load success implies we selected a file
            nextState = {
                ...state,
                isLoading: false,
                // Set pathname to the file, mark as NOT directory
                currentPathname: payload.pathname, // Expect payload to have the full file pathname
                isDirectorySelected: false,
                // We might have the parent listing already in currentListing if navigation was correct
                error: null // Clear previous errors on successful load
            };
            break;
        case ActionTypes.FS_LOAD_FILE_ERROR:
            // Keep current path selection, but indicate error
            nextState = { ...state, isLoading: false, error: payload.error || 'Failed to load file.' };
            break;
        case ActionTypes.FS_SAVE_FILE_START:
            nextState = { ...state, isSaving: true, error: null };
            break;
        case ActionTypes.FS_SAVE_FILE_SUCCESS:
            nextState = { ...state, isSaving: false, error: null };
            break;
        case ActionTypes.FS_SAVE_FILE_ERROR:
            nextState = { ...state, isSaving: false, error: payload.error || 'Failed to save file.' };
            break;
        case ActionTypes.FS_CLEAR_ERROR:
            nextState = { ...state, error: null };
            break;
    }
    return nextState;
}


// --- Plugins Slice Reducer ---\
// Assumes state structure like { mermaid: { name: 'Mermaid', enabled: true }, ... }
function pluginsReducer(state, action) {
    const { type, payload } = action;
    let nextState = state;

    switch (type) {
        case ActionTypes.PLUGIN_TOGGLE:
            if (payload && state[payload.pluginId]) {
                const updatedPluginState = {
                    ...state[payload.pluginId], // Keep existing properties like 'name'
                    enabled: !!payload.enabled // Update enabled status
                };
                nextState = {
                    ...state,
                    [payload.pluginId]: updatedPluginState
                };

                // --- Persist only the enabled status ---
                try {
                    const enabledStateToSave = {};
                    for (const pluginId in nextState) {
                        if (nextState[pluginId]) {
                             enabledStateToSave[pluginId] = nextState[pluginId].enabled;
                        }
                    }
                    localStorage.setItem(PLUGINS_STATE_KEY, JSON.stringify(enabledStateToSave));
                } catch (e) {
                    console.error('[Reducer] Failed to save plugin enabled state to localStorage:', e);
                }
            }
            break;
    }
    return nextState;
}

// --- Settings Slice Reducer ---
function settingsReducer(state, action) {
    const { type, payload } = action;
    const currentSettings = state || {};
    const currentPreviewState = currentSettings.preview || { cssFiles: [], activeCssFiles: [], enableRootCss: true };
    let nextState = currentSettings;
    let nextPreviewState = currentPreviewState;
    let updated = false;
    let emitCssUpdateEvent = false; // <<< Flag to trigger event emission

    switch (type) {
        case ActionTypes.SETTINGS_ADD_PREVIEW_CSS:
            if (payload && typeof payload === 'string' && payload.trim()) {
                const currentFiles = currentPreviewState.cssFiles || [];
                if (!currentFiles.some(item => item.path === payload)) {
                    const newItem = { path: payload, enabled: true };
                    nextPreviewState = { ...currentPreviewState, cssFiles: [...currentFiles, newItem] };
                    updated = true; emitCssUpdateEvent = true; // <<< Mark for event
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
                    updated = true; emitCssUpdateEvent = true; // <<< Mark for event
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
                    updated = true; emitCssUpdateEvent = true; // <<< Mark for event
                     console.debug(`[Reducer] Toggled enabled state for preview CSS: "${payload}"`);
                } else { console.warn(`[Reducer] Path not found for toggle: "${payload}"`); }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED:`, payload); }
            break;

        case ActionTypes.SETTINGS_TOGGLE_ROOT_CSS_ENABLED: // No payload needed
            const currentEnableRoot = currentPreviewState.enableRootCss ?? true;
            const newEnableRoot = !currentEnableRoot;
            nextPreviewState = { ...currentPreviewState, enableRootCss: newEnableRoot };
            updated = true; emitCssUpdateEvent = true; // <<< Mark for event
            console.debug(`[Reducer] Toggled enableRootCss to: ${newEnableRoot}`);
            // Persist this setting
            try { localStorage.setItem(ENABLE_ROOT_CSS_KEY, newEnableRoot); }
            catch (e) { console.error('[Reducer] Failed to save enableRootCss to localStorage:', e); }
            break;

        case ActionTypes.SETTINGS_SET_ACTIVE_PREVIEW_CSS:
             if (Array.isArray(payload)) {
                 if (JSON.stringify(payload.sort()) !== JSON.stringify((currentPreviewState.activeCssFiles || []).sort())) {
                    nextPreviewState = { ...currentPreviewState, activeCssFiles: payload };
                    updated = true;
                    console.debug(`[Reducer] Updated active preview CSS files:`, payload);
                 }
            } else { console.warn(`[Reducer] Invalid payload for SETTINGS_SET_ACTIVE_PREVIEW_CSS:`, payload); }
            break;

        case ActionTypes.SETTINGS_SET_PREVIEW_CSS_FILES:
            if (Array.isArray(payload)) {
                nextPreviewState = { ...currentPreviewState, cssFiles: payload };
                updated = true; emitCssUpdateEvent = true;
            }
            break;

        case ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED:
            if (typeof payload === 'boolean') {
                nextPreviewState = { ...currentPreviewState, enableRootCss: payload };
                updated = true; emitCssUpdateEvent = true;
                try { localStorage.setItem(ENABLE_ROOT_CSS_KEY, payload); }
                catch (e) { console.error('[Reducer] Failed to save enableRootCss:', e); }
            }
            break;
    }

    // Update the overall settings state if the preview slice changed
    if (updated) {
        nextState = { ...currentSettings, preview: nextPreviewState };
        // Persist the configured cssFiles list if it was modified
        if (type === ActionTypes.SETTINGS_ADD_PREVIEW_CSS ||
            type === ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS ||
            type === ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED) {
             try {
                localStorage.setItem(PREVIEW_CSS_FILES_KEY, JSON.stringify(nextPreviewState.cssFiles));
                 console.debug(`[Reducer] Saved preview CSS config to localStorage:`, nextPreviewState.cssFiles);
            } catch (e) { /* handle error */ }
        }
    }

    // --- Emit event AFTER calculating next state, if flagged ---
    if (emitCssUpdateEvent) {
        // Use setTimeout to ensure state update completes before event handler runs
        setTimeout(() => {
             logMessage('[Reducer] Emitting preview:cssSettingsChanged event.', 'debug', 'SETTINGS');
             // Check if eventBus exists before emitting
             if (eventBus && typeof eventBus.emit === 'function') {
                 eventBus.emit('preview:cssSettingsChanged');
             } else {
                 console.error('[Reducer] eventBus not available for emitting preview:cssSettingsChanged');
             }
         }, 0);
    }
    // ----------------------------------------------------------

    // Ensure the settings slice always returns a valid object
    return nextState || { preview: { cssFiles: [], activeCssFiles: [], enableRootCss: true } };
}


// --- Main Application Reducer ---
// Combines slice reducers into the main reducer function
// This function is passed to the messageQueue's setReducer
export function mainReducer(action) {
    const currentState = appStore.getState();

    // Call each slice reducer with its relevant part of the state and the action
    const nextAuthState = authReducer(currentState.auth, action);
    const nextUiState = uiReducer(currentState.ui, action);
    const nextSettingsPanelState = settingsPanelReducer(currentState.settingsPanel, action);
    const nextFileState = fileReducer(currentState.file, action);
    const nextPluginsState = pluginsReducer(currentState.plugins, action);
    // Pass the current 'settings' slice to the settingsReducer
    const nextSettingsState = settingsReducer(currentState.settings, action);

    // --- SmartCopy Reducer Logic (kept simple for now) ---
    let nextSmartCopyA = currentState.smartCopyA;
    let nextSmartCopyB = currentState.smartCopyB;
    if (action.type === ActionTypes.SET_SMART_COPY_A && typeof action.payload === 'string') {
        nextSmartCopyA = action.payload;
    }
    if (action.type === ActionTypes.SET_SMART_COPY_B && typeof action.payload === 'string') {
        nextSmartCopyB = action.payload;
         try { localStorage.setItem(SMART_COPY_B_KEY, nextSmartCopyB); } catch (e) { console.error('Failed to save SmartCopyB'); }
    }
    // --- End SmartCopy ---

    // Check if any slice state has changed
    if (
        nextAuthState !== currentState.auth ||
        nextUiState !== currentState.ui ||
        nextSettingsPanelState !== currentState.settingsPanel ||
        nextFileState !== currentState.file ||
        nextPluginsState !== currentState.plugins ||
        nextSettingsState !== currentState.settings ||
        nextSmartCopyA !== currentState.smartCopyA ||
        nextSmartCopyB !== currentState.smartCopyB
    ) {
        // If changes occurred, construct the new overall state object
        const nextState = {
            ...currentState, // Keep other potential top-level keys
            auth: nextAuthState,
            ui: nextUiState,
            settingsPanel: nextSettingsPanelState,
            file: nextFileState,
            plugins: nextPluginsState,
            settings: nextSettingsState,
            smartCopyA: nextSmartCopyA,
            smartCopyB: nextSmartCopyB,
        };
        // --- Use appStore.update with an updater function ---
        appStore.update(currentState => nextState); // <<< CORRECTED METHOD
    }
    // If no slice changed, the store remains unchanged
}

// --- Add at the beginning of the application init (probably in bootstrap.js) ---
// Or add this to the appStore initialization code
function loadSavedSettings() {
    // Load saved settings panel state
    try {
        const savedPanelState = localStorage.getItem(SETTINGS_PANEL_STATE_KEY);
        if (savedPanelState) {
            const parsedState = JSON.parse(savedPanelState);
            // Dispatch action to set panel state
            dispatch({ type: ActionTypes.SETTINGS_PANEL_SET_STATE, payload: parsedState });
        }
    } catch (e) {
        console.error('[Init] Failed to load settings panel state:', e);
    }

    // Load saved CSS files configuration
    try {
        const savedCssFiles = localStorage.getItem(PREVIEW_CSS_FILES_KEY);
        if (savedCssFiles) {
            const parsedFiles = JSON.parse(savedCssFiles);
            // Set saved CSS files
            dispatch({ type: ActionTypes.SETTINGS_SET_PREVIEW_CSS_FILES, payload: parsedFiles });
        }
    } catch (e) {
        console.error('[Init] Failed to load CSS files config:', e);
    }

    // Load root CSS enabled state (default to true if not found)
    try {
        const rootCssEnabled = localStorage.getItem(ENABLE_ROOT_CSS_KEY);
        if (rootCssEnabled !== null) {
            const enabled = rootCssEnabled === 'true';
            dispatch({ type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, payload: enabled });
        } else {
            // If not previously saved, set default (true)
            dispatch({ type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, payload: true });
        }
    } catch (e) {
        console.error('[Init] Failed to load root CSS state:', e);
    }
} 