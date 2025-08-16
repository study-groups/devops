/**
 * New Auth Slice - Clean RTK Query + PData integration
 * 
 * This replaces the old authSlice.js with a clean implementation that:
 * 1. Uses RTK Query for all API calls
 * 2. Integrates properly with PData token system
 * 3. Provides a unified authentication flow
 */

import { createSlice } from '@reduxjs/toolkit';
import { apiSlice } from '../apiSlice.js';

// Initial state
const initialState = {
  // User authentication status
  isAuthenticated: false,
  user: null,
  
  // PData token for API access
  token: null,
  tokenExpiresAt: null,
  
  // UI state
  isLoading: false,
  error: null,
  authChecked: false,
};

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Clear any auth errors
    clearError: (state) => {
      state.error = null;
    },
    
    // Set loading state
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    
    // Clear all auth state (for logout)
    clearAuth: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.tokenExpiresAt = null;
      state.error = null;
      state.isLoading = false;
    },
    
    // Set PData token
    setToken: (state, action) => {
      const { token, expiresAt } = action.payload;
      state.token = token;
      state.tokenExpiresAt = expiresAt;
    },
    
    // Mark auth as checked (for initial load)
    setAuthChecked: (state, action) => {
      state.authChecked = action.payload;
    },
  },
  
  // Handle RTK Query actions
  extraReducers: (builder) => {
    builder
      // Handle login
      .addMatcher(
        apiSlice.endpoints.login.matchPending,
        (state) => {
          state.isLoading = true;
          state.error = null;
        }
      )
      .addMatcher(
        apiSlice.endpoints.login.matchFulfilled,
        (state, action) => {
          state.isLoading = false;
          state.isAuthenticated = true;
          state.user = action.payload.user;
          state.authChecked = true;
          state.error = null;
          
          // Store auth state in localStorage for persistence
          try {
            localStorage.setItem('devpages_auth_state', JSON.stringify({
              isAuthenticated: true,
              user: action.payload.user
            }));
          } catch (e) {
            console.warn('[Auth] Failed to save auth state to localStorage:', e);
          }
        }
      )
      .addMatcher(
        apiSlice.endpoints.login.matchRejected,
        (state, action) => {
          state.isLoading = false;
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
          state.tokenExpiresAt = null;
          state.error = action.error?.message || 'Login failed';
          state.authChecked = true;
        }
      )
      
      // Handle token generation
      .addMatcher(
        apiSlice.endpoints.generateToken.matchFulfilled,
        (state, action) => {
          const { token, expiresAt } = action.payload;
          state.token = token;
          state.tokenExpiresAt = expiresAt;
        }
      )
      
      // Handle getCurrentUser
      .addMatcher(
        apiSlice.endpoints.getCurrentUser.matchPending,
        (state) => {
          if (!state.authChecked) {
            state.isLoading = true;
          }
        }
      )
      .addMatcher(
        apiSlice.endpoints.getCurrentUser.matchFulfilled,
        (state, action) => {
          state.isLoading = false;
          state.authChecked = true;
          
          if (action.payload.isAuthenticated) {
            state.isAuthenticated = true;
            state.user = action.payload.user;
            state.error = null;
            
            // Update localStorage
            try {
              localStorage.setItem('devpages_auth_state', JSON.stringify({
                isAuthenticated: true,
                user: action.payload.user
              }));
            } catch (e) {
              console.warn('[Auth] Failed to save auth state to localStorage:', e);
            }
          } else {
            state.isAuthenticated = false;
            state.user = null;
            state.token = null;
            state.tokenExpiresAt = null;
            
            // Clear localStorage
            try {
              localStorage.removeItem('devpages_auth_state');
            } catch (e) {
              console.warn('[Auth] Failed to clear auth state from localStorage:', e);
            }
          }
        }
      )
      .addMatcher(
        apiSlice.endpoints.getCurrentUser.matchRejected,
        (state, action) => {
          state.isLoading = false;
          state.authChecked = true;
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
          state.tokenExpiresAt = null;
          
          // Only set error if it's not a 401 (which is expected for unauthenticated users)
          if (action.error?.status !== 401) {
            state.error = action.error?.message || 'Failed to check authentication';
          }
          
          // Clear localStorage
          try {
            localStorage.removeItem('devpages_auth_state');
          } catch (e) {
            console.warn('[Auth] Failed to clear auth state from localStorage:', e);
          }
        }
      )
      
      // Handle logout
      .addMatcher(
        apiSlice.endpoints.logout.matchFulfilled,
        (state) => {
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
          state.tokenExpiresAt = null;
          state.error = null;
          state.isLoading = false;
          
          // Clear localStorage
          try {
            localStorage.removeItem('devpages_auth_state');
          } catch (e) {
            console.warn('[Auth] Failed to clear auth state from localStorage:', e);
          }
        }
      );
  },
});

// Export actions
export const { clearError, setLoading, clearAuth, setToken, setAuthChecked } = authSlice.actions;

// Selectors
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUser = (state) => state.auth.user;
export const selectAuthError = (state) => state.auth.error;
export const selectIsAuthChecked = (state) => state.auth.authChecked;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectToken = (state) => state.auth.token;
export const selectTokenExpiresAt = (state) => state.auth.tokenExpiresAt;

// Thunks for complex auth flows
export const authThunks = {
  /**
   * Initialize authentication - check current status and generate token if needed
   */
  initializeAuth: () => async (dispatch, getState) => {
    try {
      console.log('[Auth] Starting authentication initialization...');
      
      // First, check if user is authenticated
      const result = await dispatch(apiSlice.endpoints.getCurrentUser.initiate()).unwrap();
      
      if (result.isAuthenticated) {
        console.log('[Auth] User is authenticated, generating PData token...');
        
        // User is authenticated, generate a PData token for API access
        try {
          const tokenResult = await dispatch(apiSlice.endpoints.generateToken.initiate({
            expiryHours: 24,
            description: 'Session API Token'
          })).unwrap();
          
          dispatch(setToken({
            token: tokenResult.token,
            expiresAt: tokenResult.expiresAt
          }));
          
          console.log('[Auth] Authentication initialized with PData token');
          dispatch(setAuthChecked(true));
        } catch (tokenError) {
          console.warn('[Auth] Failed to generate PData token:', tokenError);
          // Continue without token - session auth will still work
          dispatch(setAuthChecked(true));
        }
      } else {
        console.log('[Auth] User is not authenticated');
        dispatch(setAuthChecked(true));
      }
    } catch (error) {
      console.warn('[Auth] Failed to initialize authentication:', error);
      dispatch(setAuthChecked(true));
    }
  },
  
  /**
   * Login with username/password and generate PData token
   */
  loginWithCredentials: (credentials) => async (dispatch) => {
    try {
      // Login with session
      const loginResult = await dispatch(apiSlice.endpoints.login.initiate(credentials)).unwrap();
      
      // Generate PData token for API access
      try {
        const tokenResult = await dispatch(apiSlice.endpoints.generateToken.initiate({
          expiryHours: 24,
          description: 'Session API Token'
        })).unwrap();
        
        dispatch(setToken({
          token: tokenResult.token,
          expiresAt: tokenResult.expiresAt
        }));
        
        console.log('[Auth] Login successful with PData token');
        return { success: true, user: loginResult.user };
      } catch (tokenError) {
        console.warn('[Auth] Login successful but failed to generate PData token:', tokenError);
        return { success: true, user: loginResult.user, tokenWarning: tokenError.message };
      }
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Logout and clear all auth state
   */
  logoutAsync: () => async (dispatch) => {
    try {
      await dispatch(apiSlice.endpoints.logout.initiate()).unwrap();
      console.log('[Auth] Logout successful');
      return { success: true };
    } catch (error) {
      console.warn('[Auth] Server logout failed, clearing local state anyway:', error);
      dispatch(clearAuth());
      return { success: true };
    }
  },
};

// Export reducer
export default authSlice.reducer;

console.log('[Auth Slice] New RTK Query + PData auth slice initialized');
