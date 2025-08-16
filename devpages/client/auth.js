/**
 * auth.js
 * Core authentication logic: state management, login/logout, hashing, API interaction.
 */
// globalFetch is accessed via window.APP.services.globalFetch 
import { eventBus } from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import fileSystemState from '/client/filesystem/fileSystemState.js';
import { api } from '/client/api.js';
import { authThunks } from '/client/store/slices/authSlice.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('Auth');

// --- Public API ---

/**
 * Initializes the authentication system by triggering the initial check
 * and setting up event listeners. Called from bootstrap.js.
 */
export function initAuth() {
    log.info('AUTH', 'INIT_SYSTEM', '[AUTH] Initializing authentication system...');
    appStore.dispatch(authThunks.initializeAuth());
    
    // Listen for login requests from UI components
    // Avoid adding listener multiple times if initAuth is called again
    if (!window.APP?.authLoginListenerAttached) {
        eventBus.on('auth:loginRequested', ({ username, password }) => {
            log.info('AUTH', 'LOGIN_REQUESTED', `[AUTH] Received auth:loginRequested for user: ${username}`);
            appStore.dispatch(authThunks.loginWithCredentials({ username, password })); 
        });
        window.APP = window.APP || {};
        window.APP.authLoginListenerAttached = true; // Set flag
        log.info('AUTH', 'EVENT_LISTENER_SET_UP', '[AUTH] Event listener for auth:loginRequested set up.');
    } else {
         log.info('AUTH', 'EVENT_LISTENER_ALREADY_ATTACHED', '[AUTH] Event listener for auth:loginRequested already attached.');
    }
    
    log.info('AUTH', 'SYSTEM_INITIALIZED', '[AUTH] System initialized. Initial check started.');
}

/**
 * Handles the logout process.
 * @param {boolean} [notifyServer=true] - Whether to send a request to the server.
 */
export async function logout(notifyServer = true) {
  appStore.dispatch(authThunks.logoutAsync(notifyServer));
}

// Updated default export - Removed authState export
export default {
  initAuth,
  logout,
}; 