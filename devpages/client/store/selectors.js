/**
 * Selectors to access the application state.
 * Use these instead of direct state access to make refactoring easier
 * and to centralize derived state calculations.
 */

// ===== AUTH SELECTORS =====
export const getIsAuthenticated = (state) => state.auth.isAuthenticated;
export const getAuthUser = (state) => state.auth.user;
export const getUserRole = (state) => state.auth?.user?.role;
export const getAuthError = (state) => state.auth.error;
export const getIsAuthInitializing = (state) => state.auth.isInitializing;

// ===== UI SELECTORS =====
export const getIsLogVisible = (state) => state.ui.logVisible;
export const getIsLogMenuVisible = (state) => state.ui.logMenuVisible;
export const getViewMode = (state) => state.ui.viewMode;
export const getIsLoading = (state) => state.ui.isLoading;
export const getTheme = (state) => state.ui.theme;

// ===== FILE SELECTORS =====
// Defensive selectors that handle undefined state gracefully
export const getCurrentPathname = (state) => state.file?.currentPathname || '';
export const getIsDirectorySelected = (state) => state.file?.isDirectorySelected || false;
export const getCurrentListing = (state) => state.file?.currentListing || null;
export const getParentListing = (state) => state.file?.parentListing || null;
export const getAvailableTopLevelDirs = (state) => state.file?.availableTopLevelDirs || [];
export const getFileError = (state) => state.file?.error || null;
export const getIsFileSaving = (state) => state.file?.isSaving || false;
export const getIsFileLoading = (state) => state.file?.isLoading || false;

// Derived selectors that combine state using other selectors
export const getCurrentFilePath = (state) => 
  !getIsDirectorySelected(state) ? getCurrentPathname(state) : null;

export const getCurrentDirectoryPath = (state) => 
  getIsDirectorySelected(state) ? getCurrentPathname(state) : 
    (getCurrentListing(state)?.pathname || null);

// ===== EDITOR SELECTORS =====
export const getCurrentFileContent = (state) => state.editor?.content || '';
export const getIsEditorModified = (state) => state.editor?.isModified || false;

// ===== SETTINGS SELECTORS =====
export const getPreviewCssFiles = (state) => state.settings.preview.cssFiles;
export const getActiveCssFiles = (state) => state.settings.preview.activeCssFiles;
export const getIsRootCssEnabled = (state) => state.settings.preview.enableRootCss;

// ===== PLUGINS SELECTORS =====
export const getAllPlugins = (state) => state.plugins?.plugins || {};
export const getPluginByName = (state, pluginName) => state.plugins?.plugins?.[pluginName];
export const getIsPluginEnabled = (state, pluginName) =>
  state.plugins?.plugins?.[pluginName]?.enabled !== false;

// ===== SMARTCOPY SELECTORS =====
export const getSmartCopyA = (state) => state.smartCopyA;
export const getSmartCopyB = (state) => state.smartCopyB; 