/**
 * pathSlice.js - Consolidated Path State Management (v2 with v1 compatibility)
 *
 * Design Principles:
 * 1. Single source of truth for current location
 * 2. Navigation history stack for back/forward
 * 3. Clear separation: state updates vs data fetching
 * 4. No render-time side effects
 * 5. Predictable state transitions
 */

import { createSlice } from '/node_modules/@reduxjs/toolkit/dist/redux-toolkit.browser.mjs';
import { apiSlice } from '../apiSlice.js';
import { fileThunks } from './fileSlice.js';
import { getParentPath } from '../../utils/pathUtils.js';

// Safe logger that falls back to no-op if window.APP is not available
const log = (() => {
    if (typeof window !== 'undefined' && window.APP?.services?.log) {
        return window.APP.services.log.createLogger('PathSlice');
    }
    return {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
    };
})();

/**
 * Path State Model
 *
 * current: {
 *   pathname: string,           // Current path (e.g., "users/mike/docs")
 *   type: 'file' | 'directory', // What we're viewing
 *   listing: null | {           // Directory listing (null for files)
 *     dirs: string[],
 *     files: string[]
 *   }
 * }
 *
 * history: Array<{               // Navigation history
 *   pathname: string,
 *   type: 'file' | 'directory',
 *   timestamp: number
 * }>
 *
 * historyIndex: number           // Current position in history (-1 = no history)
 *
 * status: 'idle' | 'loading' | 'succeeded' | 'failed'
 * error: null | { message: string, code: string }
 */

const initialState = {
  current: {
    pathname: null,
    type: 'directory',
    listing: null
  },
  history: [],
  historyIndex: -1,
  status: 'idle',
  error: null,
  // Legacy state (kept for compatibility with v1)
  isSaving: false,
  topLevelDirs: [],
  currentListing: {
    pathname: null,
    dirs: [],
    files: [],
  }
};

const pathSlice = createSlice({
  name: 'path',
  initialState,
  reducers: {
    /**
     * Navigate to a new path
     * This is the ONLY way to change current path
     */
    navigateTo: (state, action) => {
      const { pathname, type } = action.payload;

      // Clear any forward history when navigating to new location
      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      // Add to history
      state.history.push({
        pathname,
        type,
        timestamp: Date.now()
      });
      state.historyIndex = state.history.length - 1;

      // Update current location
      state.current = {
        pathname,
        type,
        listing: null // Will be loaded separately
      };

      // Reset status for new navigation
      state.status = 'idle';
      state.error = null;
    },

    /**
     * Navigate back in history
     */
    navigateBack: (state) => {
      if (state.historyIndex > 0) {
        state.historyIndex--;
        const historyItem = state.history[state.historyIndex];
        state.current = {
          pathname: historyItem.pathname,
          type: historyItem.type,
          listing: null
        };
        state.status = 'idle';
        state.error = null;
      }
    },

    /**
     * Navigate forward in history
     */
    navigateForward: (state) => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const historyItem = state.history[state.historyIndex];
        state.current = {
          pathname: historyItem.pathname,
          type: historyItem.type,
          listing: null
        };
        state.status = 'idle';
        state.error = null;
      }
    },

    /**
     * Update listing for current directory
     * Called after successful directory fetch
     */
    setListing: (state, action) => {
      const { pathname, dirs, files } = action.payload;

      // Only update if this is still the current path
      if (state.current.pathname === pathname) {
        state.current.listing = { dirs, files };
        state.status = 'succeeded';
      }
    },

    /**
     * Set loading state
     */
    setLoading: (state) => {
      state.status = 'loading';
      state.error = null;
    },

    /**
     * Set error state
     */
    setError: (state, action) => {
      state.status = 'failed';
      state.error = action.payload;
    },

    /**
     * Clear error
     */
    clearError: (state) => {
      state.error = null;
      if (state.status === 'failed') {
        state.status = 'idle';
      }
    },

    // Legacy reducers for v1 compatibility
    /**
     * Set saving state
     */
    setSaving: (state, action) => {
      state.isSaving = action.payload;
    },

    /**
     * Set top-level directories
     */
    setTopDirs: (state, action) => {
      state.topLevelDirs = action.payload;
    },

    /**
     * Legacy navigation action (v1 compatibility)
     */
    _navigateToPath: (state, action) => {
      const { pathname, isDirectory } = action.payload;
      log.debug('PATH', ` _navigateToPath reducer - Setting path to '${pathname}', isDirectory: ${isDirectory}`);

      // Update v2 state
      state.current = {
        pathname,
        type: isDirectory ? 'directory' : 'file',
        listing: null
      };

      // Update legacy state
      if (pathname === '' || pathname === '/') {
        state.currentListing = { pathname: null, dirs: [], files: [] };
      }
      state.status = 'idle';
    },

    /**
     * Set current path (v1 compatibility)
     */
    setCurrentPath: (state, action) => {
      const { pathname, isDirectory } = action.payload;
      state.current = {
        pathname,
        type: isDirectory ? 'directory' : 'file',
        listing: null
      };
    }
  },

  extraReducers: (builder) => {
    builder
      // Handle top-level directories loading
      .addMatcher(
        apiSlice.endpoints.getTopLevelDirectories.matchPending,
        (state) => {
          state.status = 'loading';
          state.error = null;
        }
      )
      .addMatcher(
        apiSlice.endpoints.getTopLevelDirectories.matchFulfilled,
        (state, action) => {
          state.status = 'succeeded';
          state.topLevelDirs = action.payload || [];
          state.error = null;
        }
      )
      .addMatcher(
        apiSlice.endpoints.getTopLevelDirectories.matchRejected,
        (state, action) => {
          state.status = 'failed';
          state.error = { message: action.error?.message || 'Failed to load top-level directories', code: 'FETCH_ERROR' };
          state.topLevelDirs = [];
        }
      )

      // Handle directory listing
      .addMatcher(
        apiSlice.endpoints.getDirectoryListing.matchPending,
        (state) => {
          state.status = 'loading';
          state.error = null;
        }
      )
      .addMatcher(
        apiSlice.endpoints.getDirectoryListing.matchFulfilled,
        (state, action) => {
          const { pathname, dirs, files } = action.payload;
          console.log('[pathSlice REDUCER] getDirectoryListing.matchFulfilled:', {
            pathname,
            dirsCount: dirs?.length,
            filesCount: files?.length,
            currentPathname: state.current.pathname,
            currentType: state.current.type
          });
          state.status = 'succeeded';

          // Update v2 state
          if (state.current.pathname === pathname && state.current.type === 'directory') {
            state.current.listing = { dirs, files };
          }

          // Update legacy state (currentListing)
          state.currentListing = { pathname, dirs: dirs || [], files: files || [] };
          state.error = null;
        }
      )
      .addMatcher(
        apiSlice.endpoints.getDirectoryListing.matchRejected,
        (state, action) => {
          state.status = 'failed';
          state.error = { message: action.error?.message || 'Failed to load directory', code: 'FETCH_ERROR' };
          state.currentListing = { pathname: action.meta.arg, dirs: [], files: [] };
        }
      )

      // Handle file saving
      .addMatcher(
        apiSlice.endpoints.saveFile.matchPending,
        (state) => {
          state.isSaving = true;
        }
      )
      .addMatcher(
        apiSlice.endpoints.saveFile.matchFulfilled,
        (state) => {
          state.isSaving = false;
        }
      )
      .addMatcher(
        apiSlice.endpoints.saveFile.matchRejected,
        (state, action) => {
          state.isSaving = false;
          state.error = { message: action.error?.message || 'Failed to save file', code: 'SAVE_ERROR' };
        }
      )

      // Handle logout - clear path state
      .addMatcher(
        apiSlice.endpoints.logout.matchFulfilled,
        (state) => {
          console.log('[PathSlice] Clearing path state on logout');
          state.current = { pathname: null, type: 'directory', listing: null };
          state.history = [];
          state.historyIndex = -1;
          state.topLevelDirs = [];
          state.currentListing = { pathname: null, dirs: [], files: [] };
          state.status = 'idle';
          state.error = null;
          state.isSaving = false;
        }
      );
  }
});

export const {
  navigateTo,
  navigateBack,
  navigateForward,
  setListing,
  setLoading,
  setError,
  clearError,
  setSaving,
  setTopDirs,
  _navigateToPath,
  setCurrentPath
} = pathSlice.actions;

// v2 Selectors (use state.path since we're replacing pathV2 with path)
export const selectCurrentPath = (state) => state.path.current;
export const selectPathHistory = (state) => state.path.history;
export const selectHistoryIndex = (state) => state.path.historyIndex;
export const selectCanGoBack = (state) => state.path.historyIndex > 0;
export const selectCanGoForward = (state) => state.path.historyIndex < state.path.history.length - 1;
export const selectPathStatus = (state) => state.path.status;
export const selectPathError = (state) => state.path.error;

// Legacy selectors (v1 compatibility)
export const selectCurrentPathname = (state) => state.path.current.pathname;
export const selectIsDirectorySelected = (state) => state.path.current.type === 'directory';
export const selectIsSaving = (state) => state.path.isSaving;
export const selectTopLevelDirs = (state) => state.path.topLevelDirs;
export const selectCurrentListing = (state) => state.path.currentListing;

/**
 * Parse pathname into breadcrumb segments
 * Returns: Array<{ name: string, path: string }>
 */
export const selectBreadcrumbs = (state) => {
  const pathname = state.path.current.pathname;
  if (!pathname || pathname === '/') {
    return [{ name: 'Root', path: '/' }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [{ name: 'Root', path: '/' }];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    breadcrumbs.push({
      name: segment,
      path: currentPath
    });
  }

  return breadcrumbs;
};

/**
 * Get parent directory path
 */
export const selectParentPath = (state) => {
  const pathname = state.path.current.pathname;
  if (!pathname || pathname === '/') {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  segments.pop();

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
};

// Enhanced thunks that use RTK Query
export const pathThunks = {
  /**
   * Universal navigation thunk. Updates path state and fetches relevant data.
   */
  navigateToPath: ({ pathname, isDirectory }) => async (dispatch, getState) => {
    log.debug('PATH', ` navigateToPath called with pathname='${pathname}', isDirectory=${isDirectory}`);

    // Dispatch the synchronous action to update the path immediately
    dispatch(_navigateToPath({ pathname, isDirectory }));
    log.debug('PATH', ` Path state updated to pathname='${pathname}', isDirectory=${isDirectory}`);

    // Update the browser URL to reflect the current path
    try {
      if (pathname && pathname !== '/' && pathname !== '') {
        const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        const cleanPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
        const newUrl = `${baseUrl}?pathname=${cleanPathname}`;
        window.history.replaceState({}, '', newUrl);
        console.log(`[Path] Updated URL to: ${newUrl}`);
      } else {
        const url = new URL(window.location);
        url.searchParams.delete('pathname');
        window.history.replaceState({}, '', url);
        console.log(`[Path] Updated URL to: ${url.toString()}`);
      }
    } catch (error) {
      console.error('[Path] Failed to update URL:', error);
    }

    // Check if user is authenticated before making API calls
    const state = getState();
    const isAuthenticated = state.auth?.isAuthenticated;
    const authChecked = state.auth?.authChecked;

    log.debug('PATH', ` Auth check: authChecked=${authChecked}, isAuthenticated=${isAuthenticated}`);

    if (!authChecked || !isAuthenticated) {
      log.debug('PATH', ' Skipping data fetch - user not authenticated');
      return;
    }

    if (isDirectory) {
      log.debug('PATH', ` Fetching directory listing for: '${pathname}'`);
      console.log('[pathThunks DEBUG] Fetching directory listing for:', pathname);
      try {
        // Force refetch to ensure reducer updates currentListing even for cached paths
        const result = await dispatch(apiSlice.endpoints.getDirectoryListing.initiate(pathname, { forceRefetch: true })).unwrap();
        console.log('[pathThunks DEBUG] Directory listing result:', result);
        log.debug('PATH', ` Directory listing fetched successfully:`, result);
      } catch (error) {
        console.error('[pathThunks DEBUG] Directory listing error:', error);
        log.error('PATH', ` Failed to fetch directory listing for ${pathname}:`, error);
      }
    } else {
      log.debug('PATH', ` Loading file content for: '${pathname}'`);
      try {
        await dispatch(fileThunks.loadFileContent(pathname));
        log.debug('PATH', ` File content loaded successfully for: '${pathname}'`);

        const parentPath = getParentPath(pathname);
        log.debug('PATH', ` Parent path calculated as: '${parentPath}'`);
        if (parentPath) {
          log.debug('PATH', ` Fetching parent directory listing for: '${parentPath}'`);
          // Force refetch to ensure reducer updates currentListing
          const parentResult = await dispatch(apiSlice.endpoints.getDirectoryListing.initiate(parentPath, { forceRefetch: true })).unwrap();
          log.debug('PATH', ` Parent directory listing fetched:`, parentResult);
        }
      } catch (error) {
        log.error('PATH', ` Failed to load file content for ${pathname}:`, error);
      }
    }
  },

  /**
   * Fetch listing by path using RTK Query
   */
  fetchListingByPath: ({ pathname, isDirectory }) => async (dispatch, getState) => {
    return dispatch(pathThunks.navigateToPath({ pathname, isDirectory }));
  },

  /**
   * Load top-level directories using RTK Query
   */
  loadTopLevelDirectories: () => async (dispatch, getState) => {
    log.debug('PATH', ` loadTopLevelDirectories called`);

    const state = getState();
    const isAuthenticated = state.auth?.isAuthenticated;
    const authChecked = state.auth?.authChecked;

    log.debug('PATH', ` Top-level dirs auth check: authChecked=${authChecked}, isAuthenticated=${isAuthenticated}`);

    if (!authChecked || !isAuthenticated) {
      log.debug('PATH', ' Skipping top-level directories fetch - user not authenticated');
      return [];
    }

    try {
      log.debug('PATH', ` Fetching top-level directories...`);
      const result = await dispatch(apiSlice.endpoints.getTopLevelDirectories.initiate()).unwrap();
      log.debug('PATH', ` Top-level directories fetched:`, result);
      return result;
    } catch (error) {
      log.error('PATH', ' Failed to load top-level directories:', error);
      return [];
    }
  },
};

// Export the slice for access to actions
export { pathSlice };

// Export reducer
export default pathSlice.reducer;

console.log('[Path Slice] v2 path slice initialized (with v1 compatibility)');
