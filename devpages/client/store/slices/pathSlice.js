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
import { filesApi } from '../api.js';
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
     */
    navigateTo: (state, action) => {
      const { pathname, type } = action.payload;

      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      state.history.push({
        pathname,
        type,
        timestamp: Date.now()
      });
      state.historyIndex = state.history.length - 1;

      state.current = {
        pathname,
        type,
        listing: null
      };

      state.status = 'idle';
      state.error = null;
    },

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

    setListing: (state, action) => {
      const { pathname, dirs, files } = action.payload;

      if (state.current.pathname === pathname) {
        state.current.listing = { dirs, files };
        state.status = 'succeeded';
      }
    },

    setLoading: (state) => {
      state.status = 'loading';
      state.error = null;
    },

    setError: (state, action) => {
      state.status = 'failed';
      state.error = action.payload;
    },

    clearError: (state) => {
      state.error = null;
      if (state.status === 'failed') {
        state.status = 'idle';
      }
    },

    setSaving: (state, action) => {
      state.isSaving = action.payload;
    },

    setTopDirs: (state, action) => {
      state.topLevelDirs = action.payload;
      state.status = 'succeeded';
    },

    _navigateToPath: (state, action) => {
      const { pathname, isDirectory } = action.payload;
      log.debug('PATH', ` _navigateToPath reducer - Setting path to '${pathname}', isDirectory: ${isDirectory}`);

      state.current = {
        pathname,
        type: isDirectory ? 'directory' : 'file',
        listing: null
      };

      if (pathname === '' || pathname === '/') {
        state.currentListing = { pathname: null, dirs: [], files: [] };
      }
      state.status = 'idle';
    },

    setCurrentPath: (state, action) => {
      const { pathname, isDirectory } = action.payload;
      state.current = {
        pathname,
        type: isDirectory ? 'directory' : 'file',
        listing: null
      };
    },

    // New reducers for async operations (replacing extraReducers)
    topDirsLoading: (state) => {
      state.status = 'loading';
      state.error = null;
    },

    topDirsSuccess: (state, action) => {
      state.status = 'succeeded';
      state.topLevelDirs = action.payload || [];
      state.error = null;
    },

    topDirsFailure: (state, action) => {
      state.status = 'failed';
      state.error = { message: action.payload || 'Failed to load top-level directories', code: 'FETCH_ERROR' };
      state.topLevelDirs = [];
    },

    directoryListingLoading: (state) => {
      state.status = 'loading';
      state.error = null;
    },

    directoryListingSuccess: (state, action) => {
      const { pathname, dirs, files } = action.payload;
      console.log('[pathSlice] directoryListingSuccess:', {
        pathname,
        dirsCount: dirs?.length,
        filesCount: files?.length,
        currentPathname: state.current.pathname,
        currentType: state.current.type
      });
      state.status = 'succeeded';

      if (state.current.pathname === pathname && state.current.type === 'directory') {
        state.current.listing = { dirs, files };
      }

      state.currentListing = { pathname, dirs: dirs || [], files: files || [] };
      state.error = null;
    },

    directoryListingFailure: (state, action) => {
      state.status = 'failed';
      state.error = { message: action.payload?.message || 'Failed to load directory', code: 'FETCH_ERROR' };
      state.currentListing = { pathname: action.payload?.pathname, dirs: [], files: [] };
    },

    saveFileStart: (state) => {
      state.isSaving = true;
    },

    saveFileSuccess: (state) => {
      state.isSaving = false;
    },

    saveFileFailure: (state, action) => {
      state.isSaving = false;
      state.error = { message: action.payload || 'Failed to save file', code: 'SAVE_ERROR' };
    },

    clearPathState: (state) => {
      console.log('[PathSlice] Clearing path state on logout');
      state.current = { pathname: null, type: 'directory', listing: null };
      state.history = [];
      state.historyIndex = -1;
      state.topLevelDirs = [];
      state.currentListing = { pathname: null, dirs: [], files: [] };
      state.status = 'idle';
      state.error = null;
      state.isSaving = false;
    },
  },
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
  setCurrentPath,
  topDirsLoading,
  topDirsSuccess,
  topDirsFailure,
  directoryListingLoading,
  directoryListingSuccess,
  directoryListingFailure,
  saveFileStart,
  saveFileSuccess,
  saveFileFailure,
  clearPathState,
} = pathSlice.actions;

// Selectors
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

export const selectParentPath = (state) => {
  const pathname = state.path.current.pathname;
  if (!pathname || pathname === '/') {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  segments.pop();

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
};

// Thunks using plain fetch via api.js
export const pathThunks = {
  /**
   * Universal navigation thunk. Updates path state and fetches relevant data.
   */
  navigateToPath: ({ pathname, isDirectory }) => async (dispatch, getState) => {
    log.debug('PATH', ` navigateToPath called with pathname='${pathname}', isDirectory=${isDirectory}`);

    dispatch(_navigateToPath({ pathname, isDirectory }));
    log.debug('PATH', ` Path state updated to pathname='${pathname}', isDirectory=${isDirectory}`);

    // Update browser URL
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

    // Check authentication
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
      dispatch(directoryListingLoading());
      try {
        const result = await filesApi.getDirectoryListing(pathname);
        console.log('[pathThunks] Directory listing result:', result);
        dispatch(directoryListingSuccess(result));
        log.debug('PATH', ` Directory listing fetched successfully:`, result);
      } catch (error) {
        console.error('[pathThunks] Directory listing error:', error);
        dispatch(directoryListingFailure({ message: error.message, pathname }));
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
          dispatch(directoryListingLoading());
          const parentResult = await filesApi.getDirectoryListing(parentPath);
          dispatch(directoryListingSuccess(parentResult));
          log.debug('PATH', ` Parent directory listing fetched:`, parentResult);
        }
      } catch (error) {
        log.error('PATH', ` Failed to load file content for ${pathname}:`, error);
      }
    }
  },

  fetchListingByPath: ({ pathname, isDirectory }) => async (dispatch, getState) => {
    return dispatch(pathThunks.navigateToPath({ pathname, isDirectory }));
  },

  /**
   * Load top-level directories
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

    dispatch(topDirsLoading());
    try {
      log.debug('PATH', ` Fetching top-level directories...`);
      const result = await filesApi.getTopLevelDirectories();
      log.debug('PATH', ` Top-level directories fetched:`, result);
      dispatch(topDirsSuccess(result));
      return result;
    } catch (error) {
      log.error('PATH', ' Failed to load top-level directories:', error);
      dispatch(topDirsFailure(error.message));
      return [];
    }
  },

  /**
   * Fetch directory listing without navigation (for sibling panels, etc.)
   */
  fetchDirectoryListing: (pathname) => async (dispatch, getState) => {
    const state = getState();
    if (!state.auth?.isAuthenticated) {
      return null;
    }

    dispatch(directoryListingLoading());
    try {
      const result = await filesApi.getDirectoryListing(pathname);
      dispatch(directoryListingSuccess(result));
      return result;
    } catch (error) {
      dispatch(directoryListingFailure({ message: error.message, pathname }));
      return null;
    }
  },
};

export { pathSlice };
export default pathSlice.reducer;

console.log('[Path Slice] Plain Redux path slice initialized (with v1 compatibility)');
