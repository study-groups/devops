/**
 * Auth Slice - Plain Redux with async thunks
 *
 * Clean implementation without RTK Query:
 * 1. Uses plain fetch via api.js
 * 2. Integrates with PData token system
 * 3. Provides unified authentication flow
 */

import { createSlice } from '@reduxjs/toolkit';
import { authApi } from '../api.js';

// Helper to persist auth state
const persistAuthState = (state) => {
  try {
    const stateToPersist = {
      isAuthenticated: state.isAuthenticated,
      user: state.user,
      token: state.token,
      tokenExpiresAt: state.tokenExpiresAt,
      authChecked: state.authChecked,
    };
    localStorage.setItem('devpages_auth_state', JSON.stringify(stateToPersist));
  } catch (e) {
    console.warn('[Auth] Failed to save auth state to localStorage:', e);
  }
};

const clearPersistedAuthState = () => {
  try {
    localStorage.removeItem('devpages_auth_state');
  } catch (e) {
    console.warn('[Auth] Failed to clear auth state from localStorage:', e);
  }
};

// Initial state
const initialState = {
  isAuthenticated: false,
  user: null,
  token: null,
  tokenExpiresAt: null,
  isLoading: false,
  error: null,
  authChecked: false,
};

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },

    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },

    clearAuth: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.tokenExpiresAt = null;
      state.error = null;
      state.isLoading = false;
      clearPersistedAuthState();
    },

    setToken: (state, action) => {
      const { token, expiresAt } = action.payload;
      state.token = token;
      state.tokenExpiresAt = expiresAt;
      persistAuthState(state);
    },

    setAuthChecked: (state, action) => {
      state.authChecked = action.payload;
    },

    // Login flow reducers
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },

    loginSuccess: (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.authChecked = true;
      state.error = null;
      persistAuthState(state);
    },

    loginFailure: (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.tokenExpiresAt = null;
      state.error = action.payload;
      state.authChecked = true;
      clearPersistedAuthState();
    },

    // Auth check reducers
    authCheckStart: (state) => {
      if (!state.authChecked) {
        state.isLoading = true;
      }
    },

    authCheckSuccess: (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = action.payload.isAuthenticated;
      state.user = action.payload.user;
      state.authChecked = true;
      state.error = null;
      if (action.payload.isAuthenticated) {
        persistAuthState(state);
      } else {
        clearPersistedAuthState();
      }
    },

    authCheckFailure: (state, action) => {
      state.isLoading = false;
      state.authChecked = true;
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.tokenExpiresAt = null;
      // Only set error if it's not a 401
      if (action.payload?.status !== 401) {
        state.error = action.payload?.message || 'Failed to check authentication';
      }
      clearPersistedAuthState();
    },

    // Logout reducers
    logoutSuccess: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.tokenExpiresAt = null;
      state.error = null;
      state.isLoading = false;
      clearPersistedAuthState();
      console.log('[Auth] Logout completed');
    },
  },
});

// Export actions
export const {
  clearError,
  setLoading,
  clearAuth,
  setToken,
  setAuthChecked,
  loginStart,
  loginSuccess,
  loginFailure,
  authCheckStart,
  authCheckSuccess,
  authCheckFailure,
  logoutSuccess,
} = authSlice.actions;

// Selectors
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUser = (state) => state.auth.user;
export const selectAuthError = (state) => state.auth.error;
export const selectIsAuthChecked = (state) => state.auth.authChecked;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectToken = (state) => state.auth.token;
export const selectTokenExpiresAt = (state) => state.auth.tokenExpiresAt;

// Thunks for async auth flows
export const authThunks = {
  /**
   * Initialize authentication - check current status and generate token if needed
   */
  initializeAuth: () => async (dispatch, getState) => {
    try {
      console.log('[Auth] Starting authentication initialization...');
      dispatch(authCheckStart());

      const result = await authApi.getCurrentUser();

      dispatch(authCheckSuccess(result));

      if (result.isAuthenticated) {
        console.log('[Auth] User is authenticated, generating PData token...');

        try {
          const tokenResult = await authApi.generateToken({
            expiryHours: 24,
            description: 'Session API Token',
          });

          dispatch(setToken({
            token: tokenResult.token,
            expiresAt: tokenResult.expiresAt,
          }));

          console.log('[Auth] Authentication initialized with PData token');

          // Navigate authenticated user to appropriate directory
          setTimeout(async () => {
            try {
              const { pathThunks } = await import('./pathSlice.js');
              const username = result.user.username;
              const userRole = result.user.role || 'user';

              if (userRole !== 'admin') {
                const userHomePath = `users/${username}`;
                console.log(`[Auth] Navigating authenticated user to home directory: ${userHomePath}`);
                dispatch(pathThunks.navigateToPath({ pathname: userHomePath, isDirectory: true }));
              } else {
                console.log('[Auth] Authenticated admin user - loading top-level directories');
                dispatch(pathThunks.loadTopLevelDirectories());
              }
            } catch (navError) {
              console.warn('[Auth] Failed to navigate after auth initialization:', navError);
            }
          }, 100);
        } catch (tokenError) {
          console.warn('[Auth] Failed to generate PData token:', tokenError);
        }
      } else {
        console.log('[Auth] User is not authenticated');
      }
    } catch (error) {
      console.warn('[Auth] Failed to initialize authentication:', error);
      dispatch(authCheckFailure(error));
    }
  },

  /**
   * Login with username/password and generate PData token
   */
  loginWithCredentials: (credentials) => async (dispatch) => {
    try {
      dispatch(loginStart());

      const loginResult = await authApi.login(credentials);
      dispatch(loginSuccess(loginResult));

      // Generate PData token
      try {
        const tokenResult = await authApi.generateToken({
          expiryHours: 24,
          description: 'Session API Token',
        });

        dispatch(setToken({
          token: tokenResult.token,
          expiresAt: tokenResult.expiresAt,
        }));

        console.log('[Auth] Login successful with PData token');

        // Navigate to user's home directory
        setTimeout(async () => {
          try {
            const { pathThunks } = await import('./pathSlice.js');
            const username = loginResult.user.username;
            const userRole = loginResult.user.role || 'user';

            if (userRole !== 'admin') {
              const userHomePath = `users/${username}`;
              console.log(`[Auth] Navigating to user home directory: ${userHomePath}`);
              dispatch(pathThunks.navigateToPath({ pathname: userHomePath, isDirectory: true }));
            } else {
              console.log('[Auth] Admin user - loading top-level directories');
              dispatch(pathThunks.loadTopLevelDirectories());
            }
          } catch (navError) {
            console.warn('[Auth] Failed to navigate after login:', navError);
          }
        }, 100);

        return { success: true, user: loginResult.user };
      } catch (tokenError) {
        console.warn('[Auth] Login successful but failed to generate PData token:', tokenError);
        return { success: true, user: loginResult.user, tokenWarning: tokenError.message };
      }
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      dispatch(loginFailure(error.message || 'Login failed'));
      return { success: false, error: error.message };
    }
  },

  /**
   * Logout and clear all auth state
   */
  logoutAsync: () => async (dispatch) => {
    try {
      // Clear auth state immediately
      dispatch(clearAuth());

      // Then perform server logout
      await authApi.logout();
      dispatch(logoutSuccess());

      return { success: true };
    } catch (error) {
      console.warn('[Auth] Server logout failed, clearing local state anyway:', error);
      dispatch(logoutSuccess());
      return { success: true };
    }
  },
};

// Export reducer
export default authSlice.reducer;

console.log('[Auth Slice] Plain Redux auth slice initialized');
