// globalFetch.js
import { authState } from './auth.js';
import { logMessage } from './log.js';

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

export async function globalFetch(url, options = {}) {
    try {
        // Check if we need to refresh auth
        if (authState?.isLoggedIn) {
            try {
                await refreshAuth();
            } catch (error) {
                logMessage(`[FETCH WARN] Auth refresh failed: ${error.message}`);
                // Continue anyway - the request might still work
            }
        }
        
        // Add authorization header if logged in
        if (authState?.isLoggedIn && authState?.username && authState?.hashedPassword) {
            options.headers = options.headers || {};
            options.headers['Authorization'] = `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`;
        }
        
        // Make the request
        const response = await fetch(url, options);
        
        // Handle 401 Unauthorized errors
        if (response.status === 401) {
            logMessage('[FETCH] Unauthorized request, attempting to refresh auth');
            
            // Try to refresh auth
            const refreshed = await refreshAuth();
            
            if (refreshed) {
                // Retry the request with fresh auth
                options.headers = options.headers || {};
                options.headers['Authorization'] = `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`;
                
                return fetch(url, options);
            } else {
                // If refresh failed, handle logout
                logMessage('[FETCH] Auth refresh failed, logging out');
                throw new Error('Authentication failed, please log in again');
            }
        }
        
        return response;
    } catch (error) {
        logMessage(`[FETCH ERROR] ${error.message}`);
        throw error;
    }
}
