// client/messaging/messageQueue.js

// Action Types used across the application
// Define action types based on usage in bootstrap.js and potentially other modules
export const ActionTypes = {
  // Auth Actions
  AUTH_INIT_START: 'AUTH_INIT_START',
  AUTH_INIT_COMPLETE: 'AUTH_INIT_COMPLETE',
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  AUTH_LOGOUT: 'AUTH_LOGOUT',

  // Settings Panel Actions
  SETTINGS_PANEL_TOGGLE: 'SETTINGS_PANEL_TOGGLE',
  SETTINGS_PANEL_SET_POSITION: 'SETTINGS_PANEL_SET_POSITION',
  SETTINGS_PANEL_SET_SIZE: 'SETTINGS_PANEL_SET_SIZE',
  SETTINGS_PANEL_TOGGLE_SECTION: 'SETTINGS_PANEL_TOGGLE_SECTION',
  SETTINGS_PANEL_UPDATE_SETTING: 'SETTINGS_PANEL_UPDATE_SETTING',
  PLUGIN_TOGGLE: 'PLUGIN_TOGGLE',

  // UI Actions
  UI_SET_LOADING: 'UI_SET_LOADING',
  UI_SET_LOG_VISIBILITY: 'UI_SET_LOG_VISIBILITY',
  UI_TOGGLE_LOG_VISIBILITY: 'UI_TOGGLE_LOG_VISIBILITY',
  UI_SET_VIEW_MODE: 'UI_SET_VIEW_MODE',

  // File System Actions
  FS_INIT_START: 'FS_INIT_START',
  FS_INIT_COMPLETE: 'FS_INIT_COMPLETE',
  FS_SET_STATE: 'FS_SET_STATE',
  FS_LOAD_LISTING_START: 'FS_LOAD_LISTING_START',
  FS_LOAD_LISTING_SUCCESS: 'FS_LOAD_LISTING_SUCCESS',
  FS_LOAD_LISTING_ERROR: 'FS_LOAD_LISTING_ERROR',
  FS_LOAD_FILE_START: 'FS_LOAD_FILE_START',
  FS_LOAD_FILE_SUCCESS: 'FS_LOAD_FILE_SUCCESS',
  FS_LOAD_FILE_ERROR: 'FS_LOAD_FILE_ERROR',
  FS_SAVE_FILE_START: 'FS_SAVE_FILE_START',
  FS_SAVE_FILE_SUCCESS: 'FS_SAVE_FILE_SUCCESS',
  FS_SAVE_FILE_ERROR: 'FS_SAVE_FILE_ERROR',
  FS_SET_TOP_DIRS: 'FS_SET_TOP_DIRS',
  FS_LOAD_TOP_DIRS_START: 'FS_LOAD_TOP_DIRS_START',
  FS_LOAD_TOP_DIRS_ERROR: 'FS_LOAD_TOP_DIRS_ERROR',
  FS_CLEAR_ERROR: 'FS_CLEAR_ERROR',

  // Add other action types as needed
};

// Placeholder for the main application reducer
let mainReducer = (action) => {
  console.warn('Reducer not set yet. Dispatched action:', action);
  // In a real scenario, this should probably throw an error or handle state update
};

/**
 * Registers the main reducer function for the application.
 * This function will be called by dispatch to process actions.
 * @param {Function} reducerFn - The reducer function. It takes the current action as an argument.
 */
export function setReducer(reducerFn) {
  if (typeof reducerFn !== 'function') {
    throw new Error('Reducer must be a function.');
  }
  mainReducer = reducerFn;
  console.log('[MessageQueue] Reducer set.');
}

/**
 * Dispatches an action to the registered reducer.
 * @param {object} action - The action object, typically { type: string, payload?: any }.
 */
export function dispatch(action) {
  if (!action || typeof action.type !== 'string') {
     console.error('Invalid action dispatched. Action must have a type property.', action);
     return; 
  }
  // Call the registered reducer with the action
  // The reducer itself is responsible for getting the current state (e.g., from appStore)
  // and updating it.
  try {
      mainReducer(action);
  } catch (error) {
      console.error(`Error executing reducer for action type ${action.type}:`, error);
      // Optionally re-throw or handle error state
  }
}

// Log initialization
console.log('[MessageQueue] Initialized.');
