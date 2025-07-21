// client/services/fetcher.js - DI-ready fetcher service

/**
 * Factory function to create an enhanced fetch instance with a logger.
 * @param {object} log - A logger instance from the logging service.
 * @returns {Function} An async fetch function.
 */
export function createGlobalFetch(log) {
    /**
     * Enhanced fetch function that includes credentials and logging.
     * @param {string} url - The URL to fetch
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    return async function globalFetch(url, options = {}) {
        const method = options.method || 'GET';
        const context = { url, method };

        log.debug('FETCH', 'REQUEST_START', `Request to: ${url}`, context);

        try {
            // All authenticated fetches should include credentials
            const response = await fetch(url, { ...options, credentials: 'include' });

            const responseContext = { ...context, status: response.status };
            log.debug('FETCH', 'RESPONSE_SUCCESS', `Response from ${url}: ${response.status} ${response.statusText}`, responseContext);
            
            return response;
        } catch (error) {
            const errorContext = { ...context, error: error.message };
            log.error('FETCH', 'REQUEST_FAILED', `Request to ${url} failed: ${error.message}`, errorContext);
            
            throw error; // Re-throw the error so the caller can handle it
        }
    }
} 