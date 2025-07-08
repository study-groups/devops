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
export const getCurrentPathname = (state) => state.file.currentPathname;
export const getIsDirectorySelected = (state) => state.file.isDirectorySelected;
export const getCurrentListing = (state) => state.file.currentListing;
export const getParentListing = (state) => state.file.parentListing;
export const getAvailableTopLevelDirs = (state) => state.file.availableTopLevelDirs;
export const getFileError = (state) => state.file.error;
export const getIsFileSaving = (state) => state.file.isSaving;
export const getIsFileLoading = (state) => state.file.isLoading;

// Derived selectors that combine state
export const getCurrentFilePath = (state) => 
  !state.file.isDirectorySelected ? state.file.currentPathname : null;

export const getCurrentDirectoryPath = (state) => 
  state.file.isDirectorySelected ? state.file.currentPathname : 
    (state.file.currentListing?.pathname || null);

// ===== SETTINGS SELECTORS =====
export const getPreviewCssFiles = (state) => state.settings.preview.cssFiles;
export const getActiveCssFiles = (state) => state.settings.preview.activeCssFiles;
export const getIsRootCssEnabled = (state) => state.settings.preview.enableRootCss;

// ===== PLUGINS SELECTORS =====
export const getAllPlugins = (state) => state.plugins;
export const getPluginByName = (state, pluginName) => state.plugins[pluginName];
export const getIsPluginEnabled = (state, pluginName) =>
  state.plugins[pluginName]?.enabled || false;

// ===== SMARTCOPY SELECTORS =====
export const getSmartCopyA = (state) => state.smartCopyA;
export const getSmartCopyB = (state) => state.smartCopyB; 