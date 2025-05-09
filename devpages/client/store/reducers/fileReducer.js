import { ActionTypes } from '/client/messaging/messageQueue.js';

const initialState = {
    isInitialized: false,
    isLoading: false,
    isSaving: false,
    currentPathname: null,
    isDirectorySelected: false,
    currentListing: { pathname: null, dirs: [], files: [] },
    parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] },
    availableTopLevelDirs: [],
    error: null
};

// --- File Slice Reducer (Refactored) ---
export function fileReducer(state = initialState, action) {
    const { type, payload } = action;
    let nextState = state;

    switch(type) {
        case ActionTypes.FS_INIT_START:
            // Reset most things, keep availableTopLevelDirs if already loaded? No, reset fully.
            nextState = {
                ...initialState,
                isLoading: true // Set loading true immediately
            };
            break;
        case ActionTypes.FS_INIT_COMPLETE:
            // Mark as initialized, clear loading unless payload overrides
            nextState = {
                ...state,
                isInitialized: true,
                isLoading: payload?.isLoading ?? false, // Allow setting loading if needed
                error: payload?.error || null,
                // availableTopLevelDirs should be handled by FS_SET_TOP_DIRS
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
             console.debug(`[Reducer FS_SET_TOP_DIRS] Handling action. Payload received:`, payload, `Updating availableTopLevelDirs to:`, topDirs);
             nextState = {
                ...state,
                availableTopLevelDirs: topDirs,
                isLoading: false, // Often loading completes when top dirs are set
             };
            break;
        case ActionTypes.FS_LOAD_LISTING_START:
             // If loading a listing, we are implicitly selecting a directory
             // Also clear parent listing as it might become invalid
            nextState = { ...state, isLoading: true, error: null, parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] } };
            break;
        case ActionTypes.FS_LOAD_LISTING_SUCCESS:
            const newListing = payload.listing || { dirs: [], files: [] };
            const currentPath = payload.pathname ?? state.currentPathname; // Use payload pathname
            // --- Check if this is the root listing --- Not strictly necessary here if FS_SET_TOP_DIRS handles it
            // Merge the rest of the state updates
            nextState = {
                ...state,
                isLoading: false,
                currentListing: { pathname: currentPath, dirs: newListing.dirs, files: newListing.files },
                error: null,
                currentPathname: currentPath,
                isDirectorySelected: true, // Loading a listing implies selecting a directory
            };
            break;
        case ActionTypes.FS_LOAD_LISTING_ERROR:
            nextState = {
                ...state,
                isLoading: false,
                // Keep pathname context but clear listing? Or revert to previous?
                currentListing: { pathname: state.currentPathname, dirs: [], files: [] },
                error: payload.error || 'Failed to load listing.'
            };
            break;
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
            // Keep current path until success, but set loading
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
                // Clear error on successful load
                error: null
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
