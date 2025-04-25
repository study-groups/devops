import { appStore } from '/client/appState.js'; // Need access to appStore to call update
import { ActionTypes } from '/client/messaging/messageQueue.js';

// <<< NEW: Key for localStorage persistence (should match appState.js) >>>
const LOG_VISIBLE_KEY = 'logVisible'; 
// <<< NEW: Key for persisting plugin state (should match appState.js) >>>
const PLUGINS_STATE_KEY = 'pluginsEnabledState'; 

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
                // try { localStorage.setItem('viewMode', payload.viewMode); } catch(e) {}
            }
            break;
    }
    return nextState;
}

// --- Settings Panel Slice Reducer ---
function settingsPanelReducer(state, action) {
    const { type, payload } = action;
    let nextState = state;

    switch(type) {
        case ActionTypes.SETTINGS_PANEL_TOGGLE:
            nextState = { ...state, enabled: !state.enabled };
            break;
        case ActionTypes.SETTINGS_PANEL_SET_POSITION:
            if (payload && typeof payload.x === 'number' && typeof payload.y === 'number') {
                nextState = { ...state, position: payload };
            }
            break;
        case ActionTypes.SETTINGS_PANEL_SET_SIZE:
            if (payload && typeof payload.width === 'number' && typeof payload.height === 'number') {
                nextState = { ...state, size: payload };
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
            }
            break;
        case ActionTypes.SETTINGS_PANEL_UPDATE_SETTING:
            if (payload && typeof payload.key === 'string') {
                nextState = { ...state, [payload.key]: payload.value };
            }
            break;
    }
    return nextState;
}

// --- File Slice Reducer ---
function fileReducer(state, action) {
    const { type, payload } = action;
    let nextState = state;

    switch(type) {
        case ActionTypes.FS_INIT_START:
            nextState = { ...state, isInitialized: false, isLoading: true, error: null };
            break;
        case ActionTypes.FS_INIT_COMPLETE:
            nextState = { ...state, isInitialized: true, isLoading: false, error: payload?.error || null };
            break;
        case ActionTypes.FS_SET_STATE:
            nextState = { ...state, ...payload };
            break;
        case ActionTypes.FS_LOAD_TOP_DIRS_START: 
            nextState = { ...state, isLoading: true, error: null };     
            break; 
        case ActionTypes.FS_LOAD_TOP_DIRS_ERROR: 
            nextState = { ...state, isLoading: false, error: payload.error || 'Failed to load top-level directories.', availableTopLevelDirs: [] }; 
            break;
        case ActionTypes.FS_SET_TOP_DIRS: 
            nextState = { ...state, availableTopLevelDirs: payload.dirs || [], isLoading: false }; 
            break;
        case ActionTypes.FS_LOAD_LISTING_START:
            nextState = { ...state, isLoading: true, error: null };
            break;
        case ActionTypes.FS_LOAD_LISTING_SUCCESS:
            nextState = { ...state, isLoading: false, currentListing: payload.listing || { dirs: [], files: [] }, error: null };
            break;
        case ActionTypes.FS_LOAD_LISTING_ERROR:
            nextState = { ...state, isLoading: false, currentListing: { dirs: [], files: [] }, error: payload.error || 'Failed to load listing.' };
            break;
        case ActionTypes.FS_LOAD_FILE_START:
            nextState = { ...state, isLoading: true, isSaving: false, error: null };
            break;
        case ActionTypes.FS_LOAD_FILE_SUCCESS:
            nextState = { ...state, isLoading: false, currentFile: payload.filename, error: null };
            break;
        case ActionTypes.FS_LOAD_FILE_ERROR:
            nextState = { ...state, isLoading: false, currentFile: null, error: payload.error || `Failed to load file '${payload.filename}'.` };
            break;
        case ActionTypes.FS_SAVE_FILE_START:
            nextState = { ...state, isSaving: true, isLoading: true, error: null };
            break;
        case ActionTypes.FS_SAVE_FILE_SUCCESS:
            nextState = { ...state, isSaving: false, isLoading: false, error: null };
            break;
        case ActionTypes.FS_SAVE_FILE_ERROR:
            nextState = { ...state, isSaving: false, isLoading: false, error: payload.error || `Failed to save file '${payload.filename}'.` };
            break;
        case ActionTypes.FS_CLEAR_ERROR:
            nextState = { ...state, error: null };
            break;
    }
    return nextState;
}

// --- Plugins Slice Reducer ---
function pluginsReducer(state, action) {
    const { type, payload } = action;
    let nextState = state; // Start with current slice state

    switch(type) {
        case ActionTypes.PLUGIN_TOGGLE: {
            const { pluginId, enabled } = payload;
            // Ensure immutability: create new state objects
            if (state && state[pluginId]) { // Check if state and pluginId exist
                const updatedPlugin = {
                    ...state[pluginId], // Keep existing properties like 'name'
                    enabled: !!enabled // Ensure boolean
                };
                // Return a new object for the plugins slice
                const newStateSlice = {
                    ...state,
                    [pluginId]: updatedPlugin
                };
                console.log(`[Reducer] Toggled plugin '${pluginId}' to ${enabled}. New plugins state:`, newStateSlice);

                // <<< ADD: Save the updated state slice to localStorage >>>
                try {
                    localStorage.setItem(PLUGINS_STATE_KEY, JSON.stringify(newStateSlice));
                    console.log(`[Reducer] Saved updated plugins state to localStorage.`);
                } catch (e) {
                    console.error('[Reducer] Failed to save plugins state to localStorage:', e);
                }
                // <<< END ADD >>>

                nextState = newStateSlice; // Update nextState only on successful toggle
            } else {
                console.warn(`[Reducer] Attempted to toggle non-existent plugin: ${pluginId}`);
            }
            break;
        }
        // Add other plugin-related actions here if needed
    }
    return nextState; // Return original state slice if action doesn't match
}

// --- Root Reducer ---
// Combines results from slice reducers
export function mainReducer(action) {
    appStore.update(currentState => {
        const nextAuthState = authReducer(currentState.auth, action);
        const nextUiState = uiReducer(currentState.ui, action);
        const nextSettingsPanelState = settingsPanelReducer(currentState.settingsPanel, action);
        const nextFileState = fileReducer(currentState.file, action);
        const nextPluginsState = pluginsReducer(currentState.plugins, action);

        // Check if any slice actually changed reference. 
        // If not, return the original state to prevent unnecessary updates.
        if (
            nextAuthState === currentState.auth &&
            nextUiState === currentState.ui &&
            nextSettingsPanelState === currentState.settingsPanel &&
            nextFileState === currentState.file &&
            nextPluginsState === currentState.plugins
        ) {
            // No changes in any slice, bail out early
            // Log only if the action type was potentially relevant but didn't change state
             const prefixes = ['AUTH_', 'SETTINGS_PANEL_', 'UI_', 'FS_', 'PLUGIN_'];
             const isPotentiallyHandled = prefixes.some(prefix => action.type?.startsWith(prefix));
             if (!isPotentiallyHandled && action.type) {
                 console.warn(`[Reducer] Unhandled action type: ${action.type}`);
             }
            return currentState;
        }

        // At least one slice changed, construct the new state object
        return {
            ...currentState, // Keep other potential top-level state properties
            auth: nextAuthState,
            ui: nextUiState,
            settingsPanel: nextSettingsPanelState,
            file: nextFileState,
            plugins: nextPluginsState,
        };
    });
} 