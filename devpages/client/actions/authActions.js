/**
 * Auth action handlers
 * Responsible for authentication operations
 */
import { logMessage } from '/client/log/index.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { authActions } from '/client/messaging/actionCreators.js';
import eventBus from '/client/eventBus.js';

// Helper for logging within this module
function logAction(message, level = 'debug') {
    const type = 'ACTION'
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

export const authActionHandlers = {
    /**
     * Initiates the login process using thunks
     * @param {String} username - Username
     * @param {String} password - Password
     */
    login: (username, password) => {
        logAction(`Triggering login action for user: ${username}`);
        
        // Use the thunk action creator
        dispatch(authActions.login(username, password));
        
        logAction(`Dispatched login thunk for user: ${username}`);
    },

    /**
     * Logs the user out using thunks
     */
    logout: async () => {
        logAction('Triggering logout action...');
        try {
            // Use the thunk action creator
            await dispatch(authActions.logoutAsync());
            logAction('Logout completed successfully');
        } catch (error) {
            logAction(`Logout failed: ${error.message}`, 'error');
            alert(`Logout failed: ${error.message}`);
        }
    },

    /**
     * Checks authentication status using thunks
     */
    checkAuthStatus: () => {
        logAction('Checking authentication status...');
        
        // Use the thunk action creator
        dispatch(authActions.checkAuthStatus());
        
        logAction('Auth status check initiated');
    },

    /**
     * Generates API token using thunks
     * @param {number} expiryHours - Token expiry in hours
     * @param {string} description - Token description
     */
    generateToken: (expiryHours = 24, description = 'API Access Token') => {
        logAction(`Generating API token with ${expiryHours}h expiry`);
        
        // Use the thunk action creator
        dispatch(authActions.generateToken(expiryHours, description));
        
        logAction('Token generation initiated');
    }
}; 