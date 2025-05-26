/**
 * Persistence module to manage storing and retrieving state from localStorage
 */
import { createPersister } from './reducers/reducerUtils.js';
import * as selectors from './selectors.js';

// Constants for localStorage keys
export const STORAGE_KEYS = {
  LOG_VISIBLE: 'logVisible',
  SMART_COPY_B: 'smartCopyBufferB',
  PLUGINS_STATE: 'pluginsEnabledState',
  PREVIEW_CSS_FILES: 'previewCssFiles',
  ENABLE_ROOT_CSS: 'previewEnableRootCss',
  SETTINGS_PANEL_STATE: 'devpages_settings_panel_state',
  VIEW_MODE: 'viewMode'
};

// Create persisters for each slice that needs persistence
const persisters = {
  ui: {
    logVisible: createPersister(
      STORAGE_KEYS.LOG_VISIBLE, 
      state => selectors.getIsLogVisible(state)
    ),
    viewMode: createPersister(
      STORAGE_KEYS.VIEW_MODE, 
      state => selectors.getViewMode(state)
    )
  },
  settings: {
    previewCssFiles: createPersister(
      STORAGE_KEYS.PREVIEW_CSS_FILES, 
      state => selectors.getPreviewCssFiles(state)
    ),
    enableRootCss: createPersister(
      STORAGE_KEYS.ENABLE_ROOT_CSS, 
      state => selectors.getIsRootCssEnabled(state)
    )
  },
  plugins: createPersister(
    STORAGE_KEYS.PLUGINS_STATE, 
    state => {
      // Create a map of plugin IDs to enabled state
      const plugins = selectors.getAllPlugins(state);
      const enabledMap = {};
      
      for (const pluginId in plugins) {
        enabledMap[pluginId] = plugins[pluginId].enabled;
      }
      
      return enabledMap;
    }
  ),
  smartCopyB: createPersister(
    STORAGE_KEYS.SMART_COPY_B, 
    state => selectors.getSmartCopyB(state)
  ),
  settingsPanel: createPersister(
    STORAGE_KEYS.SETTINGS_PANEL_STATE, 
    state => state.settingsPanel
  )
};

/**
 * Persists state to localStorage when relevant parts change
 * Call this function after state updates in the mainReducer
 * 
 * @param {Object} newState - The updated state object
 * @param {Object} prevState - The previous state object
 */
export function persistState(newState, prevState) {
  // Only persist if the slices we care about have changed
  if (newState.ui !== prevState.ui) {
    if (newState.ui.logVisible !== prevState.ui.logVisible) {
      persisters.ui.logVisible(newState);
    }
    if (newState.ui.viewMode !== prevState.ui.viewMode) {
      persisters.ui.viewMode(newState);
    }
  }
  
  if (newState.settings !== prevState.settings) {
    if (newState.settings.preview.cssFiles !== prevState.settings.preview.cssFiles) {
      persisters.settings.previewCssFiles(newState);
    }
    if (newState.settings.preview.enableRootCss !== prevState.settings.preview.enableRootCss) {
      persisters.settings.enableRootCss(newState);
    }
  }
  
  if (newState.plugins !== prevState.plugins) {
    persisters.plugins(newState);
  }
  
  if (newState.smartCopyB !== prevState.smartCopyB) {
    persisters.smartCopyB(newState);
  }
  
  if (newState.settingsPanel !== prevState.settingsPanel) {
    persisters.settingsPanel(newState);
  }
} 