/**
 * client/settings/settingsInitializer.js
 * Initializes the Settings Panel component.
 */
import { SettingsPanel } from './SettingsPanel.js';
import { pageThemeManager } from '../panels/css-design/PageThemeManager.js';
import { settingsRegistry } from './settingsRegistry.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('SettingsInitializer');

let settingsPanelInstance = null;

export async function initializeSettingsPanel() {
  if (settingsPanelInstance) {
    log.debug('INIT', 'ALREADY_INITIALIZED', '[DEBUG] initializeSettingsPanel called, instance already exists.');
    return settingsPanelInstance;
  }
  
  try {
    log.debug('INIT', 'START', '[DEBUG] Starting settings panel initialization...');
    
    // Debug the registry state before creating the panel
    log.debug('INIT', 'REGISTRY_STATE_BEFORE', `[DEBUG] Registry state before panel creation: ${settingsRegistry.count()} panels`);
    if (settingsRegistry.count() === 0) {
      log.debug('INIT', 'REGISTRY_EMPTY_NORMAL', '[DEBUG] Registry is empty before panel creation - this is normal during initialization');
    }
    
    // Check if the global registry variables are set up correctly
    if (window.settingsRegistry && window.APP.services.settingsRegistry === settingsRegistry) {
      log.debug('INIT', 'REGISTRY_SETUP_OK', '[DEBUG] window.settingsRegistry is correctly set up');
    } else {
      log.warn('INIT', 'REGISTRY_SETUP_WARN', '[WARN] window.settingsRegistry is not correctly set up!');
    }
    
    if (window.settingsSectionRegistry && window.settingsSectionRegistry === settingsRegistry) {
      log.debug('INIT', 'SECTION_REGISTRY_SETUP_OK', '[DEBUG] window.settingsSectionRegistry is correctly set up');
    } else {
      log.warn('INIT', 'SECTION_REGISTRY_SETUP_WARN', '[WARN] window.settingsSectionRegistry is not correctly set up!');
    }
    
    if (window.devpages && window.devpages.settings && window.devpages.settings.registry === settingsRegistry) {
      log.debug('INIT', 'DEVPAGES_REGISTRY_SETUP_OK', '[DEBUG] window.devpages.settings.registry is correctly set up');
    } else {
      log.warn('INIT', 'DEVPAGES_REGISTRY_SETUP_WARN', '[WARN] window.devpages.settings.registry is not correctly set up!');
    }
    
    log.debug('INIT', 'CREATING_INSTANCE', '[DEBUG] Creating new SettingsPanel instance...');
    settingsPanelInstance = new SettingsPanel();
    
    log.debug('INIT', 'INSTANCE_CREATED', '[DEBUG] SettingsPanel instance created successfully.');
    
    // Load panels dynamically after reducer is set
    log.debug('INIT', 'LOADING_PANELS', '[DEBUG] Loading panels dynamically...');
    await settingsPanelInstance.loadPanels();
    log.debug('INIT', 'PANELS_LOADED', '[DEBUG] Panels loaded successfully.');
    
    // Debug the registry state after loading panels
    log.debug('INIT', 'REGISTRY_STATE_AFTER', `[DEBUG] Registry state after loading panels: ${settingsRegistry.count()} panels`);
    if (settingsRegistry.count() === 0) {
      log.error('INIT', 'REGISTRY_STILL_EMPTY', '[ERROR] Registry is still empty after loading panels!');
      
      // Emergency fix - check if panels are registered in a different registry
      if (window.settingsSectionRegistry && window.settingsSectionRegistry !== settingsRegistry) {
        const altCount = window.settingsSectionRegistry.count();
        log.warn('INIT', 'FOUND_ALT_REGISTRY', `[WARN] Found ${altCount} panels in window.settingsSectionRegistry (different instance)`);
        
        // Copy panels from the alternate registry to the main one
        if (altCount > 0 && typeof window.settingsSectionRegistry.getPanels === 'function') {
          const altPanels = window.settingsSectionRegistry.getPanels();
          log.info('INIT', 'COPYING_PANELS', `[INFO] Attempting to copy ${altPanels.length} panels to main registry`);
          
          altPanels.forEach(panel => {
            settingsRegistry.register(panel);
          });
          
          log.info('INIT', 'COPY_COMPLETE', `[INFO] After copy, main registry has ${settingsRegistry.count()} panels`);
        }
      }
    }
    
    window.devPages = window.devPages || {};
    window.devPages.settingsPanel = settingsPanelInstance;
    
    // Start the page theme manager
    try {
      log.debug('INIT', 'STARTING_THEME_MANAGER', '[DEBUG] Starting page theme manager...');
      pageThemeManager.start();
      log.debug('INIT', 'THEME_MANAGER_STARTED', '[DEBUG] Page theme manager started successfully.');
    } catch (themeError) {
      log.error('INIT', 'THEME_MANAGER_FAILED', `[ERROR] Page theme manager failed: ${themeError.message}`, themeError);
      console.error('[SETTINGS INIT] Theme manager error:', themeError);
    }
    
    log.debug('INIT', 'COMPLETE', '[DEBUG] Settings panel initialization completed successfully.');
    return settingsPanelInstance;
  } catch (error) {
    console.error('[SETTINGS INIT ERROR]', error);
    log.error('INIT', 'FAILED', `[ERROR] Settings panel initialization failed: ${error.message}`, error);
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

        log.info('DESTROY', 'SUCCESS', 'SettingsPanel instance destroyed.');
    }
}
