import { authState } from './auth.js';
import { logMessage } from './log/index.js';
import { updateAuthDisplay } from './uiManager.js';
import { initializeFileManager } from './fileManager.js';
import { clearFileSystemState } from './fileSystemState.js';
import { initializeTopNav } from './uiManager.js';
import { initAuth } from './auth.js';

// This function will be called on page load to restore login state
export async function restoreLoginState() {
    try {
        logMessage('[AUTH] Attempting to restore login state');
        const storedAuth = localStorage.getItem('authState');
        
        logMessage(`[AUTH] Found stored auth: ${!!storedAuth}`);
        
        if (!storedAuth) {
            logMessage('[AUTH] No stored auth state found');
            // Only update display if DOM is ready
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                updateAuthDisplay();
            }
            logMessage('[AUTH] Login state restored: logged out');
            return false;
        }
        
        // Parse the stored auth data
        let parsedAuth;
        try {
            parsedAuth = JSON.parse(storedAuth);
            logMessage(`[AUTH] Parsed auth data: username=${parsedAuth.username}, isLoggedIn=${parsedAuth.isLoggedIn}`);
        } catch (e) {
            logMessage('[AUTH ERROR] Failed to parse stored auth data');
            localStorage.removeItem('authState');
            updateAuthDisplay();
            return false;
        }
        
        // Check if the session has expired
        const remainingTime = parsedAuth.expiresAt - Date.now();
        logMessage(`[AUTH] Session remaining time: ${Math.round(remainingTime/60000)} minutes`);
        
        if (remainingTime <= 0) {
            logMessage('[AUTH] Stored session has expired');
            localStorage.removeItem('authState');
            updateAuthDisplay();
            return false;
        }
        
        // Valid session exists, restore it
        logMessage(`[AUTH] Restoring session for ${parsedAuth.username}, expires in ${Math.round(remainingTime/60000)} minutes`);
        
        // Update auth state
        Object.assign(authState, {
            isLoggedIn: true,
            username: parsedAuth.username,
            hashedPassword: parsedAuth.hashedPassword,
            loginTime: parsedAuth.loginTime,
            expiresAt: parsedAuth.expiresAt
        });
        
        // Update UI only if DOM is ready
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            updateAuthDisplay();
        }
        
        // Initialize file manager and dispatch login event *after* successful restore
        try {
            await initializeFileManager();
            logMessage('[AUTH] File manager initialized after login restore');
        } catch (e) {
            logMessage(`[AUTH ERROR] Failed to initialize file manager: ${e.message}`);
        }
        
        document.dispatchEvent(new CustomEvent('auth:login', {
            detail: {
                username: parsedAuth.username,
                isLoggedIn: true,
                expiresAt: parsedAuth.expiresAt
            }
        }));
        
        logMessage('[AUTH] Login state restored: logged in');
        return true;
    } catch (error) {
        logMessage(`[AUTH ERROR] Failed to restore login state: ${error.message}`);
        localStorage.removeItem('authState');
        // Only update display if DOM is ready
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            updateAuthDisplay();
        }
        return false;
    }
}

// Call this function on page load
document.addEventListener('DOMContentLoaded', () => {
    logMessage('[AUTH] Restoring login state on DOMContentLoaded');
    
    // First restore login state, then initialize UI
    restoreLoginState().then((isLoggedIn) => {
        logMessage(`[AUTH] Login state restored, initializing top nav. isLoggedIn=${isLoggedIn}`);
        
        // Initialize auth system
        initAuth();
        
        // Initialize top navigation
        initializeTopNav();
    });
});

// Debug function to verify module is loaded
export function authManagerLoaded() {
    console.log("authManager.js loaded successfully");
    logMessage('[AUTH] authManager.js loaded successfully');
}

// Expose for debugging
window.authManagerLoaded = authManagerLoaded;
window.restoreLoginState = restoreLoginState;

// Add this to the logout function
export function logout() {
    // Clear auth state
    Object.assign(authState, {
        isLoggedIn: false,
        username: '',
        hashedPassword: '',
        loginTime: 0,
        expiresAt: 0
    });
    
    // Clear localStorage
    localStorage.removeItem('authState');
    
    // Clear file system state
    clearFileSystemState();
    
    // Update UI
    updateAuthDisplay();
    
    // Dispatch logout event
    document.dispatchEvent(new CustomEvent('auth:logout'));
    
    logMessage('[AUTH] User logged out');
} 