/**
 * @file appStore.js
 * @description Centralized state management for the application.
 * Follows a Redux-like pattern with a single state object, reducers, and actions.
 */

// --- Action Types ---
export const ActionTypes = {
    // Auth Actions
    LOGIN_SUCCESS: 'auth/loginSuccess',
    LOGOUT: 'auth/logout',

    // File Actions
    FILE_SELECT: 'file/select',
    FILE_LOADED: 'file/loaded',
    FILE_SAVE_REQUEST: 'file/saveRequest',
    
    // UI Actions
    SET_VIEW_MODE: 'ui/setViewMode',
};

// --- Reducers ---

function authReducer(state = { isAuthenticated: false, user: null }, action) {
    switch (action.type) {
        case ActionTypes.LOGIN_SUCCESS:
            return { ...state, isAuthenticated: true, user: action.payload.user };
        case ActionTypes.LOGOUT:
            return { ...state, isAuthenticated: false, user: null };
        default:
            return state;
    }
}

function fileReducer(state = { currentPath: null, currentContent: '', isDirectorySelected: true }, action) {
    switch (action.type) {
        case ActionTypes.FILE_SELECT:
            return { ...state, currentPath: action.payload.path, isDirectorySelected: action.payload.isDirectory };
        case ActionTypes.FILE_LOADED:
            return { ...state, currentContent: action.payload.content };
        default:
            return state;
    }
}

// Combine reducers into a single root reducer
function rootReducer(state = {}, action) {
    return {
        auth: authReducer(state.auth, action),
        file: fileReducer(state.file, action),
    };
}

// --- Store ---

function createStore(reducer) {
    let state;
    let listeners = [];

    function getState() {
        return state;
    }

    function dispatch(action) {
        state = reducer(state, action);
        listeners.forEach(listener => listener());
    }

    function subscribe(listener) {
        listeners.push(listener);
        return function unsubscribe() {
            listeners = listeners.filter(l => l !== listener);
        };
    }

    // Initialize the state
    dispatch({ type: '@@INIT' });

    return { getState, dispatch, subscribe };
}

export const appStore = createStore(rootReducer); 