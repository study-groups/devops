/**
 * Settings Events Constants
 * Simple event names for settings-related functionality
 * Used with the main eventBus - no separate panel event bus needed!
 */

import { appStore } from '/client/appState.js';
import { settingsActions } from '/client/store/slices/settingsSlice.js';

export const SettingsEvents = {
  // CSS-related events (the main ones we actually use)
  CSS_FILES_UPDATED: 'settings:css:files:updated',
  THEME_CHANGED: 'settings:theme:changed',
  
  // UI events
  PANEL_OPENED: 'settings:panel:opened',
  PANEL_CLOSED: 'settings:panel:closed',
  
  // Generic coordination
  SETTINGS_UPDATED: 'settings:updated',
  SETTINGS_VALIDATION_REQUESTED: 'settings:validation:requested'
};

// Simple helper to emit CSS-related events with debouncing
let cssEventTimeout;
export function emitCssSettingsChanged(reason = 'unknown', data = null) {
  // Clear any pending emission
  if (cssEventTimeout) {
    clearTimeout(cssEventTimeout);
  }
  
  // Debounce the emission
  cssEventTimeout = setTimeout(() => {
    appStore.dispatch(settingsActions.cssSettingsChanged({ reason, data }));
    cssEventTimeout = null;
  }, 100);
}

// Simple helper to emit theme changes
export function emitThemeChanged(themeData) {
  appStore.dispatch(settingsActions.updateSetting({ key: 'theme', value: themeData }));
  // Also emit the CSS change since theme affects CSS
  emitCssSettingsChanged('theme_changed', themeData);
} 