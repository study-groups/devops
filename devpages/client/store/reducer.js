// Removed createStore import, assuming appStore is already created elsewhere
// Removed eventBus import, assuming event emission is handled within slice reducers or elsewhere

// Import individual slice reducers
// REMOVED: authReducer - now handled by authSlice in appState.js
import uiReducer from './uiSlice.js';
import { pathReducer } from './slices/pathSlice.js';
import { pluginsReducer } from './reducers/pluginsReducer.js';
import { settingsReducer } from './reducers/settingsReducer.js';
import { panelsReducer } from './reducers/panelsReducer.js';
// Correct the import path for the domInspectorReducer
import { domInspectorReducer } from './slices/domInspectorSlice.js';
import { workspaceReducer } from './reducers/workspaceReducer.js';
import { debugPanelReducer } from './reducers/debugPanelReducer.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { previewSlice } from './slices/previewSlice.js';

// Remove legacy localStorage keys that are now managed by the log slice
const LOG_VISIBLE_KEY = 'logVisible';
const PLUGINS_STATE_KEY = 'pluginsEnabledState';
const PREVIEW_CSS_FILES_KEY = 'devpages_preview_css_files';
const ENABLE_ROOT_CSS_KEY = 'devpages_enable_root_css';
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

// REMOVED: logFilteringReducer - now handled by log slice
// The log state is now managed by the logSlice created with StateKit createSlice
// and is handled in the combined reducer in appState.js

// --- Mapping of State Slices to Reducers ---
// Note: log slice and auth slice are excluded here as they're handled separately in appState.js

const sliceReducers = {
    // REMOVED: auth: authReducer - now handled by authSlice in appState.js
    ui: uiReducer,
    path: pathReducer,
    plugins: pluginsReducer,
    settings: settingsReducer,
    panels: panelsReducer,
    domInspector: domInspectorReducer,
    workspace: workspaceReducer,
    debugPanel: debugPanelReducer,
    preview: previewSlice.reducer,
    smartCopyA: smartCopyAReducer,
    smartCopyB: smartCopyBReducer,
    // REMOVED: logFiltering: logFilteringReducer - now in log slice
};

// --- Main Application Reducer (Combiner) ---
// This function handles all slices except the log slice
// The log slice is handled separately in the combineReducers function in appState.js
export function mainReducer(currentState = {}, action) {
    // Start with all existing state to preserve slices not managed by sliceReducers
    const nextState = { ...currentState };

    // Apply each slice reducer to its corresponding slice
    for (const sliceKey in sliceReducers) {
        if (typeof sliceReducers[sliceKey] === 'function') {
            const reducer = sliceReducers[sliceKey];
            const previousSliceState = currentState[sliceKey];
            const nextSliceState = reducer(previousSliceState, action);
            nextState[sliceKey] = nextSliceState;
        }
    }

    // Handle legacy STATE_UPDATE action for backward compatibility
    if (action.type === ActionTypes.STATE_UPDATE && action.payload) {
        return { ...nextState, ...action.payload };
    }

    // Always return a new state object
    return nextState;
}

console.log('[Reducer] Main reducer initialized (log slice handled separately)'); 