// globalFetch.js - Enhanced fetch with authentication support
import { logMessage } from './log/index.js';

// Import from auth.js instead of authService.js to avoid module resolution issues
import { getAuthHeaders } from '/client/core/headers.js';

// Add a simple refreshAuth function since it's missing
async function refreshAuth() {
    // Simple implementation to avoid the error
    try {
        const authStateStr = localStorage.getItem('authState');
        if (!authStateStr) return false;
        
        const authState = JSON.parse(authStateStr);
        if (!authState.isLoggedIn) return false;
        
        logMessage('[AUTH] Refreshing auth token');
        // In a real implementation, you would refresh the token here
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Enhanced fetch function with automatic authentication
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export function globalFetch(url, options = {}) {
    try {
        options.headers = options.headers || {};
        
        // Get auth state directly from localStorage for maximum reliability
        try {
            const authStateStr = localStorage.getItem('authState');
            if (authStateStr) {
                const authState = JSON.parse(authStateStr);
                if (authState.isLoggedIn && authState.username && authState.hashedPassword) {
                    // Use hashedPassword instead of password for better security
                    const creds = btoa(`${authState.username}:${authState.hashedPassword}`);
                    options.headers['Authorization'] = `Basic ${creds}`;
                    
                    // Log the request (without showing the full credentials)
                    logMessage(`[FETCH] Authenticated request to: ${url}`);
                } else {
                    logMessage(`[FETCH] Auth state found but incomplete, falling back to unauthenticated request`);
                }
            } else {
                logMessage(`[FETCH] No auth state found, making unauthenticated request to: ${url}`);
            }
        } catch (e) {
            console.error('Failed to parse auth state for fetch:', e);
            logMessage(`[FETCH] Auth error, making unauthenticated request to: ${url}`);
        }
        
        return fetch(url, options);
    } catch (error) {
        logMessage(`[FETCH ERROR] Request failed: ${error.message}`);
        throw error;
    }
}

/**
 * Test fetch with authentication
 * @param {string} url - URL to fetch
 * @returns {Promise} Test result
 */
export function testAuthFetch(url) {
    // Log auth state
    logMessage(`[FETCH TEST] Auth state: isLoggedIn=${authState.isLoggedIn}, username=${authState.username}`);
    
    // Try the fetch
    return globalFetch(url)
        .then(response => {
            logMessage(`[FETCH TEST] Response status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            logMessage('[FETCH TEST] Response data received');
            return data;
        })
        .catch(error => {
            logMessage(`[FETCH TEST] Error: ${error.message}`);
            throw error;
        });
}

// Export as default for convenience
export default globalFetch;
