import { ActionTypes } from '/client/messaging/messageQueue.js';
import { createReducer, createPersister, loadFromStorage } from './reducerUtils.js';

const LOG_VISIBLE_KEY = 'logVisible';
const VIEW_MODE_KEY = 'viewMode';

// Load initial state from localStorage where applicable
const initialState = {
  isLoading: false,
  logVisible: loadFromStorage(LOG_VISIBLE_KEY, false),
  logMenuVisible: false,
  viewMode: loadFromStorage(VIEW_MODE_KEY, 'split', mode => 
    typeof mode === 'string' && ['editor', 'preview', 'split'].includes(mode)
  ),
  theme: 'default'
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
  
  [ActionTypes.UI_SET_LOG_VISIBILITY]: (state, action) => {
    const logVisible = !!action.payload;
    const newState = { ...state, logVisible };
    persisters.logVisible(newState);
    return newState;
  },
  
  [ActionTypes.UI_TOGGLE_LOG_VISIBILITY]: (state) => {
    const logVisible = !state.logVisible;
    const newState = { ...state, logVisible };
    persisters.logVisible(newState);
    return newState;
  },

  [ActionTypes.UI_TOGGLE_LOG_MENU]: (state) => {
    return { ...state, logMenuVisible: !state.logMenuVisible };
  },
  
  [ActionTypes.UI_SET_VIEW_MODE]: (state, action) => {
    // Extract mode correctly based on payload structure
    const viewMode = action.payload?.viewMode || action.payload;
    
    // Validate viewMode is a valid option
    if (typeof viewMode === 'string' && ['editor', 'preview', 'split'].includes(viewMode)) {
      const newState = { ...state, viewMode };
      persisters.viewMode(newState);
      return newState;
    }
    
    console.warn(`[Reducer UI_SET_VIEW_MODE] Invalid view mode: ${viewMode}`);
    return state;
  }
});
