/**
 * Auth Slice - Authentication state management for Redux
 * This file implements a standard Redux pattern for auth management.
 */

// --- Action Types ---
const SET_LOADING = 'auth/setLoading';
const SET_INITIALIZING = 'auth/setInitializing';
const SET_AUTH_CHECKED = 'auth/setAuthChecked';
const LOGIN_SUCCESS = 'auth/loginSuccess';
const LOGIN_FAILURE = 'auth/loginFailure';
const LOGOUT = 'auth/logout';
const SET_ERROR = 'auth/setError';
const CLEAR_ERROR = 'auth/clearError';
const UPDATE_USER = 'auth/updateUser';
// ... add other action types as needed

// --- Initial State ---
function getInitialAuthState() {
    let isAuthenticated = false;
    let user = null;
    try {
        const storedAuth = localStorage.getItem('devpages_auth_state');
        if (storedAuth) {
            const parsed = JSON.parse(storedAuth);
            if (parsed && typeof parsed.isAuthenticated === 'boolean') {
                isAuthenticated = parsed.isAuthenticated;
                user = parsed.user;
            }
        }
    } catch (e) {
        console.warn('[Auth] Error loading auth state from localStorage:', e);
    }
    return {
        isAuthenticated,
        user,
        authChecked: false,
        isLoading: false,
        error: null,
    };
}

// --- Reducer ---
export function authReducer(state = getInitialAuthState(), action) {
    switch (action.type) {
        case SET_LOADING:
            return { ...state, isLoading: action.payload };
        case LOGIN_SUCCESS:
            return {
                ...state,
                isAuthenticated: true,
                user: action.payload.user,
                isLoading: false,
                error: null,
                authChecked: true,
            };
        case LOGIN_FAILURE:
            return {
                ...state,
                isAuthenticated: false,
                user: null,
                isLoading: false,
                error: action.payload,
            };
        case LOGOUT:
            return {
                ...state,
                isAuthenticated: false,
                user: null,
                isLoading: false,
                error: null,
            };
        case SET_AUTH_CHECKED:
            return { ...state, authChecked: action.payload };
        case SET_ERROR:
            return { ...state, error: action.payload, isLoading: false };
        case CLEAR_ERROR:
            return { ...state, error: null };
        default:
            return state;
    }
}

// --- Action Creators ---
export const setLoading = (isLoading) => ({ type: SET_LOADING, payload: isLoading });
export const loginSuccess = (data) => ({ type: LOGIN_SUCCESS, payload: data });
export const loginFailure = (error) => ({ type: LOGIN_FAILURE, payload: error });
export const logout = () => ({ type: LOGOUT });
export const setAuthChecked = (isChecked) => ({ type: SET_AUTH_CHECKED, payload: isChecked });
export const setError = (error) => ({ type: SET_ERROR, payload: error });
export const clearError = () => ({ type: CLEAR_ERROR });


// --- Thunks ---
export const authThunks = {
    login: (credentials) => async (dispatch) => {
        dispatch(setLoading(true));
        try {
            const response = await window.APP.services.globalFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
                credentials: 'include',
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Login failed');
            }
            const data = await response.json();
            dispatch(loginSuccess(data));
            localStorage.setItem('devpages_auth_state', JSON.stringify({ isAuthenticated: true, user: data.user }));
            return { success: true, user: data.user };
        } catch (error) {
            dispatch(loginFailure(error.message));
            return { success: false, error: error.message };
        }
    },

    logoutAsync: () => async (dispatch) => {
        dispatch(setLoading(true));
        try {
            await window.APP.services.globalFetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (error) {
            console.warn('[Auth] Server logout failed:', error.message);
        }
        dispatch(logout());
        localStorage.removeItem('devpages_auth_state');
        return { success: true };
    },

    checkAuth: () => async (dispatch) => {
        dispatch(setLoading(true));
        try {
            const response = await window.APP.services.globalFetch('/api/auth/user', { credentials: 'include' });
            const data = await response.json();

            if (response.ok && data.isAuthenticated) {
                dispatch(loginSuccess(data));
                localStorage.setItem('devpages_auth_state', JSON.stringify({ isAuthenticated: true, user: data.user }));
            } else {
                dispatch(logout());
                localStorage.removeItem('devpages_auth_state');
            }
            dispatch(setAuthChecked(true));
        } catch (error) {
            dispatch(setError(error.message));
            dispatch(logout());
            dispatch(setAuthChecked(true));
        }
    },
};

// --- Selectors ---
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUser = (state) => state.auth.user;
export const selectAuthError = (state) => state.auth.error;
export const selectIsAuthChecked = (state) => state.auth.authChecked;

console.log('[AuthSlice] Migrated to standard Redux pattern.'); 