import { ActionTypes } from '/client/messaging/actionTypes.js';

const LAST_OPENED_KEY = 'devpages_last_opened_file';

/**
 * Load last opened file from localStorage
 */
export function loadLastOpened() {
    try {
        const stored = localStorage.getItem(LAST_OPENED_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                pathname: parsed.pathname || null,
                isDirectory: parsed.isDirectory !== false // Default to true if not specified
            };
        }
    } catch (error) {
        console.warn('[FileReducer] Error loading last opened file:', error);
    }
    return { pathname: null, isDirectory: true };
}

/**
 * Save last opened file to localStorage
 */
export function saveLastOpened(pathname, isDirectory = false) {
    try {
        localStorage.setItem(LAST_OPENED_KEY, JSON.stringify({
            pathname,
            isDirectory,
            timestamp: Date.now()
        }));
    } catch (error) {
        console.warn('[FileReducer] Error saving last opened file:', error);
    }
}

/**
 * File state reducer
 */
export function fileReducer(state = {}, action) {
    switch (action.type) {
        case ActionTypes.FS_SET_TOP_DIRS:
            return {
                ...state,
                availableTopLevelDirs: Array.isArray(action.payload) ? action.payload : [],
                isInitialized: true
            };

        case ActionTypes.FS_INIT_START:
            return {
                ...state,
                isLoading: true,
                error: null
            };

        case ActionTypes.FS_INIT_COMPLETE:
            return {
                ...state,
                isLoading: false,
                isInitialized: true
            };

        case ActionTypes.FS_SET_STATE:
            return {
                ...state,
                ...action.payload
            };

        case ActionTypes.FS_LOAD_LISTING_START:
            return {
                ...state,
                isLoading: true,
                error: null
            };

        case ActionTypes.FS_LOAD_LISTING_SUCCESS:
            const { pathname, dirs, files } = action.payload;
            return {
                ...state,
                isLoading: false,
                currentListing: {
                    pathname,
                    dirs: dirs || [],
                    files: files || []
                }
            };

        case ActionTypes.FS_LOAD_LISTING_ERROR:
            return {
                ...state,
                isLoading: false,
                error: action.payload
            };

        case ActionTypes.FS_LOAD_FILE_START:
            return {
                ...state,
                isLoading: true,
                error: null
            };

        case ActionTypes.FS_LOAD_FILE_SUCCESS:
            const { pathname: filePath, content } = action.payload;
            // Save to localStorage for persistence
            saveLastOpened(filePath, false);
            return {
                ...state,
                isLoading: false,
                currentPathname: filePath,
                currentContent: content,
                isDirectorySelected: false
            };

        case ActionTypes.FS_LOAD_FILE_ERROR:
            return {
                ...state,
                isLoading: false,
                error: action.payload
            };

        case ActionTypes.FS_SAVE_FILE_START:
            return {
                ...state,
                isSaving: true,
                error: null
            };

        case ActionTypes.FS_SAVE_FILE_SUCCESS:
            return {
                ...state,
                isSaving: false
            };

        case ActionTypes.FS_SAVE_FILE_ERROR:
            return {
                ...state,
                isSaving: false,
                error: action.payload
            };

        case ActionTypes.FS_SET_CURRENT_PATH:
            const { pathname: currentPath, isDirectory } = action.payload;
            // Save to localStorage for persistence if it's a file
            if (!isDirectory) {
                saveLastOpened(currentPath, false);
            }
            return {
                ...state,
                currentPathname: currentPath,
                isDirectorySelected: isDirectory
            };

        case ActionTypes.FS_SET_CONTENT:
            return {
                ...state,
                currentContent: action.payload
            };

        case ActionTypes.FS_CLEAR_ERROR:
            return {
                ...state,
                error: null
            };

        default:
            return state;
    }
} 