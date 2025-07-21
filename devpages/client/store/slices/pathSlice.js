import { getParentPath } from '/client/utils/pathUtils.js';

// --- Action Types ---
const FETCH_LISTING_PENDING = 'path/fetchListing/pending';
const FETCH_LISTING_SUCCESS = 'path/fetchListing/fulfilled';
const FETCH_LISTING_FAILURE = 'path/fetchListing/rejected';
const SET_CURRENT_PATH = 'path/setCurrentPath';

// --- Initial State ---
const initialState = {
  currentPathname: null,
  isDirectorySelected: false,
  isSaving: false,
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
};

console.log('[pathSlice] Migrated to standard Redux pattern.'); 