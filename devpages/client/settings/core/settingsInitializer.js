/**
 * client/settings/settingsInitializer.js
 * Initializes the Settings Panel component.
 */
import { SettingsPanel } from './SettingsPanel.js';
import { pageThemeManager } from '../panels/css-design/PageThemeManager.js';
import { settingsRegistry } from './settingsRegistry.js';

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

export async function initializeSettingsPanel() {
  if (settingsPanelInstance) {
    logSettingsInit('[DEBUG] initializeSettingsPanel called, instance already exists.');
    return settingsPanelInstance;
  }
  
  try {
    logSettingsInit('[DEBUG] Starting settings panel initialization...');
    
    // Debug the registry state before creating the panel
    logSettingsInit(`[DEBUG] Registry state before panel creation: ${settingsRegistry.count()} panels`);
    if (settingsRegistry.count() === 0) {
      logSettingsInit('[WARN] Registry is empty before panel creation!', 'warn');
    }
    
    // Check if the global registry variables are set up correctly
    if (window.settingsRegistry && window.settingsRegistry === settingsRegistry) {
      logSettingsInit('[DEBUG] window.settingsRegistry is correctly set up');
    } else {
      logSettingsInit('[WARN] window.settingsRegistry is not correctly set up!', 'warn');
    }
    
    if (window.settingsSectionRegistry && window.settingsSectionRegistry === settingsRegistry) {
      logSettingsInit('[DEBUG] window.settingsSectionRegistry is correctly set up');
    } else {
      logSettingsInit('[WARN] window.settingsSectionRegistry is not correctly set up!', 'warn');
    }
    
    if (window.devpages && window.devpages.settings && window.devpages.settings.registry === settingsRegistry) {
      logSettingsInit('[DEBUG] window.devpages.settings.registry is correctly set up');
    } else {
      logSettingsInit('[WARN] window.devpages.settings.registry is not correctly set up!', 'warn');
    }
    
    logSettingsInit('[DEBUG] Creating new SettingsPanel instance...');
    settingsPanelInstance = new SettingsPanel();
    
    logSettingsInit('[DEBUG] SettingsPanel instance created successfully.');
    
    // Load panels dynamically after reducer is set
    logSettingsInit('[DEBUG] Loading panels dynamically...');
    await settingsPanelInstance.loadPanels();
    logSettingsInit('[DEBUG] Panels loaded successfully.');
    
    // Debug the registry state after loading panels
    logSettingsInit(`[DEBUG] Registry state after loading panels: ${settingsRegistry.count()} panels`);
    if (settingsRegistry.count() === 0) {
      logSettingsInit('[ERROR] Registry is still empty after loading panels!', 'error');
      
      // Emergency fix - check if panels are registered in a different registry
      if (window.settingsSectionRegistry && window.settingsSectionRegistry !== settingsRegistry) {
        const altCount = window.settingsSectionRegistry.count();
        logSettingsInit(`[WARN] Found ${altCount} panels in window.settingsSectionRegistry (different instance)`, 'warn');
        
        // Copy panels from the alternate registry to the main one
        if (altCount > 0 && typeof window.settingsSectionRegistry.getPanels === 'function') {
          const altPanels = window.settingsSectionRegistry.getPanels();
          logSettingsInit(`[INFO] Attempting to copy ${altPanels.length} panels to main registry`, 'info');
          
          altPanels.forEach(panel => {
            settingsRegistry.register(panel);
          });
          
          logSettingsInit(`[INFO] After copy, main registry has ${settingsRegistry.count()} panels`, 'info');
        }
      }
    }
    
    window.devPages = window.devPages || {};
    window.devPages.settingsPanel = settingsPanelInstance;
    
    // Start the page theme manager
    try {
      logSettingsInit('[DEBUG] Starting page theme manager...');
      pageThemeManager.start();
      logSettingsInit('[DEBUG] Page theme manager started successfully.');
    } catch (themeError) {
      logSettingsInit(`[ERROR] Page theme manager failed: ${themeError.message}`, 'error');
      console.error('[SETTINGS INIT] Theme manager error:', themeError);
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
