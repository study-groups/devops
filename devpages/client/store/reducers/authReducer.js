import { ActionTypes } from '/client/messaging/actionTypes.js';
import { createReducer, createPersister, loadFromStorage } from './reducerUtils.js';

const AUTH_USER_KEY = 'authUser';

// --- Auth Slice Reducer ---
export function authReducer(state, action) {
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
    // Ensure initial state if state is undefined
    return nextState || { isInitializing: true, isAuthenticated: false, user: null, error: null };
}
