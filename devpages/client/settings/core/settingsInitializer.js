/**
 * client/settings/settingsInitializer.js
 * Initializes the Settings Panel component.
 */
import { SettingsPanel } from './SettingsPanel.js';
import { pageThemeManager } from '../panels/css-design/PageThemeManager.js';

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
    
    // SettingsPanel now properly manages its own visibility state through the store
    // No need to manually check localStorage here
    
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
