/**
 * pathSlice.v2.js - Simplified Path State Management
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
  error: null
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
    }
  },

  extraReducers: (builder) => {
    // Listen to RTK Query directory listing results
    builder
      .addMatcher(
        apiSlice.endpoints.getDirectoryListing.matchPending,
        (state) => {
          state.status = 'loading';
        }
      )
      .addMatcher(
        apiSlice.endpoints.getDirectoryListing.matchFulfilled,
        (state, action) => {
          const { pathname, dirs, files } = action.payload;

          // Only update if this is still the current path
          if (state.current.pathname === pathname && state.current.type === 'directory') {
            state.current.listing = { dirs, files };
            state.status = 'succeeded';
          }
        }
      )
      .addMatcher(
        apiSlice.endpoints.getDirectoryListing.matchRejected,
        (state, action) => {
          state.status = 'failed';
          state.error = {
            message: action.error?.message || 'Failed to load directory',
            code: action.error?.code || 'FETCH_ERROR'
          };
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
  clearError
} = pathSlice.actions;

// Selectors
export const selectCurrentPath = (state) => state.pathV2.current;
export const selectPathHistory = (state) => state.pathV2.history;
export const selectHistoryIndex = (state) => state.pathV2.historyIndex;
export const selectCanGoBack = (state) => state.pathV2.historyIndex > 0;
export const selectCanGoForward = (state) => state.pathV2.historyIndex < state.pathV2.history.length - 1;
export const selectPathStatus = (state) => state.pathV2.status;
export const selectPathError = (state) => state.pathV2.error;

/**
 * Parse pathname into breadcrumb segments
 * Returns: Array<{ name: string, path: string }>
 */
export const selectBreadcrumbs = (state) => {
  const pathname = state.pathV2.current.pathname;
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
  const pathname = state.pathV2.current.pathname;
  if (!pathname || pathname === '/') {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  segments.pop();

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
};

export default pathSlice.reducer;
