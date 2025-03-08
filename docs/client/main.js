/**
 * Main application entry point
 */

import { logMessage } from './log/index.js';
import { initAuth } from './auth.js';
import { initializeFileManager } from './fileManager/init.js';
import { initializeUI } from './uiManager.js';

// Initialize auth IMMEDIATELY.  This is the key change.
initAuth();

// Initialize the application
async function initializeApp() {
    logMessage('[APP] Initializing application...');
    
    // Initialize UI components
    await initializeUI();
    
    // Initialize file manager
    await initializeFileManager();
    
    logMessage('[APP] Application initialization complete');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Make sure auth is initialized again when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Ensure auth is initialized
    initAuth();
});

// Make sure handleLogin is available globally
window.addEventListener('load', () => {
    if (!window.handleLogin) {
        logMessage('[APP] Ensuring handleLogin is available globally');
        // Backup implementation in case initAuth hasn't run yet
        window.handleLogin = () => {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            logMessage(`[AUTH] Login button clicked for user: ${username}`);
            import('./auth.js').then(module => {
                module.handleLogin(username, password);
            });
        };
    }
}); 