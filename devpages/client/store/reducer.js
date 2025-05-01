import { appStore } from '/client/appState.js'; // Need access to appStore to call update
import { ActionTypes } from '/client/messaging/messageQueue.js';
import { SMART_COPY_B_KEY } from '/client/appState.js';

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
                // Or fileManager could dispatch FS_LOAD_LISTING_SUCCESS for parent dir here. Let's assume FM handles it.
                error: null
            };
            break;
        case ActionTypes.FS_LOAD_FILE_ERROR:
            // Revert selection? Keep path but show error? Let's keep path and show error.
            nextState = {
                ...state,
                isLoading: false,
                // Keep currentPathname? Maybe revert? Let's keep it for context.
                // currentPathname: null,
                isDirectorySelected: false, // Assume file selection failed
                error: payload.error || `Failed to load file '${payload.pathname}'.`
            };
            break;
        case ActionTypes.FS_SAVE_FILE_START:
            // Saving only happens when a file is selected (isDirectorySelected should be false)
            nextState = { ...state, isSaving: true, isLoading: true, error: null };
            break;
        case ActionTypes.FS_SAVE_FILE_SUCCESS:
            nextState = { ...state, isSaving: false, isLoading: false, error: null };
            break;
        case ActionTypes.FS_SAVE_FILE_ERROR:
            nextState = { ...state, isSaving: false, isLoading: false, error: payload.error || `Failed to save file '${payload.pathname}'.` };
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
        // --- Handle SmartCopy Actions Directly (for logging) ---
        if (action.type === ActionTypes.SET_SMART_COPY_A) {
            console.log(`[Reducer] Received SET_SMART_COPY_A (payload: ${JSON.stringify(action.payload)}) - State managed in localStorage.`);
            // No state change needed here
        } else if (action.type === ActionTypes.SET_SMART_COPY_B) {
            console.log(`[Reducer] Received SET_SMART_COPY_B (payload: ${JSON.stringify(action.payload)}) - State managed in localStorage.`);

            // Side Effect: Get selection and save to localStorage
            // Note: Performing side effects like DOM access in a reducer is generally discouraged,
            // but done here for pedagogical comparison with the direct triggerAction approach.
            console.log('[Reducer] Performing side effect for SET_SMART_COPY_B...');
            const editorTextArea = document.querySelector('#editor-container textarea');
            if (!editorTextArea) {
                console.error('[Reducer] Cannot set SmartCopy B: Editor textarea not found.');
            } else {
                const start = editorTextArea.selectionStart;
                const end = editorTextArea.selectionEnd;
                const selectedText = editorTextArea.value.substring(start, end);

                if (start === end) {
                     console.warn('[Reducer] Cannot set SmartCopy B: No text selected.');
                } else {
                    try {
                        localStorage.setItem(SMART_COPY_B_KEY, selectedText); // Use imported key
                        console.log(`[Reducer] SmartCopy Buffer B set via reducer (Length: ${selectedText.length})`);
                        // TODO: Add user feedback (difficult to trigger directly from reducer)
                    } catch (e) {
                        console.error(`[Reducer] Failed to save SmartCopy Buffer B to localStorage: ${e.message}`);
                        // TODO: How to show error to user from reducer?
                    }
                }
            }
            // --- End Side Effect ---
        }

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
            // Check if it was one of our SmartCopy actions (which don't change state)
            if (action.type === ActionTypes.SET_SMART_COPY_A || action.type === ActionTypes.SET_SMART_COPY_B) {
                return currentState; // Explicitly return current state for these
            }
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