import { logMessage } from './utils.js';
import { loadFiles } from './fileManager.js';
import { updateAuthDisplay } from './uiManager.js';
import { initializeFileManager } from './fileManager.js';
import { showSystemInfo } from './uiManager.js';

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

export async function attemptLogin(username, password) {
    logMessage(`[AUTH] Starting login process for user: ${username}`);
    logMessage('[AUTH] Requesting server authentication...');

    try {
        logMessage('[AUTH] Requesting salt from server...');
        const saltResponse = await fetch(`/api/auth/salt?username=${encodeURIComponent(username)}`);
        if (!saltResponse.ok) {
            logMessage('[AUTH] Failed to get salt from server');
            throw new Error('Failed to get salt');
        }
        
        const { salt } = await saltResponse.json();
        logMessage('[AUTH] Received salt from server');
        
        logMessage('[AUTH] Hashing password with salt...');
        const hashedPassword = await hashPassword(password, salt);

        logMessage('[AUTH] Sending login request...');
        const loginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, hashedPassword })
        });

        if (!loginResponse.ok) {
            logMessage(`[AUTH ERROR] Login failed: Invalid credentials`);
            throw new Error('Login failed');
        }

        logMessage('[AUTH] Login successful, updating auth state...');
        authState.isLoggedIn = true;
        authState.username = username;
        authState.hashedPassword = hashedPassword;
        authState.loginTime = Date.now();
        authState.expiresAt = authState.loginTime + EXPIRATION_TIME;

        localStorage.setItem('authState', JSON.stringify(authState));

        logMessage(`[AUTH] Login complete for: ${username}`);
        logMessage(`[AUTH] Session expires: ${new Date(authState.expiresAt).toLocaleString()}`);
        
        updateAuthDisplay();
        loadFiles();
    } catch (error) {
        logMessage(`[AUTH ERROR] Login failed: ${error.message}`);
        console.error('[AUTH ERROR] Details:', error);
        throw error;
    }
}

// Update restoreLogin to be more robust
export async function restoreLogin() {
    const storedAuth = localStorage.getItem('authState');
    if (!storedAuth) {
        updateAuthDisplay();
        return;
    }

    try {
        const parsedAuth = JSON.parse(storedAuth);
        const remainingTime = parsedAuth.expiresAt - Date.now();

        if (remainingTime > 0) {
            // Set auth state first
            Object.assign(authState, {
                isLoggedIn: true,
                username: parsedAuth.username,
                hashedPassword: parsedAuth.hashedPassword,  // Important for auth
                loginTime: parsedAuth.loginTime,
                expiresAt: parsedAuth.expiresAt
            });

            logMessage(`[AUTH] Restored login for ${authState.username}`);
            logMessage(`[AUTH] Session expires in ${Math.round(remainingTime / 1000 / 60)} minutes`);

            // Update UI first
            updateAuthDisplay();
            
            // Then initialize file manager
            await initializeFileManager().catch(error => {
                logMessage('[FILES ERROR] Failed to initialize file manager');
                console.error(error);
            });
        } else {
            logMessage(`[AUTH] Session expired. User must log in again.`);
            localStorage.removeItem('authState');
            updateAuthDisplay();
        }
    } catch (error) {
        logMessage('[AUTH ERROR] Failed to restore login state');
        console.error(error);
        localStorage.removeItem('authState');
        updateAuthDisplay();
    }
}

// At the top of the file, after imports
window.handleLogin = () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    logMessage(`[AUTH] Login button clicked for user: ${username}`);
    attemptLogin(username, password);
};

// Update attachLoginHandlers to use the same function
function attachLoginHandlers() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const passwordInput = document.getElementById('password');
    
    logMessage('[AUTH] Attaching login handlers');
    
    if (loginBtn) {
        logMessage('[AUTH] Found login button, attaching click handler');
        loginBtn.onclick = (e) => {
            e.preventDefault();
            window.handleLogin();
        };
    } else {
        logMessage('[AUTH ERROR] Login button not found');
    }

    if (passwordInput) {
        logMessage('[AUTH] Found password input, attaching keypress handler');
        passwordInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.handleLogin();
            }
        };
    } else {
        logMessage('[AUTH ERROR] Password input not found');
    }

    if (logoutBtn) {
        logMessage('[AUTH] Found logout button, attaching click handler');
        logoutBtn.onclick = logout;
    } else {
        logMessage('[AUTH ERROR] Logout button not found');
    }

    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
        logMessage('[AUTH] Found info button, attaching click handler');
        infoBtn.onclick = async () => {
            try {
                await showSystemInfo();
            } catch (error) {
                logMessage('[SYSTEM ERROR] Failed to show system info');
                console.error(error);
            }
        };
    }
}

// Update the initialization sequence
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // First get environment info
        await displayEnvironmentInfo();
        
        // Then restore auth state and initialize UI
        await restoreLogin();
        
        // Finally attach handlers
        attachLoginHandlers();
    } catch (error) {
        logMessage('[AUTH ERROR] Initialization failed');
        console.error(error);
    }
});

// ✅ Logout function
export function logout() {
    authState.isLoggedIn = false;
    authState.username = '';
    authState.password = '';
    authState.loginTime = null;
    authState.expiresAt = null;

    localStorage.removeItem('authState');
    logMessage("[AUTH] Logged out successfully.");
    
    updateAuthDisplay();
}

// Add this function to auth.js
async function displayEnvironmentInfo() {
    try {
        logMessage('[CONFIG] Fetching environment configuration...');
        const response = await fetch('/api/auth/config');
        const config = await response.json();

        // Log configuration with consistent formatting
        logMessage('\n' + '='.repeat(50));
        logMessage('[CONFIG] ENVIRONMENT CONFIGURATION');
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
