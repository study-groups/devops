/**
 * core/auth.js
 * Implementation of authentication functionality
 */
import { logMessage } from '../log/index.js';
import { eventBus } from '../eventBus.js';
import { clearFileSystemState } from '/client/core/fileManager.js';

// Auth state - central source of truth
export const AUTH_STATE = {
    isLoggedIn: false,
    username: '',
    hashedPassword: '',
    loginTime: null,
    expiresAt: null
};

// Constants
const DEFAULT_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hash password with salt using PBKDF2 to match server implementation
 * @param {string} password - The raw password
 * @param {string} salt - The salt
 * @returns {Promise<string>} - The hashed password
 */
export async function hashPasswordWithSalt(password, salt) {
    // Convert password and salt to buffers
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = encoder.encode(salt);
    
    // Import the password as a key
    const passwordKey = await crypto.subtle.importKey(
        'raw', 
        passwordBuffer,
        { name: 'PBKDF2' }, 
        false, 
        ['deriveBits']
    );
    
    // Derive bits using PBKDF2
    const keyBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: 10000,
            hash: 'SHA-512'
        },
        passwordKey,
        512 // 64 bytes = 512 bits
    );
    
    // Convert to hex
    const hashArray = Array.from(new Uint8Array(keyBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Simple SHA-256 hash for backward compatibility
 * @param {string} password - The password to hash
 * @returns {Promise<string>} - The hashed password
 */
export async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Handle user login
 * @param {string} username - The username to log in with
 * @param {string} password - The password to log in with
 * @returns {Promise<boolean>} - Whether the login was successful
 */
export async function handleLogin(username, password) {
    try {
        // First clear any existing state
        await logout(true);
        
        logMessage('[AUTH] Attempting login...');
        
        // Step 1: Get the salt for this user
        const saltResponse = await fetch(`/api/auth/salt?username=${encodeURIComponent(username)}`);
        if (!saltResponse.ok) {
            logMessage(`[AUTH ERROR] Failed to get salt: ${saltResponse.status}`, 'error');
            return false;
        }
        
        const saltData = await saltResponse.json();
        const salt = saltData.salt;
        
        if (!salt) {
            logMessage('[AUTH ERROR] No salt returned from server', 'error');
            return false;
        }
        
        logMessage('[AUTH] Retrieved salt for user');
        
        // Step 2: Hash the password with the salt using PBKDF2
        const hashedPassword = await hashPasswordWithSalt(password, salt);
        
        // Step 3: Send the login request with username and properly hashed password
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username, 
                hashedPassword
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            logMessage(`[AUTH ERROR] Login failed: ${response.status} - ${errorText || response.statusText}`, 'error');
            
            // Emit the login failure event
            eventBus.emit('auth:loginStatus', {
                success: false,
                error: errorText || response.statusText,
                status: response.status
            });
            
            return false;
        }
        
        // Process successful response
        let data;
        try {
            const responseText = await response.text();
            data = JSON.parse(responseText);
        } catch (error) {
            // If response isn't valid JSON, create a basic result
            data = { expiresIn: DEFAULT_EXPIRATION };
            logMessage('[AUTH WARN] Could not parse login response as JSON, using default expiry');
        }
        
        // Update auth state
        Object.assign(AUTH_STATE, {
            isLoggedIn: true,
            username: username,
            hashedPassword: hashedPassword,
            loginTime: Date.now(),
            expiresAt: Date.now() + (data.expiresIn || DEFAULT_EXPIRATION)
        });
        
        // Save state to localStorage
        saveAuthState();
        
        // Update event bus
        eventBus.emit('auth:loginStatus', {
            success: true,
            username,
            expiresAt: AUTH_STATE.expiresAt
        });
        
        logMessage(`[AUTH] Login successful: ${username}`);
        return true;
    } catch (error) {
        logMessage(`[AUTH ERROR] ${error.message}`, 'error');
        
        // Emit the login failure event
        eventBus.emit('auth:loginStatus', {
            success: false,
            error: error.message
        });
        
        return false;
    }
}

/**
 * Log the user out
 * @param {boolean} silent - Whether to log the logout
 */
export async function logout(silent = false) {
    // Clear auth state
    Object.assign(AUTH_STATE, {
        isLoggedIn: false,
        username: '',
        hashedPassword: '',
        loginTime: null,
        expiresAt: null
    });
    
    // Clear localStorage
    localStorage.removeItem('authState');
    
    // Clear file system state
    try {
        await clearFileSystemState();
    } catch (error) {
        logMessage(`[AUTH ERROR] Failed to clear file system state: ${error.message}`, 'error');
    }
    
    // Emit logout event
    eventBus.emit('auth:logout');
    
    if (!silent) {
        logMessage('[AUTH] User logged out');
    }
}

/**
 * Save the current auth state to localStorage
 */
export function saveAuthState() {
    try {
        const authData = {
            isLoggedIn: AUTH_STATE.isLoggedIn,
            username: AUTH_STATE.username,
            hashedPassword: AUTH_STATE.hashedPassword,
            loginTime: AUTH_STATE.loginTime,
            expiresAt: AUTH_STATE.expiresAt
        };
        
        localStorage.setItem('authState', JSON.stringify(authData));
        logMessage('[AUTH] Auth state saved to localStorage');
    } catch (error) {
        logMessage(`[AUTH ERROR] Failed to save auth state: ${error.message}`, 'error');
    }
}

/**
 * Restore the login state from localStorage
 * @returns {Promise<boolean>} - Whether a valid session was restored
 */
export async function restoreLoginState() {
    try {
        const storedAuth = localStorage.getItem('authState');
        if (!storedAuth) {
            logMessage('[AUTH] No stored auth state found');
            return false;
        }
        
        const parsedAuth = JSON.parse(storedAuth);
        if (!parsedAuth.isLoggedIn || !parsedAuth.username || !parsedAuth.hashedPassword) {
            logMessage('[AUTH] Stored auth state is invalid');
            localStorage.removeItem('authState');
            return false;
        }
        
        // Check if session has expired
        if (parsedAuth.expiresAt && parsedAuth.expiresAt < Date.now()) {
            logMessage('[AUTH] Stored session has expired');
            localStorage.removeItem('authState');
            return false;
        }
        
        // Update auth state
        Object.assign(AUTH_STATE, parsedAuth);
        
        // Emit login event
        eventBus.emit('auth:loginStatus', {
            success: true,
            username: AUTH_STATE.username,
            expiresAt: AUTH_STATE.expiresAt
        });
        
        logMessage(`[AUTH] Restored session for user: ${AUTH_STATE.username}`);
        return true;
    } catch (error) {
        logMessage(`[AUTH ERROR] Failed to restore login state: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Get authentication headers for API requests
 * @returns {Object} - Headers object with Authentication header
 */
export function getAuthHeaders() {
    if (!AUTH_STATE.isLoggedIn || !AUTH_STATE.hashedPassword) {
        return {};
    }
    
    return {
        'Authorization': `Basic ${btoa(`${AUTH_STATE.username}:${AUTH_STATE.hashedPassword}`)}`
    };
}

/**
 * Initialize the authentication system
 * @returns {Promise<boolean>} - Whether initialization was successful
 */
export async function initAuth() {
    logMessage('[AUTH] Initializing authentication system');
    
    // Try to restore login state
    const restored = await restoreLoginState();
    
    // Set up logout button if needed
    setupLogoutButton();
    
    return restored;
}

/**
 * Set up the logout button
 */
export function setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logout());
        logMessage('[AUTH] Logout button handler set up');
    }
}

// Alias for initAuth for consistency with other modules
export const initializeAuth = initAuth;

// Export the module for use with default imports
const auth = {
    AUTH_STATE,
    initAuth,
    initializeAuth,
    handleLogin,
    logout,
    restoreLoginState,
    saveAuthState,
    getAuthHeaders,
    hashPassword,
    hashPasswordWithSalt,
    setupLogoutButton
};

export default auth; 