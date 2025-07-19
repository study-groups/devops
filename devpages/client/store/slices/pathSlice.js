// Cache buster: 2025-01-19-12:35 - ENHANCED REDUCER APPROACH
import { createSlice, createAsyncThunk } from '/packages/devpages-statekit/src/index.js';
import { globalFetch } from '/client/globalFetch.js';
import { getParentPath } from '/client/utils/pathUtils.js';

// Helper function to get initial path state from URL and localStorage
function getInitialPathState() {
  let currentPathname = null;
  let isDirectorySelected = false;

  try {
    // Check if window is available (browser environment)
    if (typeof window !== 'undefined' && window.location) {
      // Get parameters from URL first (highest priority)
      const params = new URLSearchParams(window.location.search);
      const pathname = params.get('pathname') || null;
      
      if (pathname) {
        // Consider it a file if it has an extension
        isDirectorySelected = !/\.[^/]+$/.test(pathname);
        currentPathname = pathname;
        console.log(`[pathSlice] Loaded pathname from URL: "${pathname}" (${isDirectorySelected ? 'directory' : 'file'})`);
      } else if (typeof localStorage !== 'undefined') {
        // If no URL parameter, try to restore from localStorage
        try {
          const stored = localStorage.getItem('devpages_last_opened_file');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.pathname) {
              currentPathname = parsed.pathname;
              isDirectorySelected = parsed.isDirectory !== false; // Default to true if not specified
              console.log(`[pathSlice] No URL parameter, restored from localStorage: "${currentPathname}" (${isDirectorySelected ? 'directory' : 'file'})`);
            }
          }
        } catch (error) {
          console.warn('[pathSlice] Error loading last opened file from localStorage:', error);
        }
      }
    } else {
      console.log('[pathSlice] Window or location not available during initialization, using defaults');
    }
  } catch (error) {
    console.error('[pathSlice] Error loading initial path state:', error);
  }

  return {
    currentPathname,
    isDirectorySelected,
    isSaving: false,
    currentListing: {
      pathname: null,
      dirs: [],
      files: [],
    },
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
  };
}

// Use a default state that will be updated when the slice is actually used
const initialState = {
  currentPathname: null,
  isDirectorySelected: false,
  isSaving: false,
  currentListing: {
    pathname: null,
    dirs: [],
    files: [],
  },
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// Async thunk for fetching directory listings
export const fetchListingByPath = createAsyncThunk(
  'path/fetchListing',
  async ({ pathname, isDirectory }, { dispatch, getState }) => {
    try {
      // Prevent API call if the path is invalid
      if (typeof pathname !== 'string') {
        throw new Error('Invalid pathname provided for fetching listing.');
      }
        
      // For files, we need the parent directory listing.
      // For directories, we list the directory itself.
      const pathToList = isDirectory ? pathname : (getParentPath(pathname) || '');
      
      console.log(`[pathSlice] Fetching listing for path: "${pathToList}"`);
      
      let response;
      try {
        // Use the API method that properly handles org parameter
        const { api } = await import('/client/api.js');
        const listing = await api.fetchDirectoryListing(pathToList);
        
        // Return the listing directly since api.fetchDirectoryListing already handles the response
        const result = { listing, requestedPath: pathname, isDirectory, listedPath: pathToList };
        console.log(`[pathSlice] Returning to reducer:`, result);
        return result;
      } catch (fetchError) {
        console.error(`[pathSlice] API error fetching listing:`, fetchError);
        throw new Error(`API error: ${fetchError.message}`);
      }
    } catch (error) {
      console.error(`[pathSlice] Thunk error for path "${pathname}":`, error);
      console.error(`[pathSlice] Error details:`, { pathname, isDirectory, error: error.message, stack: error.stack });
      throw new Error(error.message);
    }
  }
);

// Async thunk for saving the current file
export const saveCurrentFile = createAsyncThunk(
  'path/saveFile',
  async (_, { getState, dispatch }) => {
    const state = getState().path;
    const { currentPathname, isDirectorySelected } = state;

    if (isDirectorySelected || !currentPathname) {
      throw new Error('Cannot save: No file selected.');
    }

    // We need to get the file content. This is a challenge since
    // pathSlice doesn't own content. For now, we assume another slice
    // holds it and we can access it via getState().
    const content = getState().editor?.content || '';

    try {
      const response = await globalFetch('/api/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: currentPathname, content }),
      });
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(error.message);
    }
  }
);

console.log('[pathSlice] 🚀 CREATING SLICE...');
console.log('[pathSlice] fetchListingByPath object:', fetchListingByPath);
console.log('[pathSlice] Expected action types:', {
  pending: fetchListingByPath.pending?.type,
  fulfilled: fetchListingByPath.fulfilled?.type,  
  rejected: fetchListingByPath.rejected?.type
});

let pathSlice;
try {
  pathSlice = createSlice({
  name: 'path',
  initialState,
  reducers: {
    setInitialPath: (state, action) => {
      const { pathname, isDirectory } = action.payload;
      state.currentPathname = pathname;
      state.isDirectorySelected = isDirectory;
      state.status = 'idle'; // Reset status to allow fetching
    },
    
    // Simple actions for hybrid approach
    setCurrentPath: (state, action) => {
      const { pathname, isDirectory } = action.payload;
      state.currentPathname = pathname;
      state.isDirectorySelected = isDirectory;
      return state;
    },
    
    updateListing: (state, action) => {
      state.currentListing = action.payload;
      return state;
    },
    
    clearError: (state) => {
      state.error = null;
      return state;
    },
  },
});
} catch (error) {
  console.error('[pathSlice] ❌ ERROR CREATING SLICE:', error);
  alert('SLICE CREATION ERROR: ' + error.message);
  throw error;
}

console.log('[pathSlice] ✅ SLICE CREATED SUCCESSFULLY:', pathSlice);

// Enhanced reducer to handle async thunk actions that StateKit doesn't support natively
const originalReducer = pathSlice.reducer;
const enhancedReducer = (state = initialState, action) => {
  console.log('[pathSlice] 🔍 ENHANCED REDUCER called with action:', action.type);
  
  // Handle async thunk actions manually
  if (action.type === 'path/fetchListing/pending') {
    console.log('[pathSlice] ⏳ PENDING CASE HIT!');
    return { 
      ...state, 
      status: 'loading',
      // Clear any stale listing data when starting a new fetch
      currentListing: {
        pathname: null,
        dirs: [],
        files: []
      },
      // Keep error cleared during loading
      error: null
    };
  }
  
  if (action.type === 'path/fetchListing/fulfilled') {
    console.log('[pathSlice] ✅ FULFILLED CASE HIT!');
    console.log('[pathSlice] Payload:', action.payload);
    
    const { listing, requestedPath, isDirectory, listedPath } = action.payload;
    
    // Debug logging to track state transitions
    console.log(`[pathSlice] STATE TRANSITION:`);
    console.log(`  - Requested path: '${requestedPath}'`);
    console.log(`  - Listed path: '${listedPath}'`);
    console.log(`  - Is directory: ${isDirectory}`);
    console.log(`  - Listing contents: ${listing.dirs?.length || 0} dirs, ${listing.files?.length || 0} files`);
    console.log(`  - Previous pathname: '${state.currentPathname}'`);
    
    return {
      ...state,
      status: 'succeeded',
      currentListing: { ...listing, pathname: listedPath },
      currentPathname: requestedPath,
      isDirectorySelected: isDirectory,
      error: null
    };
  }
  
  if (action.type === 'path/fetchListing/rejected') {
    console.log('[pathSlice] ❌ REJECTED CASE HIT!');
    return { ...state, status: 'failed', error: action.error || 'Failed to fetch listing' };
  }
  
  if (action.type === 'path/saveFile/pending') {
    return { ...state, isSaving: true, error: null };
  }
  
  if (action.type === 'path/saveFile/fulfilled') {
    return { ...state, isSaving: false, error: null };
  }
  
  if (action.type === 'path/saveFile/rejected') {
    return { ...state, isSaving: false, error: action.error || 'Failed to save file' };
  }
  
  // Fall back to original StateKit reducer for regular actions
  return originalReducer(state, action);
};

export const pathReducer = enhancedReducer;
export const pathActions = pathSlice.actions; 