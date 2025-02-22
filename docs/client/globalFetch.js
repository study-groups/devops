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
            'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
        };

        // Only set Content-Type if not multipart form data
        if (!options.body || !(options.body instanceof FormData)) {
            options.headers['Content-Type'] = 'application/json';
        }
    }

    try {
        logMessage(`[FETCH] Requesting: ${url}`);
        
        // Add timeout to the fetch request
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeout);

            if (!response.ok) {
                let errorMessage = 'Unknown error';
                try {
                    const error = await response.json();
                    errorMessage = error.error || `HTTP Error: ${response.status}`;
                } catch {
                    errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
                }
                logMessage(`[FETCH ERROR] ${response.status}: ${errorMessage}`);
                throw new Error(errorMessage);
            }

            return response;
        } catch (error) {
            clearTimeout(timeout);
            if (error.name === 'AbortError') {
                logMessage('[FETCH ERROR] Request timed out');
                throw new Error('Request timed out. Please try again.');
            }
            throw error;
        }
    } catch (error) {
        logMessage(`[FETCH ERROR] Failed: ${error.message}`);
        throw error;
    }
}
