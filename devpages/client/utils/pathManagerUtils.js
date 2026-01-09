/**
 * Hybrid Path Manager Utilities
 * Combines simple actions for local operations with thunks for server operations
 */

import { appStore } from '/client/appState.js';
import { appDispatch } from '/client/appDispatch.js';
import { pathThunks } from '/client/store/slices/pathSlice.js';
import { getParentPath } from '/client/utils/pathUtils.js';

/**
 * Simple path actions for local state updates (no server interaction)
 */
export const pathActions = {
    // Direct state updates for local navigation
    setCurrentPath: (pathname, isDirectory) => ({
        type: 'path/setCurrentPath',
        payload: { pathname, isDirectory }
    }),

    // Update current listing without server call
    updateListing: (listing) => ({
        type: 'path/updateListing', 
        payload: listing
    }),

    // Clear any path errors
    clearError: () => ({
        type: 'path/clearError'
    }),
};

/**
 * Hybrid path utilities - use simple actions or thunks as appropriate
 */
export const pathUtils = {
    
    /**
     * SIMPLE: Navigate to parent directory (local operation)
     * Use when we already know the parent path and don't need server listing
     */
    navigateToParent(currentPath) {
        const parentPath = getParentPath(currentPath) || '';
        appStore.dispatch(pathActions.setCurrentPath(parentPath, true));
        
        // If we need the parent listing, trigger server fetch
        return appDispatch(pathThunks.fetchListingByPath({ pathname: parentPath, isDirectory: true }));
    },

    /**
     * SIMPLE: Set current path without server interaction
     * Use for breadcrumb navigation when we just want to update the current selection
     */
    setCurrentPath(pathname, isDirectory = true) {
        appStore.dispatch(pathActions.setCurrentPath(pathname, isDirectory));
    },

    /**
     * COMPLEX: Load directory with server fetch (use existing thunk)
     * Use when we need fresh server data
     */
    async loadDirectory(pathname) {
        return appDispatch(pathThunks.fetchListingByPath({ pathname, isDirectory: true }));
    },

    /**
     * COMPLEX: Load file with server fetch (use existing thunk) 
     * Use when selecting a file that needs content loading
     */
    async loadFile(pathname) {
        return appDispatch(pathThunks.fetchListingByPath({ pathname, isDirectory: false }));
    },

    /**
     * SIMPLE: Get current path state
     * Convenient getter for current state
     */
    getCurrentState() {
        return appStore.getState().path;
    },

    /**
     * SIMPLE: Check if we have a valid listing for a path
     * Use to avoid unnecessary server calls
     */
    hasListingForPath(pathname) {
        const state = this.getCurrentState();
        return state.currentListing?.pathname === pathname;
    },

    /**
     * HYBRID: Smart navigation that chooses the right approach
     * Uses simple actions when possible, server calls when needed
     */
    async smartNavigate(pathname, isDirectory = true) {
        // Always update local state immediately for responsive UI
        this.setCurrentPath(pathname, isDirectory);
        
        // If it's a directory and we don't have listing, fetch from server
        if (isDirectory && !this.hasListingForPath(pathname)) {
            return this.loadDirectory(pathname);
        }
        
        // If it's a file, we might need parent directory listing
        if (!isDirectory) {
            const parentPath = getParentPath(pathname) || '';
            if (!this.hasListingForPath(parentPath)) {
                return this.loadDirectory(parentPath);
            }
        }
        
        return Promise.resolve();
    }
};

/**
 * Top-level directory utilities for root navigation
 */
export const topDirUtils = {
    
    /**
     * Get available top-level directories from path state
     * v2: topLevelDirs is at path.topLevelDirs, not file.availableTopLevelDirs
     */
    getAvailableTopLevelDirs() {
        const pathState = appStore.getState().path || {};
        return pathState.topLevelDirs || [];
    },

    /**
     * Check if top-level directories are available
     */
    hasTopLevelDirs() {
        return this.getAvailableTopLevelDirs().length > 0;
    },

    /**
     * Load root directory to populate top-level directories
     * Uses existing thunk for server call
     */
    async loadRootDirectory() {
        return pathUtils.loadDirectory('');
    },

    /**
     * Handle root directory selection - when user is at empty path
     */
    async handleRootDirectorySelection() {
        // First, ensure we have top-level directories
        if (!this.hasTopLevelDirs()) {
            return this.loadRootDirectory();
        }
        return Promise.resolve();
    }
};

/**
 * Navigation helpers for common operations
 */
export const navigationHelpers = {
    
    /**
     * Handle breadcrumb click - usually just local navigation
     */
    handleBreadcrumbNavigation(pathname) {
        // Simple local update first
        pathUtils.setCurrentPath(pathname, true);
        
        // Load directory listing if needed
        if (!pathUtils.hasListingForPath(pathname)) {
            return pathUtils.loadDirectory(pathname);
        }
        
        return Promise.resolve();
    },

    /**
     * Handle dropdown selection - mix of local and server operations
     */
    async handleDropdownSelection(selectedValue, selectedType, currentDirectory) {
        if (selectedType === 'parent') {
            // Parent navigation - we know the path, just navigate
            return pathUtils.navigateToParent(currentDirectory);
        }
        
        // Calculate new path for normal selections
        const newPath = currentDirectory ? `${currentDirectory}/${selectedValue}` : selectedValue;
        
        return appDispatch(pathThunks.navigateToPath({ pathname: newPath, isDirectory: selectedType === 'dir' }));
    }
}; 