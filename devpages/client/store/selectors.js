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
// v2: pathname from file.currentFile.pathname or path.current.pathname
export const getCurrentPathname = (state) =>
    state.file?.currentFile?.pathname || state.path?.current?.pathname || '';
// v2: isDirectorySelected from path.current.type
export const getIsDirectorySelected = (state) => state.path?.current?.type === 'directory';
// v2: currentListing from path.currentListing
export const getCurrentListing = (state) => state.path?.currentListing || null;
export const getParentListing = (state) => state.path?.parentListing || null;
// v2: topLevelDirs from path.topLevelDirs
export const getAvailableTopLevelDirs = (state) => state.path?.topLevelDirs || [];
export const getFileError = (state) => state.file?.error || null;
// v2: status-based flags
export const getIsFileSaving = (state) => state.file?.status === 'saving' || state.path?.isSaving || false;
export const getIsFileLoading = (state) => state.file?.status === 'loading' || state.path?.status === 'loading';

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