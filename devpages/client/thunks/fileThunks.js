/**
 * client/thunks/fileThunks.js
 * File system thunk action creators
 */

import { ActionTypes } from '/client/messaging/actionTypes.js';
import { api } from '/client/api.js';
import { logMessage } from '/client/log/index.js';

// Helper for logging within this module
function logFile(message, level = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, 'FILE');
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[FILE] ${message}`);
    }
}

export const fileThunks = {
    /**
     * Thunk for loading top-level directories
     * @returns {Function} Thunk function
     */
    loadTopLevelDirectories: () => async (dispatch, getState) => {
        try {
            logFile('Loading top-level directories...');
            
            dispatch({ type: ActionTypes.FS_INIT_START });
            
            const response = await fetch('/api/files/dirs', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const directories = await response.json();
            logFile(`Top-level dirs received: [${directories.join(', ')}]`);
            
            if (directories && Array.isArray(directories)) {
                dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: directories });
            } else {
                logFile('No valid directories array found', 'warning');
                dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: [] });
            }
            
            dispatch({ type: ActionTypes.FS_INIT_COMPLETE });
            return directories;
        } catch (error) {
            logFile(`Error loading top-level directories: ${error.message}`, 'error');
            dispatch({ type: ActionTypes.FS_SET_TOP_DIRS, payload: [] });
            dispatch({ type: ActionTypes.FS_LOAD_TOP_DIRS_ERROR, payload: { error: error.message } });
            throw error;
        }
    },

    /**
     * Thunk for loading directory listing
     * @param {string} pathname - Directory path
     * @returns {Function} Thunk function
     */
    loadDirectoryListing: (pathname) => async (dispatch, getState) => {
        const state = getState();
        const isLoading = state.file?.isLoading;

        if (isLoading) {
            logFile(`Currently loading. Skipping duplicate request for ${pathname}`);
            return;
        }

        try {
            logFile(`Loading directory listing for: ${pathname}`);
            
            dispatch({ type: ActionTypes.FS_LOAD_LISTING_START });
            
            const listing = await api.fetchDirectoryListing(pathname);
            
            logFile(`Directory listing loaded: ${listing?.dirs?.length} dirs, ${listing?.files?.length} files`);
            
            dispatch({ 
                type: ActionTypes.FS_LOAD_LISTING_SUCCESS, 
                payload: { pathname, listing } 
            });
            
            return listing;
        } catch (error) {
            logFile(`Error loading directory listing: ${error.message}`, 'error');
            dispatch({ 
                type: ActionTypes.FS_LOAD_LISTING_ERROR, 
                payload: { pathname, error: error.message } 
            });
            throw error;
        }
    },

    /**
     * Thunk for loading file content
     * @param {string} pathname - File path
     * @returns {Function} Thunk function
     */
    loadFileContent: (pathname) => async (dispatch, getState) => {
        const state = getState();
        const authState = state.auth;

        if (!authState.isAuthenticated) {
            throw new Error('User not authenticated. Please log in to access files.');
        }

        try {
            logFile(`Loading file content for: ${pathname}`);
            
            dispatch({ type: ActionTypes.FS_LOAD_FILE_START, payload: { pathname } });
            
            const content = await api.fetchFileContent(pathname);
            
            if (content === null || content === undefined) {
                throw new Error('File content is null or undefined');
            }
            
            logFile(`File content loaded: ${content.length} characters`);
            
            dispatch({ 
                type: ActionTypes.FS_LOAD_FILE_SUCCESS, 
                payload: { pathname, content } 
            });
            
            return content;
        } catch (error) {
            logFile(`Error loading file content: ${error.message}`, 'error');
            dispatch({ 
                type: ActionTypes.FS_LOAD_FILE_ERROR, 
                payload: { pathname, error: error.message } 
            });
            throw error;
        }
    },

    /**
     * Thunk for saving file content
     * @param {string} pathname - File path
     * @param {string} content - File content
     * @returns {Function} Thunk function
     */
    saveFileContent: (pathname, content) => async (dispatch, getState) => {
        try {
            logFile(`Saving file: ${pathname}`);
            
            dispatch({ type: ActionTypes.FS_SAVE_FILE_START, payload: { pathname } });
            
            const result = await api.saveFile(pathname, content);
            
            logFile(`File saved successfully: ${pathname}`);
            
            dispatch({ 
                type: ActionTypes.FS_SAVE_FILE_SUCCESS, 
                payload: { pathname } 
            });
            
            return result;
        } catch (error) {
            logFile(`Error saving file: ${error.message}`, 'error');
            dispatch({ 
                type: ActionTypes.FS_SAVE_FILE_ERROR, 
                payload: { pathname, error: error.message } 
            });
            throw error;
        }
    },

    /**
     * Thunk for deleting a file
     * @param {string} pathname - File path
     * @returns {Function} Thunk function
     */
    deleteFile: (pathname) => async (dispatch, getState) => {
        try {
            logFile(`Deleting file: ${pathname}`);
            
            const response = await fetch(`/api/files/delete?pathname=${encodeURIComponent(pathname)}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            logFile(`File deleted successfully: ${pathname}`);
            
            // Refresh the current directory listing
            const currentState = getState();
            const currentPath = currentState.file?.currentPathname;
            if (currentPath) {
                dispatch(fileThunks.loadDirectoryListing(currentPath));
            }
            
            return true;
        } catch (error) {
            logFile(`Error deleting file: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Thunk for getting directory configuration
     * @param {string} directory - Directory path
     * @returns {Function} Thunk function
     */
    getDirectoryConfig: (directory) => async (dispatch, getState) => {
        try {
            logFile(`Getting directory config for: ${directory}`);
            
            const config = await api.getDirectoryConfig(directory);
            
            logFile(`Directory config loaded for: ${directory}`);
            
            return config;
        } catch (error) {
            logFile(`Error getting directory config: ${error.message}`, 'error');
            throw error;
        }
    }
}; 