// globalFetch.js - Enhanced fetch 
import { logMessage } from './log/index.js';

// REMOVED import for getAuthHeaders
// import { getAuthHeaders } from '/client/auth.js'; 


/**
 * Enhanced fetch function
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export function globalFetch(url, options = {}) {
    try {
        // Log the request
        // NOTE: We are now relying on the browser to automatically send
        // the session cookie set by the server after login.
        // No Authorization header is manually added here.
        logMessage(`[FETCH] Request to: ${url}`);
        
        // Perform the fetch call
        // Ensure credentials option is set if needed for cross-origin cookies
        // options.credentials = options.credentials || 'include'; 
        return fetch(url, options);
    } catch (error) {
        logMessage(`[FETCH ERROR] Request failed: ${error.message}`);
        throw error;
    }
}

// Export as default for convenience
export default globalFetch;
