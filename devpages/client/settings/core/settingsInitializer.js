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
    logSettingsInit('[DEBUG] initializeSettingsPanel called, instance already exists.');
    logSettingsInit(`[DEBUG] window.devPages exists: ${!!window.devPages}`);
    logSettingsInit(`[DEBUG] window.devPages.settingsPanel exists: ${!!(window.devPages && window.devPages.settingsPanel)}`);
    return settingsPanelInstance;
  }
  
  try {
    logSettingsInit('[DEBUG] Starting settings panel initialization...');
    
    // Test if SettingsPanel can be imported
    logSettingsInit('[DEBUG] Importing SettingsPanel class...');
    
    logSettingsInit('[DEBUG] Creating new SettingsPanel instance...');
    settingsPanelInstance = new SettingsPanel();
    
    logSettingsInit('[DEBUG] SettingsPanel instance created successfully.');
    
    window.devPages = window.devPages || {};
    window.devPages.settingsPanel = settingsPanelInstance;
    
    logSettingsInit('[DEBUG] window.devPages.settingsPanel assigned.');
    logSettingsInit(`[DEBUG] Verification - window.devPages exists: ${!!window.devPages}`);
    logSettingsInit(`[DEBUG] Verification - window.devPages.settingsPanel exists: ${!!(window.devPages && window.devPages.settingsPanel)}`);
    logSettingsInit(`[DEBUG] Verification - toggleVisibility method exists: ${!!(window.devPages && window.devPages.settingsPanel && typeof window.devPages.settingsPanel.toggleVisibility === 'function')}`);
    
    // Start the page theme manager
    try {
      logSettingsInit('[DEBUG] Starting page theme manager...');
      pageThemeManager.start();
      logSettingsInit('[DEBUG] Page theme manager started successfully.');
    } catch (themeError) {
      logSettingsInit(`[ERROR] Page theme manager failed: ${themeError.message}`, 'error');
      console.error('[SETTINGS INIT] Theme manager error:', themeError);
    }
    
    // DEBUG: Force panel visible on init
    if (settingsPanelInstance && typeof settingsPanelInstance.toggleVisibility === 'function') {
      settingsPanelInstance.toggleVisibility(true);
      logSettingsInit('[DEBUG] Forced settings panel visible on init.');
    }
    
    logSettingsInit('[DEBUG] Settings panel initialization completed successfully.');
    return settingsPanelInstance;
  } catch (error) {
    console.error('[SETTINGS INIT ERROR]', error);
    logSettingsInit(`[ERROR] Settings panel initialization failed: ${error.message}`, 'error');
    logSettingsInit(`[ERROR] Error stack: ${error.stack}`, 'error');
    return null;
  }
}

// Optional: Add a function to destroy/clean up if needed during HMR or teardown
export function destroySettingsPanel() {
    if (settingsPanelInstance) {
        settingsPanelInstance.destroy();
        settingsPanelInstance = null;
        window.devPages.settingsPanel = undefined; // Clear global reference
        
        // Stop the page theme manager
        pageThemeManager.stop();

        logSettingsInit('SettingsPanel instance destroyed.');
    }
}
