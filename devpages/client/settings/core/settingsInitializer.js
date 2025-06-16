/**
 * client/settings/settingsInitializer.js
 * Initializes the Settings Panel component.
 */
import { SettingsPanel } from './SettingsPanel.js';
import { pageThemeManager } from './PageThemeManager.js';

// Helper for logging
function logSettingsInit(message, level = 'info') {
  const type = 'SETTINGS_INIT';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

let settingsPanelInstance = null;

export function initializeSettingsPanel() {
  if (settingsPanelInstance) {
    return settingsPanelInstance;
  }
  
  try {
    settingsPanelInstance = new SettingsPanel();
    window.settingsPanel = settingsPanelInstance;
    
    // Start the page theme manager
    pageThemeManager.start();
    
    // Restore state from localStorage immediately after creation
    try {
      const savedVisible = localStorage.getItem('settings_panel_visible');
      if (savedVisible === 'true') {
        settingsPanelInstance.toggleVisibility(true);
      }
    } catch (e) {}
    
    return settingsPanelInstance;
  } catch (error) {
    console.error('[SETTINGS INIT ERROR]', error);
    return null;
  }
}

// Optional: Add a function to destroy/clean up if needed during HMR or teardown
export function destroySettingsPanel() {
    if (settingsPanelInstance) {
        settingsPanelInstance.destroy();
        settingsPanelInstance = null;
        window.settingsPanel = undefined; // Clear global reference
        
        // Stop the page theme manager
        pageThemeManager.stop();

        logSettingsInit('SettingsPanel instance destroyed.');
    }
}
