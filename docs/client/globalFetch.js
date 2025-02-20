// globalFetch.js
import { authState } from './auth.js';
import { logMessage } from './utils.js';

export async function globalFetch(url, options = {}) {
    // Add a small delay to ensure auth state is ready
    await new Promise(resolve => setTimeout(resolve, 0));

    if (url.startsWith('/api/') && url !== '/api/auth/config' && !authState.isLoggedIn) {
        logMessage('[FETCH] Unauthorized request attempted: ' + url);
        throw new Error('User is not authenticated. Login required.');
    }

    // Add username to all authenticated requests
    if (authState.isLoggedIn) {
        options.headers = {
            ...options.headers,
            'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`,
            'Content-Type': 'application/json'
        };
    }

    try {
        logMessage(`[FETCH] Requesting: ${url}`);
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            logMessage(`[FETCH ERROR] ${response.status}: ${error.error || 'Unknown error'}`);
            throw new Error(error.error || `HTTP Error: ${response.status}`);
        }

        return response;
    } catch (error) {
        logMessage(`[FETCH ERROR] Failed: ${error.message}`);
        throw error;
    }
}
