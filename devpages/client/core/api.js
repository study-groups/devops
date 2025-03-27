// api.js - Handles API calls to the server
import { globalFetch } from '../globalFetch.js';
import { logMessage } from '../log/index.js';
import { AUTH_STATE, getAuthHeaders } from '/client/core/auth.js';

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

export async function fetchFileContent(filename, directory) {
    // Normalize directory name for API request
    const normalizedDir = normalizeDirectoryForApi(directory);
    
    // Add parameter to ensure we get symlink content for Community Files
    const includeSymlinks = normalizedDir === 'Community_Files' ? '&symlinks=true' : '';
    
    const url = `/api/files/get?name=${encodeURIComponent(filename)}&dir=${encodeURIComponent(normalizedDir)}${includeSymlinks}`;
    
    logMessage(`[API] Fetching file content from: ${url}`);
    
    const response = await globalFetch(url);
    
    if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return response;
}

export async function saveFileContent(filename, directory, content) {
    logMessage(`[DEBUG] Save attempt with filename: "${filename}", directory: "${directory}"`);
    
    const authHeaders = {
        'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`,
        'Content-Type': 'text/plain'  // Important: text/plain, not application/json
    };
    
    try {
        // Use query parameters for file and directory
        const queryParams = new URLSearchParams({
            file: filename,
            dir: directory
        }).toString();
        
        const response = await fetch(`/api/files/save?${queryParams}`, {
            method: 'POST',
            headers: authHeaders,
            body: content  // Send content directly as text
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            logMessage(`[FILES] Save failed with error: ${errorText}`);
            throw new Error(`Failed to save: ${response.status}`);
        }
        
        logMessage('[FILES] Successfully saved file');
        return response;
    } catch (error) {
        logMessage(`[FILES] Save failed: ${error.message}`);
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
    const response = await globalFetch(`/api/files/config?dir=${encodeURIComponent(directory)}`);
    
    if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
}

// Export a helper for community link management
export async function manageCommunityLink(filename, directory, action = 'add') {
    try {
        const url = `/api/community/link?file=${encodeURIComponent(filename)}&dir=${encodeURIComponent(directory)}&action=${action}`;
        
        logMessage(`[API] Managing community link: ${action} for ${filename} from ${directory}`);

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
        logMessage(`[API ERROR] Failed to manage community link: ${error.message}`);
        console.error('[API] manageCommunityLink error:', error); // Log the error to the console
        throw error;
    }
} 