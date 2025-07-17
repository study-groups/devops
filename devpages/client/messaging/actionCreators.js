import { ActionTypes } from './actionTypes.js';
import { dispatch } from './messageQueue.js';

// Import thunks
import { authThunks } from '/client/thunks/authThunks.js';
import { fileThunks } from '/client/thunks/fileThunks.js';
import { uiThunks } from '/client/thunks/uiThunks.js';
import { settingsThunks } from '/client/thunks/settingsThunks.js';
import { pluginThunks } from '/client/thunks/pluginThunks.js';

// ===== AUTH ACTIONS =====
export const authActions = {
  // Regular action creators
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
  }),
  
  // Thunk action creators
  login: authThunks.login,
  logoutAsync: authThunks.logout,
  checkAuthStatus: authThunks.checkAuthStatus,
  generateToken: authThunks.generateToken
};

// ===== UI ACTIONS =====
export const uiActions = {
  // Regular action creators
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
  }),
  
  // Thunk action creators
  setViewModeAsync: uiThunks.setViewMode,
  toggleLogVisibilityAsync: uiThunks.toggleLogVisibility,
  setLogHeightAsync: uiThunks.setLogHeight,
  toggleLogMenuAsync: uiThunks.toggleLogMenu,
  applyInitialUIState: uiThunks.applyInitialUIState,
  refreshPreview: uiThunks.refreshPreview
};

// ===== FILE ACTIONS =====
export const fileActions = {
  // Regular action creators
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
  }),
  
  // Thunk action creators
  loadTopLevelDirectories: fileThunks.loadTopLevelDirectories,
  loadDirectoryListing: fileThunks.loadDirectoryListing,
  loadFileContent: fileThunks.loadFileContent,
  saveFileContent: fileThunks.saveFileContent,
  deleteFile: fileThunks.deleteFile,
  getDirectoryConfig: fileThunks.getDirectoryConfig
};

// ===== SETTINGS ACTIONS =====
export const settingsActions = {
  // Regular action creators
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
  }),
  // Design Tokens Theme Actions
  setActiveDesignTheme: (themeName) => ({
    type: ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME,
    payload: themeName
  }),
  setDesignThemeVariant: (variant) => ({
    type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT,
    payload: variant
  }),
  setDesignTokensDirectory: (directory) => ({
    type: ActionTypes.SETTINGS_SET_DESIGN_TOKENS_DIR,
    payload: directory
  }),
  
  // Thunk action creators
  togglePreviewCssEnabledAsync: settingsThunks.togglePreviewCssEnabled,
  addPreviewCssAsync: settingsThunks.addPreviewCss,
  removePreviewCssAsync: settingsThunks.removePreviewCss,
  setActivePreviewCssAsync: settingsThunks.setActivePreviewCss,
  toggleRootCssEnabledAsync: settingsThunks.toggleRootCssEnabled,
  setRootCssEnabledAsync: settingsThunks.setRootCssEnabled,
  setPreviewCssFilesAsync: settingsThunks.setPreviewCssFiles,
  setActiveDesignThemeAsync: settingsThunks.setActiveDesignTheme,
  setDesignThemeVariantAsync: settingsThunks.setDesignThemeVariant,
  setDesignTokensDirectoryAsync: settingsThunks.setDesignTokensDirectory
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

// ===== PLUGIN ACTIONS =====
export const pluginActions = {
  // Regular action creators
  setState: (state) => ({
    type: ActionTypes.PLUGINS_SET_STATE,
    payload: state
  }),
  register: (pluginId, config) => ({
    type: ActionTypes.PLUGINS_REGISTER,
    payload: { pluginId, config }
  }),
  unregister: (pluginId) => ({
    type: ActionTypes.PLUGINS_UNREGISTER,
    payload: { pluginId }
  }),
  updateSettings: (pluginId, settings) => ({
    type: ActionTypes.PLUGINS_UPDATE_SETTINGS,
    payload: { pluginId, settings }
  }),
  moduleLoaded: (pluginId, module) => ({
    type: ActionTypes.PLUGINS_MODULE_LOADED,
    payload: { pluginId, module }
  }),
  
  // Thunk action creators
  initializePlugins: pluginThunks.initializePlugins,
  updatePluginSettings: pluginThunks.updatePluginSettings,
  togglePluginEnabled: pluginThunks.togglePluginEnabled,
  loadPluginModule: pluginThunks.loadPluginModule,
  registerPlugin: pluginThunks.registerPlugin,
  unregisterPlugin: pluginThunks.unregisterPlugin,
  savePluginState: pluginThunks.savePluginState
}; 