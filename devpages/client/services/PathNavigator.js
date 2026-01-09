/**
 * PathNavigator.js - Navigation Service
 *
 * Handles all path navigation logic and side effects:
 * - URL synchronization
 * - Data fetching
 * - History management
 * - Error handling
 *
 * This is the ONLY place that should dispatch navigation actions.
 */

import { navigateTo, navigateBack, navigateForward, setError, _navigateToPath } from '../store/slices/pathSlice.js';
import { apiSlice } from '../store/apiSlice.js';

export class PathNavigator {
  constructor(store, options = {}) {
    this.store = store;
    this.pendingFetch = null; // Track in-flight requests
    this.enableDataFetching = options.enableDataFetching !== false; // Default true
  }

  /**
   * Navigate to a path
   * This is the main navigation method
   *
   * @param {string} pathname - Path to navigate to
   * @param {object} options
   * @param {boolean} options.updateURL - Update browser URL (default: true)
   * @param {boolean} options.fetchData - Fetch directory/file data (default: uses enableDataFetching)
   */
  async navigate(pathname, { updateURL = true, fetchData = null } = {}) {
    // Normalize pathname
    const normalizedPath = this._normalizePath(pathname);

    // Determine if it's a file or directory
    const type = this._inferType(normalizedPath);

    // Dispatch navigation action to NEW state (synchronous state update)
    this.store.dispatch(navigateTo({ pathname: normalizedPath, type }));

    // ALSO update OLD state for backward compatibility during migration
    this.store.dispatch(_navigateToPath({
      pathname: normalizedPath,
      isDirectory: type === 'directory'
    }));

    // Update browser URL if requested
    if (updateURL) {
      this._updateURL(normalizedPath);
    }

    // Fetch data if requested (respect both global and per-call settings)
    const shouldFetch = fetchData !== null ? fetchData : this.enableDataFetching;
    if (shouldFetch) {
      await this._fetchData(normalizedPath, type);
    }
  }

  /**
   * Navigate back in history
   */
  async goBack() {
    const state = this.store.getState().pathV2;

    if (state.historyIndex <= 0) {
      console.warn('[PathNavigator] Cannot go back - already at start of history');
      return;
    }

    this.store.dispatch(navigateBack());

    // Fetch data for the previous location (if data fetching is enabled)
    if (this.enableDataFetching) {
      const newState = this.store.getState().pathV2;
      await this._fetchData(newState.current.pathname, newState.current.type);
    }
  }

  /**
   * Navigate forward in history
   */
  async goForward() {
    const state = this.store.getState().pathV2;

    if (state.historyIndex >= state.history.length - 1) {
      console.warn('[PathNavigator] Cannot go forward - already at end of history');
      return;
    }

    this.store.dispatch(navigateForward());

    // Fetch data for the next location (if data fetching is enabled)
    if (this.enableDataFetching) {
      const newState = this.store.getState().pathV2;
      await this._fetchData(newState.current.pathname, newState.current.type);
    }
  }

  /**
   * Navigate to parent directory
   */
  async navigateUp() {
    const state = this.store.getState().pathV2;
    const pathname = state.current.pathname;

    if (!pathname || pathname === '/') {
      console.warn('[PathNavigator] Already at root directory');
      return;
    }

    const segments = pathname.split('/').filter(Boolean);
    segments.pop();
    // Return relative path (no leading slash) unless it's root
    const parentPath = segments.length === 0 ? '/' : segments.join('/');

    await this.navigate(parentPath);
  }

  /**
   * Navigate to breadcrumb
   * @param {string} breadcrumbPath - Full path from breadcrumb
   */
  async navigateToBreadcrumb(breadcrumbPath) {
    await this.navigate(breadcrumbPath);
  }

  /**
   * Handle deep link from URL
   * Called on page load if ?pathname= exists
   */
  async handleDeepLink(pathname) {
    console.log('[PathNavigator] Handling deep link:', pathname);
    await this.navigate(pathname, { updateURL: false }); // Don't update URL again
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Normalize path (handle trailing slashes, empty strings, etc.)
   */
  _normalizePath(pathname) {
    if (!pathname || pathname === '') {
      return '/';
    }

    // Remove trailing slash (except for root)
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // IMPORTANT: PData expects RELATIVE paths (no leading slash)
    // Only root should be '/', everything else should be 'users/mike', 'projects', etc.
    if (pathname.startsWith('/') && pathname !== '/') {
      pathname = pathname.slice(1); // Remove leading slash
    }

    return pathname;
  }

  /**
   * Infer if path is a file or directory
   * Heuristic: has extension = file, else = directory
   */
  _inferType(pathname) {
    if (pathname === '/') {
      return 'directory';
    }

    // Check if the last segment has an extension
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];

    return lastSegment && lastSegment.includes('.') ? 'file' : 'directory';
  }

  /**
   * Update browser URL without page reload
   */
  _updateURL(pathname) {
    try {
      const url = new URL(window.location);

      if (pathname && pathname !== '/') {
        url.searchParams.set('pathname', pathname);
      } else {
        url.searchParams.delete('pathname');
      }

      window.history.pushState({}, '', url);
      console.log('[PathNavigator] Updated URL:', url.toString());
    } catch (error) {
      console.error('[PathNavigator] Failed to update URL:', error);
    }
  }

  /**
   * Fetch data for the current location
   * Handles both files and directories
   */
  async _fetchData(pathname, type) {
    // Cancel any pending fetch
    if (this.pendingFetch) {
      this.pendingFetch.abort?.();
      this.pendingFetch = null;
    }

    try {
      if (type === 'directory') {
        // Fetch directory listing
        console.log('[PathNavigator] Fetching directory listing:', pathname);
        this.pendingFetch = this.store.dispatch(
          apiSlice.endpoints.getDirectoryListing.initiate(pathname, { forceRefetch: true })
        );
        await this.pendingFetch.unwrap();
        console.log('[PathNavigator] Directory listing loaded');
      } else {
        // Fetch file content
        console.log('[PathNavigator] Fetching file content:', pathname);

        // Load the file content using fileThunks
        const { fileThunks } = await import('../store/slices/fileSlice.js');
        await this.store.dispatch(fileThunks.loadFileContent(pathname));
        console.log('[PathNavigator] File content loaded');

        // Also fetch the parent directory listing for the file browser
        const parentPath = this._getParentPath(pathname);
        if (parentPath) {
          this.pendingFetch = this.store.dispatch(
            apiSlice.endpoints.getDirectoryListing.initiate(parentPath, { forceRefetch: true })
          );
          await this.pendingFetch.unwrap();
          console.log('[PathNavigator] Parent directory listing loaded');
        }
      }

      this.pendingFetch = null;
    } catch (error) {
      console.error('[PathNavigator] Failed to fetch data:', error);

      // Extract detailed error information
      let errorMessage = 'Failed to load path';
      if (error.data && error.data.error) {
        errorMessage = error.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error('[PathNavigator] Error details:', {
        status: error.status,
        message: errorMessage,
        data: error.data,
        pathname: pathname
      });

      this.store.dispatch(setError({
        message: errorMessage,
        code: error.status || 'FETCH_ERROR'
      }));
      this.pendingFetch = null;
    }
  }

  /**
   * Get parent path
   */
  _getParentPath(pathname) {
    if (!pathname || pathname === '/') {
      return null;
    }

    const segments = pathname.split('/').filter(Boolean);
    segments.pop();

    // Return relative path (no leading slash) to match PData expectations
    return segments.length === 0 ? '/' : segments.join('/');
  }
}

// Singleton instance (will be initialized with store)
let pathNavigator = null;

export function initializePathNavigator(store, options = {}) {
  if (!pathNavigator) {
    pathNavigator = new PathNavigator(store, options);
    console.log('[PathNavigator] Initialized with options:', options);
  }
  return pathNavigator;
}

export function getPathNavigator() {
  if (!pathNavigator) {
    throw new Error('[PathNavigator] Not initialized. Call initializePathNavigator(store) first.');
  }
  return pathNavigator;
}
