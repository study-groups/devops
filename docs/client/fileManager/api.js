// api.js - Handles API calls to the server
import { globalFetch } from '../globalFetch.js';
import { logMessage } from '../log.js';
import { authState } from '../auth.js';

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
    // Common headers with authentication
    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
    };
    
    // Try the original endpoint first
    try {
        const response = await globalFetch('/api/files/save', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                name: filename,
                dir: directory,
                content: content
            })
        });
        
        if (response.ok) {
            logMessage('[FILES] Successfully saved using /api/files/save');
            return response;
        }
    } catch (error) {
        logMessage(`[FILES] Primary save endpoint failed: ${error.message}`);
    }
    
    // Try alternative endpoint format
    try {
        const response = await globalFetch('/api/markdown/save/' + encodeURIComponent(filename), {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                content: content,
                pwd: directory,
                userDir: authState.username
            })
        });
        
        if (response.ok) {
            logMessage('[FILES] Successfully saved using /api/markdown/save/');
            return response;
        }
    } catch (error) {
        logMessage(`[FILES] Alternative save endpoint failed: ${error.message}`);
    }
    
    // Try a direct write endpoint
    try {
        const response = await globalFetch('/api/write', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                filename: filename,
                directory: directory,
                content: content,
                user: authState.username
            })
        });
        
        if (response.ok) {
            logMessage('[FILES] Successfully saved using /api/write');
            return response;
        }
    } catch (error) {
        logMessage(`[FILES] Direct write endpoint failed: ${error.message}`);
    }
    
    // Try a content endpoint
    try {
        const response = await globalFetch(`/api/content?file=${encodeURIComponent(filename)}&dir=${encodeURIComponent(directory)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
            },
            body: content
        });
        
        if (response.ok) {
            logMessage('[FILES] Successfully saved using /api/content');
            return response;
        }
    } catch (error) {
        logMessage(`[FILES] Content endpoint failed: ${error.message}`);
    }
    
    // If we get here, all attempts failed
    throw new Error('All save endpoints failed');
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