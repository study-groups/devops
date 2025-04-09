/**
 * auth.js
 * Core authentication logic: state management, login/logout, hashing, API interaction.
 */
import { globalFetch } from '/client/globalFetch.js';
import { eventBus } from '/client/eventBus.js';
import { authState } from './authState.js'; // Import the new reactive state
import fileSystemState from './fileSystemState.js'; // Import fileSystemState directly

// --- Constants ---
const LOGIN_ENDPOINT = '/api/auth/login';
const LOGOUT_ENDPOINT = '/api/auth/logout';
const USER_STATUS_ENDPOINT = '/api/auth/user';

// --- State ---
// Removed the old AUTH_STATE object. State is now managed in authState.js

// --- Private Functions ---

/**
 * Updates the reactive authentication state.
 * @param {object} data - The new state properties to merge.
 */
function updateReactiveAuthState(data) {
  const currentState = authState.get(); // Get current state for comparison/logging if needed
  logAuth(`Updating auth state: ${JSON.stringify(data)}`);
  
  // Use the update function from the created state
  authState.update(prevState => ({ 
      ...prevState, 
      ...data, 
      isChecking: false // Mark checking as complete on any update after init
  }));

  // Keep emitting specific status/lifecycle events if needed
  if (data.isAuthenticated !== undefined || data.error !== undefined) {
      eventBus.emit('auth:loginStatus', {
          success: data.isAuthenticated === true,
          username: data.username !== undefined ? data.username : currentState.username, // Use new or old username
          error: data.error
      });
  }
}

// --- Public API ---

/**
 * Checks the initial authentication status with the server.
 */
async function checkInitialAuthStatus() {
    logAuth('[AUTH] Checking initial auth status with server...');
    try {
        const response = await globalFetch(USER_STATUS_ENDPOINT);
        if (response.ok) {
            const data = await response.json();
            if (data.username) {
                logAuth(`[AUTH] Server confirmed active session for: ${data.username}`);
                updateReactiveAuthState({ 
                    isAuthenticated: true, 
                    username: data.username, 
                    error: null
                    // isChecking will be set to false by updateReactiveAuthState
                });
                eventBus.emit('auth:restored', { username: data.username });
            } else {
                 logAuth('[AUTH] Server status OK but no username returned.', 'warning');
                 updateReactiveAuthState({ isAuthenticated: false, username: null, error: null });
            }
        } else if (response.status === 401) {
            logAuth('[AUTH] No active session found on server.');
            updateReactiveAuthState({ isAuthenticated: false, username: null, error: null });
        } else {
            logAuth(`[AUTH] Unexpected status ${response.status} checking auth status.`, 'error');
            updateReactiveAuthState({ isAuthenticated: false, username: null, error: `Server status check failed: ${response.status}` });
        }
    } catch (error) {
        logAuth(`[AUTH] Error checking initial auth status: ${error.message}`, 'error');
        updateReactiveAuthState({ isAuthenticated: false, username: null, error: 'Network error checking auth status' });
    }
}

/**
 * Initializes the authentication system.
 */
export function initAuth() {
    logAuth('[AUTH] Initializing authentication system...');
    // The initial state in authState.js already has isChecking: true
    checkInitialAuthStatus(); 
    logAuth('[AUTH] System initialized. Initial check started.');
}

/**
 * Handles the login process.
 * @param {string} username - The username.
 * @param {string} password - The plain text password.
 * @returns {Promise<boolean>} True on successful login, false otherwise.
 */
export async function handleLogin(username, password) {
  if (!username || !password) {
    logAuth('[AUTH] Login attempt with missing credentials', 'warning');
    updateReactiveAuthState({ error: 'Username and password required' }); // Update error state
    return false;
  }

  // Optional: Indicate authenticating state if needed in authState
  // authState.update(s => ({ ...s, isAuthenticating: true })); // If you add this flag to authState

  try {
    logAuth(`[AUTH] Sending login request for user: ${username}`);
    const loginResponse = await globalFetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!loginResponse.ok) {
        let errorMsg = `Login failed: ${loginResponse.status}`;
        try {
            const errorData = await loginResponse.json();
            errorMsg = errorData.error || errorMsg;
        } catch (e) { /* Ignore JSON parsing error */ }
        throw new Error(errorMsg);
    }

    logAuth(`[AUTH] Server login successful for: ${username}`);
    updateReactiveAuthState({ 
        isAuthenticated: true, 
        username: username, 
        error: null
    });
    return true;

  } catch (error) {
    logAuth(`[AUTH] Login failed: ${error.message}`, 'error');
    updateReactiveAuthState({ 
        isAuthenticated: false, // Ensure authenticated is false on error
        username: null, // Clear username on error
        error: error.message 
    });
    return false;
  }
}

/**
 * Handles the logout process.
 * @param {boolean} [notifyServer=true] - Whether to send a request to the server.
 */
export async function logout(notifyServer = true) {
  const currentUser = authState.get().username; // Get username from reactive state
  logAuth(`[AUTH] Logout requested for ${currentUser || 'user'}. Notify server: ${notifyServer}`);

  if (notifyServer) {
    try {
      const response = await globalFetch(LOGOUT_ENDPOINT, { method: 'POST' });
      if (!response.ok) {
        logAuth(`[AUTH] Server logout failed: ${response.status}`, 'warning');
      } else {
         logAuth('[AUTH] Server logout successful.');
      }
    } catch (error) {
      logAuth(`[AUTH] Error during server logout: ${error.message}`, 'warning');
    }
  }

  // Update reactive state for logout
  updateReactiveAuthState({ 
      isAuthenticated: false, 
      username: null, 
      error: null
  });

  // Clear other related state
  fileSystemState.saveState({ currentDir: '', currentFile: '' });
  logAuth('[AUTH] Client file system state cleared via fileSystemState.saveState.');
  
  // ADDED: Clear the editor content
  try {
      window.editor?.setContent('');
      logAuth('[AUTH] Editor content cleared.');
  } catch (editorError) {
       logAuth(`[AUTH WARNING] Failed to clear editor content: ${editorError.message}`, 'warning');
  }

  // Emit lifecycle event
  eventBus.emit('auth:loggedOut', { username: currentUser });
}

// Default export updated to export authState as well if needed, or remove it
export default {
  // AUTH_STATE removed
  initAuth,
  handleLogin,
  logout,
  authState // Export the state object itself if needed by consumers
}; 

/**
 * Wrapper for logging auth messages.
 * Uses window.logMessage if available, otherwise console.log.
 * @param {string} message
 * @param {string} [level='text'] - 'text', 'error', 'warning'
 */
function logAuth(message, level = 'text') {
    const prefix = '[AUTH]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
} 