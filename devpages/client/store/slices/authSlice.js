/**
 * Auth Slice - Authentication state management using StateKit createSlice
 * This replaces the legacy auth reducer with a modern slice approach
 */

import { createSlice } from '/packages/devpages-statekit/src/createSlice.js';
import { globalFetch } from '/client/globalFetch.js';

// Helper function to get initial auth state from localStorage
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
        console.warn('[AuthSlice] Error loading auth state from localStorage:', e);
    }

    return {
        isAuthenticated,
        user,
        authChecked: false, // Whether initial auth check has been performed
        isInitializing: false, // Whether auth initialization is in progress
        isLoading: false, // For async auth operations
        error: null, // Any authentication error
        lastLoginTime: null,
        sessionTimeout: null,
        refreshToken: null, // Store refresh token if using JWT
        permissions: [], // User permissions array
        profile: null, // Extended user profile data
        loginAttempts: 0, // Track failed login attempts
        lockoutUntil: null // Account lockout timestamp
    };
}

// Persistence helper
function persistAuthState(state) {
    try {
        const authData = {
            isAuthenticated: state.isAuthenticated,
            user: state.user,
            lastLoginTime: state.lastLoginTime,
            permissions: state.permissions,
            profile: state.profile
        };
        localStorage.setItem('devpages_auth_state', JSON.stringify(authData));
    } catch (e) {
        console.warn('[AuthSlice] Error persisting auth state:', e);
    }
}

// Create the auth slice
export const authSlice = createSlice({
    name: 'auth',
    initialState: getInitialAuthState(),
    reducers: {
        // Loading states
        setLoading: (state, action) => {
            state.isLoading = !!action.payload;
            return state;
        },

        // Initialization
        setInitializing: (state, action) => {
            state.isInitializing = !!action.payload;
            if (state.isInitializing) {
                state.error = null; // Clear errors when starting initialization
            }
            return state;
        },

        setAuthChecked: (state, action) => {
            state.authChecked = !!action.payload;
            state.isInitializing = false;
            return state;
        },

        // Successful authentication
        loginSuccess: (state, action) => {
            const { user, refreshToken, permissions, profile, sessionDuration } = action.payload || {};
            
            state.isAuthenticated = true;
            state.user = user || null;
            state.refreshToken = refreshToken || null;
            state.permissions = Array.isArray(permissions) ? permissions : [];
            state.profile = profile || null;
            state.lastLoginTime = Date.now();
            state.error = null;
            state.isInitializing = false;
            state.isLoading = false;
            state.authChecked = true;
            state.loginAttempts = 0; // Reset failed attempts
            state.lockoutUntil = null; // Clear any lockout
            
            // Calculate session timeout (default 24 hours or provided duration)
            const duration = sessionDuration || (24 * 60 * 60 * 1000);
            state.sessionTimeout = Date.now() + duration;
            
            persistAuthState(state);
            return state;
        },

        // Login failure
        loginFailure: (state, action) => {
            const { message, remainingAttempts, lockoutDuration } = action.payload || {};
            
            state.isAuthenticated = false;
            state.user = null;
            state.refreshToken = null;
            state.error = message || 'Login failed';
            state.isLoading = false;
            state.loginAttempts = (state.loginAttempts || 0) + 1;
            
            // Handle account lockout
            if (lockoutDuration) {
                state.lockoutUntil = Date.now() + lockoutDuration;
            }
            
            return state;
        },

        // Logout
        logout: (state, action) => {
            const reason = action.payload?.reason || 'user_logout';
            
            state.isAuthenticated = false;
            state.user = null;
            state.refreshToken = null;
            state.permissions = [];
            state.profile = null;
            state.lastLoginTime = null;
            state.sessionTimeout = null;
            state.error = reason === 'session_expired' ? 'Session expired' : null;
            state.isInitializing = false;
            state.isLoading = false;
            
            // Clear persisted auth state
            try {
                localStorage.removeItem('devpages_auth_state');
            } catch (e) {
                console.warn('[AuthSlice] Error clearing auth state:', e);
            }
            
            return state;
        },

        // Error handling
        setError: (state, action) => {
            state.error = action.payload;
            state.isInitializing = false;
            state.isLoading = false;
            
            // Clear auth data on certain errors
            if (typeof action.payload === 'string' && 
                (action.payload.includes('invalid') || action.payload.includes('expired'))) {
                state.isAuthenticated = false;
                state.user = null;
                state.refreshToken = null;
            }
            
            return state;
        },

        clearError: (state) => {
            state.error = null;
            return state;
        },

        // Session management
        refreshSession: (state, action) => {
            const { refreshToken, expiresIn } = action.payload || {};
            
            if (refreshToken) {
                state.refreshToken = refreshToken;
            }
            
            if (expiresIn) {
                state.sessionTimeout = Date.now() + (expiresIn * 1000);
            }
            
            persistAuthState(state);
            return state;
        },

        checkSessionExpiry: (state) => {
            if (state.sessionTimeout && Date.now() > state.sessionTimeout) {
                // Session expired
                state.isAuthenticated = false;
                state.user = null;
                state.refreshToken = null;
                state.permissions = [];
                state.profile = null;
                state.error = 'Session expired. Please log in again.';
                
                try {
                    localStorage.removeItem('devpages_auth_state');
                } catch (e) {
                    console.warn('[AuthSlice] Error clearing expired auth state:', e);
                }
            }
            return state;
        },

        // User profile updates
        updateUser: (state, action) => {
            if (state.isAuthenticated && action.payload) {
                state.user = { ...state.user, ...action.payload };
                persistAuthState(state);
            }
            return state;
        },

        updateProfile: (state, action) => {
            if (state.isAuthenticated && action.payload) {
                state.profile = { ...state.profile, ...action.payload };
                persistAuthState(state);
            }
            return state;
        },

        // Permissions management
        setPermissions: (state, action) => {
            if (state.isAuthenticated && Array.isArray(action.payload)) {
                state.permissions = action.payload;
                persistAuthState(state);
            }
            return state;
        },

        addPermission: (state, action) => {
            if (state.isAuthenticated && action.payload && 
                !state.permissions.includes(action.payload)) {
                state.permissions.push(action.payload);
                persistAuthState(state);
            }
            return state;
        },

        removePermission: (state, action) => {
            if (state.isAuthenticated && action.payload) {
                state.permissions = state.permissions.filter(p => p !== action.payload);
                persistAuthState(state);
            }
            return state;
        },

        // Complete state update (for compatibility)
        setState: (state, action) => {
            if (action.payload && typeof action.payload === 'object') {
                const newState = { ...state, ...action.payload };
                persistAuthState(newState);
                return newState;
            }
            return state;
        },

        // Reset lockout
        clearLockout: (state) => {
            state.lockoutUntil = null;
            state.loginAttempts = 0;
            return state;
        },

        // Reset to initial state
        resetAuth: (state) => {
            const freshState = getInitialAuthState();
            try {
                localStorage.removeItem('devpages_auth_state');
            } catch (e) {
                console.warn('[AuthSlice] Error clearing auth state on reset:', e);
            }
            return freshState;
        }
    }
});

// Export actions
export const {
    setLoading,
    setInitializing,
    setAuthChecked,
    loginSuccess,
    loginFailure,
    logout,
    setError,
    clearError,
    refreshSession,
    checkSessionExpiry,
    updateUser,
    updateProfile,
    setPermissions,
    addPermission,
    removePermission,
    setState,
    clearLockout,
    resetAuth
} = authSlice.actions;

export const authReducer = authSlice.reducer;

// Thunk Actions for async authentication operations
export const authThunks = {
    // Async login
    login: (credentials) => async (dispatch, getState) => {
        const { username, password, rememberMe = false } = credentials;

        // Check if account is locked out
        const state = getState();
        if (state.auth?.lockoutUntil && Date.now() < state.auth.lockoutUntil) {
            const remainingTime = Math.ceil((state.auth.lockoutUntil - Date.now()) / 1000 / 60);
            dispatch(setError(`Account locked. Try again in ${remainingTime} minutes.`));
            return { success: false, error: 'Account locked' };
        }

        dispatch(setLoading(true));
        dispatch(clearError());

        try {
            const requestBody = { username, password };
            console.log('[AUTH DEBUG] Login request body:', requestBody);
            
            const response = await globalFetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                credentials: 'include' // Important for session cookies
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                if (response.status === 429) {
                    // Rate limited / account locked
                    dispatch(loginFailure({
                        message: errorData.message || 'Too many failed attempts',
                        lockoutDuration: errorData.lockoutDuration || 15 * 60 * 1000 // 15 minutes
                    }));
                } else if (response.status === 401) {
                    // Invalid credentials
                    dispatch(loginFailure({
                        message: errorData.message || 'Invalid username or password',
                        remainingAttempts: errorData.remainingAttempts
                    }));
                } else {
                    // Other error
                    throw new Error(errorData.message || `Login failed: ${response.status}`);
                }
                
                return { success: false, error: errorData.message };
            }

            const data = await response.json();
            
            // Construct user object from server response
            const user = {
                username: data.username,
                role: data.role
            };
            
            dispatch(loginSuccess({
                user: user,
                refreshToken: data.refreshToken,
                permissions: data.permissions,
                profile: data.profile,
                sessionDuration: data.sessionDuration
            }));

            return { success: true, user: user };
        } catch (error) {
            dispatch(setError(error.message));
            return { success: false, error: error.message };
        }
    },

    // Async logout
    logout: (reason = 'user_logout') => async (dispatch, getState) => {
        dispatch(setLoading(true));

        try {
            // Call server logout endpoint
            await globalFetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.warn('[AuthThunk] Server logout failed:', error.message);
            // Continue with client logout even if server call fails
        }

        dispatch(logout({ reason }));
        return { success: true };
    },

    // Check authentication status
    checkAuth: () => async (dispatch, getState) => {
        dispatch(setInitializing(true));

        try {
            const response = await globalFetch('/api/auth/user', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                
                // Construct user object from server response
                const user = {
                    username: data.username,
                    role: data.role
                };
                
                dispatch(loginSuccess({
                    user: user,
                    permissions: data.permissions,
                    profile: data.profile,
                    sessionDuration: data.sessionDuration
                }));
                dispatch(setAuthChecked(true));
                return { success: true, user: user };
            } else {
                // Not authenticated
                dispatch(setAuthChecked(true));
                return { success: false, authenticated: false };
            }
        } catch (error) {
            console.warn('[AuthThunk] Auth check failed:', error.message);
            dispatch(setAuthChecked(true));
            return { success: false, error: error.message };
        }
    },

    // Refresh authentication token
    refreshAuth: () => async (dispatch, getState) => {
        const state = getState();
        const refreshToken = state.auth?.refreshToken;

        if (!refreshToken) {
            dispatch(setError('No refresh token available'));
            return { success: false, error: 'No refresh token' };
        }

        dispatch(setLoading(true));

        try {
            const response = await globalFetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken }),
                credentials: 'include'
            });

            if (!response.ok) {
                // Refresh failed, logout user
                dispatch(logout({ reason: 'refresh_failed' }));
                return { success: false, error: 'Token refresh failed' };
            }

            const data = await response.json();
            
            dispatch(refreshSession({
                refreshToken: data.refreshToken,
                expiresIn: data.expiresIn
            }));

            return { success: true };
        } catch (error) {
            dispatch(logout({ reason: 'refresh_error' }));
            return { success: false, error: error.message };
        }
    },

    // Update user profile
    updateProfile: (profileData) => async (dispatch, getState) => {
        const state = getState();
        
        if (!state.auth?.isAuthenticated) {
            dispatch(setError('Not authenticated'));
            return { success: false, error: 'Not authenticated' };
        }

        dispatch(setLoading(true));
        dispatch(clearError());

        try {
            const response = await globalFetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(profileData),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Profile update failed: ${response.status}`);
            }

            const data = await response.json();
            
            dispatch(updateProfile(data.profile));
            dispatch(setLoading(false));

            return { success: true, profile: data.profile };
        } catch (error) {
            dispatch(setError(error.message));
            return { success: false, error: error.message };
        }
    },

    // Change password
    changePassword: (passwordData) => async (dispatch, getState) => {
        const state = getState();
        
        if (!state.auth?.isAuthenticated) {
            dispatch(setError('Not authenticated'));
            return { success: false, error: 'Not authenticated' };
        }

        dispatch(setLoading(true));
        dispatch(clearError());

        try {
            const response = await globalFetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(passwordData),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Password change failed: ${response.status}`);
            }

            dispatch(setLoading(false));
            return { success: true };
        } catch (error) {
            dispatch(setError(error.message));
            return { success: false, error: error.message };
        }
    },

    // Session monitoring
    startSessionMonitoring: (checkInterval = 60000) => (dispatch, getState) => {
        const monitoringId = setInterval(() => {
            const state = getState();
            
            // Check if session has expired
            dispatch(checkSessionExpiry());
            
            // Auto-refresh token if close to expiry (within 5 minutes)
            if (state.auth?.isAuthenticated && state.auth?.sessionTimeout) {
                const timeUntilExpiry = state.auth.sessionTimeout - Date.now();
                if (timeUntilExpiry > 0 && timeUntilExpiry < 5 * 60 * 1000) {
                    dispatch(authThunks.refreshAuth());
                }
            }
            
            // Clear lockout if time has passed
            if (state.auth?.lockoutUntil && Date.now() > state.auth.lockoutUntil) {
                dispatch(clearLockout());
            }
        }, checkInterval);

        // Return cleanup function
        return () => clearInterval(monitoringId);
    }
};

// Selectors for easy state access
export const selectIsAuthenticated = (state) => state.auth?.isAuthenticated || false;
export const selectUser = (state) => state.auth?.user || null;
export const selectAuthError = (state) => state.auth?.error || null;
export const selectIsAuthChecked = (state) => state.auth?.authChecked || false;
export const selectIsInitializing = (state) => state.auth?.isInitializing || false;
export const selectIsAuthLoading = (state) => state.auth?.isLoading || false;
export const selectPermissions = (state) => state.auth?.permissions || [];
export const selectProfile = (state) => state.auth?.profile || null;
export const selectSessionTimeout = (state) => state.auth?.sessionTimeout || null;
export const selectLoginAttempts = (state) => state.auth?.loginAttempts || 0;
export const selectLockoutUntil = (state) => state.auth?.lockoutUntil || null;

// Utility selectors
export const selectHasPermission = (permission) => (state) => {
    const permissions = selectPermissions(state);
    return permissions.includes(permission);
};

export const selectIsSessionValid = (state) => {
    const sessionTimeout = selectSessionTimeout(state);
    return !sessionTimeout || Date.now() < sessionTimeout;
};

export const selectIsAccountLocked = (state) => {
    const lockoutUntil = selectLockoutUntil(state);
    return lockoutUntil && Date.now() < lockoutUntil;
};

export const selectAuthStatus = (state) => {
    const auth = state.auth || {};
    return {
        isAuthenticated: auth.isAuthenticated || false,
        authChecked: auth.authChecked || false,
        isInitializing: auth.isInitializing || false,
        isLoading: auth.isLoading || false,
        hasError: !!auth.error,
        isSessionValid: selectIsSessionValid(state),
        isAccountLocked: selectIsAccountLocked(state),
        loginAttempts: auth.loginAttempts || 0
    };
};

export const selectUserSummary = (state) => {
    const user = selectUser(state);
    const profile = selectProfile(state);
    const permissions = selectPermissions(state);
    
    return user ? {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: profile?.displayName || user.username,
        avatar: profile?.avatar,
        role: user.role,
        permissions: permissions.length,
        lastLogin: state.auth?.lastLoginTime
    } : null;
};

console.log('[AuthSlice] Auth slice created with StateKit createSlice and thunk actions'); 