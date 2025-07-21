/**
 * Auth action handlers
 * Responsible for authentication operations
 */
import { dispatch } from '/client/messaging/messageQueue.js';
import { authActions } from '/client/messaging/actionCreators.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('AuthActions');

export const authActionHandlers = {
    /**
     * Initiates the login process using thunks
     * @param {String} username - Username
     * @param {String} password - Password
     */
    login: (username, password) => {
        log.info('ACTION', 'LOGIN_START', `Triggering login for user: ${username}`);
        
        // Use the thunk action creator with proper credentials object
        dispatch(authActions.login({ username, password }));
        
        log.info('ACTION', 'LOGIN_DISPATCHED', `Dispatched login thunk for user: ${username}`);
    },

    /**
     * Logs the user out using thunks
     */
    logout: async () => {
        log.info('ACTION', 'LOGOUT_START', 'Triggering logout...');
        try {
            // Use the thunk action creator
            await dispatch(authActions.logoutAsync());
            log.info('ACTION', 'LOGOUT_SUCCESS', 'Logout completed successfully');
        } catch (error) {
            log.error('ACTION', 'LOGOUT_FAILED', `Logout failed: ${error.message}`, error);
            alert(`Logout failed: ${error.message}`);
        }
    },

    /**
     * Checks authentication status using thunks
     */
    checkAuthStatus: () => {
        log.info('ACTION', 'AUTH_CHECK_START', 'Checking authentication status...');
        
        // Use the thunk action creator
        dispatch(authActions.checkAuthStatus());
        
        log.info('ACTION', 'AUTH_CHECK_DISPATCHED', 'Auth status check initiated');
    },

    /**
     * Generates API token using thunks
     * @param {number} expiryHours - Token expiry in hours
     * @param {string} description - Token description
     */
    generateToken: (expiryHours = 24, description = 'API Access Token') => {
        log.info('ACTION', 'TOKEN_GEN_START', `Generating API token with ${expiryHours}h expiry`);
        
        // Use the thunk action creator
        dispatch(authActions.generateToken(expiryHours, description));
        
        log.info('ACTION', 'TOKEN_GEN_DISPATCHED', 'Token generation initiated');
    }
}; 