import { appStore } from '/client/appState.js'; // Need access to appStore to call update
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { SMART_COPY_B_KEY } from '/client/appState.js';
// Removed createStore import, assuming appStore is already created elsewhere
// Removed eventBus import, assuming event emission is handled within slice reducers or elsewhere

// Import individual slice reducers
import { authReducer } from './reducers/authReducer.js';
import { uiReducer } from './reducers/uiReducer.js';
import { settingsPanelReducer } from './reducers/settingsPanelReducer.js';
import { fileReducer } from './reducers/fileReducer.js';
import { pluginsReducer } from './reducers/pluginsReducer.js';
import { settingsReducer } from './reducers/settingsReducer.js';
import { panelsReducer } from './reducers/panelsReducer.js';
import { domInspectorReducer } from './reducers/domInspectorReducer.js';
import { workspaceReducer } from './reducers/workspaceReducer.js';

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

// --- Simple Reducers (kept inline for simplicity) ---

function smartCopyAReducer(state, action) {
    if (action.type === ActionTypes.SET_SMART_COPY_A && typeof action.payload === 'string') {
        return action.payload;
    }
    return state; // Return current state if action doesn't match or state is undefined initially
}

function smartCopyBReducer(state, action) {
    if (action.type === ActionTypes.SET_SMART_COPY_B && typeof action.payload === 'string') {
        // Persistence is now handled by the persistence module
        return action.payload;
    }
    return state;
}

// --- Mapping of State Slices to Reducers ---

const sliceReducers = {
    auth: authReducer,
    ui: uiReducer,
    settingsPanel: settingsPanelReducer,
    file: fileReducer,
    plugins: pluginsReducer,
    settings: settingsReducer,
    panels: panelsReducer,
    domInspector: domInspectorReducer,
    workspace: workspaceReducer,
    smartCopyA: smartCopyAReducer,
    smartCopyB: smartCopyBReducer,
};

// --- Main Application Reducer (Combiner) ---
// This function is passed to the messageQueue's setReducer
export function mainReducer(action) {
    const currentState = appStore.getState();
    let hasChanged = false;
    const nextState = {};

    // Iterate over the slice reducers mapping
    for (const sliceKey in sliceReducers) {
        // Ensure the reducer function exists for the key
        if (typeof sliceReducers[sliceKey] === 'function') {
            const reducer = sliceReducers[sliceKey];
            const previousSliceState = currentState[sliceKey];
            // Call the slice reducer
            const nextSliceState = reducer(previousSliceState, action);
            // Assign the result to the next overall state object
            nextState[sliceKey] = nextSliceState;
            // Check if this slice has changed (strict equality check)
            if (previousSliceState !== nextSliceState) {
                hasChanged = true;
            }
        } else {
            // If no reducer is defined for a slice in sliceReducers,
            // carry over the existing state for that slice.
            // This handles cases where currentState might have keys not actively managed here.
            if (currentState.hasOwnProperty(sliceKey)) {
                nextState[sliceKey] = currentState[sliceKey];
            }
        }
    }

    // Update the appStore only if any slice reported a change
    if (hasChanged) {
        const finalNextState = { ...currentState, ...nextState };

        // Special handling for MD_DIR change - trigger file system reload
        if (action.type === ActionTypes.SETTINGS_SET_CONTENT_SUBDIR) {
            console.log('[MainReducer] MD_DIR changed, resetting file system to trigger reload');
            finalNextState.file = {
                ...finalNextState.file,
                isInitialized: false,
                currentPathname: null,
                currentListing: null,
                parentListing: null,
                availableTopLevelDirs: [],
                error: null
            };
        }

        appStore.update(currentState => finalNextState);
    }
    // If no slice changed, the store remains unchanged
}

// --- Initialization Logic (Example - Should live in app initialization code) ---
// Removed loadSavedSettings from here. This function should be called once
// during application startup (e.g., in bootstrap.js or main entry point)
// after the store and messageQueue are initialized.
/*
function loadSavedSettings() {
    // Load saved settings panel state
    try {
        const savedPanelState = localStorage.getItem('devpages_settings_panel_state');
        if (savedPanelState) {
            const parsedState = JSON.parse(savedPanelState);
            dispatch({ type: ActionTypes.SETTINGS_PANEL_SET_STATE, payload: parsedState });
        }
    } catch (e) { console.error('[Init] Failed to load settings panel state:', e); }

    // Load saved CSS files configuration
    try {
        const savedCssFiles = localStorage.getItem('devpages_preview_css_files');
        if (savedCssFiles) {
            const parsedFiles = JSON.parse(savedCssFiles);
            dispatch({ type: ActionTypes.SETTINGS_SET_PREVIEW_CSS_FILES, payload: parsedFiles });
        }
    } catch (e) { console.error('[Init] Failed to load CSS files config:', e); }

    // Load root CSS enabled state
    try {
        const rootCssEnabled = localStorage.getItem('devpages_enable_root_css');
        if (rootCssEnabled !== null) {
            dispatch({ type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, payload: rootCssEnabled === 'true' });
        } else {
            dispatch({ type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED, payload: true }); // Default
        }
    } catch (e) { console.error('[Init] Failed to load root CSS state:', e); }

     // Load SmartCopy B
     try {
        const savedSmartCopyB = localStorage.getItem(SMART_COPY_B_KEY);
        if (savedSmartCopyB !== null) { // Check for null to allow empty string
            dispatch({ type: ActionTypes.SET_SMART_COPY_B, payload: savedSmartCopyB });
        }
    } catch (e) { console.error('[Init] Failed to load SmartCopy B state:', e); }

    // Load Log Visibility
    try {
        const savedLogVisible = localStorage.getItem('logVisible');
        if (savedLogVisible !== null) {
            dispatch({ type: ActionTypes.UI_SET_LOG_VISIBILITY, payload: savedLogVisible === 'true' });
        }
    } catch (e) { console.error('[Init] Failed to load log visibility state:', e); }

    // Load Plugin Enabled States
    try {
        const savedPluginsEnabled = localStorage.getItem('pluginsEnabledState');
        if (savedPluginsEnabled) {
            const enabledStates = JSON.parse(savedPluginsEnabled);
            // We need an action to merge this into the initially populated plugin state
            // Or the initial plugin state itself should be loaded from storage.
            // For now, let's assume an action SET_PLUGIN_ENABLED_STATES exists
            // dispatch({ type: ActionTypes.PLUGINS_SET_ENABLED_STATES, payload: enabledStates });
            console.warn('[Init] Need mechanism/action to load saved plugin enabled states.');
        }
    } catch (e) { console.error('[Init] Failed to load plugin enabled states:', e); }
}
*/ 