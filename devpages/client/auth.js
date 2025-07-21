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

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('Auth');

// --- Public API ---

/**
 * Checks the initial authentication status with the server and updates central state.
 */
async function checkInitialAuthStatus() {
    log.info('AUTH', 'CHECK_INITIAL_STATUS', '[AUTH] Checking initial auth status with server...');
    // Dispatch start action
    dispatch({ type: ActionTypes.AUTH_INIT_START });

    let authResult = { // Define structure for success/failure payload
        isAuthenticated: false,
        user: null,
        error: null,
    };

    try {
        log.debug('AUTH', 'AWAIT_USER_STATUS', '[AUTH checkInitialAuthStatus] Awaiting api.getUserStatus()...');
        
        const result = await api.getUserStatus(); 
        
        log.debug('AUTH', 'USER_STATUS_RESPONSE', `[AUTH checkInitialAuthStatus] api.getUserStatus() responded with status: ${result?.status}`);

        if (result.ok) {
            const data = await result.json();
            if (data.username) {
                log.info('AUTH', 'SESSION_CONFIRMED', `[AUTH] Server confirmed active session for: ${data.username} (Role: ${data.role})`);
                authResult = {
                    isAuthenticated: true,
                    user: { username: data.username, role: data.role },
                };
            } else {
                 log.warn('AUTH', 'NO_USERNAME_IN_RESPONSE', '[AUTH] Server status OK but no username returned.');
            }
        } else if (result.status === 401) {
            log.info('AUTH', 'NO_ACTIVE_SESSION', '[AUTH] No active session found on server.');
        } else {
            // Read error message from response if possible
            let errorMsg = `Server status check failed: ${result.status}`;
            try { 
                const errorData = await result.text(); // Use text() for non-JSON errors
                errorMsg = `${errorMsg} - ${errorData.substring(0, 100)}`; // Append response snippet
            } catch(e){/*Ignore parse error*/}
            log.error('AUTH', 'UNEXPECTED_STATUS', `[AUTH] Unexpected status ${result.status} checking auth status. ${errorMsg}`);
            authResult.error = errorMsg;
        }
    } catch (error) {
        log.error('AUTH', 'CHECK_STATUS_ERROR', `[AUTH] Error checking initial auth status: ${error.message}`, error);
        authResult.error = 'Network error checking auth status';
    }

    // Dispatch completion action
    dispatch({ type: ActionTypes.AUTH_INIT_COMPLETE, payload: authResult });
    log.info('AUTH', 'CHECK_STATUS_COMPLETE', `[AUTH] Initial auth check complete. isAuthenticated: ${authResult.isAuthenticated}`);
}

/**
 * Initializes the authentication system by triggering the initial check
 * and setting up event listeners. Called from bootstrap.js.
 */
export function initAuth() {
    log.info('AUTH', 'INIT_SYSTEM', '[AUTH] Initializing authentication system...');
    checkInitialAuthStatus(); // This function now manages isInitializing state
    
    // Listen for login requests from UI components
    // Avoid adding listener multiple times if initAuth is called again
    if (!window.APP?.authLoginListenerAttached) {
        eventBus.on('auth:loginRequested', ({ username, password }) => {
            log.info('AUTH', 'LOGIN_REQUESTED', `[AUTH] Received auth:loginRequested for user: ${username}`);
            handleLogin(username, password); 
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
 * Handles the login process. 
 * NOTE: This should no longer be called directly from outside, only via eventBus.
 * @param {string} username - The username.
 * @param {string} password - The plain text password.
 * @returns {Promise<boolean>} True on successful login, false otherwise.
 */
async function handleLogin(username, password) {
  if (!username || !password) {
    log.warn('AUTH', 'LOGIN_MISSING_CREDENTIALS', '[AUTH] Login attempt with missing credentials');
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
    log.info('AUTH', 'CALLING_API_LOGIN', `[AUTH handleLogin] Calling api.login for user: ${username}`);
    const user = await api.login(username, password); // Expects { username, role, ...}

    log.debug('AUTH', 'API_LOGIN_RESPONSE', `[AUTH handleLogin] api.login response received: ${JSON.stringify(user)}`); // Log response

    // --- CRITICAL: Role Check ---
    if (!user || !user.role) {
        log.error('AUTH', 'ROLE_CHECK_FAILED', `[AUTH handleLogin] Role check failed for user data: ${JSON.stringify(user)}`);
        throw new Error('User role not configured. Login aborted.');
    }
    // --- End Role Check ---

    log.info('AUTH', 'LOGIN_API_SUCCESS', `[AUTH handleLogin] Login API call successful for: ${user.username} (Role: ${user.role})`);
    loginResult = {
        isAuthenticated: true,
        user: user, // Store the full user object
        error: null,
    };

    // Log before dispatching success
    log.debug('AUTH', 'DISPATCHING_LOGIN_SUCCESS', `[AUTH handleLogin] Dispatching AUTH_LOGIN_SUCCESS with payload: ${JSON.stringify(loginResult)}`);
    dispatch({ type: ActionTypes.AUTH_LOGIN_SUCCESS, payload: loginResult });
    success = true;

  } catch (error) {
    log.error('AUTH', 'LOGIN_CAUGHT_ERROR', `[AUTH handleLogin] Caught error: ${error.message}`, error); // Log the caught error
    loginResult.error = error.message;
    // Log before dispatching failure
    log.debug('AUTH', 'DISPATCHING_LOGIN_FAILURE', `[AUTH handleLogin] Dispatching AUTH_LOGIN_FAILURE with payload: ${JSON.stringify(loginResult)}`);
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
  log.info('LOGOUT', 'START', `[LOGOUT_FLOW] Logout requested for ${username || 'user'}. Notify server: ${notifyServer}`);

  if (notifyServer) {
    try {
      log.info('LOGOUT', 'CALLING_API_LOGOUT', `[LOGOUT_FLOW] Calling api.logout()...`);
      await api.logout();
      log.info('LOGOUT', 'API_LOGOUT_SUCCESS', '[LOGOUT_FLOW] Server logout successful.');
    } catch (error) {
      log.error('LOGOUT', 'API_LOGOUT_ERROR', `[LOGOUT_FLOW] Error calling api.logout(): ${error.message}`, error);
    }
  }

  // --- Client-side state clearing --- 
  try {
      log.info('LOGOUT', 'CLEARING_FILESYSTEM_STATE', '[LOGOUT_FLOW] Clearing fileSystemState...');
      fileSystemState.saveState({ currentDir: '', currentFile: '' });
      log.info('LOGOUT', 'FILESYSTEM_STATE_CLEARED', '[LOGOUT_FLOW] fileSystemState cleared.');
  } catch (fsError) {
       log.warn('LOGOUT', 'FILESYSTEM_STATE_CLEAR_ERROR', `[LOGOUT_FLOW WARNING] Failed to clear fileSystemState: ${fsError.message}`, fsError);
  }

  try {
      log.info('LOGOUT', 'CLEARING_EDITOR_CONTENT', '[LOGOUT_FLOW] Clearing editor content...');
      if (window.editor && typeof window.editor.setContent === 'function') {
          window.editor.setContent('');
          log.info('LOGOUT', 'EDITOR_CONTENT_CLEARED', '[LOGOUT_FLOW] Editor content cleared.');
      } else {
           log.warn('LOGOUT', 'EDITOR_NOT_FOUND', '[LOGOUT_FLOW WARNING] window.editor or setContent not found.');
      }
  } catch (editorError) {
       log.warn('LOGOUT', 'EDITOR_CLEAR_ERROR', `[LOGOUT_FLOW WARNING] Failed to clear editor content: ${editorError.message}`, editorError);
  }
  // --- End Client-side state clearing --- 

  // Dispatch AUTH_LOGOUT action - reducer handles resetting auth state
  dispatch({ type: ActionTypes.AUTH_LOGOUT });
  log.info('LOGOUT', 'DISPATCHED_LOGOUT', '[LOGOUT_FLOW] Dispatched AUTH_LOGOUT. State reset handled by reducer/subscribers.');
  // Note: fileManager will see the auth state change via its subscription
  // and call its own resetFileManagerState function.
}

// Updated default export - Removed authState export
export default {
  initAuth,
  logout,
}; 