/**
 * pathSlice.v2.test.js - Test version without apiSlice dependency
 *
 * This is a standalone version for testing that doesn't depend on apiSlice.
 * For production use, import pathSlice.v2.js instead.
 */

import { createSlice } from '@reduxjs/toolkit';

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
    }
  }
  // No extraReducers - testing without API integration
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
