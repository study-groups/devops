/**
 * Redux Auth Slice
 * Handles authentication state and actions
 */

// Action Types
const AUTH_LOGIN_START = 'auth/loginStart';
const AUTH_LOGIN_SUCCESS = 'auth/loginSuccess';
const AUTH_LOGIN_FAILURE = 'auth/loginFailure';
const AUTH_LOGOUT = 'auth/logout';
const AUTH_CHECK_START = 'auth/checkStart';
const AUTH_CHECK_SUCCESS = 'auth/checkSuccess';
const AUTH_CHECK_FAILURE = 'auth/checkFailure';

// Initial State
const initialState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
};

// Action Creators
export const authActions = {
    loginStart: () => ({ type: AUTH_LOGIN_START }),
    loginSuccess: (user) => ({ type: AUTH_LOGIN_SUCCESS, payload: user }),
    loginFailure: (error) => ({ type: AUTH_LOGIN_FAILURE, payload: error }),
    logout: () => ({ type: AUTH_LOGOUT }),
    checkStart: () => ({ type: AUTH_CHECK_START }),
    checkSuccess: (user) => ({ type: AUTH_CHECK_SUCCESS, payload: user }),
    checkFailure: (error) => ({ type: AUTH_CHECK_FAILURE, payload: error })
};

// Async Thunks
export const authThunks = {
    login: (credentials) => async (dispatch) => {
        dispatch(authActions.loginStart());
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(credentials)
            });
            
            if (!response.ok) {
                // Read the response body as text once.
                const errorText = await response.text();
                let errorPayload = errorText; // Default to the raw text.

                try {
                    // Try to parse the text as JSON.
                    const errorData = JSON.parse(errorText);
                    // If successful, use the more specific error message.
                    errorPayload = errorData.error || errorData.message || JSON.stringify(errorData);
                } catch (e) {
                    // If JSON parsing fails, we've already stored the raw text
                    // in errorPayload, so we can just proceed.
                }
                throw new Error(errorPayload);
            }
            
            const user = await response.json();
            dispatch(authActions.loginSuccess(user));
            return user;
        } catch (error) {
            dispatch(authActions.loginFailure(error.message));
            // Do not re-throw the error. The failure is now in the Redux state,
            // and the UI should react to that state change.
        }
    },

    logout: () => async (dispatch) => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.warn('Logout request failed, but clearing local state');
        } finally {
            dispatch(authActions.logout());
        }
    },

    checkAuth: () => async (dispatch) => {
        dispatch(authActions.checkStart());
        try {
            const response = await fetch('/api/auth/user', {
                credentials: 'include'
            });
            
            if (response.status === 401) {
                // 401 is normal - user is not authenticated
                dispatch(authActions.checkFailure('Not authenticated'));
                return { isAuthenticated: false, user: null };
            }
            
            if (!response.ok) {
                throw new Error(`Auth check failed: ${response.status}`);
            }
            
            const user = await response.json();
            dispatch(authActions.checkSuccess(user));
            return user;
        } catch (error) {
            dispatch(authActions.checkFailure(error.message));
            throw error;
        }
    }
};

// Reducer
const authReducer = (state = initialState, action) => {
    switch (action.type) {
        case AUTH_LOGIN_START:
        case AUTH_CHECK_START:
            return {
                ...state,
                isLoading: true,
                error: null
            };
            
        case AUTH_LOGIN_SUCCESS:
        case AUTH_CHECK_SUCCESS:
            return {
                ...state,
                user: action.payload,
                isAuthenticated: true,
                isLoading: false,
                error: null
            };
            
        case AUTH_LOGIN_FAILURE:
        case AUTH_CHECK_FAILURE:
            return {
                ...state,
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: action.payload
            };
            
        case AUTH_LOGOUT:
            return {
                ...initialState
            };
            
        default:
            return state;
    }
};

export default authReducer;