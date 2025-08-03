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
        const { silent = false, ...fetchOptions } = options;
        const method = fetchOptions.method || 'GET';
        const context = { url, method };

        if (!silent) {
            log.info('FETCH', 'REQUEST_START', `Request to: ${url}`, context);
        }

        try {
            const response = await fetch(url, { ...fetchOptions, credentials: 'include' });
            const responseContext = { ...context, status: response.status };

            // Log non-ok responses as warnings, but not 401s on the user endpoint
            if (!response.ok) {
                if (response.status === 401 && url.includes('/api/auth/user')) {
                    if (!silent) {
                        log.debug('FETCH', 'AUTH_CHECK_UNAUTHENTICATED', `Unauthenticated session check on ${url}`, responseContext);
                    }
                } else {
                    log.warn('FETCH', 'RESPONSE_NOT_OK', `Non-OK response from ${url}: ${response.status}`, responseContext);
                }
            } else if (!silent) {
                log.info('FETCH', 'RESPONSE_SUCCESS', `Success response from ${url}: ${response.status}`, responseContext);
            }
            
            return response;
        } catch (error) {
            const errorContext = { ...context, error: error.message };
            log.error('FETCH', 'REQUEST_FAILED', `Request to ${url} failed: ${error.message}`, errorContext);
            
            throw error;
        }
    }
} 