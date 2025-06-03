// SettingsStateManager.js - Centralized settings panel state management

const SETTINGS_STORAGE_KEY = 'devpages_settings_panel_state';

export class SettingsStateManager {
  constructor() {
    this.defaultState = {
      // Visibility and panel state
      visible: false,
      collapsed: false,
      
      // Position and size
      position: { x: 50, y: 50 }, // pixels from top-left
      size: { width: 800, height: 600 }, // panel dimensions
      
      // Panel-specific states
      panels: {
        console: { expanded: true },
        performance: { expanded: false },
        filters: { expanded: true },
        heartbeat: { expanded: false }
      },
      
      // Active tab/section
      activeTab: 'console',
      
      // Last interaction timestamp
      lastUpdated: Date.now()
    };
  }

  /**
   * Load complete settings state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        // Merge with defaults to handle new properties
        return { ...this.defaultState, ...parsedState };
      }
    } catch (e) {
      console.error('[SettingsState] Error loading state:', e);
    }
    return { ...this.defaultState };
  }

  /**
   * Save complete settings state to localStorage
   */
  saveState(state) {
    try {
      const stateToSave = {
        ...state,
        lastUpdated: Date.now()
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(stateToSave));
      console.debug('[SettingsState] State saved:', stateToSave);
    } catch (e) {
      console.error('[SettingsState] Error saving state:', e);
    }
  }

  /**
   * Update specific properties and save
   */
  updateState(updates) {
    const currentState = this.loadState();
    const newState = { ...currentState, ...updates };
    this.saveState(newState);
    return newState;
  }

  /**
   * Update panel position
   */
  updatePosition(x, y) {
    return this.updateState({ position: { x, y } });
  }

  /**
   * Update panel size
   */
  updateSize(width, height) {
    return this.updateState({ size: { width, height } });
  }

  /**
   * Toggle panel visibility
   */
  toggleVisibility() {
    const currentState = this.loadState();
    return this.updateState({ visible: !currentState.visible });
  }

  /**
   * Toggle panel collapsed state
   */
  toggleCollapsed() {
    const currentState = this.loadState();
    return this.updateState({ collapsed: !currentState.collapsed });
  }

  /**
   * Update specific panel expanded state
   */
  updatePanelState(panelName, expanded) {
    const currentState = this.loadState();
    const newPanelStates = {
      ...currentState.panels,
      [panelName]: { ...currentState.panels[panelName], expanded }
    };
    return this.updateState({ panels: newPanelStates });
  }

  /**
   * Set active tab
   */
  setActiveTab(tabName) {
    return this.updateState({ activeTab: tabName });
  }

  /**
   * Get default panel bounds (for initial positioning)
   */
  getDefaultBounds() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    return {
      position: {
        x: Math.max(50, (viewportWidth - this.defaultState.size.width) / 2),
        y: Math.max(50, (viewportHeight - this.defaultState.size.height) / 2)
      },
      size: {
        width: Math.min(this.defaultState.size.width, viewportWidth - 100),
        height: Math.min(this.defaultState.size.height, viewportHeight - 100)
      }
    };
  }
}

// Export singleton instance
export const settingsStateManager = new SettingsStateManager(); 