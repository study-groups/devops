import { logMessage } from "./log/index.js";
import { updateAuthDisplay, showSystemInfo } from './uiManager.js';
import { appName, appVer } from './config.js';
import { clearFileSystemState } from './fileSystemState.js';
// Import directly - no dynamic imports
import { restoreLoginState } from './authManager.js';

export const authState = {
    isLoggedIn: false,
    username: '',
    password: '',
    loginTime: null,
    expiresAt: null
};

const EXPIRATION_TIME = 60 * 60 * 1000; // 60 minutes in milliseconds

async function hashPassword(password, salt) {
    console.log(`[AUTH DEBUG] Client hashing password with:`);
    console.log(`[AUTH DEBUG] Password: ${password}`);
    console.log(`[AUTH DEBUG] Salt: ${salt}`);
    
    const encoder = new TextEncoder();
    
    // Import just the password as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),  // Only password, not password+salt
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    
    // Use the salt in PBKDF2
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 10000,
            hash: 'SHA-512'
        },
        keyMaterial,
        512 // 64 bytes * 8 = 512 bits
    );
    
    // Convert to hex string
    const result = Array.from(new Uint8Array(bits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    console.log(`[AUTH DEBUG] Produced hash: ${result.slice(0, 20)}...`);
    return result;
}

export async function handleLogin(username, password) {
    console.log(`[AUTH] Attempting login for ${username}`);
    logMessage(`[AUTH] Attempting login for ${username}`);

    if (!username || !password) {
        logMessage('[AUTH ERROR] Username and password are required');
        throw new Error('Username and password are required');
    }

    try {
        const saltResponse = await fetch(`/api/auth/salt?username=${encodeURIComponent(username)}`);
        if (!saltResponse.ok) {
            logMessage(`[AUTH ERROR] Failed to get salt: ${saltResponse.status}`);
            throw new Error(`Failed to get salt: ${saltResponse.status}`);
        }
        const { salt } = await saltResponse.json();

        const hashedPassword = await hashPassword(password, salt);

        const loginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, hashedPassword }),
        });

        if (loginResponse.status === 401) {
            logMessage('[AUTH ERROR] Login failed: Invalid credentials');
            updateAuthDisplay('Invalid credentials');
            throw new Error('Unauthorized');
        }

        if (!loginResponse.ok) {
          const errorText = await loginResponse.text();
          logMessage(`[AUTH ERROR] Login failed: ${loginResponse.status} - ${errorText}`);
          throw new Error(`Login failed: ${loginResponse.status} - ${errorText}`);
        }

        const data = await loginResponse.json();

        if (data.success) {
            authState.isLoggedIn = true;
            authState.username = username;
            authState.hashedPassword = hashedPassword;
            authState.loginTime = Date.now();
            authState.expiresAt = Date.now() + EXPIRATION_TIME;

            localStorage.setItem('authState', JSON.stringify(authState));

            logMessage(`[AUTH] Login successful: ${username}`);
            updateAuthDisplay();

            // Dispatch login event with handled flag
            document.dispatchEvent(new CustomEvent('auth:login', {
                detail: {
                    username: username,
                    isLoggedIn: true,
                    expiresAt: authState.expiresAt,
                    handled: false
                }
            }));
        } else {
            logMessage('[AUTH ERROR] Unexpected server response');
            throw new Error('Unexpected server response');
        }

    } catch (error) {
        logMessage(`[AUTH ERROR] Login error: ${error.message}`);
        console.error(`[AUTH ERROR]`, error);
        updateAuthDisplay(error.message);
    }
}

// Add this function to clear the editor interface on logout
function clearEditorInterface() {
    try {
        // Clear the editor textarea
        const editorTextarea = document.querySelector('#md-editor textarea');
        if (editorTextarea) {
            editorTextarea.value = '';
            logMessage('[AUTH] Cleared editor content');
        }
        
        // Clear the preview
        const preview = document.getElementById('md-preview');
        if (preview) {
            preview.innerHTML = '';
            logMessage('[AUTH] Cleared preview content');
        }
        
        // Clear file and directory selects
        const fileSelect = document.getElementById('file-select');
        if (fileSelect) {
            // Keep only the first option
            while (fileSelect.options.length > 1) {
                fileSelect.remove(1);
            }
            fileSelect.selectedIndex = 0;
            logMessage('[AUTH] Cleared file select');
        }
        
        const dirSelect = document.getElementById('dir-select');
        if (dirSelect) {
            // Keep only the first option
            while (dirSelect.options.length > 1) {
                dirSelect.remove(1);
            }
            dirSelect.selectedIndex = 0;
            logMessage('[AUTH] Cleared directory select');
        }
        
        // Update the UI to reflect logged out state
        document.body.setAttribute('data-auth-state', 'logged-out');
        
        logMessage('[AUTH] Editor interface cleared');
    } catch (error) {
        logMessage(`[AUTH ERROR] Failed to clear editor interface: ${error.message}`);
        console.error('[AUTH ERROR]', error);
    }
}

// Update the logout function to clear the interface
export async function logout() {
    try {
        logMessage('[AUTH] Logging out...');
        
        // Clear auth state
        authState.isLoggedIn = false;
        authState.username = '';
        authState.password = '';
        authState.loginTime = null;
        authState.expiresAt = null;
        
        // Update UI
        updateAuthDisplay();
        
        // Clear file system state
        clearFileSystemState();
        
        // Clear the editor interface
        clearEditorInterface();
        
        // Save auth state to localStorage
        localStorage.removeItem('authState');
        
        logMessage('[AUTH] Logged out successfully');
        return true;
    } catch (error) {
        logMessage(`[AUTH ERROR] Logout failed: ${error.message}`);
        console.error('[AUTH ERROR]', error);
        return false;
    }
}

// Add initialization state tracking
let authInitialized = false;
let handlersAttached = false;

// Initialize authentication system
export async function initializeAuth() {
    if (authInitialized) {
        console.log('[AUTH] Already initialized, skipping');
        return;
    }

    logMessage('[AUTH] Initializing authentication system');
    
    try {
        // Only attach handlers once
        if (!handlersAttached) {
            attachLoginHandlers();
            setupLogoutButton();
            handlersAttached = true;
        }
        
        authInitialized = true;
        logMessage('[AUTH] Authentication system initialized');
    } catch (error) {
        console.error('[AUTH] Initialization error:', error);
        logMessage(`[AUTH ERROR] ${error.message}`);
    }
}

// Update attachLoginHandlers to prevent duplicate handlers
function attachLoginHandlers() {
    if (handlersAttached) {
        console.log('[AUTH] Handlers already attached, skipping');
        return;
    }

    logMessage('[AUTH] Attaching login handlers');

    // Handle form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        logMessage('[AUTH] Found login form, attaching submit handler');

        // Remove any existing event listeners first
        const newLoginForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newLoginForm, loginForm);

        // Add form submit handler
        newLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            logMessage(`[AUTH] Login form submitted for user: ${username}`);
            handleLogin(username, password);
        });

        logMessage('[AUTH] Login form submit handler attached successfully.');
    }

    // Attach logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logMessage('[AUTH] Found logout button, attaching click handler');
        
        // Remove any existing event listeners first
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        
        // Add our click handler
        newLogoutBtn.addEventListener('click', logout);
    }

    // Attach info button handler
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
        logMessage('[AUTH] Found info button, attaching click handler');
        const newInfoBtn = infoBtn.cloneNode(true);
        infoBtn.parentNode.replaceChild(newInfoBtn, infoBtn);
        newInfoBtn.addEventListener('click', showSystemInfo);
    }
    
    handlersAttached = true;
    logMessage('[AUTH] Login handlers attached successfully');
}

// Add this function to auth.js
async function displayEnvironmentInfo() {
    try {
        logMessage(`[CONFIG] Fetching ${appName} v${appVer} configuration...`);
        const response = await fetch('/api/auth/config');
        const config = await response.json();

        // Log configuration with consistent formatting
        logMessage('\n' + '='.repeat(50));
        logMessage(`[CONFIG] ${appName.toUpperCase()} CONFIGURATION (v${appVer})`);
        logMessage('='.repeat(50));
        
        // Environment
        logMessage('[CONFIG] Environment Settings:');
        logMessage(`[CONFIG] NODE_ENV     = ${config.NODE_ENV}`);
        logMessage(`[CONFIG] PORT         = ${config.PORT}`);
        logMessage(`[CONFIG] VERSION      = ${config.VERSION}`);
        logMessage(`[CONFIG] SERVER_TIME  = ${config.SERVER_TIME}`);
        
        // Directories
        logMessage('\n[CONFIG] Directory Paths:');
        logMessage(`[CONFIG] PJ_DIR       = ${config.PJ_DIR}`);
        logMessage(`[CONFIG] MD_DIR       = ${config.MD_DIR}`);
        logMessage(`[CONFIG] UPLOADS_DIR  = ${config.UPLOADS_DIR}`);
        logMessage(`[CONFIG] IMAGES_DIR   = ${config.IMAGES_DIR}`);
        logMessage(`[CONFIG] USERS_FILE   = ${config.USERS_FILE}`);
        
        // Browser Info
        logMessage('\n[CONFIG] Browser Information:');
        logMessage(`[CONFIG] USER_AGENT   = ${navigator.userAgent}`);
        logMessage(`[CONFIG] PLATFORM     = ${navigator.platform}`);
        logMessage(`[CONFIG] LANGUAGE     = ${navigator.language}`);
        logMessage(`[CONFIG] WINDOW_SIZE  = ${window.innerWidth}x${window.innerHeight}`);
        
        logMessage('='.repeat(50) + '\n');
    } catch (error) {
        logMessage('[CONFIG ERROR] Failed to load environment config');
        logMessage(`[CONFIG ERROR] ${error.message}`);
        console.error('[CONFIG] Error:', error);
    }
}

// Add or update this function in auth.js
export function saveAuthState() {
    try {
        if (authState.isLoggedIn) {
            // Save the current auth state to localStorage
            localStorage.setItem('authState', JSON.stringify({
                isLoggedIn: true,
                username: authState.username,
                hashedPassword: authState.hashedPassword,
                loginTime: authState.loginTime,
                expiresAt: authState.expiresAt
            }));
            logMessage(`[AUTH] Saved auth state for ${authState.username}`);
        } else {
            // Clear auth state from localStorage when logged out
            localStorage.removeItem('authState');
            logMessage('[AUTH] Cleared auth state from localStorage');
        }
    } catch (error) {
        console.error('[AUTH] Error saving auth state:', error);
    }
}

// Add this function to handle logout confirmation
function confirmLogout() {
    return window.confirm('Are you sure you want to log out? Any unsaved changes will be lost.');
}

// Update the logout button event listener
export function setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirmLogout()) {
                await logout();
            }
        });
    }
}

// Update the refreshAuth function to handle 404 errors gracefully
export async function refreshAuth() {
    try {
        if (!authState.isLoggedIn || !authState.username || !authState.hashedPassword) {
            logMessage('[AUTH] Cannot refresh: Not logged in');
            return false;
        }
        
        // Check if token is still valid (with some margin)
        const now = Date.now();
        if (authState.expiresAt && authState.expiresAt > now + 60000) {
            // Token still valid for more than a minute, no need to refresh
            return true;
        }
        
        logMessage('[AUTH] Refreshing authentication token...');
        
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
                },
                body: JSON.stringify({
                    username: authState.username
                })
            });
            
            if (response.status === 404) {
                // If the refresh endpoint doesn't exist, assume the token is still valid
                logMessage('[AUTH] Refresh endpoint not found, assuming token is still valid');
                
                // Extend token expiration by 30 minutes
                const newExpiry = now + 30 * 60 * 1000;
                updateAuthState({
                    ...authState,
                    expiresAt: newExpiry
                });
                
                return true;
            }
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${await response.text()}`);
            }
            
            const data = await response.json();
            
            if (data.token) {
                updateAuthState({
                    ...authState,
                    token: data.token,
                    expiresAt: now + (data.expiresIn || 3600) * 1000
                });
                
                logMessage('[AUTH] Authentication refreshed successfully');
                return true;
            } else {
                throw new Error('No token in refresh response');
            }
        } catch (error) {
            // For network errors or missing endpoints, assume token is still valid
            if (error.message.includes('Failed to fetch') || 
                error.message.includes('404') || 
                error.message.includes('not found')) {
                
                logMessage('[AUTH WARN] Auth refresh failed, but continuing: ' + error.message);
                
                // Extend token expiration by 30 minutes
                const newExpiry = now + 30 * 60 * 1000;
                updateAuthState({
                    ...authState,
                    expiresAt: newExpiry
                });
                
                return true;
            }
            
            throw error;
        }
    } catch (error) {
        logMessage(`[AUTH ERROR] ${error}`);
        return false;
    }
}

// Add this function to auth.js
export function initAuth() {
    logMessage('[AUTH] Initializing authentication system');
    
    // Define doLogin.  This is fine.
    window.doLogin = (username, password) => {
        if (!username && !password) {
            username = document.getElementById('username')?.value || '';
            password = document.getElementById('password')?.value || '';
        }
        
        if (!username || !password) {
            logMessage('[AUTH ERROR] Username and password required');
            return false;
        }
        
        logMessage(`[AUTH] Login initiated for user: ${username}`);
        return handleLogin(username, password);
    };
    
    window.logoutUser = () => { // Keep logoutUser
        logMessage('[AUTH] Logout initiated');
        return logout();
    };
    
    // Attach handlers FIRST.
    attachLoginHandlers();
    
    // Restore login state (if any)
    restoreLoginState();
    
    // Your retry mechanism (keep this, it's a good safety net)
    setTimeout(() => {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn && !loginBtn._hasAuthHandler) {
            logMessage('[AUTH] Re-attaching login handlers as a precaution');
            attachLoginHandlers();
        }
    }, 1000);
}

