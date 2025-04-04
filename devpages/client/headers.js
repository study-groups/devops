/**
 * headers.js
 * Provides consistent auth headers across the application
 */

/**
 * Get the current authentication headers
 * @returns {Object} Headers object with Authorization header
 */
export function getAuthHeaders() {
    try {
        // Get auth state from localStorage
        const authStateStr = localStorage.getItem('authState');
        if (!authStateStr) {
            console.warn('No auth state found in localStorage');
            return {};
        }
        
        const authState = JSON.parse(authStateStr);
        if (!authState || !authState.username || !authState.hashedPassword) {
            console.warn('Invalid auth state in localStorage');
            return {};
        }
        
        // Create Basic auth header (username:password encoded in base64)
        const basicAuth = btoa(`${authState.username}:${authState.hashedPassword}`);
        
        return {
            'Authorization': `Basic ${basicAuth}`
        };
    } catch (error) {
        console.error('Error creating auth headers:', error);
        return {};
    }
}

/**
 * Applies auth headers to existing headers object
 * @param {Object} headers - Existing headers object
 * @returns {Object} Headers with auth headers added
 */
export function withAuthHeaders(headers = {}) {
    return {
        ...headers,
        ...getAuthHeaders()
    };
} 