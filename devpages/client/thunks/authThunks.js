/**
 * client/thunks/authThunks.js
 * Authentication thunk action creators
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';
import { api } from '/client/api.js';
import { logMessage } from '/client/log/index.js';

// Helper for logging within this module
function logAuth(message, level = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, 'AUTH');
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[AUTH] ${message}`);
    }
}

export const authThunks = {
    /**
     * Thunk for user login
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Function} Thunk function
     */
    login: (username, password) => async (dispatch, getState) => {
        if (!username || !password) {
            logAuth('Login attempt with missing credentials', 'warning');
            dispatch({ 
                type: ActionTypes.AUTH_LOGIN_FAILURE, 
                payload: { error: 'Username and password required' } 
            });
            return false;
        }

        // Dispatch loading state
        dispatch({ type: ActionTypes.AUTH_INIT_START });

        try {
            logAuth(`Attempting login for user: ${username}`);
            const user = await api.login(username, password);

            logAuth(`Login successful for: ${user.username} (Role: ${user.role})`);
            
            // Validate user data
            if (!user || !user.role) {
                throw new Error('User role not configured. Login aborted.');
            }

            const loginResult = {
                isAuthenticated: true,
                user: user,
                error: null,
            };

            dispatch({ 
                type: ActionTypes.AUTH_LOGIN_SUCCESS, 
                payload: loginResult 
            });
            
            return true;
        } catch (error) {
            logAuth(`Login failed: ${error.message}`, 'error');
            
            const loginResult = {
                isAuthenticated: false,
                user: null,
                error: error.message,
            };
            
            dispatch({ 
                type: ActionTypes.AUTH_LOGIN_FAILURE, 
                payload: loginResult 
            });
            
            return false;
        }
    },

    /**
     * Thunk for user logout
     * @returns {Function} Thunk function
     */
    logout: () => async (dispatch, getState) => {
        try {
            logAuth('Logging out user...');
            
            // Call logout API
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            // Dispatch logout action
            dispatch({ type: ActionTypes.AUTH_LOGOUT });
            
            logAuth('Logout successful');
            return true;
        } catch (error) {
            logAuth(`Logout failed: ${error.message}`, 'error');
            // Still dispatch logout to clear local state
            dispatch({ type: ActionTypes.AUTH_LOGOUT });
            return false;
        }
    },

    /**
     * Thunk for checking user authentication status
     * @returns {Function} Thunk function
     */
    checkAuthStatus: () => async (dispatch, getState) => {
        try {
            logAuth('Checking authentication status...');
            
            dispatch({ type: ActionTypes.AUTH_CHECK_START });
            
            const response = await api.getUserStatus();
            
            if (response.ok) {
                const userData = await response.json();
                logAuth(`User authenticated: ${userData.username}`);
                
                dispatch({ 
                    type: ActionTypes.AUTH_LOGIN_SUCCESS, 
                    payload: {
                        isAuthenticated: true,
                        user: userData,
                        error: null
                    }
                });
            } else {
                logAuth('User not authenticated');
                dispatch({ type: ActionTypes.AUTH_LOGIN_REQUIRED });
            }
            
            dispatch({ type: ActionTypes.AUTH_CHECK_COMPLETE });
        } catch (error) {
            logAuth(`Auth check failed: ${error.message}`, 'error');
            dispatch({ type: ActionTypes.AUTH_LOGIN_REQUIRED });
            dispatch({ type: ActionTypes.AUTH_CHECK_COMPLETE });
        }
    },

    /**
     * Thunk for generating API token
     * @param {number} expiryHours - Token expiry in hours
     * @param {string} description - Token description
     * @returns {Function} Thunk function
     */
    generateToken: (expiryHours = 24, description = 'API Access Token') => async (dispatch, getState) => {
        try {
            logAuth(`Generating API token with ${expiryHours}h expiry`);
            
            const tokenData = await api.generateToken(expiryHours, description);
            
            logAuth(`Token generated successfully: ${tokenData.token.substring(0, 8)}...`);
            
            return tokenData;
        } catch (error) {
            logAuth(`Token generation failed: ${error.message}`, 'error');
            throw error;
        }
    }
}; 