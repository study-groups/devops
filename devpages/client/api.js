// API configuration and utilities
import { logMessage, logError } from '/client/log/index.js';

// Logging function using the proper logging system
function logApi(message, level = 'info') {
    logMessage(message, level, 'API');
}

// Error logging function using the proper logging system
function errorLogger(message, error) {
    logError(`${message}: ${error?.message || error}`, 'API', null, error);
}

// API endpoints configuration  
const endpoints = {
    // Auth endpoints
    login: () => '/api/auth/login',
    logout: () => '/api/auth/logout', 
    userStatus: () => '/api/auth/user',
    
    // File endpoints
    fileContent: (pathname) => `/api/files/content?pathname=${encodeURIComponent(pathname)}`,
    directoryList: (pathname) => `/api/files/list?pathname=${encodeURIComponent(pathname)}`,
    saveFile: () => '/api/files/save',
    deleteFile: (pathname) => `/api/files/delete?pathname=${encodeURIComponent(pathname)}`,
    
    // Config endpoints
    getConfig: (directory) => `/api/config?directory=${encodeURIComponent(directory)}`,
    manageLink: () => '/api/community/manage-link'
};

// Global fetch wrapper (will be set to window.fetch initially)
let globalFetch = window.fetch;

// Token storage
let apiToken = null;

/**
 * Set API token for authenticated requests
 * @param {string} token - The API token
 */
function setApiToken(token) {
    apiToken = token;
    logApi(`API token set: ${token ? token.substring(0, 8) + '...' : 'null'}`, 'debug');
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
        headers
    });
}

// Main API object
const api = {
    // Internal method to update fetch behavior
    setFetch(fetchFn) {
        globalFetch = fetchFn;
    },

/**
     * Get current org from app state
     */
    getCurrentOrg() {
        // Get from global app state when available
        if (typeof window !== 'undefined' && window.appStore) {
            return window.appStore.getState().file.currentOrg;
        }
        return null;
    },

    /**
     * Fetch file content
     * @param {string} relativePath - Path relative to MD_DIR
     * @returns {Promise<string>} File content
     */
    async fetchFileContent(relativePath) {
        let url = endpoints.fileContent(relativePath);
        
        // Add org parameter if set
        const currentOrg = this.getCurrentOrg();
        if (currentOrg) {
            url += `&org=${encodeURIComponent(currentOrg)}`;
        }
        
        logApi(`Fetching file content: ${url}`, 'debug');
        
        try {
            const response = await authenticatedFetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const content = await response.text();
            logApi(`File content received for "${relativePath}": ${content.length} chars`, 'debug');
            return content;
        } catch (error) {
            logApi(`Error fetching file content for "${relativePath}": ${error.message}`, 'error');
            throw error;
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
             logApi(errorMsg, 'error');
             throw new Error(errorMsg);
        }
        
        let url = endpoints.directoryList(pathname);
        
        // Add org parameter if set
        const currentOrg = this.getCurrentOrg();
        if (currentOrg) {
            url += `&org=${encodeURIComponent(currentOrg)}`;
        }
        
        logApi(`Fetching directory listing: ${url}`, 'debug');
        
        try {
            const response = await authenticatedFetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            logApi(`Directory listing received for "${pathname}": ${data.dirs?.length || 0} dirs, ${data.files?.length || 0} files`, 'debug');
            return data;
        } catch (error) {
            logApi(`Error fetching directory listing for "${pathname}": ${error.message}`, 'error');
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
        logApi(`Saving file: ${relativePath}`, 'info');
        
        const payload = { pathname: relativePath, content };
        
        // Add org if set
        const currentOrg = this.getCurrentOrg();
        if (currentOrg) {
            payload.org = currentOrg;
        }
        
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
            logApi(`File saved successfully: ${relativePath}`, 'info');
            return result;
        } catch (error) {
            logApi(`Error saving file "${relativePath}": ${error.message}`, 'error');
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
        logApi(`Fetching config for dir: '${directory}'`, 'debug');
        try {
            const options = { method: 'GET' };
            const response = await globalFetch(url, options);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            logApi(`Error fetching directory config: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Manage community link (add/remove)
     * @param {string} filename
     * @param {string} directory
     * @param {string} action - 'add' or 'remove'
     * @returns {Promise<object>} Parsed JSON result
     */
    async manageCommunityLink(filename, directory, action = 'add') {
        const url = `${endpoints.manageLink()}?file=${encodeURIComponent(filename)}&dir=${encodeURIComponent(directory)}&action=${action}`;
        logApi(`Managing community link: ${action} for ${filename} from ${directory}`);
        try {
            const options = { method: 'POST' };
            const response = await globalFetch(url, options);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            logApi(`Failed to manage community link: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Fetch public CSS content via the unprotected route.
     * @param {string} relativePath - Path relative to PD_DIR/data ('themes/classic/core.css', 'themes/classic/light.css', etc.).
     * @returns {Promise<{content: string}|null>} CSS content object or null on error/not found.
     */
    async fetchPublicCss(relativePath) {
        logApi(`Fetching public CSS for path: "${relativePath}"`, 'debug');
        // Construct URL for the new public endpoint
        const url = `/public/css?path=${encodeURIComponent(relativePath)}`;
        try {
            // No auth needed, but still use globalFetch if it adds other headers/handling
            // NO credentials: 'include' needed here for public route
            const response = await globalFetch(url, { method: 'GET' });

            logApi(`Response from ${url}: ${response.status} ${response.statusText}`, 'debug');

            if (!response.ok) {
                // Handle 404 specifically maybe?
                if (response.status === 404) {
                    logApi(`Public CSS not found at ${url}`, 'debug');
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
                logApi(errorText, 'error');
                throw new Error(errorText);
            }
            const content = await response.text();
            logApi(`Public CSS content fetched successfully (length: ${content.length}) for path "${relativePath}"`, 'debug');
            if (content && content.length > 0) {
                logApi(`Public CSS content fetched successfully, returning object with content property`, 'debug');
                return { content: content };
            } else {
                logApi(`Empty content received for CSS, returning null`, 'warn');
                return null;
            }
        } catch (error) {
            logApi(`Error in fetchPublicCss for ${relativePath}: ${error.message}`, 'error');
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
        logApi(`Attempting login for user: ${username}`, 'info');
        try {
            const response = await globalFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            
            logApi(`Login response status: ${response.status}`, 'debug');

            let data;
            try {
                data = await response.json();
                logApi(`Login response data: ${JSON.stringify(data)}`, 'debug');
            } catch (e) {
                logApi(`Failed to parse JSON response (Status: ${response.status})`, 'error');
                 throw new Error(`Login failed: Server returned non-JSON response (Status: ${response.status})`);
            }

            if (!response.ok) {
                logApi(`Login response not OK (${response.status}). Throwing error.`, 'warn');
                throw new Error(data?.error || `Login failed: ${response.status}`);
            }

            // Validate response structure
            if (!data || !data.username || !data.role) {
                logApi('Login success but server response missing username or role!', 'error');
                throw new Error('Login response from server is incomplete.');
            }

            logApi(`Login successful. User data: ${JSON.stringify(data)}`, 'info');
            return data;
        } catch (error) {
            errorLogger(`Login failed: ${error.message}`, error);
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
        logApi(`Generating API token with ${expiryHours}h expiry`, 'info');
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
            logApi(`Token generated successfully: ${data.token.substring(0, 8)}...`, 'info');
            
            // Automatically set the token for future requests
            setApiToken(data.token);
            
            return data;
        } catch (error) {
            errorLogger(`Token generation failed: ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Get all active tokens for the current user
     * @returns {Promise<object>} Token list
     */
    async getTokens() {
        logApi('Fetching user tokens', 'debug');
        try {
            const response = await authenticatedFetch('/api/auth/tokens');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch tokens: ${response.status}`);
            }

            const data = await response.json();
            logApi(`Retrieved ${data.count} tokens`, 'debug');
            return data;
        } catch (error) {
            errorLogger(`Failed to fetch tokens: ${error.message}`, error);
            throw error;
        }
    },

    /**
     * Revoke an API token
     * @param {string} token - The token to revoke
     * @returns {Promise<object>} Revocation result
     */
    async revokeToken(token) {
        logApi(`Revoking token: ${token.substring(0, 8)}...`, 'info');
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
            logApi('Token revoked successfully', 'info');
            
            // Clear the token if it's the current one
            if (apiToken === token) {
                setApiToken(null);
            }
            
            return data;
        } catch (error) {
            errorLogger(`Token revocation failed: ${error.message}`, error);
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
        logApi('Logout called', 'debug');
        const url = endpoints.logout();
        const options = { method: 'POST' };
        return await globalFetch(url, options);
    },
   
    /**
     * Fetches the current user's status from the server.
     * @returns {Promise<Response>} Raw response object
     */
    async getUserStatus() {
        logApi('getUserStatus called', 'debug');
        const url = endpoints.userStatus();
        const options = { method: 'GET' };
        return await globalFetch(url, options);
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
            logApi(errorMsg, 'error');
            throw new Error(errorMsg);
        }
        logApi(`deleteFile called for: ${relativePath}`, 'debug');

        const encodedPath = encodeURIComponent(relativePath);
        const url = `/api/files/delete?pathname=${encodedPath}`;

        const options = {
            method: 'DELETE'
        };
        try {
            const response = await globalFetch(url, options);
            if (!response.ok) {
                const errorText = await response.text();
                logApi(`Error deleting file '${relativePath}': ${response.status} ${response.statusText} - ${errorText}`, 'error');
                try {
                    const errData = JSON.parse(errorText);
                     throw new Error(errData.error || `Failed to delete file: ${response.status}`);
                } catch(e) {
                     throw new Error(`Failed to delete file: ${response.status}`);
                }
            }
            logApi(`Successfully deleted '${relativePath}'`);
            return await response.json();
        } catch (error) {
            logApi(`Error deleting file: ${error.message}`, 'error');
            throw error;
        }
    },

    // Add stubs/implementations for other endpoints (images etc.) if needed
};

// Export both named and default exports for compatibility
export { api };
export default api;

logApi('Client API module loaded.', 'info'); 