// api.js - Handles API calls to the server
import { globalFetch } from '../globalFetch.js';
import { logMessage } from '../log.js';
import { authState } from '../auth.js';

export async function fetchFileContent(filename, directory) {
    const response = await globalFetch(
        `/api/files/get?name=${encodeURIComponent(filename)}&dir=${encodeURIComponent(directory)}`
    );
    
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

export async function fetchDirectoryListing(directory = '') {
    try {
        // Try different API endpoints
        const endpoints = [
            `/api/files/list?dir=${encodeURIComponent(directory)}`,
            `/api/files?dir=${encodeURIComponent(directory)}`
        ];
        
        let response;
        let success = false;
        
        // Try each endpoint until one works
        for (const endpoint of endpoints) {
            try {
                response = await fetch(endpoint, {
                    headers: {
                        'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
                    }
                });
                
                if (response.ok) {
                    success = true;
                    break;
                }
            } catch (error) {
                logMessage(`[FILES] Endpoint ${endpoint} failed: ${error.message}`);
            }
        }
        
        if (!success || !response) {
            throw new Error('All file listing endpoints failed');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        logMessage(`[FILES API ERROR] Failed to fetch directory listing: ${error.message}`);
        throw error;
    }
}

export async function fetchDirectoryConfig(directory) {
    const response = await globalFetch(`/api/files/config?dir=${encodeURIComponent(directory)}`);
    
    if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
} 