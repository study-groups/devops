// API configuration and utilities
const log = window.APP.services.log.createLogger('API');

// API endpoints configuration  
const endpoints = {
    // Auth endpoints
    login: () => '/api/auth/login',
    logout: () => '/api/auth/logout', 
    userStatus: () => '/api/auth/user',
    
    // File endpoints
    fileContent: (pathname) => `/api/files/content?pathname=${pathname}`,
    directoryList: (pathname) => `/api/files/list?pathname=${pathname}`,
    saveFile: () => '/api/files/save',
    deleteFile: (pathname) => `/api/files/delete?pathname=${pathname}`,
    
    // Config endpoints
    getConfig: (directory) => `/api/config?directory=${encodeURIComponent(directory)}`
};

// Global fetch wrapper (will be set to window.fetch initially)
const globalFetch = window.APP.services.globalFetch;

// Token storage
let apiToken = null;

/**
 * Set API token for authenticated requests
 * @param {string} token - The API token
 */
function setApiToken(token) {
    apiToken = token;
    log.debug('API_TOKEN', 'SET', `API token set: ${token ? token.substring(0, 8) + '...' : 'null'}`);
}

/**
 * Get current API token
 * @returns {string|null} Current API token
 */
function getApiToken() {
    return apiToken;
}

/**
 * Enhanced fetch wrapper that adds authentication headers
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function authenticatedFetch(url, options = {}) {
    const headers = { ...options.headers };
    
    // Add Bearer token if available
    if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
    }
    
    return globalFetch(url, {
        ...options,
        headers,
        credentials: 'include' // ALWAYS include session cookies for authentication
    });
}

// Main API object
const api = {
    // Internal method to update fetch behavior is no longer needed
    // setFetch(fetchFn) {
    //     globalFetch = fetchFn;
    // },



    /**
     * Fetch file content
     * @param {string} relativePath - Path relative to MD_DIR
     * @returns {Promise<string>} File content
     */
    async fetchFileContent(relativePath) {
        let url = endpoints.fileContent(relativePath);
        
        log.debug('API_REQUEST', 'FETCH_FILE_CONTENT', `Fetching file content: ${url}`);
        
        try {
            log.debug('API_REQUEST', 'AUTHENTICATED_FETCH', `Making authenticated fetch request to: ${url}`);
            const response = await authenticatedFetch(url);
            
            log.debug('API_RESPONSE', 'STATUS', `Response received - Status: ${response.status}, OK: ${response.ok}`);
            
            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                
                // Try to get more detailed error information
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        errorMessage += ` - ${errorText}`;
                    }
                } catch (textError) {
                    log.debug('API_ERROR', 'READ_RESPONSE_TEXT_FAILED', `Could not read error response text: ${textError.message}`);
                }
                
                log.error('API_ERROR', 'FETCH_FILE_CONTENT_HTTP_ERROR', `HTTP error fetching file content: ${errorMessage}`);
                throw new Error(errorMessage);
            }
            
            const content = await response.text();
            log.debug('API_RESPONSE', 'FILE_CONTENT_RECEIVED', `File content received for "${relativePath}": ${content.length} chars`);
            
            // Additional validation
            if (content === null || content === undefined) {
                throw new Error('Server returned null or undefined content');
            }
            
            return content;
        } catch (error) {
            // Enhanced error logging
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                log.error('API_ERROR', 'FETCH_FILE_CONTENT_NETWORK_ERROR', `Network error fetching file content for "${relativePath}": ${error.message}`, error);
                throw new Error(`Network error: Unable to connect to server. Please check your internet connection.`);
            } else if (error.message.includes('credentials')) {
                log.error('API_ERROR', 'FETCH_FILE_CONTENT_AUTH_ERROR', `Authentication error fetching file content for "${relativePath}": ${error.message}`, error);
                throw new Error(`Authentication error: Please log in again.`);
            } else {
                log.error('API_ERROR', 'FETCH_FILE_CONTENT_ERROR', `Error fetching file content for "${relativePath}": ${error.message}`, error);
                throw error;
            }
        }
    },

    /**
     * Fetch directory listing
     * @param {string} pathname - Directory path relative to MD_DIR
     * @returns {Promise<object>} Directory listing {dirs: [], files: [], pathname: ''}
     */
    async fetchDirectoryListing(pathname) {
        if (pathname && /\.[^/]+$/.test(pathname)) {
            const errorMsg = `Cannot list directory contents of a file: ${pathname}`;
             log.error('API_ERROR', 'FETCH_DIR_LISTING_INVALID_PATH', errorMsg);
             throw new Error(errorMsg);
        }
        
        let url = endpoints.directoryList(pathname);
        
        log.debug('API_REQUEST', 'FETCH_DIR_LISTING', `Fetching directory listing: ${url}`);
        
        try {
            const response = await authenticatedFetch(url);
            if (!response.ok) {
                let errorText = `HTTP error! status: ${response.status}`;
                try {
                    const body = await response.text();
                    if (body && !body.trim().toLowerCase().startsWith('<!doctype html>')) {
                        errorText += ` - ${body}`;
                    }
                } catch (e) {
                    // Ignore if we cannot read the error body
                }
                throw new Error(errorText);
            }
            const data = await response.json();
            log.debug('API_RESPONSE', 'DIR_LISTING_RECEIVED', `Directory listing received for "${pathname}": ${data.dirs?.length || 0} dirs, ${data.files?.length || 0} files`);
            return data;
        } catch (error) {
            log.error('API_ERROR', 'FETCH_DIR_LISTING_ERROR', `Error fetching directory listing for "${pathname}": ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Save file content
     * @param {string} relativePath - Path relative to MD_DIR
     * @param {string} content - File content to save
     * @returns {Promise<object>} Save result
     */
    async saveFile(relativePath, content) {
        log.info('API_REQUEST', 'SAVE_FILE', `Saving file: ${relativePath}`);
        
        const payload = { pathname: relativePath, content };
        
        try {
            const response = await authenticatedFetch(endpoints.saveFile(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            log.info('API_RESPONSE', 'SAVE_FILE_SUCCESS', `File saved successfully: ${relativePath}`);
            return result;
        } catch (error) {
            log.error('API_ERROR', 'SAVE_FILE_ERROR', `Error saving file "${relativePath}": ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Get directory configuration
     * @param {string} directory - Directory path
     * @returns {Promise<object>} Configuration object
     */
    async getDirectoryConfig(directory) {
        const url = endpoints.getConfig(directory);
        log.debug('API_REQUEST', 'GET_DIR_CONFIG', `Fetching config for dir: '${directory}'`);
        try {
            const options = { method: 'GET' };
            const response = await globalFetch(url, options);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            log.error('API_ERROR', 'GET_DIR_CONFIG_ERROR', `Error fetching directory config: ${error.message}`, error);
            throw error;
        }
    },



    /**
     * Fetch public CSS content via the unprotected route.
     * @param {string} relativePath - Path relative to PD_DIR/data ('themes/classic/core.css', 'themes/classic/light.css', etc.).
     * @returns {Promise<{content: string}|null>} CSS content object or null on error/not found.
     */
    async fetchPublicCss(relativePath) {
        log.debug('API_REQUEST', 'FETCH_PUBLIC_CSS', `Fetching public CSS for path: "${relativePath}"`);
        // Construct URL for the new public endpoint
        const url = `/public/css?path=${encodeURIComponent(relativePath)}`;
        try {
            // No auth needed, but still use globalFetch if it adds other headers/handling
            // NO credentials: 'include' needed here for public route
            const response = await globalFetch(url, { method: 'GET' });

            log.debug('API_RESPONSE', 'PUBLIC_CSS_STATUS', `Response from ${url}: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                // Handle 404 specifically maybe?
                if (response.status === 404) {
                    log.debug('API_RESPONSE', 'PUBLIC_CSS_NOT_FOUND', `Public CSS not found at ${url}`);
                    return null; // Return null for not found
                }
                 // Throw error for other non-OK statuses
                 let errorText = `Server error fetching public CSS: ${response.status} ${response.statusText}`;
                 try {
                     const bodyText = await response.text(); // Attempt to get error body
                     if (bodyText && !bodyText.startsWith('/*')) { // Avoid logging CSS comments as errors
                          errorText += ` - ${bodyText}`;
                     }
                 } catch (e) { /* Ignore error reading body */ }
                log.error('API_ERROR', 'FETCH_PUBLIC_CSS_HTTP_ERROR', errorText);
                throw new Error(errorText);
            }
            const content = await response.text();
            log.debug('API_RESPONSE', 'PUBLIC_CSS_RECEIVED', `Public CSS content fetched successfully (length: ${content.length}) for path "${relativePath}"`);
            if (content && content.length > 0) {
                log.debug('API_RESPONSE', 'PUBLIC_CSS_SUCCESS', `Public CSS content fetched successfully, returning object with content property`);
                return { content: content };
            } else {
                log.warn('API_RESPONSE', 'PUBLIC_CSS_EMPTY', `Empty content received for CSS, returning null`);
                return null;
            }
        } catch (error) {
            log.error('API_ERROR', 'FETCH_PUBLIC_CSS_ERROR', `Error in fetchPublicCss for ${relativePath}: ${error.message}`, error);
            // Don't re-throw, return null to indicate failure gracefully
            return null;
            // throw error; // Or re-throw if callers expect exceptions
        }
    },

    // --- Auth --- 
    /**
     * Sends login credentials to the server.
     * @param {string} username
     * @param {string} password
     * @returns {Promise<object>} User data {username, role}
     */
    async login(username, password) {
        log.info('AUTH', 'LOGIN_ATTEMPT', `Attempting login for user: ${username}`);
        try {
            const response = await globalFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include' // Include session cookies for authentication
            });
            
            log.debug('AUTH', 'LOGIN_RESPONSE_STATUS', `Login response status: ${response.status}`);

            let data;
            try {
                data = await response.json();
                log.debug('AUTH', 'LOGIN_RESPONSE_DATA', `Login response data: ${JSON.stringify(data)}`);
            } catch (e) {
                log.error('AUTH', 'LOGIN_JSON_PARSE_ERROR', `Failed to parse JSON response (Status: ${response.status})`, e);
                 throw new Error(`Login failed: Server returned non-JSON response (Status: ${response.status})`);
            }

            if (!response.ok) {
                log.warn('AUTH', 'LOGIN_RESPONSE_NOT_OK', `Login response not OK (${response.status}). Throwing error.`);
                throw new Error(data?.error || `Login failed: ${response.status}`);
            }

            // Validate response structure
            if (!data || !data.username || !data.role) {
                log.error('AUTH', 'LOGIN_INVALID_RESPONSE', 'Login success but server response missing username or role!');
                throw new Error('Login response from server is incomplete.');
            }

            log.info('AUTH', 'LOGIN_SUCCESS', `Login successful. User data: ${JSON.stringify(data)}`);
            return data;
        } catch (error) {
            log.error('AUTH', 'LOGIN_FAILED', `Login failed: ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Generate an API token for the current user
     * @param {number} expiryHours - Token expiry in hours (default: 24)
     * @param {string} description - Token description
     * @returns {Promise<object>} Token data
     */
    async generateToken(expiryHours = 24, description = 'API Access Token') {
        log.info('AUTH', 'GENERATE_TOKEN', `Generating API token with ${expiryHours}h expiry`);
        try {
            const response = await authenticatedFetch('/api/auth/token/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expiryHours, description })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Token generation failed: ${response.status}`);
            }

            const data = await response.json();
            log.info('AUTH', 'GENERATE_TOKEN_SUCCESS', `Token generated successfully: ${data.token.substring(0, 8)}...`);
            
            // Automatically set the token for future requests
            setApiToken(data.token);
            
            return data;
        } catch (error) {
            log.error('AUTH', 'GENERATE_TOKEN_FAILED', `Token generation failed: ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Get all active tokens for the current user
     * @returns {Promise<object>} Token list
     */
    async getTokens() {
        log.debug('AUTH', 'GET_TOKENS', 'Fetching user tokens');
        try {
            const response = await authenticatedFetch('/api/auth/tokens');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch tokens: ${response.status}`);
            }

            const data = await response.json();
            log.debug('AUTH', 'GET_TOKENS_SUCCESS', `Retrieved ${data.count} tokens`);
            return data;
        } catch (error) {
            log.error('AUTH', 'GET_TOKENS_FAILED', `Failed to fetch tokens: ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Revoke an API token
     * @param {string} token - The token to revoke
     * @returns {Promise<object>} Revocation result
     */
    async revokeToken(token) {
        log.info('AUTH', 'REVOKE_TOKEN', `Revoking token: ${token.substring(0, 8)}...`);
        try {
            const response = await authenticatedFetch('/api/auth/token/revoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Token revocation failed: ${response.status}`);
            }

            const data = await response.json();
            log.info('AUTH', 'REVOKE_TOKEN_SUCCESS', 'Token revoked successfully');
            
            // Clear the token if it's the current one
            if (apiToken === token) {
                setApiToken(null);
            }
            
            return data;
        } catch (error) {
            log.error('AUTH', 'REVOKE_TOKEN_FAILED', `Token revocation failed: ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Set API token for authenticated requests
     * @param {string} token - The API token
     */
    setToken: setApiToken,

    /**
     * Get current API token
     * @returns {string|null} Current API token
     */
    getToken: getApiToken,
   
    /**
     * Sends logout request to the server.
     * @returns {Promise<Response>} Raw response object
     */
    async logout() {
        log.debug('AUTH', 'LOGOUT', 'Logout called');
        const url = endpoints.logout();
        const options = { method: 'POST' };
        return await globalFetch(url, options);
    },
   
    /**
     * Fetches the current user's status from the server.
     * @returns {Promise<Response>} Raw response object
     */
    async getUserStatus() {
        log.debug('AUTH', 'GET_USER_STATUS', 'getUserStatus called');
        console.log('[API DEBUG] getUserStatus: cookies before request:', document.cookie);
        const url = endpoints.userStatus();
        const options = { 
            method: 'GET',
            credentials: 'include' // Include cookies for session
        };
        console.log('[API DEBUG] getUserStatus: making request to', url, 'with options:', options);
        const result = await globalFetch(url, options);
        console.log('[API DEBUG] getUserStatus: response received:', result.status, result.ok);
        return result;
    },
   
    // --- Files --- 
    /**
     * Deletes a file on the server using a single relative path.
     * @param {string} relativePath - Path relative to MD_DIR root.
     * @returns {Promise<object>} Server response
     */
    async deleteFile(relativePath) {
        if (typeof relativePath !== 'string' || relativePath === '') {
            const errorMsg = `Invalid relativePath provided to deleteFile: ${relativePath}`;
            log.error('API_ERROR', 'DELETE_FILE_INVALID_PATH', errorMsg);
            throw new Error(errorMsg);
        }
        log.debug('API_REQUEST', 'DELETE_FILE', `deleteFile called for: ${relativePath}`);

        const url = `/api/files/delete?pathname=${relativePath}`;

        const options = {
            method: 'DELETE'
        };
        try {
            const response = await globalFetch(url, options);
            if (!response.ok) {
                const errorText = await response.text();
                log.error('API_ERROR', 'DELETE_FILE_HTTP_ERROR', `Error deleting file '${relativePath}': ${response.status} ${response.statusText} - ${errorText}`);
                try {
                    const errData = JSON.parse(errorText);
                     throw new Error(errData.error || `Failed to delete file: ${response.status}`);
                } catch(e) {
                     throw new Error(`Failed to delete file: ${response.status}`);
                }
            }
            log.info('API_RESPONSE', 'DELETE_FILE_SUCCESS', `Successfully deleted '${relativePath}'`);
            return await response.json();
        } catch (error) {
            log.error('API_ERROR', 'DELETE_FILE_ERROR', `Error deleting file: ${error.message}`, error);
            throw error;
        }
    },

    // Add stubs/implementations for other endpoints (images etc.) if needed
};

// Export both named and default exports for compatibility
export { api };
export default api;

log.info('API_MODULE', 'LOADED', 'Client API module loaded.'); 