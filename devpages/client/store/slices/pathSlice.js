/**
 * New Path Slice - RTK Query Integration
 * 
 * This replaces the old pathSlice.js with RTK Query integration:
 * 1. Uses RTK Query hooks for all file/directory operations
 * 2. Eliminates manual thunks and API calls
 * 3. Provides automatic caching and error handling
 */

import { createSlice } from '@reduxjs/toolkit';
import { apiSlice } from '../apiSlice.js';
import { fileThunks } from '/client/store/slices/fileSlice.js';
import { getParentPath } from '/client/utils/pathUtils.js';

// Initial state
const initialState = {
  // Current path information
  currentPathname: null,
  isDirectorySelected: false,
  
  // UI state
  isSaving: false,
  
  // Legacy state (kept for compatibility)
  topLevelDirs: [],
  currentListing: {
    pathname: null,
    dirs: [],
    files: [],
  },
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// Path slice
export const pathSlice = createSlice({
  name: 'path',
  initialState,
  reducers: {
    // Set current path
    setCurrentPath: (state, action) => {
      const { pathname, isDirectory } = action.payload;
      state.currentPathname = pathname;
      state.isDirectorySelected = isDirectory;
    },

    // New reducer for navigation without fetching
    _navigateToPath: (state, action) => {
        const { pathname, isDirectory } = action.payload;
        state.currentPathname = pathname;
        state.isDirectorySelected = isDirectory;
        // When navigating to the root, the listing is conceptually empty,
        // and the UI should use topLevelDirs instead.
        if (pathname === '' || pathname === '/') {
            state.currentListing = {
                pathname: null,
                dirs: [],
                files: [],
            };
        }
        state.status = 'idle'; // Reset status as no fetch is occurring
    },
    
    // Set saving state
    setSaving: (state, action) => {
      state.isSaving = action.payload;
    },
    
    // Clear any errors
    clearError: (state) => {
      state.error = null;
    },
    
    // Legacy action for compatibility
    setTopDirs: (state, action) => {
      state.topLevelDirs = action.payload;
    },
  },
  
  // Handle RTK Query actions
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
          state.error = action.error?.message || 'Failed to load top-level directories';
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
          state.status = 'succeeded';
          state.currentListing = {
            pathname: action.payload.pathname,
            dirs: action.payload.dirs || [],
            files: action.payload.files || [],
          };
          state.error = null;
        }
      )
      .addMatcher(
        apiSlice.endpoints.getDirectoryListing.matchRejected,
        (state, action) => {
          state.status = 'failed';
          state.error = action.error?.message || 'Failed to load directory listing';
          state.currentListing = {
            pathname: action.meta.arg,
            dirs: [],
            files: [],
          };
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
          state.error = action.error?.message || 'Failed to save file';
        }
      );
  },
});

// Export actions
export const { setCurrentPath, _navigateToPath, setSaving, clearError, setTopDirs } = pathSlice.actions;

// Selectors
export const selectCurrentPathname = (state) => state.path.currentPathname;
export const selectIsDirectorySelected = (state) => state.path.isDirectorySelected;
export const selectIsSaving = (state) => state.path.isSaving;
export const selectTopLevelDirs = (state) => state.path.topLevelDirs;
export const selectCurrentListing = (state) => state.path.currentListing;
export const selectPathStatus = (state) => state.path.status;
export const selectPathError = (state) => state.path.error;

// Enhanced thunks that use RTK Query
export const pathThunks = {
  /**
   * Universal navigation thunk. Updates path state and fetches relevant data.
   */
  navigateToPath: ({ pathname, isDirectory }) => async (dispatch, getState) => {
    // Dispatch the synchronous action to update the path immediately
    dispatch(_navigateToPath({ pathname, isDirectory }));

    // Update the browser URL to reflect the current path
    try {
      const url = new URL(window.location);
      if (pathname && pathname !== '/' && pathname !== '') {
        url.searchParams.set('pathname', pathname);
      } else {
        url.searchParams.delete('pathname');
      }
      window.history.replaceState({}, '', url);
      console.log(`[Path] Updated URL to: ${url.toString()}`);
    } catch (error) {
      console.error('[Path] Failed to update URL:', error);
    }

    if (isDirectory) {
      // If it's a directory, fetch its listing
      try {
        await dispatch(apiSlice.endpoints.getDirectoryListing.initiate(pathname)).unwrap();
      } catch (error) {
        console.error(`[Path] Failed to fetch directory listing for ${pathname}:`, error);
      }
    } else {
      // If it's a file, load its content and its parent directory listing
      try {
        await dispatch(fileThunks.loadFileContent(pathname));
        const parentPath = getParentPath(pathname);
        if (parentPath) {
          await dispatch(apiSlice.endpoints.getDirectoryListing.initiate(parentPath)).unwrap();
        }
      } catch (error) {
        console.error(`[Path] Failed to load file content for ${pathname}:`, error);
      }
    }
  },

  /**
   * Fetch listing by path using RTK Query
   * This is a compatibility layer for existing code
   */
  fetchListingByPath: ({ pathname, isDirectory }) => async (dispatch, getState) => {
    // This is now just a wrapper around the universal navigateToPath thunk
    return dispatch(pathThunks.navigateToPath({ pathname, isDirectory }));
  },
  
  /**
   * Load top-level directories using RTK Query
   * This is a compatibility layer for existing code
   */
  loadTopLevelDirectories: () => async (dispatch) => {
    try {
      const result = await dispatch(apiSlice.endpoints.getTopLevelDirectories.initiate()).unwrap();
      return result;
    } catch (error) {
      console.error('[Path] Failed to load top-level directories:', error);
      // Error is handled by the extraReducers
      return [];
    }
  },
};

// Export reducer
export default pathSlice.reducer;

console.log('[Path Slice] New RTK Query path slice initialized');
