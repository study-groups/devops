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
 * Adds authentication headers if the user is logged in.
 * Reads directly from appStore.
 * @param {object} options - Existing fetch options.
 * @returns {object} Fetch options potentially augmented with Authorization header.
 */
function addAuthHeader(options = {}) {
    const authInfo = appStore.getState().auth; // Use appStore
    if (authInfo.isLoggedIn && authInfo.user?.username) {
        options.headers = {
            ...options.headers,
            // Assuming Basic Auth based on previous context
            'Authorization': `Basic ${btoa(`${authInfo.user.username}:${authInfo.hashedPassword || ''}`)}`
        };
        logApi('Added Auth header.', 'debug');
    } else {
        logApi('No Auth header added (not logged in or missing credentials).', 'debug');
    }
    return options;
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
            // Use addAuthHeader
            const options = addAuthHeader({ method: 'GET' });
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
            const options = addAuthHeader({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // Use JSON
                body: body
            });
            
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
        const includeSymlinks = normalizedDir === 'Community_Files' ? '&symlinks=true' : '';
        const url = endpoints.listFiles(normalizedDir) + includeSymlinks; // Append symlink param
        logApi(`Fetching listing for dir: '${normalizedDir}'`, 'debug');
        try {
            const options = addAuthHeader({ method: 'GET' });
            const response = await globalFetch(url, options);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
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
            const options = addAuthHeader({ method: 'GET' });
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
            const options = addAuthHeader({ method: 'POST' }); // Needs auth
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

    // --- Auth --- 
    /**
     * Sends login credentials to the server.
     * @param {string} username
     * @param {string} password
     * @returns {Promise<Response>} Raw response object
     */
    async login(username, password) {
        logger(`Attempting login for user: ${username}`); // logger should be defined now
        try {
            const response = await globalFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            logger(`[API login] Raw response status: ${response.status}`, 'debug');
            const data = await response.json();
            logger(`[API login] Parsed response data: ${JSON.stringify(data)}`, 'debug');

            if (!response.ok) {
                logger(`[API login] Response not OK (${response.status}). Throwing error.`, 'warning');
                throw new Error(data.error || `Login failed: ${response.status}`);
            }
            if (!data.user || !data.user.username || !data.user.role) {
                logger('[API login] Login success but server response missing nested user object or role!', 'error');
                throw new Error('Login response from server is incomplete.');
            }
            logger(`[API login] Login successful. Returning user data: ${JSON.stringify(data.user)}`, 'info');
            return data.user;
        } catch (error) {
            // errorLogger should definitely be defined now
            errorLogger(`Login failed: ${error.message}`, error); 
            throw error; 
        }
    },
   
    /**
     * Sends logout request to the server.
     * @returns {Promise<Response>} Raw response object
     */
    async logout() {
        logApi(`[API] logout called`, 'debug');
        const url = endpoints.logout();
        const options = addAuthHeader({ method: 'POST' });
        return await globalFetch(url, options);
    },
   
    /**
     * Fetches the current user's status from the server.
     * @returns {Promise<Response>} Raw response object
     */
    async getUserStatus() {
        logApi(`[API] getUserStatus called`, 'debug');
        const url = endpoints.userStatus();
        const options = addAuthHeader({ method: 'GET' });
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
        const options = addAuthHeader({
            method: 'POST', // Assuming POST based on endpoint def
            headers: { 'Content-Type': 'application/json' },
            body,
        });
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