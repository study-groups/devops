import { getParentPath } from '/client/utils/pathUtils.js';

// --- Action Types ---
const FETCH_LISTING_PENDING = 'path/fetchListing/pending';
const FETCH_LISTING_SUCCESS = 'path/fetchListing/fulfilled';
const FETCH_LISTING_FAILURE = 'path/fetchListing/rejected';
const SET_CURRENT_PATH = 'path/setCurrentPath';
const SET_TOP_DIRS = 'path/setTopDirs';

// --- Initial State ---
const initialState = {
  currentPathname: null,
  isDirectorySelected: false,
  isSaving: false,
  topLevelDirs: [],
  currentListing: {
    pathname: null,
    dirs: [],
    files: [],
  },
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// --- Reducer ---
export function pathReducer(state = initialState, action) {
    switch (action.type) {
        case FETCH_LISTING_PENDING:
            return { ...state, status: 'loading', error: null };
        case FETCH_LISTING_SUCCESS:
            const { listing, requestedPath, isDirectory, listedPath } = action.payload;
            return {
                ...state,
                status: 'succeeded',
                currentListing: { ...listing, pathname: listedPath },
                currentPathname: requestedPath,
                isDirectorySelected: isDirectory,
            };
        case FETCH_LISTING_FAILURE:
            return { ...state, status: 'failed', error: action.payload };
        case SET_CURRENT_PATH:
            return {
                ...state,
                currentPathname: action.payload.pathname,
                isDirectorySelected: action.payload.isDirectory,
            };
        case SET_TOP_DIRS:
            return {
                ...state,
                topLevelDirs: action.payload,
            };
        default:
            return state;
    }
}

// --- Action Creators ---
export const pathActions = {
    fetchListingPending: () => ({ type: FETCH_LISTING_PENDING }),
    fetchListingSuccess: (data) => ({ type: FETCH_LISTING_SUCCESS, payload: data }),
    fetchListingFailure: (error) => ({ type: FETCH_LISTING_FAILURE, payload: error }),
    setCurrentPath: (pathname, isDirectory) => ({ type: SET_CURRENT_PATH, payload: { pathname, isDirectory } }),
    setTopDirs: (dirs) => ({ type: SET_TOP_DIRS, payload: dirs }),
};


// --- Thunks ---
export const pathThunks = {
    fetchListingByPath: ({ pathname, isDirectory }) => async (dispatch) => {
        dispatch(pathActions.fetchListingPending());
        try {
            const pathToList = isDirectory ? pathname : (getParentPath(pathname) || '');
            const { api } = await import('/client/api.js');
            const listing = await api.fetchDirectoryListing(pathToList);
            const result = { listing, requestedPath: pathname, isDirectory, listedPath: pathToList };
            dispatch(pathActions.fetchListingSuccess(result));
        } catch (error) {
            dispatch(pathActions.fetchListingFailure(error.message));
        }
    },
    loadTopLevelDirectories: () => async (dispatch) => {
        try {
            console.log('[pathSlice] Starting loadTopLevelDirectories...');
            const response = await fetch('/api/files/dirs', { credentials: 'include' });
            if (!response.ok) {
                console.warn(`[pathSlice] API /api/files/dirs returned ${response.status}. Trying fallback...`);
                
                // Try fallback API endpoint
                const fallbackResponse = await fetch('/api/files/list?path=/', { credentials: 'include' });
                if (!fallbackResponse.ok) {
                    throw new Error(`Both API endpoints failed. Primary: ${response.status}, Fallback: ${fallbackResponse.status}`);
                }
                const fallbackData = await fallbackResponse.json();
                const directories = fallbackData.dirs || fallbackData.directories || [];
                dispatch(pathActions.setTopDirs(directories));
                return directories;
            }
            
            const directories = await response.json();
            dispatch(pathActions.setTopDirs(directories));
            return directories;
        } catch (error) {
            console.error(`[pathSlice] Error loading top-level directories: ${error.message}`, error);
            // Set empty array as fallback
            dispatch(pathActions.setTopDirs([]));
            return [];
        }
    },
};

console.log('[pathSlice] Migrated to standard Redux pattern.'); 