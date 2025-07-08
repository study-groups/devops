/**
 * @file appStore.js
 * @description Centralized state management for the application.
 * Follows a Redux-like pattern with a single state object, reducers, and actions.
 */

// --- Reducers ---

function authReducer(state = { isAuthenticated: false, user: null }, action) {
    switch (action.type) {
        // This is now handled in the main reducer in appState.js
        default:
            return state;
    }
}

function fileReducer(state = { currentPath: null, currentContent: '', isDirectorySelected: true }, action) {
    switch (action.type) {
        // This is now handled in the main reducer in appState.js
        default:
            return state;
    }
}

// Combine reducers into a single root reducer
function rootReducer(state = {}, action) {
    // The main reducer logic is now in /client/store/reducer.js and composed in appState.js
    return state;
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

// This store is now a legacy implementation. The primary store is in appState.js
export const appStore = createStore(rootReducer); 