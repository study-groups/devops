import { ActionTypes } from '/client/messaging/actionTypes.js';
import { createReducer, createPersister, loadFromStorage } from './reducerUtils.js';

const LOG_VISIBLE_KEY = 'logVisible';
const VIEW_MODE_KEY = 'viewMode';
const LEFT_SIDEBAR_KEY = 'leftSidebarVisible';
const TEXT_VISIBLE_KEY = 'textVisible';
const PREVIEW_VISIBLE_KEY = 'previewVisible';
const THEME_KEY = 'devpages_theme';
const COLOR_SCHEME_KEY = 'devpages_color_scheme';
const DESIGN_DENSITY_KEY = 'devpages_design_density';

// Load visibility states first, then derive viewMode from them
const textVisible = loadFromStorage(TEXT_VISIBLE_KEY, true);
const previewVisible = loadFromStorage(PREVIEW_VISIBLE_KEY, true);

// Derive viewMode from visibility states
let derivedViewMode;
if (textVisible && previewVisible) {
  derivedViewMode = 'split';
} else if (textVisible && !previewVisible) {
  derivedViewMode = 'editor';
} else if (!textVisible && previewVisible) {
  derivedViewMode = 'preview';
} else {
  derivedViewMode = 'blank';
}

// Load initial state from localStorage where applicable
const initialState = {
  isLoading: false,
  logVisible: loadFromStorage(LOG_VISIBLE_KEY, false),
  logMenuVisible: false,
  viewMode: derivedViewMode, // Use derived mode instead of stored viewMode
  theme: 'light', // Force light theme as default
  colorScheme: loadFromStorage(COLOR_SCHEME_KEY, 'system'),
  designDensity: loadFromStorage(DESIGN_DENSITY_KEY, 'comfortable'),
  leftSidebarVisible: loadFromStorage(LEFT_SIDEBAR_KEY, true),
  rightSidebarVisible: false,
  textVisible,
  previewVisible
};

// Create persisters for state that should be saved to localStorage
const persisters = {
  logVisible: createPersister(LOG_VISIBLE_KEY, state => state.logVisible),
  viewMode: createPersister(VIEW_MODE_KEY, state => state.viewMode),
  leftSidebarVisible: createPersister(LEFT_SIDEBAR_KEY, state => state.leftSidebarVisible),
  textVisible: createPersister(TEXT_VISIBLE_KEY, state => state.textVisible),
  previewVisible: createPersister(PREVIEW_VISIBLE_KEY, state => state.previewVisible),
  theme: createPersister(THEME_KEY, state => state.theme),
  colorScheme: createPersister(COLOR_SCHEME_KEY, state => state.colorScheme),
  designDensity: createPersister(DESIGN_DENSITY_KEY, state => state.designDensity)
};

// Define action handlers using the createReducer pattern
export const uiReducer = createReducer(initialState, {
  [ActionTypes.UI_SET_LOADING]: (state, action) => {
    const isLoading = !!action.payload;
    return { ...state, isLoading };
  },
  
  [ActionTypes.UI_SET_LOG_HEIGHT]: (state, action) => {
    if (typeof action.payload === 'number' && action.payload >= 80) {
      try {
        localStorage.setItem('logHeight', String(action.payload));
      } catch (e) {
        console.error('[UI Reducer] Failed to save log height:', e);
      }
      return { ...state, logHeight: action.payload };
    }
    return state;
  },
  
  [ActionTypes.UI_SET_LOG_VISIBILITY]: (state, action) => {
    try {
      localStorage.setItem('logVisible', String(action.payload));
    } catch (e) {
      console.error('[UI Reducer] Failed to save log visibility:', e);
    }
    return { ...state, logVisible: !!action.payload };
  },
  
  [ActionTypes.UI_TOGGLE_LOG_VISIBILITY]: (state) => {
    const newVisible = !state.logVisible;
    try {
      localStorage.setItem('logVisible', String(newVisible));
    } catch (e) {
      console.error('[UI Reducer] Failed to save log visibility:', e);
    }
    return { ...state, logVisible: newVisible };
  },

  [ActionTypes.UI_TOGGLE_LOG_MENU]: (state) => {
    return { ...state, logMenuVisible: !state.logMenuVisible };
  },
  
  [ActionTypes.UI_SET_VIEW_MODE]: (state, action) => {
    // Extract mode correctly based on payload structure
    const viewMode = action.payload?.viewMode || action.payload;
    
    // Validate viewMode is a valid option
    if (typeof viewMode === 'string' && ['preview', 'split'].includes(viewMode)) {
      const newState = { ...state, viewMode };
      persisters.viewMode(newState);
      return newState;
    }
    
    console.warn(`[Reducer UI_SET_VIEW_MODE] Invalid view mode: ${viewMode}`);
    return state;
  },

  [ActionTypes.UI_TOGGLE_LEFT_SIDEBAR]: (state) => {
    return { ...state, leftSidebarVisible: !state.leftSidebarVisible };
  },

  [ActionTypes.UI_TOGGLE_RIGHT_SIDEBAR]: (state) => {
    return { ...state, rightSidebarVisible: !state.rightSidebarVisible };
  },

  [ActionTypes.UI_TOGGLE_TEXT_VISIBILITY]: (state) => {
    const newTextVisible = !state.textVisible;
    const previewVisible = state.previewVisible;
    
    console.log(`[PANEL_DEBUG] Reducer UI_TOGGLE_TEXT_VISIBILITY: Current textVisible=${state.textVisible}. New textVisible=${newTextVisible}`);

    // Derive new viewMode
    let newViewMode;
    if (newTextVisible && previewVisible) {
      newViewMode = 'split';
    } else if (newTextVisible && !previewVisible) {
      newViewMode = 'editor';
    } else if (!newTextVisible && previewVisible) {
      newViewMode = 'preview';
    } else {
      newViewMode = 'blank';
    }
    
    const newState = { ...state, textVisible: newTextVisible, viewMode: newViewMode };
    console.log(`[PANEL_DEBUG] Reducer UI_TOGGLE_TEXT_VISIBILITY: New state computed. textVisible=${newState.textVisible}, previewVisible=${newState.previewVisible}, viewMode=${newState.viewMode}`);
    persisters.textVisible(newState);
    return newState;
  },

  [ActionTypes.UI_TOGGLE_PREVIEW_VISIBILITY]: (state) => {
    const textVisible = state.textVisible;
    const newPreviewVisible = !state.previewVisible;

    console.log(`[PANEL_DEBUG] Reducer UI_TOGGLE_PREVIEW_VISIBILITY: Current previewVisible=${state.previewVisible}. New previewVisible=${newPreviewVisible}`);
    
    // Derive new viewMode
    let newViewMode;
    if (textVisible && newPreviewVisible) {
      newViewMode = 'split';
    } else if (textVisible && !newPreviewVisible) {
      newViewMode = 'editor';
    } else if (!textVisible && newPreviewVisible) {
      newViewMode = 'preview';
    } else {
      newViewMode = 'blank';
    }
    
    const newState = { ...state, previewVisible: newPreviewVisible, viewMode: newViewMode };
    console.log(`[PANEL_DEBUG] Reducer UI_TOGGLE_PREVIEW_VISIBILITY: New state computed. textVisible=${newState.textVisible}, previewVisible=${newState.previewVisible}, viewMode=${newState.viewMode}`);
    persisters.previewVisible(newState);
    return newState;
  },

  [ActionTypes.UI_APPLY_INITIAL_STATE]: (state) => {
    // This action doesn't change state, but its dispatch triggers subscribers
    // to re-read the current state, ensuring UI consistency on startup.
    return { ...state };
  },

  // Theme Actions
  [ActionTypes.UI_SET_THEME]: (state, action) => {
    const theme = action.payload;
    if (typeof theme === 'string' && ['light', 'dark', 'auto'].includes(theme)) {
      const newState = { ...state, theme };
      persisters.theme(newState);
      // Apply theme immediately to document
      applyThemeToDocument(theme);
      return newState;
    }
    return state;
  },

  [ActionTypes.UI_TOGGLE_THEME]: (state) => {
    const currentTheme = state.theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    const newState = { ...state, theme: newTheme };
    persisters.theme(newState);
    // Apply theme immediately to document
    applyThemeToDocument(newTheme);
    return newState;
  },

  [ActionTypes.UI_SET_COLOR_SCHEME]: (state, action) => {
    const colorScheme = action.payload;
    if (typeof colorScheme === 'string' && ['system', 'light', 'dark'].includes(colorScheme)) {
      const newState = { ...state, colorScheme };
      persisters.colorScheme(newState);
      return newState;
    }
    return state;
  },

  [ActionTypes.UI_SET_DESIGN_DENSITY]: (state, action) => {
    const density = action.payload;
    if (typeof density === 'string' && ['compact', 'comfortable', 'spacious'].includes(density)) {
      const newState = { ...state, designDensity: density };
      persisters.designDensity(newState);
      // Apply density class to document
      applyDensityToDocument(density);
      return newState;
    }
    return state;
  }
});

// Helper function to apply theme to document
function applyThemeToDocument(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  
  // Handle system theme detection
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

// Helper function to apply design density to document
function applyDensityToDocument(density) {
  const root = document.documentElement;
  root.setAttribute('data-density', density);
}
