/**
 * auth.js
 * Core authentication logic: state management, login/logout, hashing, API interaction.
 */
import { globalFetch } from '/client/globalFetch.js';
import { eventBus } from '/client/eventBus.js';

// --- Constants ---
const LOGIN_ENDPOINT = '/api/auth/login';
const LOGOUT_ENDPOINT = '/api/auth/logout';
const USER_STATUS_ENDPOINT = '/api/auth/user';

// --- State ---
export const AUTH_STATE = {
  UNKNOWN: 'unknown',
  AUTHENTICATING: 'authenticating',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
  ERROR: 'error',
  current: 'unknown',
  username: '',
  loginTime: null,
  expiresAt: null, // Optional: For session expiration
};

// Need to import clearFileSystemState separately after moving fileManager
let clearFileSystemState = async () => {
  logAuth('[AUTH WARN] clearFileSystemState called before fileManager loaded');
};
try {
  import('/client/fileManager.js').then(module => {
    if (module && typeof module.clearFileSystemState === 'function') {
      clearFileSystemState = module.clearFileSystemState;
      logAuth('[AUTH] clearFileSystemState function dynamically loaded.');
    } else {
      logAuth('[AUTH ERROR] Failed to load clearFileSystemState from fileManager.', 'error');
    }
  }).catch(err => {
     logAuth(`[AUTH ERROR] Error dynamically loading fileManager: ${err.message}`, 'error');
  });
} catch (e) {
   logAuth(`[AUTH ERROR] Setup for dynamic import of fileManager failed: ${e.message}`, 'error');
}

// --- Private Functions ---

/**
 * Updates the authentication state and notifies listeners.
 * @param {string} newState - The new state value (e.g., AUTH_STATE.AUTHENTICATED).
 * @param {object} [data={}] - Optional data associated with the state change.
 */
function setAuthState(newState, data = {}) {
  const oldState = AUTH_STATE.current;
  if (oldState === newState && JSON.stringify(AUTH_STATE.username) === JSON.stringify(data.username)) {
    return; // No change
  }

  AUTH_STATE.current = newState;
  AUTH_STATE.username = data.username || '';
  AUTH_STATE.loginTime = data.loginTime || null;
  AUTH_STATE.expiresAt = data.expiresAt || null;

  logAuth(`[AUTH] State changed: ${oldState} -> ${newState} for user: ${AUTH_STATE.username || 'none'}`);
  eventBus.emit('auth:stateChanged', newState, { username: AUTH_STATE.username });
  // Specific event for login success/failure
  if (newState === AUTH_STATE.AUTHENTICATED || newState === AUTH_STATE.UNAUTHENTICATED || newState === AUTH_STATE.ERROR) {
      eventBus.emit('auth:loginStatus', {
          success: newState === AUTH_STATE.AUTHENTICATED,
          username: AUTH_STATE.username,
          error: data.error || (newState === AUTH_STATE.ERROR ? 'Authentication error' : null)
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
                setAuthState(AUTH_STATE.AUTHENTICATED, { 
                    username: data.username, 
                    loginTime: new Date().toISOString() // Set login time on status check success
                });
                eventBus.emit('auth:restored', { username: data.username }); // Reuse event for consistency
            } else {
                 logAuth('[AUTH] Server status OK but no username returned.', 'warning');
                 setAuthState(AUTH_STATE.UNAUTHENTICATED);
            }
        } else if (response.status === 401) {
            logAuth('[AUTH] No active session found on server.');
            setAuthState(AUTH_STATE.UNAUTHENTICATED);
        } else {
            logAuth(`[AUTH] Unexpected status ${response.status} checking auth status.`, 'error');
            setAuthState(AUTH_STATE.ERROR, { error: `Server status check failed: ${response.status}` });
        }
    } catch (error) {
        logAuth(`[AUTH] Error checking initial auth status: ${error.message}`, 'error');
        setAuthState(AUTH_STATE.ERROR, { error: 'Network error checking auth status' });
    }
}

/**
 * Initializes the authentication system.
 */
export function initAuth() {
    logAuth('[AUTH] Initializing authentication system...');
    // Check status with server instead of restoring from localStorage
    checkInitialAuthStatus(); 
    // Setup listeners or timers if needed
    logAuth('[AUTH] System initialized.');
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
    setAuthState(AUTH_STATE.ERROR, { error: 'Username and password required' });
    return false;
  }

  setAuthState(AUTH_STATE.AUTHENTICATING, { username });

  try {
    // 1. Send plain username and password to the server
    logAuth(`[AUTH] Sending login request for user: ${username}`);
    const loginResponse = await globalFetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }), // Send plain password
    });

    if (!loginResponse.ok) {
        let errorMsg = `Login failed: ${loginResponse.status}`;
        try {
            const errorData = await loginResponse.json();
            errorMsg = errorData.error || errorMsg;
        } catch (e) { /* Ignore JSON parsing error */ }
        throw new Error(errorMsg);
    }

    // Login successful on the server
    logAuth(`[AUTH] Server login successful for: ${username}`);
    setAuthState(AUTH_STATE.AUTHENTICATED, { 
        username: username, 
        loginTime: new Date().toISOString() 
    });
    return true;

  } catch (error) {
    logAuth(`[AUTH] Login failed: ${error.message}`, 'error');
    setAuthState(AUTH_STATE.ERROR, { error: error.message });
    return false;
  }
}

/**
 * Handles the logout process.
 * @param {boolean} [notifyServer=true] - Whether to send a request to the server.
 */
export async function logout(notifyServer = true) {
  const currentUser = AUTH_STATE.username;
  logAuth(`[AUTH] Logout requested for ${currentUser || 'user'}. Notify server: ${notifyServer}`);

  if (notifyServer) {
    try {
      const response = await globalFetch(LOGOUT_ENDPOINT, { method: 'POST' });
      if (!response.ok) {
        // Log error but proceed with client-side logout anyway
        logAuth(`[AUTH] Server logout failed: ${response.status}`, 'warning');
      } else {
         logAuth('[AUTH] Server logout successful.');
      }
    } catch (error) {
      logAuth(`[AUTH] Error during server logout: ${error.message}`, 'warning');
    }
  }

  // Clear client state immediately regardless of server response
  setAuthState(AUTH_STATE.UNAUTHENTICATED);
  // Use dynamically imported function
  await clearFileSystemState();
  logAuth('[AUTH] Client state cleared.');
  eventBus.emit('auth:loggedOut', { username: currentUser });
}

// Default export for convenience
export default {
  AUTH_STATE,
  initAuth,
  handleLogin,
  logout,
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