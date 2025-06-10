import { ActionTypes } from '/client/messaging/messageQueue.js';
import { createReducer, createPersister, loadFromStorage } from './reducerUtils.js';

const LOG_VISIBLE_KEY = 'logVisible';
const VIEW_MODE_KEY = 'viewMode';

// Load initial state from localStorage where applicable
const initialState = {
  isLoading: false,
  logVisible: loadFromStorage(LOG_VISIBLE_KEY, false),
  logMenuVisible: false,
  viewMode: loadFromStorage(VIEW_MODE_KEY, 'preview', mode => 
    typeof mode === 'string' && ['preview', 'split'].includes(mode)
  ),
  theme: 'default',
  leftSidebarVisible: false,
  rightSidebarVisible: false
};

// Create persisters for state that should be saved to localStorage
const persisters = {
  logVisible: createPersister(LOG_VISIBLE_KEY, state => state.logVisible),
  viewMode: createPersister(VIEW_MODE_KEY, state => state.viewMode)
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
  }
});
