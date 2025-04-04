/**
 * auth.js
 * Core authentication logic: state management, login/logout, hashing, API interaction.
 */
import { logMessage } from '/client/log/index.js';
import { eventBus } from '/client/eventBus.js';
import { globalFetch } from '/client/globalFetch.js';

// --- Constants ---
const SALT_ENDPOINT = '/api/auth/salt';
const LOGIN_ENDPOINT = '/api/auth/login';
const LOGOUT_ENDPOINT = '/api/auth/logout';
const AUTH_STATE_KEY = 'authState';

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
  logMessage('[AUTH WARN] clearFileSystemState called before fileManager loaded');
};
try {
  import('/client/fileManager.js').then(module => {
    if (module && typeof module.clearFileSystemState === 'function') {
      clearFileSystemState = module.clearFileSystemState;
      logMessage('[AUTH] clearFileSystemState function dynamically loaded.');
    } else {
      logMessage('[AUTH ERROR] Failed to load clearFileSystemState from fileManager.', 'error');
    }
  }).catch(err => {
     logMessage(`[AUTH ERROR] Error dynamically loading fileManager: ${err.message}`, 'error');
  });
} catch (e) {
   logMessage(`[AUTH ERROR] Setup for dynamic import of fileManager failed: ${e.message}`, 'error');
}

// --- CORRECT PBKDF2 Hashing Function ---
/**
 * Converts an ArrayBuffer to a hex string.
 */
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes a password with a salt using PBKDF2-SHA512, matching the server implementation.
 * @param {string} password - The plain text password.
 * @param {string} salt - The hex-encoded salt from the server.
 * @returns {Promise<string|null>} The resulting hash as a hex string, or null on error.
 */
async function hashPasswordPBKDF2(password, salt) {
  if (!password || !salt) {
    logMessage('[AUTH] Missing password or salt for PBKDF2 hash', 'error');
    return null;
  }
  try {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    // Salt needs to be decoded from hex back to buffer for crypto.subtle
    const saltBuffer = Uint8Array.from(salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    // 1. Import the password key (required for deriveBits)
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false, // not extractable
      ['deriveBits']
    );

    // 2. Derive the bits using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 10000, // Match server iterations
        hash: 'SHA-512' // Match server hash
      },
      keyMaterial,
      512 // Match server key length (64 bytes * 8 bits/byte)
    );

    // 3. Convert the derived bits (ArrayBuffer) to a hex string
    const hashHex = bufferToHex(derivedBits);
    logMessage(`[AUTH] PBKDF2 hash generated: ${hashHex.slice(0, 20)}...`);
    return hashHex;

  } catch (error) {
    logMessage(`[AUTH] PBKDF2 hashing failed: ${error.message}`, 'error');
    console.error('[AUTH PBKDF2 Error Stack]:', error);
    return null;
  }
}

// --- End PBKDF2 Hashing Function ---

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

  logMessage(`[AUTH] State changed: ${oldState} -> ${newState} for user: ${AUTH_STATE.username || 'none'}`);
  saveAuthState();
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

/**
 * Saves the current authentication state to localStorage.
 */
export function saveAuthState() {
  try {
    const stateToSave = {
      current: AUTH_STATE.current,
      username: AUTH_STATE.username,
      loginTime: AUTH_STATE.loginTime,
      expiresAt: AUTH_STATE.expiresAt,
    };
    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(stateToSave));
    logMessage('[AUTH] State saved to localStorage');
  } catch (error) {
    logMessage(`[AUTH] Failed to save state: ${error.message}`, 'error');
  }
}

/**
 * Restores authentication state from localStorage.
 * @returns {Promise<boolean>} True if restored state is authenticated, false otherwise.
 */
export async function restoreLoginState() {
  logMessage('[AUTH] Attempting to restore login state...');
  try {
    const savedState = localStorage.getItem(AUTH_STATE_KEY);
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      // Restore based only on state and username
      if (parsedState.current === AUTH_STATE.AUTHENTICATED && parsedState.username) {
        // Optional: Check expiration
        if (parsedState.expiresAt && new Date(parsedState.expiresAt) < new Date()) {
          logMessage('[AUTH] Restored session expired. Logging out.');
          await logout(false); // Logout without server call
          return false;
        }

        // Restore state WITHOUT password
        setAuthState(AUTH_STATE.AUTHENTICATED, {
          username: parsedState.username,
          loginTime: parsedState.loginTime,
          expiresAt: parsedState.expiresAt,
        });
        logMessage(`[AUTH] Successfully restored state for user: ${parsedState.username}`);
         eventBus.emit('auth:restored', { username: parsedState.username });
        return true;
      } else {
         logMessage('[AUTH] Saved state is invalid or unauthenticated.');
         if (AUTH_STATE.current !== AUTH_STATE.UNAUTHENTICATED) {
             setAuthState(AUTH_STATE.UNAUTHENTICATED);
         }
      }
    } else {
      logMessage('[AUTH] No saved state found.');
      setAuthState(AUTH_STATE.UNAUTHENTICATED);
    }
  } catch (error) {
    logMessage(`[AUTH] Failed to restore state: ${error.message}`, 'error');
    setAuthState(AUTH_STATE.ERROR, { error: 'Failed to restore state' });
    localStorage.removeItem(AUTH_STATE_KEY);
  }
  return false;
}

// --- Public API ---

/**
 * Initializes the authentication system.
 * @returns {boolean} Always true (initialization success).
 */
export function initAuth() {
    logMessage('[AUTH] Initializing authentication system...');
    // Attempt to restore state immediately
    restoreLoginState().then(isLoggedIn => {
        if (!isLoggedIn && AUTH_STATE.current !== AUTH_STATE.UNAUTHENTICATED) {
             // If restoration failed but state isn't explicitly unauthenticated, set it.
             setAuthState(AUTH_STATE.UNAUTHENTICATED);
        }
    });
    // Setup listeners or timers if needed (e.g., for token refresh)
    logMessage('[AUTH] System initialized.');
    return true; // Indicate success
}

/**
 * Handles the login process.
 * @param {string} username - The username.
 * @param {string} password - The plain text password.
 * @returns {Promise<boolean>} True on successful login, false otherwise.
 */
export async function handleLogin(username, password) {
  if (!username || !password) {
    logMessage('[AUTH] Login attempt with missing credentials', 'warning');
    return false;
  }

  setAuthState(AUTH_STATE.AUTHENTICATING, { username });

  try {
    // 1. Fetch the salt
    logMessage(`[AUTH] Fetching salt for user: ${username}`);
    const saltResponse = await globalFetch(`${SALT_ENDPOINT}?username=${encodeURIComponent(username)}`);
    if (!saltResponse.ok) {
      throw new Error(`Salt endpoint failed: ${saltResponse.status}`);
    }
    const saltData = await saltResponse.json();
    if (!saltData.salt) {
      throw new Error('Salt not found for user');
    }

    // 2. Perform client-side hashing using PBKDF2
    const hashedPassword = await hashPasswordPBKDF2(password, saltData.salt);
    if (!hashedPassword) {
      setAuthState(AUTH_STATE.ERROR, { username, error: 'Client-side PBKDF2 hashing failed' });
      return false;
    }

    logMessage(`[AUTH] Attempting login for: ${username} with client PBKDF2 hash`);
    const response = await globalFetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Send HASHED password with field name 'hashedPassword'
      body: JSON.stringify({ username, hashedPassword: hashedPassword }),
    });

    if (response.ok) {
      const responseData = await response.json();
      // Store state WITHOUT password/hash
      setAuthState(AUTH_STATE.AUTHENTICATED, {
          username,
          loginTime: Date.now(),
          expiresAt: responseData?.expiresAt || null
      });
      logMessage(`[AUTH] Login successful for ${username}`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({ error: `Server error: ${response.status}` }));
      logMessage(`[AUTH] Login failed: ${response.status} - ${JSON.stringify(errorData)}`, 'error');
      setAuthState(AUTH_STATE.ERROR, { username, error: `Login failed: ${response.status}` });
      return false;
    }
  } catch (error) {
    logMessage(`[AUTH] Login error: ${error.message}`, 'error');
    setAuthState(AUTH_STATE.ERROR, { username, error: error.message });
    return false;
  }
}

/**
 * Handles the logout process.
 * @param {boolean} [notifyServer=true] - Whether to send a logout request to the server.
 * @returns {Promise<boolean>} True on successful logout, false otherwise.
 */
export async function logout(notifyServer = true) {
  logMessage(`[AUTH] Logout initiated (notify server: ${notifyServer})`);
  const loggedOutUsername = AUTH_STATE.username;

  // Clear client state immediately
  setAuthState(AUTH_STATE.UNAUTHENTICATED);
  localStorage.removeItem(AUTH_STATE_KEY);
  // Use dynamically imported function
  await clearFileSystemState();

  if (notifyServer) {
    try {
      const response = await globalFetch(LOGOUT_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username: loggedOutUsername })
      });
      if (!response.ok) {
        logMessage(`[AUTH WARN] Server logout notification failed: ${response.status}`, 'warning');
      } else {
        logMessage('[AUTH] Server logout successful');
      }
    } catch (error) {
      logMessage(`[AUTH WARN] Server logout notification error: ${error.message}`, 'warning');
    }
  }

  logMessage('[AUTH] Client state cleared. Logout complete.');
  eventBus.emit('auth:loggedOut');
  return true;
}

// Default export for convenience
export default {
  AUTH_STATE,
  initAuth,
  handleLogin,
  logout,
  saveAuthState,
  restoreLoginState,
}; 