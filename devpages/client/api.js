// api.js - Handles API calls to the server
import { globalFetch } from '/client/globalFetch.js';
// import { AUTH_STATE } from '/client/auth.js'; // Removed
// import { withAuthHeaders } from '/client/headers.js'; // Removed unused import
import { appStore } from '/client/appState.js'; // Import central state for auth info

// REMOVE Alias: const appState = appStore; 

// Remove backward-compatible alias
// const authState = AUTH_STATE;

// --- API Endpoints --- (Reinstate)
const API_BASE = '/api';
const endpoints = {
    // Files
    listFiles: (dir = '') => `${API_BASE}/files/list?dir=${encodeURIComponent(dir)}`,
    getFileContent: (name, dir = '') => `${API_BASE}/files/content?file=${encodeURIComponent(name)}&dir=${encodeURIComponent(dir)}`, // Adjusted endpoint based on usage
    saveFile: () => `${API_BASE}/files/save`, // POST request
    listDirs: () => `${API_BASE}/files/dirs`,
    deleteFile: () => `${API_BASE}/files/delete`, // POST request
    getConfig: (dir = '') => `${API_BASE}/files/config?dir=${encodeURIComponent(dir)}`, // Adjusted endpoint

    // Auth
    login: () => `${API_BASE}/auth/login`, // POST
    logout: () => `${API_BASE}/auth/logout`, // POST
    userStatus: () => `${API_BASE}/auth/user`, // GET

    // Community Files
    manageLink: () => `${API_BASE}/community/link`, // Combined add/remove via action param
    // Add other endpoints if needed (images, etc.)
};

// --- Define Loggers FIRST ---
const _log = (level, message, context, ...args) => {
    const type = context || 'API';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type, ...args);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`, ...args);
    }
};

const logger = (message, level = 'debug', ...args) => _log(level, message, 'API', ...args);
const errorLogger = (message, error, ...args) => _log('error', message, 'API', error, ...args);
// --- End Logger Definitions ---

// --- Helper Functions ---

/**
 * Helper for logging within this module
 * @param {string} message
 * @param {string} [level='info'] // Default level to info
 */
function logApi(message, level = 'info') {
    const type = 'API';
    // Use window.logMessage if available
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        // Fallback to console if global logger isn't ready
        const logFunc = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

/**
 * Normalize directory names for API requests
 * @param {string} directory
 * @returns {string}
 */
function normalizeDirectoryForApi(directory) {
    return directory; // Keep simple for now
}

// --- Exported API Object --- 
export const api = {
    /**
     * Fetch content for a file
     * @param {string} filename - File name
     * @param {string} directory - Directory name
     * @returns {Promise<string>} File content
     */
    async fetchFileContent(filename, directory) {
        logApi(`Fetching content for ${filename} in ${directory}`);
        const url = endpoints.getFileContent(filename, directory);
        try {
            const options = { method: 'GET' };
            const response = await globalFetch(url, options);
            if (!response.ok) {
                throw new Error(`Server error fetching content: ${response.status} ${response.statusText}`);
            }
            const content = await response.text();
            logApi(`Content fetched successfully (length: ${content.length})`);
            return content;
        } catch (error) {
            logApi(`Error fetching file content: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Save content to a file
     * @param {string} filename - File name
     * @param {string} directory - Directory name
     * @param {string} content - Content to save
     * @returns {Promise<Response>} Raw server response
     */
    async saveFileContent(filename, directory, content) {
        logApi(`[API] Save attempt with filename: "${filename}", directory: "${directory}"`);
        const url = endpoints.saveFile(); // Use endpoint
        try {
            // Standardize to use JSON body and auth header
            const body = JSON.stringify({ name: filename, dir: directory, content: content });
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // Use JSON
                body: body
            };
            
            const response = await globalFetch(url, options);
            
            if (!response.ok) {
                const errorText = await response.text();
                logApi(`[API] Save failed with error: ${errorText}`, 'error');
                throw new Error(`Failed to save: ${response.status}`);
            }
            
            logApi('[API] Successfully saved file');
            return response; // Return raw response for flexibility
        } catch (error) {
            logApi(`[API] Save failed: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Fetch directory listing
     * @param {string} directory
     * @returns {Promise<object>} Parsed JSON listing
     */
    async fetchDirectoryListing(directory) {
        const normalizedDir = normalizeDirectoryForApi(directory);
        const url = endpoints.listFiles(normalizedDir); // Simpler URL construction
        logApi(`Fetching listing for dir: '${normalizedDir}'`, 'debug');
        try {
            const options = { method: 'GET' };
            const response = await globalFetch(url, options);
            if (!response.ok) {
                let errorMsg = `Server returned ${response.status}: ${response.statusText}`;
                try {
                   const errData = await response.json();
                   if (errData.error) errorMsg = errData.error;
                } catch(e) {/* Ignore if body is not json */}
                throw new Error(errorMsg);
            }
            return await response.json(); // Parse JSON here
        } catch (error) {
            logApi(`Error fetching directory listing: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Fetch directory configuration
     * @param {string} directory
     * @returns {Promise<object>} Parsed JSON config
     */
    async fetchDirectoryConfig(directory) {
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
     * @param {string} relativePath - Path relative to PD_DIR root ('styles.css') or PD_DIR/data ('themes/dark.css').
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
     * @returns {Promise<Response>} Raw response object
     */
    async login(username, password) {
        logger(`Attempting login for user: ${username}`);
        try {
            // Make the POST request to the login endpoint
            const response = await globalFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                // Note: No explicit Authorization header needed here,
                // using username/password in body for server check.
            });
            logger(`[API login] Raw response status: ${response.status}`, 'debug');

            let data;
            try {
                // Attempt to parse response body as JSON
                data = await response.json();
                logger(`[API login] Parsed response data: ${JSON.stringify(data)}`, 'debug');
            } catch (e) {
                 logger(`[API login] Failed to parse JSON response (Status: ${response.status})`, 'error');
                 throw new Error(`Login failed: Server returned non-JSON response (Status: ${response.status})`);
            }

            // Check if the HTTP status code indicates success (e.g., 2xx)
            if (!response.ok) {
                logger(`[API login] Response not OK (${response.status}). Throwing error.`, 'warning');
                // Use the error message from the JSON body if available
                throw new Error(data?.error || `Login failed: ${response.status}`);
            }

            // --- Validate Success Response Structure ---
            // Server successfully authenticated and should return { username: "...", role: "..." }
            if (!data || !data.username || !data.role) {
                logger('[API login] Login success (status 200) but server response missing username or role!', 'error');
                // Throw an error to indicate to the calling code (e.g., auth.js)
                // that the expected data wasn't received, even though the status was OK.
                throw new Error('Login response from server is incomplete.');
            }
            // --- End Validation ---

            // If response.ok and data structure is valid, consider login successful
            logger(`[API login] Login successful. Returning user data: ${JSON.stringify(data)}`, 'info');
            // Return the user data object { username, role } to the caller (e.g., auth.js)
            return data;
        } catch (error) {
            // Log any error that occurred during fetch, parsing, or validation
            errorLogger(`Login failed: ${error.message}`, error);
            throw error; // Re-throw the error for the calling code (e.g., auth.js) to handle
        }
    },
   
    /**
     * Sends logout request to the server.
     * @returns {Promise<Response>} Raw response object
     */
    async logout() {
        logApi(`[API] logout called`, 'debug');
        const url = endpoints.logout();
        const options = { method: 'POST' };
        return await globalFetch(url, options);
    },
   
    /**
     * Fetches the current user's status from the server.
     * @returns {Promise<Response>} Raw response object
     */
    async getUserStatus() {
        logApi(`[API] getUserStatus called`, 'debug');
        const url = endpoints.userStatus();
        const options = { method: 'GET' };
        return await globalFetch(url, options);
    },
   
    // --- Files --- 
    /**
     * Deletes a file on the server.
     * @param {string} filename 
     * @param {string} directory 
     * @returns {Promise<object>} Server response
     */
    async deleteFile(filename, directory = '') {
        logApi(`[API] deleteFile called for: ${directory}/${filename}`, 'debug');
        const url = endpoints.deleteFile();
        const body = JSON.stringify({ name: filename, dir: directory });
        const options = {
            method: 'POST', // Assuming POST based on endpoint def
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        try {
            const response = await globalFetch(url, options);
            if (!response.ok) throw new Error(`Failed to delete file: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            logApi(`Error deleting file: ${error.message}`, 'error');
            throw error;
        }
    }
     
    // Add stubs/implementations for other endpoints (images etc.) if needed
};

logger('[API] Client API module loaded.'); 