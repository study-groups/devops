/**
 * Simplified Settings Registry
 * Single registry system to replace the complex multi-registry approach
 */

class SettingsRegistry {
  constructor() {
    this.panels = new Map();
    this.order = [];
    this.collapsedState = this.loadCollapsedState();
    this.initialized = false;
  }
  
  /**
   * Register a settings panel
   * @param {Object} config - Panel configuration
   * @param {string} config.id - Unique panel ID
   * @param {string} config.title - Display title
   * @param {Function} config.component - Panel class constructor
   * @param {boolean} [config.defaultCollapsed=false] - Default collapsed state
   * @param {number} [config.order] - Display order (optional)
   */
  register(config) {
    // Simple validation
    if (!config.id || !config.title || !config.component) {
      throw new Error(`Invalid panel config - missing required fields: ${JSON.stringify(config)}`);
    }
    
    // Check for duplicate IDs
    if (this.panels.has(config.id)) {
      console.warn(`Panel with ID '${config.id}' already registered - overwriting`);
    }
    
    const panelConfig = {
      id: config.id,
      title: config.title,
      component: config.component,
      defaultCollapsed: config.defaultCollapsed || false,
      order: config.order
    };
    
    this.panels.set(config.id, panelConfig);
    
    // Auto-add to order if not specified
    if (!this.order.includes(config.id)) {
      if (config.order !== undefined) {
        // Insert at specific position
        this.order.splice(config.order, 0, config.id);
      } else {
        // Add to end
        this.order.push(config.id);
      }
    }
    
    console.debug(`[SettingsRegistry] Registered panel: ${config.id}`);
    
    // If system is already initialized, notify
    if (this.initialized && typeof window !== 'undefined') {
      this.emit('panel-registered', { panelId: config.id, config: panelConfig });
    }
  }
  
  /**
   * Get all registered panels in order
   * @returns {Array} Ordered array of panel configurations
   */
  getPanels() {
    return this.order
      .map(id => this.panels.get(id))
      .filter(Boolean);
  }
  
  /**
   * Get panels with their current collapsed state
   * @returns {Array} Panels with current state
   */
  getPanelsWithState() {
    return this.getPanels().map(panel => ({
      ...panel,
      isCollapsed: this.collapsedState[panel.id] ?? panel.defaultCollapsed
    }));
  }
  
  /**
   * Get a specific panel by ID
   * @param {string} id - Panel ID
   * @returns {Object|null} Panel configuration or null
   */
  getPanel(id) {
    return this.panels.get(id) || null;
  }
  
  /**
   * Toggle panel collapsed state
   * @param {string} panelId - Panel ID
   */
  toggleCollapsed(panelId) {
    const currentState = this.collapsedState[panelId] ?? 
      (this.panels.get(panelId)?.defaultCollapsed || false);
    
    this.setCollapsed(panelId, !currentState);
  }
  
  /**
   * Set panel collapsed state
   * @param {string} panelId - Panel ID
   * @param {boolean} collapsed - Collapsed state
   */
  setCollapsed(panelId, collapsed) {
    this.collapsedState[panelId] = collapsed;
    this.saveCollapsedState();
    
    // Emit event if initialized
    if (this.initialized && typeof window !== 'undefined') {
      this.emit('panel-toggled', { panelId, collapsed });
    }
  }
  
  /**
   * Check if panel is collapsed
   * @param {string} panelId - Panel ID
   * @returns {boolean} Collapsed state
   */
  isCollapsed(panelId) {
    const panel = this.panels.get(panelId);
    return this.collapsedState[panelId] ?? (panel?.defaultCollapsed || false);
  }
  
  /**
   * Set panel order
   * @param {Array} orderArray - Array of panel IDs in desired order
   */
  setOrder(orderArray) {
    // Validate all IDs exist
    const validIds = orderArray.filter(id => this.panels.has(id));
    
    // Add any missing panels to the end
    const missingIds = Array.from(this.panels.keys())
      .filter(id => !validIds.includes(id));
    
    this.order = [...validIds, ...missingIds];
    this.saveCollapsedState(); // Save order changes too
  }
  
  /**
   * Load collapsed state from localStorage
   * @returns {Object} Collapsed state object
   */
  loadCollapsedState() {
    try {
      const saved = localStorage.getItem('devpages_settings_panel_state');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn('[SettingsRegistry] Failed to load collapsed state:', e);
      return {};
    }
  }
  
  /**
   * Save collapsed state to localStorage
   */
  saveCollapsedState() {
    try {
      localStorage.setItem('devpages_settings_panel_state', 
        JSON.stringify(this.collapsedState));
    } catch (e) {
      console.warn('[SettingsRegistry] Failed to save collapsed state:', e);
    }
  }
  
  /**
   * Simple event emission (if needed)
   */
  emit(event, data) {
    if (typeof window !== 'undefined' && window.settingsEvents) {
      window.settingsEvents.emit(event, data);
    }
  }
  
  /**
   * Mark registry as initialized
   */
  markInitialized() {
    this.initialized = true;
  }
  
  /**
   * Clear all panels (for testing/cleanup)
   */
  clear() {
    this.panels.clear();
    this.order = [];
    console.debug('[SettingsRegistry] Cleared all panels');
  }
  
  /**
   * Get panel count
   * @returns {number} Number of registered panels
   */
  count() {
    return this.panels.size;
  }
  
  /**
   * Debug method to log all panels
   */
  debug() {
    console.group('[SettingsRegistry] Debug Info');
    console.log('Registered panels:', this.panels.size);
    console.log('Panel order:', this.order);
    console.log('Collapsed state:', this.collapsedState);
    
    this.getPanels().forEach(panel => {
      console.log(`- ${panel.id}: "${panel.title}" (${this.isCollapsed(panel.id) ? 'collapsed' : 'expanded'})`);
    });
    
    console.groupEnd();
  }
}

// Create and export singleton instance
export const settingsRegistry = new SettingsRegistry();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.settingsRegistry = settingsRegistry;
} 