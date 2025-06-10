/**
 * LayoutManager.js - Declarative layout management for DevPages
 * 
 * New Architecture:
 * - Single source of truth via app store
 * - Declarative CSS-based layouts using custom properties
 * - Clean separation between state management and DOM updates
 * - Event-driven updates with minimal coupling
 */

import { eventBus } from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export class LayoutManager {
  constructor() {
    // Internal state - mirrors app store for quick access
    this.state = {
      leftSidebarVisible: false,
      rightSidebarVisible: false,
      viewMode: 'preview', // 'preview', 'split'
      logVisible: false,
      // Layout dimensions
      leftSidebarWidth: 250,
      rightSidebarWidth: 320,
      logHeight: 300
    };

    // DOM element cache
    this.elements = new Map();
    
    // Event cleanup
    this.cleanup = [];
    this.appStateUnsubscribe = null;
    
    this.initialize();
  }

  /**
   * Initialize the layout manager
   */
  initialize() {
    this.cacheElements();
    this.loadStoredPreferences();
    this.subscribeToAppState();
    this.setupEventListeners();
    this.applyInitialLayout();
    
    // Global access for debugging
    window.layoutManager = this;
    
    console.log('[LayoutManager] Initialized with declarative architecture');
  }

  /**
   * Cache frequently accessed DOM elements
   */
  cacheElements() {
    const elementIds = [
      'code-sidebar',
      'right-sidebar', 
      'main-container',
      'content-view-wrapper',
      'log-container'
    ];

    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      } else {
        console.warn(`[LayoutManager] Element not found: ${id}`);
      }
    });

    // Cache body for CSS custom properties
    this.elements.set('body', document.body);
    this.elements.set('root', document.documentElement);
  }

  /**
   * Load preferences from localStorage
   */
  loadStoredPreferences() {
    try {
      const saved = localStorage.getItem('layoutPreferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.state = { ...this.state, ...preferences };
      }
    } catch (error) {
      console.warn('[LayoutManager] Failed to load preferences:', error);
    }
  }

  /**
   * Save preferences to localStorage
   */
  savePreferences() {
    try {
      const { leftSidebarWidth, rightSidebarWidth, logHeight } = this.state;
      localStorage.setItem('layoutPreferences', JSON.stringify({
        leftSidebarWidth,
        rightSidebarWidth,
        logHeight
      }));
    } catch (error) {
      console.warn('[LayoutManager] Failed to save preferences:', error);
    }
  }

  /**
   * Subscribe to app store changes - single source of truth
   */
  subscribeToAppState() {
    this.appStateUnsubscribe = appStore.subscribe((newState, prevState) => {
      const newUI = newState.ui || {};
      const prevUI = prevState.ui || {};

      let needsUpdate = false;

      // Sync view mode
      if (newUI.viewMode !== prevUI.viewMode && newUI.viewMode !== this.state.viewMode) {
        this.state.viewMode = newUI.viewMode;
        needsUpdate = true;
      }

      // Sync log visibility
      if (newUI.logVisible !== prevUI.logVisible && newUI.logVisible !== this.state.logVisible) {
        this.state.logVisible = newUI.logVisible;
        needsUpdate = true;
      }

      // Sync sidebar visibility
      if (newUI.leftSidebarVisible !== prevUI.leftSidebarVisible && newUI.leftSidebarVisible !== this.state.leftSidebarVisible) {
        this.state.leftSidebarVisible = newUI.leftSidebarVisible;
        needsUpdate = true;
      }

      if (newUI.rightSidebarVisible !== prevUI.rightSidebarVisible && newUI.rightSidebarVisible !== this.state.rightSidebarVisible) {
        this.state.rightSidebarVisible = newUI.rightSidebarVisible;
        needsUpdate = true;
      }

      if (needsUpdate) {
        this.updateLayout();
        this.emitLayoutChange();
      }
    });
  }

  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    // Keyboard shortcuts
    const handleKeyboard = this.handleKeyboardShortcuts.bind(this);
    document.addEventListener('keydown', handleKeyboard);
    this.cleanup.push(() => document.removeEventListener('keydown', handleKeyboard));

    // EventBus listeners
    if (eventBus) {
      const listeners = [
        ['layout:toggleLeftSidebar', () => this.toggleLeftSidebar()],
        ['layout:toggleRightSidebar', () => this.toggleRightSidebar()],
        ['layout:setViewMode', (data) => this.setViewMode(data.mode)],
        ['layout:toggleLog', () => this.toggleLogVisibility()]
      ];

      listeners.forEach(([event, handler]) => {
        eventBus.on(event, handler);
        this.cleanup.push(() => eventBus.off(event, handler));
      });
    }
  }

  /**
   * Apply initial layout based on current state
   */
  applyInitialLayout() {
    // Sync with initial app state
    const currentAppState = appStore.getState();
    const ui = currentAppState.ui || {};
    
    this.state.viewMode = ui.viewMode || 'preview';
    this.state.logVisible = ui.logVisible || false;
    this.state.leftSidebarVisible = ui.leftSidebarVisible || false;
    this.state.rightSidebarVisible = ui.rightSidebarVisible || false;
    
    this.updateLayout();
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(event) {
    const { altKey, ctrlKey, metaKey, shiftKey, key } = event;
    
    // Only handle Alt+ shortcuts without other modifiers
    if (!altKey || ctrlKey || metaKey || shiftKey) return;

    const shortcuts = {
      'l': () => this.toggleLeftSidebar(),
      'r': () => this.toggleRightSidebar(),
      'c': () => this.cycleViewMode('editor'),
      'p': () => this.cycleViewMode('preview'),
      's': () => this.cycleViewMode('split')
    };

    const handler = shortcuts[key.toLowerCase()];
    if (handler) {
      event.preventDefault();
      handler();
    }
  }

  // === Public API Methods ===

  /**
   * Toggle left sidebar visibility
   */
  toggleLeftSidebar() {
    dispatch({ type: ActionTypes.UI_TOGGLE_LEFT_SIDEBAR });
  }

  /**
   * Toggle right sidebar visibility
   */
  toggleRightSidebar() {
    dispatch({ type: ActionTypes.UI_TOGGLE_RIGHT_SIDEBAR });
  }

  /**
   * Toggle log panel visibility
   */
  toggleLogVisibility() {
    // Update via app store to maintain single source of truth
    dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
  }

  /**
   * Set view mode and update app store
   */
  setViewMode(mode) {
    if (!['preview', 'split'].includes(mode)) {
      console.warn(`[LayoutManager] Invalid view mode: ${mode}`);
      return;
    }

    // Update via app store to maintain single source of truth
    dispatch({ 
      type: ActionTypes.UI_SET_VIEW_MODE, 
      payload: { viewMode: mode } 
    });
  }

  /**
   * Cycle through view modes
   */
  cycleViewMode(preferredMode) {
    const modes = ['editor', 'preview', 'split'];
    const currentIndex = modes.indexOf(this.state.viewMode);
    
    let nextMode;
    if (preferredMode && modes.includes(preferredMode)) {
      nextMode = this.state.viewMode === preferredMode ? 'split' : preferredMode;
    } else {
      nextMode = modes[(currentIndex + 1) % modes.length];
    }
    
    this.setViewMode(nextMode);
  }

  /**
   * Set sidebar width
   */
  setSidebarWidth(side, width) {
    if (side === 'left') {
      this.state.leftSidebarWidth = Math.max(200, Math.min(500, width));
    } else if (side === 'right') {
      this.state.rightSidebarWidth = Math.max(250, Math.min(600, width));
    }
    
    this.updateLayout();
    this.savePreferences();
  }

  /**
   * Set log panel height
   */
  setLogHeight(height) {
    this.state.logHeight = Math.max(150, Math.min(500, height));
    this.updateLayout();
    this.savePreferences();
  }

  // === Core Layout Update Logic ===

  /**
   * Main layout update method - declarative CSS approach
   */
  updateLayout() {
    this.updateCSSCustomProperties();
    this.updateBodyClasses();
    this.updateElementVisibility();
    
    console.log('[LayoutManager] Layout updated:', this.state);
  }

  /**
   * Update CSS custom properties for declarative styling
   */
  updateCSSCustomProperties() {
    const root = this.elements.get('root');
    if (!root) return;

    const properties = {
      '--left-sidebar-width': `${this.state.leftSidebarWidth}px`,
      '--right-sidebar-width': `${this.state.rightSidebarWidth}px`,
      '--log-height': `${this.state.logHeight}px`,
      '--left-sidebar-visible': this.state.leftSidebarVisible ? '1' : '0',
      '--right-sidebar-visible': this.state.rightSidebarVisible ? '1' : '0',
      '--log-visible': this.state.logVisible ? '1' : '0'
    };

    Object.entries(properties).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }

  /**
   * Update body classes for view mode styling
   */
  updateBodyClasses() {
    const body = this.elements.get('body');
    if (!body) return;

    // Remove existing view classes
    body.classList.remove('view-editor', 'view-preview', 'view-split');
    
    // Add current view class
    body.classList.add(`view-${this.state.viewMode}`);

    // Add sidebar visibility classes
    body.classList.toggle('left-sidebar-visible', this.state.leftSidebarVisible);
    body.classList.toggle('right-sidebar-visible', this.state.rightSidebarVisible);
    body.classList.toggle('log-visible', this.state.logVisible);
  }

  /**
   * Update element visibility and attributes
   */
  updateElementVisibility() {
    // Log container - still use display since it's not handled by body classes
    const logContainer = this.elements.get('log-container');
    if (logContainer) {
      logContainer.style.display = this.state.logVisible ? 'block' : 'none';
    }

    // Update data attributes for CSS targeting
    const root = this.elements.get('root');
    if (root) {
      root.setAttribute('data-view-mode', this.state.viewMode);
      root.setAttribute('data-log-visible', this.state.logVisible.toString());
    }

    // Sidebars are now handled by CSS body classes, no need to set display directly
  }

  /**
   * Emit layout change event for other components
   */
  emitLayoutChange() {
    if (eventBus) {
      // Legacy format for PreviewManager (it listens to layout:stateChanged)
      eventBus.emit('layout:stateChanged', {
        editorType: 'markdown', // Default editor type
        previewType: this.getPreviewTypeFromViewMode(),
        contentMode: this.state.viewMode
      });

      // New format for modern components
      eventBus.emit('layout:modernStateChanged', { 
        state: { ...this.state },
        timestamp: Date.now()
      });
    }
  }

  /**
   * Convert viewMode to previewType for legacy compatibility
   */
  getPreviewTypeFromViewMode() {
    switch (this.state.viewMode) {
      case 'editor':
        return 'hidden';
      case 'preview':
        return 'inline';
      case 'split':
        return 'inline';
      default:
        return 'inline';
    }
  }

  // === Public Getters ===

  /**
   * Get current layout state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get layout info for components
   */
  getLayoutInfo() {
    return {
      contentWidth: this.calculateContentWidth(),
      availableHeight: this.calculateAvailableHeight(),
      isCompact: this.isCompactLayout(),
      activeLayout: this.getActiveLayoutType()
    };
  }

  /**
   * Calculate available content width
   */
  calculateContentWidth() {
    const viewportWidth = window.innerWidth;
    let contentWidth = viewportWidth;
    
    if (this.state.leftSidebarVisible) {
      contentWidth -= this.state.leftSidebarWidth;
    }
    if (this.state.rightSidebarVisible) {
      contentWidth -= this.state.rightSidebarWidth;
    }
    
    return Math.max(300, contentWidth); // Minimum content width
  }

  /**
   * Calculate available content height
   */
  calculateAvailableHeight() {
    const viewportHeight = window.innerHeight;
    const topBarHeight = 40; // Approximate
    let availableHeight = viewportHeight - topBarHeight;
    
    if (this.state.logVisible) {
      availableHeight -= this.state.logHeight;
    }
    
    return Math.max(200, availableHeight);
  }

  /**
   * Check if layout is in compact mode
   */
  isCompactLayout() {
    return this.calculateContentWidth() < 600;
  }

  /**
   * Get active layout type description
   */
  getActiveLayoutType() {
    const { leftSidebarVisible, rightSidebarVisible, viewMode } = this.state;
    
    if (!leftSidebarVisible && !rightSidebarVisible) {
      return `${viewMode}-only`;
    } else if (leftSidebarVisible && rightSidebarVisible) {
      return `${viewMode}-full`;
    } else if (leftSidebarVisible) {
      return `${viewMode}-with-files`;
    } else {
      return `${viewMode}-with-context`;
    }
  }

  // === Cleanup ===

  /**
   * Clean up resources
   */
  destroy() {
    // Unsubscribe from app store
    if (this.appStateUnsubscribe) {
      this.appStateUnsubscribe();
      this.appStateUnsubscribe = null;
    }

    // Clean up event listeners
    this.cleanup.forEach(cleanupFn => cleanupFn());
    this.cleanup = [];

    // Clear element cache
    this.elements.clear();

    console.log('[LayoutManager] Destroyed');
  }
}

// Export for use in other modules
export default LayoutManager;