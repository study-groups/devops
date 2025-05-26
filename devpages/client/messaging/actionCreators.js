import { ActionTypes } from './messageQueue.js';

// ===== AUTH ACTIONS =====
export const authActions = {
  loginSuccess: (userData) => ({
    type: ActionTypes.AUTH_LOGIN_SUCCESS,
    payload: userData
  }),
  loginFailure: (error) => ({
    type: ActionTypes.AUTH_LOGIN_FAILURE,
    payload: error
  }),
  logout: () => ({
    type: ActionTypes.AUTH_LOGOUT
  })
};

// ===== UI ACTIONS =====
export const uiActions = {
  setLogVisibility: (isVisible) => ({
    type: ActionTypes.UI_SET_LOG_VISIBILITY,
    payload: isVisible
  }),
  toggleLogVisibility: () => ({
    type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY
  }),
  toggleLogMenu: () => ({
    type: ActionTypes.UI_TOGGLE_LOG_MENU
  }),
  setViewMode: (mode) => ({
    type: ActionTypes.UI_SET_VIEW_MODE,
    payload: mode
  }),
  setLoading: (isLoading) => ({
    type: ActionTypes.UI_SET_LOADING,
    payload: isLoading
  })
};

// ===== FILE ACTIONS =====
export const fileActions = {
  initStart: () => ({
    type: ActionTypes.FS_INIT_START
  }),
  initComplete: () => ({
    type: ActionTypes.FS_INIT_COMPLETE
  }),
  loadListingStart: (pathname) => ({
    type: ActionTypes.FS_LOAD_LISTING_START,
    payload: { pathname }
  }),
  loadListingSuccess: (pathname, dirs, files) => ({
    type: ActionTypes.FS_LOAD_LISTING_SUCCESS,
    payload: { pathname, dirs, files }
  }),
  loadListingError: (error) => ({
    type: ActionTypes.FS_LOAD_LISTING_ERROR,
    payload: error
  }),
  loadFileStart: (pathname) => ({
    type: ActionTypes.FS_LOAD_FILE_START,
    payload: { pathname }
  }),
  loadFileSuccess: (pathname, content) => ({
    type: ActionTypes.FS_LOAD_FILE_SUCCESS,
    payload: { pathname, content }
  }),
  loadFileError: (error) => ({
    type: ActionTypes.FS_LOAD_FILE_ERROR,
    payload: error
  }),
  saveFileStart: (pathname) => ({
    type: ActionTypes.FS_SAVE_FILE_START,
    payload: { pathname }
  }),
  saveFileSuccess: (pathname) => ({
    type: ActionTypes.FS_SAVE_FILE_SUCCESS,
    payload: { pathname }
  }),
  saveFileError: (error) => ({
    type: ActionTypes.FS_SAVE_FILE_ERROR,
    payload: error
  }),
  setTopDirs: (dirs) => ({
    type: ActionTypes.FS_SET_TOP_DIRS,
    payload: dirs
  }),
  setParentListing: (pathname, dirs, files, triggeringPath) => ({
    type: ActionTypes.FS_SET_PARENT_LISTING,
    payload: { pathname, dirs, files, triggeringPath }
  }),
  clearError: () => ({
    type: ActionTypes.FS_CLEAR_ERROR
  })
};

// ===== SETTINGS ACTIONS =====
export const settingsActions = {
  togglePreviewCssEnabled: (cssId) => ({
    type: ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED,
    payload: cssId
  }),
  addPreviewCss: (cssPath) => ({
    type: ActionTypes.SETTINGS_ADD_PREVIEW_CSS,
    payload: cssPath
  }),
  removePreviewCss: (cssId) => ({
    type: ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS,
    payload: cssId
  }),
  setActivePreviewCss: (cssId) => ({
    type: ActionTypes.SETTINGS_SET_ACTIVE_PREVIEW_CSS,
    payload: cssId
  }),
  toggleRootCssEnabled: () => ({
    type: ActionTypes.SETTINGS_TOGGLE_ROOT_CSS_ENABLED
  }),
  setRootCssEnabled: (isEnabled) => ({
    type: ActionTypes.SETTINGS_SET_ROOT_CSS_ENABLED,
    payload: isEnabled
  }),
  setPreviewCssFiles: (files) => ({
    type: ActionTypes.SETTINGS_SET_PREVIEW_CSS_FILES,
    payload: files
  })
};

// ===== SMARTCOPY ACTIONS =====
export const smartCopyActions = {
  setSmartCopyA: (content) => ({
    type: ActionTypes.SET_SMART_COPY_A,
    payload: content
  }),
  setSmartCopyB: (content) => ({
    type: ActionTypes.SET_SMART_COPY_B,
    payload: content
  })
}; 