/**
 * Redux Path Slice
 * Handles file system navigation and directory listing
 */

// Action Types
const PATH_SET_CURRENT = 'path/setCurrent';
const PATH_LOAD_START = 'path/loadStart';
const PATH_LOAD_SUCCESS = 'path/loadSuccess';
const PATH_LOAD_FAILURE = 'path/loadFailure';
const PATH_SET_SELECTED = 'path/setSelected';

// Initial State
const initialState = {
    currentPath: '/',
    listing: [],
    selectedFiles: [],
    isLoading: false,
    error: null
};

// Action Creators
export const pathActions = {
    setCurrent: (path) => ({ type: PATH_SET_CURRENT, payload: path }),
    loadStart: () => ({ type: PATH_LOAD_START }),
    loadSuccess: (listing) => ({ type: PATH_LOAD_SUCCESS, payload: listing }),
    loadFailure: (error) => ({ type: PATH_LOAD_FAILURE, payload: error }),
    setSelected: (files) => ({ type: PATH_SET_SELECTED, payload: files })
};

// Async Thunks
export const pathThunks = {
    loadDirectory: (path) => async (dispatch, getState) => {
        dispatch(pathActions.loadStart());
        dispatch(pathActions.setCurrent(path));
        
        try {
            // Use PData for file system operations
            if (typeof window.PData !== 'undefined') {
                const listing = await window.PData.list(path);
                dispatch(pathActions.loadSuccess(listing));
                return listing;
            } else {
                throw new Error('PData not available');
            }
        } catch (error) {
            dispatch(pathActions.loadFailure(error.message));
            throw error;
        }
    },

    navigateTo: (path) => async (dispatch) => {
        return dispatch(pathThunks.loadDirectory(path));
    }
};

// Reducer
const pathReducer = (state = initialState, action) => {
    switch (action.type) {
        case PATH_SET_CURRENT:
            return {
                ...state,
                currentPath: action.payload,
                selectedFiles: [] // Clear selection on path change
            };
            
        case PATH_LOAD_START:
            return {
                ...state,
                isLoading: true,
                error: null
            };
            
        case PATH_LOAD_SUCCESS:
            return {
                ...state,
                listing: action.payload,
                isLoading: false,
                error: null
            };
            
        case PATH_LOAD_FAILURE:
            return {
                ...state,
                listing: [],
                isLoading: false,
                error: action.payload
            };
            
        case PATH_SET_SELECTED:
            return {
                ...state,
                selectedFiles: action.payload
            };
            
        default:
            return state;
    }
};

export default pathReducer; 