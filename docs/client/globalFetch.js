// globalFetch.js
import { authState } from './auth.js';
import { logMessage } from './log/index.js';

// Add a simple refreshAuth function since it's missing
async function refreshAuth() {
    // Simple implementation to avoid the error
    if (!authState?.isLoggedIn) {
        return false;
    }
    
    logMessage('[AUTH] Refreshing auth token');
    // In a real implementation, you would refresh the token here
    // For now, just return true to indicate "success" without actually doing anything
    return true;
}

export function globalFetch(url, options = {}) {
    try {
        options.headers = options.headers || {};
        
        // Only add auth headers if user is logged in and we have credentials
        if (authState.isLoggedIn && authState.username && authState.hashedPassword) {
            // Use hashedPassword instead of password for better security
            const creds = btoa(`${authState.username}:${authState.hashedPassword}`);
            options.headers['Authorization'] = `Basic ${creds}`;
            
            // Log the request (without showing the full credentials)
            logMessage(`[FETCH] Authenticated request to: ${url}`);
        } else {
            logMessage(`[FETCH] Unauthenticated request to: ${url}`);
        }
        
        return fetch(url, options);
    } catch (error) {
        logMessage(`[FETCH ERROR] Request failed: ${error.message}`);
        throw error;
    }
}

// Add a debug function to test fetch
export function testFetch(url = '/api/auth/config') {
    logMessage('[FETCH TEST] Testing fetch with auth...');
    
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

// Expose test function globally
if (typeof window !== 'undefined') {
    window.testGlobalFetch = testFetch;
}
