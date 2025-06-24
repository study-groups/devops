/**
 * client/settings/settingsSectionRegistry.js
 * IoC container for settings panel section configurations
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes, isReducerInitialized } from '/client/messaging/messageQueue.js';
import { panelOrder } from './panelOrder.js';

// Simple array to hold section configuration objects
const sections = [];

export const settingsSectionRegistry = {
  /**
   * Register a section configuration
   * @param {Object} config - Section configuration object
   * @param {string} config.id - Unique DOM ID for the section container
   * @param {string} config.title - Display title for the section header
   * @param {Function} config.component - Panel class constructor
   * @param {boolean} [config.defaultCollapsed=false] - Whether section starts collapsed
   */
  register(config) {
    // Validate required fields
    if (!config.id || !config.title || !config.component) {
      console.error('[SettingsSectionRegistry] Invalid section config - missing required fields:', config);
      return;
    }
    
    // Check for duplicate IDs
    if (sections.some(section => section.id === config.id)) {
      console.error(`[SettingsSectionRegistry] Section with ID '${config.id}' already registered`);
      return;
    }
    
    // Add defaults
    const sectionConfig = {
      defaultCollapsed: false,
      ...config
    };
    
    sections.push(sectionConfig);
    console.debug(`[SettingsSectionRegistry] Registered section: ${config.id}`, sectionConfig);
    
    // Only initialize section state if reducer is ready
    if (isReducerInitialized()) {
      this.initializeSectionState(config.id, config.defaultCollapsed);
    }
  },

  /**
   * Initialize all section states (called after reducer is ready)
   */
  initializeAllSectionStates() {
    sections.forEach(section => {
      this.initializeSectionState(section.id, section.defaultCollapsed);
    });
  },

  /**
   * Initialize section state in the store if not already present
   * @param {string} sectionId - Section ID
   * @param {boolean} defaultCollapsed - Default collapsed state
   */
  initializeSectionState(sectionId, defaultCollapsed = false) {
    if (!isReducerInitialized()) {
      console.debug(`[SettingsSectionRegistry] Reducer not ready, skipping state init for ${sectionId}`);
      return;
    }

    try {
      const currentState = appStore.getState().settingsPanel;
      const collapsedSections = currentState.collapsedSections || {};
      
      // Only set default if not already persisted
      if (collapsedSections[sectionId] === undefined) {
        dispatch({
          type: ActionTypes.SETTINGS_PANEL_SET_SECTION_STATE,
          payload: { 
            sectionId: sectionId, 
            collapsed: defaultCollapsed 
          }
        });
      }
    } catch (error) {
      console.error(`[SettingsSectionRegistry] Failed to initialize state for section ${sectionId}:`, error);
    }
  },

  /**
   * Get all registered sections, sorted by order
   * @returns {Array} Sorted array of section configurations
   */
  getSections() {
    return [...sections].sort((a, b) => {
      const indexA = panelOrder.indexOf(a.id);
      const indexB = panelOrder.indexOf(b.id);

      // If both sections are in the order array, sort by their index
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only section A is in the order array, it comes first
      if (indexA !== -1) {
        return -1;
      }
      // If only section B is in the order array, it comes first
      if (indexB !== -1) {
        return 1;
      }
      // If neither is in the order array, keep their registration order
      return 0;
    });
  },

  /**
   * Get sections with their current state from the store
   * @returns {Array} Sections with current collapsed state
   */
  getSectionsWithState() {
    const currentState = appStore.getState().settingsPanel;
    const collapsedSections = currentState.collapsedSections || {};
    
    return this.getSections().map(section => ({
      ...section,
      isCollapsed: collapsedSections[section.id] ?? section.defaultCollapsed
    }));
  },

  /**
   * Get a specific section by ID
   * @param {string} id - Section ID
   * @returns {Object|null} Section configuration or null if not found
   */
  getSection(id) {
    return sections.find(section => section.id === id) || null;
  },

  /**
   * Get a section with its current state
   * @param {string} id - Section ID
   * @returns {Object|null} Section with current state or null if not found
   */
  getSectionWithState(id) {
    const section = this.getSection(id);
    if (!section) return null;
    
    const currentState = appStore.getState().settingsPanel;
    const collapsedSections = currentState.collapsedSections || {};
    
    return {
      ...section,
      isCollapsed: collapsedSections[section.id] ?? section.defaultCollapsed
    };
  },

  /**
   * Toggle section collapsed state through the store
   * @param {string} sectionId - Section ID
   */
  toggleSection(sectionId) {
    dispatch({
      type: ActionTypes.SETTINGS_PANEL_TOGGLE_SECTION,
      payload: { sectionId: sectionId }
    });
  },

  /**
   * Set section collapsed state through the store
   * @param {string} sectionId - Section ID
   * @param {boolean} collapsed - Collapsed state
   */
  setSectionState(sectionId, collapsed) {
    dispatch({
      type: ActionTypes.SETTINGS_PANEL_SET_SECTION_STATE,
      payload: { 
        sectionId: sectionId, 
        collapsed: collapsed 
      }
    });
  },

  /**
   * Clear all registered sections (useful for testing/cleanup)
   */
  clear() {
    sections.length = 0;
    console.debug('[SettingsSectionRegistry] Cleared all registered sections');
  },

  /**
   * Get count of registered sections
   * @returns {number} Number of registered sections
   */
  count() {
    return sections.length;
  },

  /**
   * Debug function to log all registered sections
   */
  debugRegisteredSections() {
    console.log('[SettingsSectionRegistry] Debug - All registered sections:');
    sections.forEach((section, index) => {
      console.log(`  ${index + 1}. ID: ${section.id}, Title: ${section.title}, Component: ${section.component.name}`);
    });
    console.log(`Total sections: ${sections.length}`);
    return sections;
  },

  /**
   * Sync all sections with their default states (useful for initialization)
   */
  syncDefaults() {
    sections.forEach(section => {
      this.initializeSectionState(section.id, section.defaultCollapsed);
    });
  }
};

// Expose globally for debugging
// Register with consolidation system
if (window.devpages && window.devpages._internal && window.devpages._internal.consolidator) {
    window.devpages._internal.consolidator.migrate('settingsSectionRegistry', settingsSectionRegistry);
} else {
    // Fallback for legacy support
    window.settingsSectionRegistry = settingsSectionRegistry;
} 