// directSave.js - Direct file saving implementation
import { logMessage } from '../log.js';
import { authState } from '../auth.js';

/**
 * Directly save a file using a simple fetch request
 * @param {string} filename - The name of the file to save
 * @param {string} directory - The directory to save to
 * @param {string} content - The content to save
 * @returns {Promise<boolean>} - Whether the save was successful
 */
export async function directSaveFile(filename, directory, content) {
    try {
        logMessage(`[DIRECT SAVE] Attempting to save ${filename} to ${directory}`);
        
        // Create basic auth header
        const authHeader = `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`;
        
        // Use a single, clean endpoint with query parameters
        const url = `/api/save?file=${encodeURIComponent(filename)}&dir=${encodeURIComponent(directory)}`;
        
        logMessage(`[DIRECT SAVE] Using endpoint: ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Authorization': authHeader
            },
            body: content
        });
        
        if (response.ok) {
            logMessage(`[DIRECT SAVE] Successfully saved ${filename}`);
            return true;
        }
        
        const errorText = await response.text();
        logMessage(`[DIRECT SAVE] Failed: ${response.status} - ${errorText}`);
        
        return false;
    } catch (error) {
        logMessage(`[DIRECT SAVE] Error: ${error.message}`);
        return false;
    }
} 