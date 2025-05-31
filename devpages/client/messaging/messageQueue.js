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
  PLUGIN_RESET: 'PLUGIN_RESET',

  // --- NEW: Preview CSS Settings Actions ---
  SETTINGS_ADD_PREVIEW_CSS: 'SETTINGS_ADD_PREVIEW_CSS',
  SETTINGS_REMOVE_PREVIEW_CSS: 'SETTINGS_REMOVE_PREVIEW_CSS',
  SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED: 'SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED',
  SETTINGS_SET_ACTIVE_PREVIEW_CSS: 'SETTINGS_SET_ACTIVE_PREVIEW_CSS',
  SETTINGS_TOGGLE_ROOT_CSS_ENABLED: 'SETTINGS_TOGGLE_ROOT_CSS_ENABLED',
  // -----------------------------------------

  // UI Actions
  UI_SET_LOADING: 'UI_SET_LOADING',
  UI_SET_LOG_VISIBILITY: 'UI_SET_LOG_VISIBILITY',
  UI_TOGGLE_LOG_VISIBILITY: 'UI_TOGGLE_LOG_VISIBILITY',
  UI_SET_VIEW_MODE: 'UI_SET_VIEW_MODE',
  UI_TOGGLE_LOG_MENU: 'UI_TOGGLE_LOG_MENU',

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
  FS_SET_PARENT_LISTING: 'FS_SET_PARENT_LISTING',
  FS_SET_VIRTUAL_BASE_PATH: 'FS_SET_VIRTUAL_BASE_PATH',
  FS_SET_CURRENT_ORG: 'FS_SET_CURRENT_ORG',

  // SmartCopy Actions
  SET_SMART_COPY_A: 'SET_SMART_COPY_A',
  SET_SMART_COPY_B: 'SET_SMART_COPY_B',

  // Add other action types as needed
  SETTINGS_PANEL_SET_STATE: 'SETTINGS_PANEL_SET_STATE',
  SETTINGS_SET_PREVIEW_CSS_FILES: 'SETTINGS_SET_PREVIEW_CSS_FILES',
  SETTINGS_SET_ROOT_CSS_ENABLED: 'SETTINGS_SET_ROOT_CSS_ENABLED',
  SETTINGS_SET_CONTENT_SUBDIR: 'SETTINGS_SET_CONTENT_SUBDIR',

  // Simple org selection
  SETTINGS_SET_SELECTED_ORG: 'SETTINGS_SET_SELECTED_ORG',
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
    // Refined Check:
    if (!action) {
        console.error('Invalid action dispatched: Action object itself is null or undefined.', action);
        return;
    }
    if (!action.hasOwnProperty('type')) { // Check if the key 'type' is even present
        console.error('Invalid action dispatched: Action object is missing the "type" property.', action);
        return;
    }
    if (typeof action.type === 'undefined') { // Check if the type key exists BUT its value is undefined
        console.error('Action "type" property resolved to undefined. Check if the ActionTypes constant exists.', action);
        // debugger; // Optional: uncomment to pause here when this specific error happens
        return;
    }
    if (typeof action.type !== 'string' || action.type.trim() === '') { // Check if it's not a non-empty string
         console.error(`Action "type" property must be string, but received type ${typeof action.type} with value "${action.type}".`, action);
         return;
    }

    // If we reach here, action and action.type are valid
    // console.debug(`[Dispatch] Processing action: ${action.type}`, action.payload); // Optional debug log

    try {
        mainReducer(action);
    } catch (error) {
        console.error(`[Reducer Error] Error processing action type ${action.type}:`, error);
        // Optionally dispatch an error action
        // dispatch({ type: ActionTypes.REDUCER_ERROR, payload: { error: error.message, originalAction: action } });
    }
}

// Log initialization
console.log('[MessageQueue] Initialized.');
