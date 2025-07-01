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
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

// --- Public API ---

/**
 * Checks the initial authentication status with the server and updates central state.
 */
async function checkInitialAuthStatus() {
    logAuth('[AUTH] Checking initial auth status with server...');
    // Dispatch start action
    dispatch({ type: ActionTypes.AUTH_INIT_START });

    let authResult = { // Define structure for success/failure payload
        isAuthenticated: false,
        user: null,
        error: null,
    };

    try {
        logAuth('[AUTH checkInitialAuthStatus] Awaiting api.getUserStatus()...', 'debug');
        console.log('[AUTH DEBUG] About to call api.getUserStatus()');
        console.log('[AUTH DEBUG] Current cookies:', document.cookie);
        
        const result = await api.getUserStatus(); 
        console.log('[AUTH DEBUG] api.getUserStatus() result:', result);
        console.log('[AUTH DEBUG] Result status:', result?.status);
        console.log('[AUTH DEBUG] Result ok:', result?.ok);
        
        logAuth(`[AUTH checkInitialAuthStatus] api.getUserStatus() responded with status: ${result?.status}`, 'debug');

        if (result.ok) {
            const data = await result.json();
            if (data.username) {
                logAuth(`[AUTH] Server confirmed active session for: ${data.username} (Role: ${data.role})`);
                authResult = {
                    isAuthenticated: true,
                    user: { username: data.username, role: data.role },
                };
            } else {
                 logAuth('[AUTH] Server status OK but no username returned.', 'warning');
            }
        } else if (result.status === 401) {
            logAuth('[AUTH] No active session found on server.');
        } else {
            // Read error message from response if possible
            let errorMsg = `Server status check failed: ${result.status}`;
            try { 
                const errorData = await result.text(); // Use text() for non-JSON errors
                errorMsg = `${errorMsg} - ${errorData.substring(0, 100)}`; // Append response snippet
            } catch(e){/*Ignore parse error*/}
            logAuth(`[AUTH] Unexpected status ${result.status} checking auth status. ${errorMsg}`, 'error');
            authResult.error = errorMsg;
        }
    } catch (error) {
        logAuth(`[AUTH] Error checking initial auth status: ${error.message}`, 'error');
        authResult.error = 'Network error checking auth status';
    }

    // Dispatch completion action
    dispatch({ type: ActionTypes.AUTH_INIT_COMPLETE, payload: authResult });
    logAuth(`[AUTH] Initial auth check complete. isAuthenticated: ${authResult.isAuthenticated}`);
}

/**
 * Initializes the authentication system by triggering the initial check
 * and setting up event listeners. Called from bootstrap.js.
 */
export function initAuth() {
    logAuth('[AUTH] Initializing authentication system...');
    checkInitialAuthStatus(); // This function now manages isInitializing state
    
    // Listen for login requests from UI components
    // Avoid adding listener multiple times if initAuth is called again
    if (!window.APP?.authLoginListenerAttached) {
        eventBus.on('auth:loginRequested', ({ username, password }) => {
            logAuth(`[AUTH] Received auth:loginRequested for user: ${username}`);
            handleLogin(username, password); 
        });
        window.APP = window.APP || {};
        window.APP.authLoginListenerAttached = true; // Set flag
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
    dispatch({ type: ActionTypes.AUTH_LOGIN_FAILURE, payload: { error: 'Username and password required' } });
    return;
  }

  // Dispatch AUTH_INIT_START to reuse loading/initializing state logic
  dispatch({ type: ActionTypes.AUTH_INIT_START });

  let loginResult = {
      isAuthenticated: false,
      user: null,
      error: null,
  };
  let success = false;

  try {
    logAuth(`[AUTH handleLogin] Calling api.login for user: ${username}`);
    const user = await api.login(username, password); // Expects { username, role, ...}

    logAuth(`[AUTH handleLogin] api.login response received: ${JSON.stringify(user)}`, 'debug'); // Log response

    // --- CRITICAL: Role Check ---
    if (!user || !user.role) {
        logAuth(`[AUTH handleLogin] Role check failed for user data: ${JSON.stringify(user)}`, 'error');
        throw new Error('User role not configured. Login aborted.');
    }
    // --- End Role Check ---

    logAuth(`[AUTH handleLogin] Login API call successful for: ${user.username} (Role: ${user.role})`);
    loginResult = {
        isAuthenticated: true,
        user: user, // Store the full user object
        error: null,
    };

    // Log before dispatching success
    logAuth(`[AUTH handleLogin] Dispatching AUTH_LOGIN_SUCCESS with payload: ${JSON.stringify(loginResult)}`, 'debug');
    dispatch({ type: ActionTypes.AUTH_LOGIN_SUCCESS, payload: loginResult });
    success = true;

  } catch (error) {
    logAuth(`[AUTH handleLogin] Caught error: ${error.message}`, 'error'); // Log the caught error
    loginResult.error = error.message;
    // Log before dispatching failure
    logAuth(`[AUTH handleLogin] Dispatching AUTH_LOGIN_FAILURE with payload: ${JSON.stringify(loginResult)}`, 'debug');
    safeDispatch({ type: ActionTypes.AUTH_LOGIN_FAILURE, payload: loginResult });
    success = false;
  }

  return success;
}

/**
 * Handles the logout process.
 * @param {boolean} [notifyServer=true] - Whether to send a request to the server.
 */
export async function logout(notifyServer = true) {
  const username = appStore.getState().auth.user?.username;
  logAuth(`[LOGOUT_FLOW] Logout requested for ${username || 'user'}. Notify server: ${notifyServer}`);

  logAuth(`[LOGOUT_FLOW] (Removed isLoading = true dispatch)`);

  if (notifyServer) {
    try {
      logAuth(`[LOGOUT_FLOW] Calling api.logout()...`);
      await api.logout();
      logAuth('[LOGOUT_FLOW] Server logout successful.');
    } catch (error) {
      logAuth(`[LOGOUT_FLOW] Error calling api.logout(): ${error.message}`, 'error');
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

  // Dispatch AUTH_LOGOUT action - reducer handles resetting auth state
  dispatch({ type: ActionTypes.AUTH_LOGOUT });
  logAuth('[LOGOUT_FLOW] Dispatched AUTH_LOGOUT. State reset handled by reducer/subscribers.');
  // Note: fileManager will see the auth state change via its subscription
  // and call its own resetFileManagerState function.
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