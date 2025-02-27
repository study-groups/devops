import { authState } from './auth.js';
import { logMessage } from './log.js';
import { updateAuthDisplay } from './uiManager.js';
import { initializeFileManager } from './fileManager.js';
import { clearFileSystemState } from './fileSystemState.js';

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
            return false;
        }
        
        // Log the stored auth data for debugging (be careful with sensitive data)
        const parsedAuth = JSON.parse(storedAuth);
        logMessage(`[AUTH] Parsed auth data: username=${parsedAuth.username}, isLoggedIn=${parsedAuth.isLoggedIn}`);
        
        const remainingTime = parsedAuth.expiresAt - Date.now();
        logMessage(`[AUTH] Session remaining time: ${Math.round(remainingTime/60000)} minutes`);
        
        if (remainingTime <= 0) {
            logMessage('[AUTH] Stored session has expired');
            localStorage.removeItem('authState');
            // Only update display if DOM is ready
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                updateAuthDisplay();
            }
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
        await initializeFileManager();
        
        document.dispatchEvent(new CustomEvent('auth:login', {
            detail: {
                username: parsedAuth.username,
                isLoggedIn: true,
                expiresAt: parsedAuth.expiresAt
            }
        }));
        
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
    // First restore login state
    restoreLoginState().then(() => {
        // Then initialize UI *after* auth is restored
        import('./uiManager.js').then(({ initializeTopNav }) => {
            initializeTopNav();
        });
    });
});

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