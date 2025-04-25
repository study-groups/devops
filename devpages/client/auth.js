/**
 * auth.js
 * Core authentication logic: state management, login/logout, hashing, API interaction.
 */
// Remove globalFetch if no longer needed directly
// import { globalFetch } from '/client/globalFetch.js'; 
import { eventBus } from '/client/eventBus.js'; // Import eventBus
// REMOVED: import { authState } from './authState.js'; // Import the new reactive state
import { appStore } from '/client/appState.js'; // IMPORT the central state
import fileSystemState from '/client/filesystem/fileSystemState.js'; // Keep for now, might refactor later
import { api } from '/client/api.js'; // Import the centralized API object

// --- Constants ---
// Remove endpoint constants as they are now in api.js
// const LOGIN_ENDPOINT = '/api/auth/login';
// const LOGOUT_ENDPOINT = '/api/auth/logout';
// const USER_STATUS_ENDPOINT = '/api/auth/user';

// --- State ---
// State is managed in the central appState.js

// --- Private Functions ---

/**
 * Updates the central application state's auth section.
 * @param {object} data - The new state properties to merge into appState.auth.
 */
// function updateCentralAuthState(data) { // No longer needed, direct update used
//   // ...
// }

// --- Public API ---

/**
 * Checks the initial authentication status with the server and updates central state.
 */
async function checkInitialAuthStatus() {
    logAuth('[AUTH] Checking initial auth status with server...');
    appStore.update(s => ({ ...s, auth: { ...s.auth, isInitializing: true, authChecked: false, error: null } }));

    let finalAuthState = {
        isLoggedIn: false,
        user: null,
        token: null, 
        tokenExpiresAt: null,
        error: null,
        // isInitializing will be set false below
        authChecked: true 
    };

    try {
        logAuth('[AUTH checkInitialAuthStatus] Awaiting api.getUserStatus()...', 'debug');
        const response = await api.getUserStatus(); 
        logAuth(`[AUTH checkInitialAuthStatus] api.getUserStatus() responded with status: ${response?.status}`, 'debug');

        if (response.ok) {
            const data = await response.json();
            if (data.username) {
                logAuth(`[AUTH] Server confirmed active session for: ${data.username}`);
                finalAuthState = {
                    ...finalAuthState,
                    isAuthenticated: true,
                    isLoggedIn: true,
                    user: { username: data.username },
                };
                // REMOVED: eventBus.emit('auth:restored', { username: data.username });
            } else {
                 logAuth('[AUTH] Server status OK but no username returned.', 'warning');
                 // finalAuthState already defaults to logged out
            }
        } else if (response.status === 401) {
            logAuth('[AUTH] No active session found on server.');
             // finalAuthState already defaults to logged out
        } else {
            // Read error message from response if possible
            let errorMsg = `Server status check failed: ${response.status}`;
            try { 
                const errorData = await response.text(); // Use text() for non-JSON errors
                errorMsg = `${errorMsg} - ${errorData.substring(0, 100)}`; // Append response snippet
            } catch(e){/*Ignore parse error*/}
            logAuth(`[AUTH] Unexpected status ${response.status} checking auth status. ${errorMsg}`, 'error');
            finalAuthState.error = errorMsg;
        }
    } catch (error) {
        logAuth(`[AUTH] Error checking initial auth status: ${error.message}`, 'error');
        finalAuthState.error = 'Network error checking auth status';
    }

    // Single update at the end
    logAuth('[AUTH checkInitialAuthStatus] Preparing final state update dispatch...', 'debug');
    appStore.update(s => {
        const newStateSlice = { 
            ...s.auth, 
            ...finalAuthState, 
            isInitializing: false 
        };
        logAuth(`[AUTH checkInitialAuthStatus Update] Prev auth state: ${JSON.stringify(s.auth)}`, 'debug');
        logAuth(`[AUTH checkInitialAuthStatus Update] Final auth state payload for merge: ${JSON.stringify(finalAuthState)}`, 'debug');
        logAuth(`[AUTH checkInitialAuthStatus Update] Calculated next auth state: ${JSON.stringify(newStateSlice)}`, 'debug');
        return { ...s, auth: newStateSlice };
    });
    logAuth(`[AUTH] Initial auth check complete. State update dispatched.`);
}

/**
 * Initializes the authentication system by triggering the initial check
 * and setting up event listeners.
 */
export function initAuth() {
    logAuth('[AUTH] Initializing authentication system...');
    // Call the status check
    checkInitialAuthStatus(); // This function now manages isInitializing state
    
    // Listen for login requests from UI components
    // Avoid adding listener multiple times if initAuth is called again
    if (!window.APP?.authListenerAttached) {
        eventBus.on('auth:loginRequested', ({ username, password }) => {
            logAuth(`[AUTH] Received auth:loginRequested for user: ${username}`);
            handleLogin(username, password); 
        });
        window.APP = window.APP || {};
        window.APP.authListenerAttached = true; // Set flag
        logAuth('[AUTH] Event listener for auth:loginRequested set up.');
    } else {
         logAuth('[AUTH] Event listener for auth:loginRequested already attached.');
    }
    
    logAuth('[AUTH] System initialized. Initial check started.');
}

/**
 * Handles the login process. 
 * NOTE: This should no longer be called directly from outside, only via eventBus.
 * @param {string} username - The username.
 * @param {string} password - The plain text password.
 * @returns {Promise<boolean>} True on successful login, false otherwise.
 */
async function handleLogin(username, password) {
  if (!username || !password) {
    logAuth('[AUTH] Login attempt with missing credentials', 'warning');
    updateCentralAuthState({ error: 'Username and password required' });
    return false;
  }

  appStore.update(s => ({ ...s, auth: { ...s.auth, isLoading: true, error: null } }));

  let success = false;
  let finalAuthState = {
      isAuthenticated: false,
      isLoggedIn: false,
      user: null,
      token: null, 
      tokenExpiresAt: null,
      error: null,
      isLoading: false 
  };

  try {
    logAuth(`[AUTH] Sending login request for user: ${username}`);
    // Use api.login()
    const loginResponse = await api.login(username, password);

    if (!loginResponse.ok) {
        let errorMsg = `Login failed: ${loginResponse.status}`;
        try {
            const errorData = await loginResponse.json();
            errorMsg = errorData.error || errorMsg;
        } catch (e) { /* Ignore JSON parsing error */ }
        throw new Error(errorMsg);
    }

    logAuth(`[AUTH] Server login successful for: ${username}`);
    finalAuthState = {
        ...finalAuthState,
        isAuthenticated: true,
        isLoggedIn: true,
        user: { username: username },
    };
    success = true;

    // After successful login, check for saved deep link request
    try {
      // Import the deepLink module dynamically to avoid circular dependencies
      const deepLinkModule = await import('./deepLink.js');
      if (deepLinkModule.restoreDeepLinkNavigation) {
        const restored = deepLinkModule.restoreDeepLinkNavigation();
        if (restored) {
          logAuth('[AUTH] Restored navigation from saved deep link', 'info');
        }
      }
    } catch (deepLinkError) {
      logAuth(`[AUTH] Error checking deep links: ${deepLinkError.message}`, 'warning');
      // Non-critical error, continue with login flow
    }

  } catch (error) {
    logAuth(`[AUTH] Login failed: ${error.message}`, 'error');
    finalAuthState.isAuthenticated = false;
    finalAuthState.isLoggedIn = false;
    finalAuthState.error = error.message;
    success = false;
  }

  // Single update at the end
  appStore.update(s => ({ ...s, auth: { ...s.auth, ...finalAuthState } }));
  
  return success;
}

/**
 * Handles the logout process.
 * @param {boolean} [notifyServer=true] - Whether to send a request to the server.
 */
export async function logout(notifyServer = true) {
  const currentUser = appStore.getState().auth.user; // Get user object from central state
  const username = currentUser?.username;
  logAuth(`[LOGOUT_FLOW] Logout requested for ${username || 'user'}. Notify server: ${notifyServer}`);

  appStore.update(s => ({ ...s, auth: { ...s.auth, isLoading: true } }));
  logAuth(`[LOGOUT_FLOW] Set isLoading = true`);

  if (notifyServer) {
    try {
      logAuth(`[LOGOUT_FLOW] Calling api.logout()...`);
      const response = await api.logout(); 
      logAuth(`[LOGOUT_FLOW] api.logout() response status: ${response?.status}`); // Log status
      if (!response.ok) {
        let errorText = '';
        try { errorText = await response.text(); } catch(e){}
        logAuth(`[LOGOUT_FLOW] Server logout failed: ${response.status} ${errorText}`, 'warning');
      } else {
         logAuth('[LOGOUT_FLOW] Server logout successful.');
      }
    } catch (error) {
      // Catch errors from api.logout() call itself
      logAuth(`[LOGOUT_FLOW] Error calling api.logout(): ${error.message}`, 'error'); 
      // Consider if we should still proceed with client-side logout? For now, we will.
    }
  }

  // --- Client-side state clearing --- 
  try {
      logAuth('[LOGOUT_FLOW] Clearing fileSystemState...');
      fileSystemState.saveState({ currentDir: '', currentFile: '' });
      logAuth('[LOGOUT_FLOW] fileSystemState cleared.');
  } catch (fsError) {
       logAuth(`[LOGOUT_FLOW WARNING] Failed to clear fileSystemState: ${fsError.message}`, 'warning');
  }

  try {
      logAuth('[LOGOUT_FLOW] Clearing editor content...');
      if (window.editor && typeof window.editor.setContent === 'function') {
          window.editor.setContent('');
          logAuth('[LOGOUT_FLOW] Editor content cleared.');
      } else {
           logAuth('[LOGOUT_FLOW WARNING] window.editor or setContent not found.', 'warning');
      }
  } catch (editorError) {
       logAuth(`[LOGOUT_FLOW WARNING] Failed to clear editor content: ${editorError.message}`, 'warning');
  }
  // --- End Client-side state clearing --- 

  // Final state update
  const finalState = {
      isAuthenticated: false,
      isLoggedIn: false,
      user: null,
      token: null,
      tokenExpiresAt: null,
      error: null,
      isLoading: false 
  };
  logAuth(`[LOGOUT_FLOW] Updating central state with final logout state: ${JSON.stringify(finalState)}`);
  appStore.update(s => ({ 
      ...s, 
      auth: { 
          ...s.auth,
          ...finalState 
      } 
  }));
  logAuth('[LOGOUT_FLOW] Central state updated. Logout complete.');

  // REMOVED: eventBus.emit('auth:loggedOut', { username: username });
}

// Updated default export - Removed authState export
export default {
  initAuth,
  logout,
};

/**
 * Wrapper for logging auth messages.
 * Uses window.logMessage if available, otherwise console.log.
 * @param {string} message
 * @param {string} [logLevel='info'] - 'text', 'error', 'warning', 'info', 'debug'
 */
function logAuth(message, logLevel = 'info') {
    const type = 'AUTH'; // Keep specific type
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, logLevel, type);
    } else {
        const logFunc = logLevel === 'error' ? console.error : (logLevel === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
} 