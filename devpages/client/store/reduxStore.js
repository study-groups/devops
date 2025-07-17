/**
 * Redux Toolkit Store Configuration
 * 
 * This replaces the StateKit implementation with Redux Toolkit for better
 * state management, immutability guarantees, and developer experience.
 */

import { configureStore, createSlice } from '@reduxjs/toolkit';
import { ActionTypes } from '/client/messaging/actionTypes.js';
// --- Auth Slice (Example Migration) ---
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    isAuthenticated: false,
    user: null,
    authChecked: false,
    isInitializing: false,
    error: null,
  },
  reducers: {
    setInitializing: (state, action) => {
      state.isInitializing = action.payload;
    },
    loginSuccess: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.error = null;
      state.isInitializing = false;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.error = null;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.isInitializing = false;
    },
    setAuthChecked: (state, action) => {
      state.authChecked = action.payload;
    },
  },
});

// --- UI Slice ---
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    viewMode: 'preview',
    logVisible: false,
    logHeight: 200,
    logMenuVisible: false,
  },
  reducers: {
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    toggleLogVisibility: (state) => {
      state.logVisible = !state.logVisible;
    },
    setLogHeight: (state, action) => {
      state.logHeight = action.payload;
    },
    toggleLogMenu: (state) => {
      state.logMenuVisible = !state.logMenuVisible;
    },
  },
});

// --- File Slice ---
const fileSlice = createSlice({
  name: 'file',
  initialState: {
    currentPathname: null,
    currentContent: '',
    isDirectorySelected: true,
    isInitialized: false,
    isLoading: false,
    isSaving: false,
    currentListing: null,
    parentListing: null,
    availableTopLevelDirs: [],
    currentOrg: 'pixeljam-arcade',
    error: null,
  },
  reducers: {
    setState: (state, action) => {
      Object.assign(state, action.payload);
    },
    setContent: (state, action) => {
      state.currentContent = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setSaving: (state, action) => {
      state.isSaving = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

// --- Smart Copy Slices ---
const smartCopyASlice = createSlice({
  name: 'smartCopyA',
  initialState: {
    // This slice is not used in the new store, but keeping it for now
    // as it might be re-introduced or removed later.
    // For now, it's just a placeholder.
  },
  reducers: {
    set: (state, action) => action.payload,
  },
});

const smartCopyBSlice = createSlice({
  name: 'smartCopyB',
  initialState: {
    // This slice is not used in the new store, but keeping it for now
    // as it might be re-introduced or removed later.
    // For now, it's just a placeholder.
  },
  reducers: {
    set: (state, action) => action.payload,
  },
});

// --- Settings Slice ---
const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    preview: {
      cssFiles: [],
      enableRootCss: true,
    },
  },
  reducers: {
    setPreviewCssFiles: (state, action) => {
      state.preview.cssFiles = action.payload;
    },
    setRootCssEnabled: (state, action) => {
      state.preview.enableRootCss = action.payload;
    },
  },
});

// --- Store Configuration ---
export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    ui: uiSlice.reducer,
    file: fileSlice.reducer,
    smartCopyA: smartCopyASlice.reducer,
    smartCopyB: smartCopyBSlice.reducer,
    settings: settingsSlice.reducer,
    // TODO: Migrate remaining slices
    // plugins: pluginsSlice.reducer,
    // panels: panelsSlice.reducer,
    // domInspector: domInspectorSlice.reducer,
    // workspace: workspaceSlice.reducer,
    // debugPanel: debugPanelSlice.reducer,
    // logFiltering: logFilteringSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for localStorage serialization
        ignoredActions: ['persist/REHYDRATE', 'persist/PERSIST'],
        // Ignore these field paths in all actions
        ignoredActionPaths: [payload.timestamp],
        // Ignore these paths in the state
        ignoredPaths: ['some.path.to.ignore'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// --- Export Actions ---
export const authActions = authSlice.actions;
export const uiActions = uiSlice.actions;
export const fileActions = fileSlice.actions;
export const smartCopyAActions = smartCopyASlice.actions;
export const smartCopyBActions = smartCopyBSlice.actions;
export const settingsActions = settingsSlice.actions;

// --- Backward Compatibility ---
// Export dispatch and getState for existing code
export const { dispatch, getState } = store;

// --- Persistence Middleware ---
// This will handle localStorage persistence automatically
store.subscribe(() => {
  const state = store.getState();
  
  // Persist auth state
  try {
    localStorage.setItem('devpages_auth_state', JSON.stringify({
      isAuthenticated: state.auth.isAuthenticated,
      user: state.auth.user,
    }));
  } catch (error) {
    console.error('Failed to persist auth state:', error);
  }
  
  // Persist UI state
  try {
    localStorage.setItem('devpages_ui_state', JSON.stringify({
      viewMode: state.ui.viewMode,
      logVisible: state.ui.logVisible,
      logHeight: state.ui.logHeight,
    }));
  } catch (error) {
    console.error('Failed to persist UI state:', error);
  }
  
  // Persist smart copy buffers
  try {
    localStorage.setItem('devpages_smart_copy_a', JSON.stringify(state.smartCopyA));
    localStorage.setItem('devpages_smart_copy_b', JSON.stringify(state.smartCopyB));
  } catch (error) {
    console.error('Failed to persist smart copy state:', error);
  }
});

console.log('[Redux Store] Store configured with Redux Toolkit'); 