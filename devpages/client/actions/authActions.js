/**
 * Auth action handlers
 * Responsible for authentication operations
 */
import { logout } from '/client/auth.js';
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
     * Initiates the login process
     * @param {String} username - Username
     * @param {String} password - Password
     */
    login: (username, password) => {
        logAction(`Triggering login action for user: ${username}`);
        // Emit the event that auth.js is listening for
        eventBus.emit('auth:loginRequested', { username, password }); 
        logAction(`Emitted auth:loginRequested for user: ${username}`);
    },

    /**
     * Logs the user out
     */
    logout: async () => {
        logAction('Triggering logout action...');
        try {
            await logout();
            // Dispatch the logout action to update state
            dispatch(authActions.logout());
        } catch (error) {
            logAction(`logout call failed: ${error.message}`, 'error');
            alert(`Logout failed: ${error.message}`);
        }
    }
}; 