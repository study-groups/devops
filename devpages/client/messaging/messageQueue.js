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
  SETTINGS_PANEL_SET_SECTION_STATE: 'SETTINGS_PANEL_SET_SECTION_STATE',
  SETTINGS_PANEL_UPDATE_SETTING: 'SETTINGS_PANEL_UPDATE_SETTING',
  PLUGIN_TOGGLE: 'PLUGIN_TOGGLE',
  PLUGIN_RESET: 'PLUGIN_RESET',
  PLUGIN_UPDATE_SETTING: 'PLUGIN_UPDATE_SETTING',

  // --- NEW: Preview CSS Settings Actions ---
  SETTINGS_ADD_PREVIEW_CSS: 'SETTINGS_ADD_PREVIEW_CSS',
  SETTINGS_REMOVE_PREVIEW_CSS: 'SETTINGS_REMOVE_PREVIEW_CSS',
  SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED: 'SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED',
  SETTINGS_SET_ACTIVE_PREVIEW_CSS: 'SETTINGS_SET_ACTIVE_PREVIEW_CSS',
  SETTINGS_TOGGLE_ROOT_CSS_ENABLED: 'SETTINGS_TOGGLE_ROOT_CSS_ENABLED',
  SETTINGS_SET_CSS_BUNDLING_ENABLED: 'SETTINGS_SET_CSS_BUNDLING_ENABLED',
  SETTINGS_SET_CSS_PREFIX: 'SETTINGS_SET_CSS_PREFIX',
  SETTINGS_UPDATE_CSS_INJECTION_MODE: 'SETTINGS_UPDATE_CSS_INJECTION_MODE',
  // -----------------------------------------

  // UI Actions
  UI_SET_LOADING: 'UI_SET_LOADING',
  UI_SET_LOG_VISIBILITY: 'UI_SET_LOG_VISIBILITY',
  UI_TOGGLE_LOG_VISIBILITY: 'UI_TOGGLE_LOG_VISIBILITY',
  UI_SET_VIEW_MODE: 'UI_SET_VIEW_MODE',
  UI_TOGGLE_LOG_MENU: 'UI_TOGGLE_LOG_MENU',
  UI_TOGGLE_LEFT_SIDEBAR: 'UI_TOGGLE_LEFT_SIDEBAR',
  UI_TOGGLE_RIGHT_SIDEBAR: 'UI_TOGGLE_RIGHT_SIDEBAR',
  UI_TOGGLE_TEXT_VISIBILITY: 'UI_TOGGLE_TEXT_VISIBILITY',
  UI_TOGGLE_PREVIEW_VISIBILITY: 'UI_TOGGLE_PREVIEW_VISIBILITY',
  UI_APPLY_INITIAL_STATE: 'UI_APPLY_INITIAL_STATE',
  
  // Theme Actions
  UI_SET_THEME: 'UI_SET_THEME',
  UI_TOGGLE_THEME: 'UI_TOGGLE_THEME',
  UI_SET_COLOR_SCHEME: 'UI_SET_COLOR_SCHEME',
  UI_SET_DESIGN_DENSITY: 'UI_SET_DESIGN_DENSITY',

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

  // Enhanced Log Actions
  UI_SET_LOG_HEIGHT: 'UI_SET_LOG_HEIGHT',
  UI_SET_LOG_MENU_VISIBILITY: 'UI_SET_LOG_MENU_VISIBILITY',

  // Panel Actions
  PANELS_SHOW_ALL: 'PANELS_SHOW_ALL',
  PANELS_HIDE_ALL: 'PANELS_HIDE_ALL',
  PANEL_SHOW: 'PANEL_SHOW',
  PANEL_HIDE: 'PANEL_HIDE',
  PANEL_SET_STATE: 'PANEL_SET_STATE',
  PANEL_TOGGLE_VISIBILITY: 'PANEL_TOGGLE_VISIBILITY',
  PANEL_SET_WIDTH: 'PANEL_SET_WIDTH',

  // Settings Panel Actions
  SETTINGS_PANEL_MOUNT: 'SETTINGS_PANEL_MOUNT',
  SETTINGS_PANEL_UNMOUNT: 'SETTINGS_PANEL_UNMOUNT',

  // --- NEW: Publish Settings Actions ---
      SETTINGS_SET_PUBLISH_MODE: 'SETTINGS_SET_PUBLISH_MODE',
    SETTINGS_SET_PUBLISH_CSS_BUNDLING: 'SETTINGS_SET_PUBLISH_CSS_BUNDLING',
  // -----------------------------------------

  // New action type
  SETTINGS_SET_PREVIEW_MODE: 'SETTINGS_SET_PREVIEW_MODE',

      // Page Theme Settings
    SETTINGS_SET_PAGE_THEME_DIR: 'SETTINGS_SET_PAGE_THEME_DIR',
    SETTINGS_SET_PAGE_THEME_MODE: 'SETTINGS_SET_PAGE_THEME_MODE',
    
    // Design Tokens Theme Management
    SETTINGS_SET_ACTIVE_DESIGN_THEME: 'SETTINGS_SET_ACTIVE_DESIGN_THEME',
    SETTINGS_SET_DESIGN_THEME_VARIANT: 'SETTINGS_SET_DESIGN_THEME_VARIANT',
    SETTINGS_SET_SPACING_VARIANT: 'SETTINGS_SET_SPACING_VARIANT',
    SETTINGS_SET_DESIGN_TOKENS_DIR: 'SETTINGS_SET_DESIGN_TOKENS_DIR',
    SETTINGS_SET_DESIGN_TOKENS_THEME: 'SETTINGS_SET_DESIGN_TOKENS_THEME',

  // For System CSS Panel
  SYSTEM_CSS_FETCH_START: 'SYSTEM_CSS_FETCH_START',
  SYSTEM_CSS_FETCH_SUCCESS: 'SYSTEM_CSS_FETCH_SUCCESS',

  // Icons Panel Actions
  SETTINGS_SET_ACTIVE_ICON_SET: 'SETTINGS_SET_ACTIVE_ICON_SET',
  SETTINGS_UPDATE_ICON_TOKENS: 'SETTINGS_UPDATE_ICON_TOKENS',
  SETTINGS_SAVE_CUSTOM_ICONS: 'SETTINGS_SAVE_CUSTOM_ICONS',
};

// Placeholder for the main application reducer
let mainReducer = (action) => {
  console.warn('Reducer not set yet. Dispatched action:', action);
  // In a real scenario, this should probably throw an error or handle state update
};

let isReducerReady = false;

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
  isReducerReady = true;
  console.log('[MessageQueue] Reducer set.');
}

/**
 * Check if the reducer has been registered and is ready to handle actions.
 * @returns {boolean} True if reducer is ready, false otherwise.
 */
export function isReducerInitialized() {
  return isReducerReady;
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
