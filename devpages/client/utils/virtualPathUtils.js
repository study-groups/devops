/**
 * virtualPathUtils.js - Utilities for handling virtual base paths
 */
import { appStore } from '/client/appState.js';

/**
 * Prepends the virtual base path to a relative path for API calls
 * @param {string} relativePath - The path relative to the virtual base
 * @returns {string} The full path including virtual base
 */
export function resolveVirtualPath(relativePath) {
    const state = appStore.getState();
    const virtualBasePath = state.file.virtualBasePath || '';
    
    if (!virtualBasePath) {
        return relativePath; // No virtual base, return as-is
    }
    
    if (!relativePath || relativePath === '') {
        return virtualBasePath; // Return just the base path for root requests
    }
    
    // Join the paths with proper separator handling
    return `${virtualBasePath}/${relativePath}`.replace(/\/+/g, '/');
}

/**
 * Removes the virtual base path from a full path (for display purposes)
 * @param {string} fullPath - The full path including virtual base
 * @returns {string} The path relative to the virtual base
 */
export function stripVirtualPath(fullPath) {
    const state = appStore.getState();
    const virtualBasePath = state.file.virtualBasePath || '';
    
    if (!virtualBasePath || !fullPath) {
        return fullPath; // No virtual base or no path, return as-is
    }
    
    if (fullPath.startsWith(virtualBasePath + '/')) {
        return fullPath.substring(virtualBasePath.length + 1);
    } else if (fullPath === virtualBasePath) {
        return ''; // Root of virtual base
    }
    
    return fullPath; // Path doesn't start with virtual base, return as-is
}

/**
 * Sets a new virtual base path and persists it
 * @param {string} newBasePath - The new virtual base path
 */
export function setVirtualBasePath(newBasePath) {
    const normalizedPath = (newBasePath || '').replace(/^\/+|\/+$/g, ''); // Trim leading/trailing slashes
    
    try {
        localStorage.setItem('devpages_virtual_base_path', normalizedPath);
        console.log(`[VirtualPath] Set virtual base path to: '${normalizedPath}'`);
    } catch (e) {
        console.error('[VirtualPath] Error saving virtual base path to localStorage:', e);
    }
    
    // Update the app state - we'll need to add an action for this
    if (window.dispatch) {
        window.dispatch({
            type: 'FS_SET_VIRTUAL_BASE_PATH',
            payload: { virtualBasePath: normalizedPath }
        });
    }
}

/**
 * Gets available virtual base paths by examining top-level directories
 * @returns {Array<string>} Array of possible base paths
 */
export function getAvailableBasePaths() {
    const state = appStore.getState();
    // v2: topLevelDirs is at path.topLevelDirs, not file.availableTopLevelDirs
    const topDirs = state.path?.topLevelDirs || [];
    
    // Start with root (empty string)
    const basePaths = [''];
    
    // Add each top-level directory as a potential base
    topDirs.forEach(dir => {
        if (dir && typeof dir === 'string') {
            basePaths.push(dir);
        }
    });
    
    return basePaths;
} 