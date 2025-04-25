/**
 * client/settings/settingsInitializer.js
 * Initializes the Settings Panel component.
 */
import { SettingsPanel } from './SettingsPanel.js';

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
    logSettingsInit('SettingsPanel already initialized.');
    return settingsPanelInstance;
  }
  
  try {
    logSettingsInit('Initializing SettingsPanel...');
    settingsPanelInstance = new SettingsPanel(); 
    // Store instance globally if needed for debugging or direct access
    window.settingsPanel = settingsPanelInstance; 
    logSettingsInit('SettingsPanel initialized successfully.');
    return settingsPanelInstance;
  } catch (error) {
    logSettingsInit(`Error initializing SettingsPanel: ${error.message}`, 'error');
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
        logSettingsInit('SettingsPanel instance destroyed.');
    }
}
