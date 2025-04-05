// api.js - Handles API calls to the server
import { globalFetch } from '/client/globalFetch.js';
import { AUTH_STATE } from '/client/auth.js';

// Create backwards-compatible alias
const authState = AUTH_STATE;

/**
 * Normalize directory names for API requests
 * This ensures special cases are handled properly
 */
function normalizeDirectoryForApi(directory) {
    // No longer converting between variations - use as is
    return directory;
}

// Helper for logging within this module
function logApi(message, level = 'text') {
    const prefix = '[API]';
    if (typeof window.logMessage === 'function') {
        window.logMessage(`${prefix} ${message}`, level);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`${prefix} ${message}`);
    }
}

/**
 * Fetch content for a file
 * @param {string} filename - File name
 * @param {string} directory - Directory name
 * @returns {Promise<string>} File content
 */
export async function fetchFileContent(filename, directory) {
    logApi(`Fetching content for ${filename} in ${directory}`);
    const url = `/api/files/content?file=${encodeURIComponent(filename)}&dir=${encodeURIComponent(directory)}`;
    try {
        const response = await globalFetch(url);
        if (!response.ok) {
            throw new Error(`Server error fetching content: ${response.status} ${response.statusText}`);
        }
        const content = await response.text();
        logApi(`Content fetched successfully (length: ${content.length})`);
        return content;
    } catch (error) {
        logApi(`Error fetching file content: ${error.message}`, 'error');
        throw error; // Re-throw for the caller (e.g., fileManager)
    }
}

/**
 * Save content to a file
 * @param {string} filename - File name
 * @param {string} directory - Directory name
 * @param {string} content - Content to save
 * @returns {Promise<Response>} Raw server response
 */


export async function saveFileContent(filename, directory, content) {
    logMessage(`[API] Save attempt with filename: "${filename}", directory: "${directory}"`);
    
    // Headers only need Content-Type now
    const headers = {
      'Content-Type': 'text/plain' // Important: text/plain, not application/json
    };
    
    try {
        // Use query parameters for file and directory
        const queryParams = new URLSearchParams({
            file: filename,
            dir: directory
        }).toString();
        
        // Use fetch WITHOUT manual auth headers. Relies on browser sending session cookie.
        const response = await fetch(`/api/files/save?${queryParams}`, {
            method: 'POST',
            headers: headers, // Only Content-Type needed
            body: content  // Send content directly as text
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            logMessage(`[API] Save failed with error: ${errorText}`, 'error');
            throw new Error(`Failed to save: ${response.status}`);
        }
        
        logMessage('[API] Successfully saved file');
        return response;
    } catch (error) {
        logMessage(`[API] Save failed: ${error.message}`, 'error');
        throw error;
    }
}



export async function fetchDirectoryListing(directory) {
    const normalizedDir = normalizeDirectoryForApi(directory);
    
    // Add parameter to ensure we get symlinks for Community Files
    const includeSymlinks = normalizedDir === 'Community_Files' ? '&symlinks=true' : '';
    
    const response = await globalFetch(
        `/api/files/list?dir=${encodeURIComponent(normalizedDir)}${includeSymlinks}`
    );
    
    if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return response;
}

export async function fetchDirectoryConfig(directory) {
    const response = await globalFetch(
        `/api/files/config?dir=${encodeURIComponent(directory)}`
    );
    
    if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
}

// Export a helper for community link management
export async function manageCommunityLink(filename, directory, action = 'add') {
    try {
        const url = `/api/community/link?file=${encodeURIComponent(filename)}&dir=${encodeURIComponent(directory)}&action=${action}`;
        
        logApi(`Managing community link: ${action} for ${filename} from ${directory}`);

        // Add detailed logging for the fetch call
        console.log('[API] manageCommunityLink URL:', url);
        const fetchOptions = {
            method: 'POST'
        };
        console.log('[API] manageCommunityLink fetchOptions:', fetchOptions);
        
        const response = await globalFetch(url, fetchOptions);
        
        console.log('[API] manageCommunityLink response:', response);

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        logApi(`Failed to manage community link: ${error.message}`, 'error');
        console.error('[API] manageCommunityLink error:', error); // Log the error to the console
        throw error;
    }
}

// Export APIs
export default {
  fetchFileContent,
  saveFileContent,
  fetchDirectoryListing,
  fetchDirectoryConfig,
  manageCommunityLink
}; 