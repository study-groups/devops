import { ActionTypes } from '/client/messaging/actionTypes.js';
import { createReducer } from './reducerUtils.js';

const initialState = {
    isInitialized: false,
    isLoading: false,
    isSaving: false,
    currentOrg: null, // null = root, string = org name  
    currentPathname: null,
    isDirectorySelected: false,
    content: '', // File content for the currently loaded file
    currentListing: { pathname: null, dirs: [], files: [] },
    parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] },
    availableTopLevelDirs: [],
    error: null
};

// Constants for localStorage persistence
const LAST_FILE_KEY = 'devpages_last_file';
const LAST_DIRECTORY_KEY = 'devpages_last_directory'; 

// Helper to save last opened file/directory
function persistLastOpened(pathname, isDirectory) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
        if (pathname) {
            if (isDirectory) {
                localStorage.setItem(LAST_DIRECTORY_KEY, pathname);
                localStorage.removeItem(LAST_FILE_KEY); // Clear file when selecting directory
            } else {
                localStorage.setItem(LAST_FILE_KEY, pathname);
                // Also save the parent directory
                const parentPath = pathname.includes('/') ? pathname.substring(0, pathname.lastIndexOf('/')) : '';
                if (parentPath) {
                    localStorage.setItem(LAST_DIRECTORY_KEY, parentPath);
                }
            }
            console.log(`[FileReducer] Persisted last opened: ${isDirectory ? 'directory' : 'file'} = "${pathname}"`);
        }
    } catch (e) {
        console.error('[FileReducer] Error persisting last opened file/directory:', e);
    }
}

// Helper to load last opened file/directory
export function loadLastOpened() {
    if (typeof window === 'undefined' || !window.localStorage) return { pathname: null, isDirectory: true };
    
    try {
        const lastFile = localStorage.getItem(LAST_FILE_KEY);
        const lastDirectory = localStorage.getItem(LAST_DIRECTORY_KEY);
        
        // Prefer last file over last directory
        if (lastFile) {
            console.log(`[FileReducer] Loaded last opened file: "${lastFile}"`);
            return { pathname: lastFile, isDirectory: false };
        } else if (lastDirectory) {
            console.log(`[FileReducer] Loaded last opened directory: "${lastDirectory}"`);
            return { pathname: lastDirectory, isDirectory: true };
        }
        
        // Check legacy keys for backward compatibility
        const legacyFile = localStorage.getItem('lastFile');
        const legacyDir = localStorage.getItem('lastDir') || localStorage.getItem('lastDirectory');
        
        if (legacyFile && legacyDir) {
            const fullPath = legacyDir ? `${legacyDir}/${legacyFile}` : legacyFile;
            console.log(`[FileReducer] Loaded legacy last opened file: "${fullPath}"`);
            // Migrate to new format
            persistLastOpened(fullPath, false);
            return { pathname: fullPath, isDirectory: false };
        } else if (legacyDir) {
            console.log(`[FileReducer] Loaded legacy last opened directory: "${legacyDir}"`);
            // Migrate to new format
            persistLastOpened(legacyDir, true);
            return { pathname: legacyDir, isDirectory: true };
        }
        
    } catch (e) {
        console.error('[FileReducer] Error loading last opened file/directory:', e);
    }
    
    return { pathname: null, isDirectory: true };
}

// --- File Slice Reducer (Simplified) ---
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
            // Persist last opened if pathname changed
            if (payload.currentPathname !== undefined && payload.currentPathname !== state.currentPathname) {
                const isDirectory = payload.isDirectorySelected !== undefined ? payload.isDirectorySelected : state.isDirectorySelected;
                persistLastOpened(payload.currentPathname, isDirectory);
            }
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
                content: '', // Clear content when selecting a directory
            };
            // Persist the last opened directory
            persistLastOpened(currentPath, true);
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
                // Store the file content
                content: payload.content || '',
                // Clear error on successful load
                error: null
            };
            // Persist the last opened file
            persistLastOpened(payload.pathname, false);
            break;
        case ActionTypes.FS_LOAD_FILE_ERROR:
            // Keep current path selection, but indicate error and show error content if provided
            nextState = { 
                ...state, 
                isLoading: false, 
                error: payload.error || 'Failed to load file.',
                content: payload.content || '' // Show error content in editor if provided
            };
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
        case ActionTypes.FS_SET_CURRENT_ORG:
            nextState = {
                ...state,
                currentOrg: payload.org || null // null for root, string for org
            };
            break;
    }
    return nextState;
}
