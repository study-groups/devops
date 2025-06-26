/**
 * client/settings/core/settingsRegistry.js
 * UNIFIED Settings Registry - SINGLE source of truth for all settings panels
 * 
 * This is the ONLY registry implementation that should be used.
 * The other registry files (panelRegistry.js, settingsSectionRegistry.js) are 
 * compatibility layers that re-export this registry.
 * 
 * New code should ONLY import from this file:
 * import { settingsRegistry } from '/client/settings/core/settingsRegistry.js';
 * 
 * Legacy compatibility:
 * - settingsSectionRegistry.js (backward compatibility)
 * - panelRegistry.js (backward compatibility)
 * - archived/SettingsRegistry.js (legacy, unused)
 */

import { appStore } from '/client/appState.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { panelOrder } from './panelOrder.js';

// Single array to hold all panel configurations
const panels = [];

export const settingsRegistry = {
  /**
   * Register a settings panel
   * @param {Object} config - Panel configuration object
   * @param {string} config.id - Unique panel ID (used as DOM container ID)
   * @param {string} config.title - Display title for the panel
   * @param {Function} config.component - Panel class constructor
   * @param {boolean} [config.defaultCollapsed=false] - Whether panel starts collapsed
   * @param {number} [config.order] - DEPRECATED: Use panelOrder.js instead
   */
  register(config) {
    // Validate required fields
    if (!config.id || !config.title || !config.component) {
      console.error('[SettingsRegistry] Invalid panel config - missing required fields:', config);
      return;
    }
    
    // Check for duplicate IDs
    if (panels.some(panel => panel.id === config.id)) {
      console.error(`[SettingsRegistry] Panel with ID '${config.id}' already registered`);
      return;
    }
    
    // Add defaults
    const panelConfig = {
      defaultCollapsed: false,
      ...config
    };
    
    panels.push(panelConfig);
    console.log(`[SettingsRegistry] Registered panel: ${config.id}`, panelConfig);
  },

  /**
   * Initialize all panel states (called after reducer is ready)
   */
  initializeAllStates() {
    panels.forEach(panel => {
      this.initializeState(panel.id, panel.defaultCollapsed);
    });
  },

  /**
   * Initialize individual panel state in the store if not already present
   * @param {string} panelId - Panel ID
   * @param {boolean} defaultCollapsed - Default collapsed state
   */
  initializeState(panelId, defaultCollapsed = false) {
    try {
      const currentState = appStore.getState().settingsPanel;
      const collapsedSections = currentState.collapsedSections || {};
      
      // Only set default if not already persisted
      if (collapsedSections[panelId] === undefined) {
        dispatch({
          type: ActionTypes.SETTINGS_PANEL_SET_SECTION_STATE,
          payload: { 
            sectionId: panelId, 
            collapsed: defaultCollapsed 
          }
        });
      }
    } catch (error) {
      console.error(`[SettingsRegistry] Failed to initialize state for panel ${panelId}:`, error);
    }
  },

  /**
   * Get all registered panels, sorted by panelOrder.js
   * @returns {Array} Sorted array of panel configurations
   */
  getPanels() {
    return [...panels].sort((a, b) => {
      const indexA = panelOrder.indexOf(a.id);
      const indexB = panelOrder.indexOf(b.id);

      // If both panels are in the order array, sort by their index
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only panel A is in the order array, it comes first
      if (indexA !== -1) {
        return -1;
      }
      // If only panel B is in the order array, it comes first
      if (indexB !== -1) {
        return 1;
      }
      // If neither is in the order array, keep their registration order
      return 0;
    });
  },

  /**
   * Get panels with their current state from the store
   * @returns {Array} Panels with current collapsed state
   */
  getPanelsWithState() {
    const currentState = appStore.getState().settingsPanel;
    const collapsedSections = currentState.collapsedSections || {};
    
    return this.getPanels().map(panel => ({
      ...panel,
      isCollapsed: collapsedSections[panel.id] ?? panel.defaultCollapsed
    }));
  },

  /**
   * Get a specific panel by ID
   * @param {string} id - Panel ID
   * @returns {Object|null} Panel configuration or null if not found
   */
  getPanel(id) {
    return panels.find(panel => panel.id === id) || null;
  },

  /**
   * Get a panel with its current state
   * @param {string} id - Panel ID
   * @returns {Object|null} Panel with current state or null if not found
   */
  getPanelWithState(id) {
    const panel = this.getPanel(id);
    if (!panel) return null;
    
    const currentState = appStore.getState().settingsPanel;
    const collapsedSections = currentState.collapsedSections || {};
    
    return {
      ...panel,
      isCollapsed: collapsedSections[panel.id] ?? panel.defaultCollapsed
    };
  },

  /**
   * Toggle panel collapsed state through the store
   * @param {string} panelId - Panel ID
   */
  togglePanel(panelId) {
    dispatch({
      type: ActionTypes.SETTINGS_PANEL_TOGGLE_SECTION,
      payload: { sectionId: panelId }
    });
  },

  /**
   * Set panel collapsed state through the store
   * @param {string} panelId - Panel ID
   * @param {boolean} collapsed - Collapsed state
   */
  setPanelState(panelId, collapsed) {
    dispatch({
      type: ActionTypes.SETTINGS_PANEL_SET_SECTION_STATE,
      payload: { 
        sectionId: panelId, 
        collapsed: collapsed 
      }
    });
  },

  /**
   * Clear all registered panels (useful for testing/cleanup)
   */
  clear() {
    panels.length = 0;
    console.debug('[SettingsRegistry] Cleared all registered panels');
  },

  // Legacy compatibility methods (for backward compatibility)
  getAllSections: function() { return this.getPanels(); },
  getSections: function() { return this.getPanels(); },
  getSectionsWithState: function() { return this.getPanelsWithState(); },
  getSection: function(id) { return this.getPanel(id); },
  getSectionWithState: function(id) { return this.getPanelWithState(id); },
  toggleSection: function(panelId) { return this.togglePanel(panelId); },
  setSectionState: function(panelId, collapsed) { return this.setPanelState(panelId, collapsed); },
  initializeAllSectionStates: function() { return this.initializeAllStates(); },
  initializeSectionState: function(panelId, defaultCollapsed) { return this.initializeState(panelId, defaultCollapsed); },

  /**
   * Utility methods
   */
  count() {
    return panels.length;
  },

  debug() {
    console.log('[SettingsRegistry] Registered panels:');
    panels.forEach((panel, index) => {
      console.log(`  ${index + 1}. ${panel.id} - ${panel.title}`);
    });
    return panels;
  }
};

/**
 * Global registry exposure and migration
 * 
 * This section handles exposing the registry to the global scope and
 * migrating it to the window.devpages namespace.
 */
function setupGlobalRegistry() {
  // First, ensure the registry is available in the window.devpages namespace
  if (window.devpages && window.devpages._internal && window.devpages._internal.consolidator) {
    // Try to migrate using the consolidator
    window.devpages._internal.consolidator.migrate('settingsRegistry', settingsRegistry);
    window.devpages._internal.consolidator.migrate('settingsSectionRegistry', settingsRegistry);
    window.devpages._internal.consolidator.migrate('panelRegistry', settingsRegistry);
  }
  
  // Ensure the registry is available in the window.devpages.settings namespace
  // regardless of whether the consolidator worked
  if (window.devpages) {
    window.devpages.settings = window.devpages.settings || {};
    window.devpages.settings.registry = settingsRegistry;
  }
  
  // Also set up the legacy global variables for backward compatibility
  window.settingsRegistry = settingsRegistry;
  window.settingsSectionRegistry = settingsRegistry;
  window.panelRegistry = settingsRegistry;
  
  // Log a message to help with debugging
  console.log('[SettingsRegistry] Registry initialized and exposed globally');
}

// Run the setup
setupGlobalRegistry();
