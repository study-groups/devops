/**
 * client/settings/panelRegistry.js
 * IoC container for settings panel configurations
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes, isReducerInitialized } from '/client/messaging/messageQueue.js';
import { panelOrder } from './panelOrder.js';

// Simple array to hold panel configuration objects
const panels = [];

export const panelRegistry = {
  /**
   * Register a panel configuration
   * @param {Object} config - Panel configuration object
   * @param {string} config.id - Unique DOM ID for the panel container
   * @param {string} config.title - Display title for the panel header
   * @param {Function} config.component - Panel class constructor
   * @param {number} [config.order=100] - Sort order (lower numbers first)
   * @param {boolean} [config.defaultCollapsed=false] - Whether panel starts collapsed
   */
  register(config) {
    // Validate required fields
    if (!config.id || !config.title || !config.component) {
      console.error('[PanelRegistry] Invalid panel config - missing required fields:', config);
      return;
    }
    
    // Check for duplicate IDs
    if (panels.some(panel => panel.id === config.id)) {
      console.error(`[PanelRegistry] Panel with ID '${config.id}' already registered`);
      return;
    }
    
    // Add defaults
    const panelConfig = {
      order: 100,
      defaultCollapsed: false,
      ...config
    };
    
    panels.push(panelConfig);
    console.debug(`[PanelRegistry] Registered panel: ${config.id}`, panelConfig);
    
    // Only initialize panel state if reducer is ready
    if (isReducerInitialized()) {
      this.initializePanelState(config.id, config.defaultCollapsed);
    }
  },

  /**
   * Initialize all panel states (called after reducer is ready)
   */
  initializeAllPanelStates() {
    panels.forEach(panel => {
      this.initializePanelState(panel.id, panel.defaultCollapsed);
    });
  },

  /**
   * Initialize panel state in the store if not already present
   * @param {string} panelId - Panel ID
   * @param {boolean} defaultCollapsed - Default collapsed state
   */
  initializePanelState(panelId, defaultCollapsed = false) {
    if (!isReducerInitialized()) {
      console.debug(`[PanelRegistry] Reducer not ready, skipping state init for ${panelId}`);
      return;
    }

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
      console.error(`[PanelRegistry] Failed to initialize state for panel ${panelId}:`, error);
    }
  },

  /**
   * Get all registered panels, sorted by order
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
      // If neither is in the order array, sort by the old 'order' property for stability
      return (a.order || 100) - (b.order || 100);
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
    console.debug('[PanelRegistry] Cleared all registered panels');
  },

  /**
   * Get count of registered panels
   * @returns {number} Number of registered panels
   */
  count() {
    return panels.length;
  },

  /**
   * Sync all panels with their default states (useful for initialization)
   */
  syncDefaultStates() {
    panels.forEach(panel => {
      this.initializePanelState(panel.id, panel.defaultCollapsed);
    });
  }
}; 