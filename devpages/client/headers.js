/**
 * headers.js
 * Provides consistent auth headers across the application
 */

import { appStore } from '/client/appState.js';

/**
 * Get the current authentication headers
 * @returns {Object} Headers object with Authorization header
 */
export function getAuthHeaders() {
    try {
        // Get auth state from appStore
        const authState = appStore.getState().auth;
        if (!authState || !authState.isAuthenticated || !authState.user) {
            console.warn('No authenticated user found in appStore');
            return {};
        }
        
        // For now, return empty headers since the new auth system uses session cookies
        // The server will handle authentication via session cookies
        return {};
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