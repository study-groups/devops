/**
 * client/thunks/fileThunks.js
 * File system thunk action creators for Redux
 */

import { api } from '/client/api.js';
import { logMessage } from '/client/log/index.js';

// --- Action Types ---
const FS_SET_TOP_DIRS = 'fs/setTopDirs';
const FS_LOAD_LISTING_START = 'fs/loadListingStart';
const FS_LOAD_LISTING_SUCCESS = 'fs/loadListingSuccess';
const FS_LOAD_LISTING_ERROR = 'fs/loadListingError';

// --- Action Creators ---
const fileActions = {
    setTopDirs: (dirs) => ({ type: FS_SET_TOP_DIRS, payload: dirs }),
    loadListingStart: () => ({ type: FS_LOAD_LISTING_START }),
    loadListingSuccess: (payload) => ({ type: FS_LOAD_LISTING_SUCCESS, payload }),
    loadListingError: (error) => ({ type: FS_LOAD_LISTING_ERROR, payload: error }),
};

// Helper for logging
function logFile(message, level = 'debug') {
    logMessage(message, level, 'FILE');
}

export const fileThunks = {
    loadTopLevelDirectories: () => async (dispatch) => {
        try {
            logFile('Loading top-level directories...');
            const response = await fetch('/api/files/dirs', { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const directories = await response.json();
            dispatch(fileActions.setTopDirs(directories));
            return directories;
        } catch (error) {
            logFile(`Error loading top-level directories: ${error.message}`, 'error');
            dispatch(fileActions.setTopDirs([]));
        }
    },

    loadDirectoryListing: (pathname) => async (dispatch) => {
        dispatch(fileActions.loadListingStart());
        try {
            const listing = await api.fetchDirectoryListing(pathname);
            dispatch(fileActions.loadListingSuccess({ pathname, listing }));
            return listing;
        } catch (error) {
            dispatch(fileActions.loadListingError({ pathname, error: error.message }));
        }
    },
    
    // ... other thunks can be migrated here ...
}; 