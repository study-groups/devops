// globalFetch.js - Wrapper for fetch with potential auth/logging
// REMOVED logMessage import - use window.logMessage instead

// REMOVED import for getAuthHeaders
// import { getAuthHeaders } from '/client/auth.js'; 


/**
 * Enhanced fetch function
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function globalFetch(url, options = {}) {
    // Check if window.logMessage is available before logging
    if (typeof window.logMessage === 'function') {
        window.logMessage(`[FETCH] Request to: ${url}`);
    } else {
        console.log(`[FETCH] Request to: ${url} (window.logMessage not available)`);
    }
    
    // Check auth status (optional - depends on where auth state lives)
    // For simplicity, let's assume fetch doesn't need explicit auth headers anymore
    // if relying on session cookies set by the server.
    
    // const { addAuthHeadersIfNeeded } = await import('./auth.js');
    // options = await addAuthHeadersIfNeeded(options);
    
    try {
        const response = await fetch(url, options);
        
        // Check if window.logMessage is available before logging
        if (typeof window.logMessage === 'function') {
            window.logMessage(`[FETCH] Response from ${url}: ${response.status} ${response.statusText}`);
        } else {
            console.log(`[FETCH] Response from ${url}: ${response.status} ${response.statusText}`);
        }
        
        return response;
    } catch (error) {
        // Check if window.logMessage is available before logging
        if (typeof window.logMessage === 'function') {
            window.logMessage(`[FETCH ERROR] Request to ${url} failed: ${error.message}`, 'error');
        } else {
            console.error(`[FETCH ERROR] Request to ${url} failed: ${error.message}`);
        }
        throw error; // Re-throw the error so the caller can handle it
    }
}

// Export as default for convenience
export default globalFetch;
