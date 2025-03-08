// simpleSave.js - Extremely simple file saving implementation
import { logMessage } from '../log/index.js';
import { authState } from '../auth.js';

/**
 * Simple function to save a file directly to the server
 */
export async function simpleSave(filename, directory, content) {
    try {
        logMessage(`[SIMPLE SAVE] Attempting to save ${filename} to ${directory}`);
        
        // Create a FormData object for maximum compatibility
        const formData = new FormData();
        formData.append('filename', filename);
        formData.append('directory', directory);
        formData.append('content', content);
        
        // Create a text file blob as a fallback
        const textFileBlob = new Blob([content], { type: 'text/plain' });
        formData.append('file', textFileBlob, filename);
        
        // Add auth information
        formData.append('username', authState.username);
        
        // Use a simple POST to /api/save
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`
            },
            body: formData
        });
        
        if (response.ok) {
            logMessage(`[SIMPLE SAVE] Successfully saved ${filename}`);
            return true;
        }
        
        const errorText = await response.text();
        logMessage(`[SIMPLE SAVE] Failed: ${response.status} - ${errorText}`);
        
        return false;
    } catch (error) {
        logMessage(`[SIMPLE SAVE] Error: ${error.message}`);
        return false;
    }
} 