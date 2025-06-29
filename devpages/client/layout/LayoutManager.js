/**
 * LayoutManager.js - Panel-based layout management for DevPages
 * 
 * Updated Architecture:
 * - Panel-based layout instead of sidebar-based
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
    // Internal state - now panel-based instead of sidebar-based
    this.state = {
      panelsVisible: true,
      codeViewVisible: false,
      viewMode: 'preview', // 'preview', 'split'
      logVisible: false,
      // Layout dimensions
      panelsTotalWidth: 580, // ContextPanel(280) + CodePanel(300)
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
    
    console.log('[LayoutManager] Initialized with panel-based architecture');
  }

  /**
   * Cache frequently accessed DOM elements
   */
  cacheElements() {
    const elementIds = [
      'panels-container',
      'right-gutter', 
      'preview',
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
        // Migrate old sidebar preferences to panel preferences
        if (preferences.leftSidebarWidth || preferences.rightSidebarWidth) {
          this.state.panelsTotalWidth = (preferences.leftSidebarWidth || 280) + (preferences.rightSidebarWidth || 300);
        }
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
      const { panelsTotalWidth, logHeight } = this.state;
      localStorage.setItem('layoutPreferences', JSON.stringify({
        panelsTotalWidth,
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

      // Sync panel visibility with app state
      if (newUI.leftSidebarVisible !== prevUI.leftSidebarVisible) {
        this.state.panelsVisible = newUI.leftSidebarVisible;
        needsUpdate = true;
      }

      if (newUI.rightSidebarVisible !== prevUI.rightSidebarVisible) {
        this.state.codeViewVisible = newUI.rightSidebarVisible;
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

    // EventBus listeners for panel system
    if (eventBus) {
      const listeners = [
        ['layout:togglePanels', () => this.togglePanels()],
        ['layout:toggleCodeView', () => this.toggleCodeView()],
        ['layout:setViewMode', (data) => this.setViewMode(data.mode)],
        ['layout:toggleLog', () => this.toggleLogVisibility()]
      ];

      listeners.forEach(([event, handler]) => {
        eventBus.on(event, handler);
        this.cleanup.push(() => eventBus.off(event, handler));
      });
    }

    // Listen for panel system events
    if (eventBus) {
      eventBus.on('panels:layoutChanged', (panelData) => {
        this.handlePanelLayoutChange(panelData);
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
    this.state.panelsVisible = ui.leftSidebarVisible !== false; // Default to true
    this.state.codeViewVisible = ui.rightSidebarVisible || false;
    
    this.updateLayout();
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(event) {
    const { altKey, ctrlKey, metaKey, shiftKey, key } = event;
    
    // Only handle Alt+ shortcuts without other modifiers
    if (!altKey || ctrlKey || metaKey || shiftKey) return;

    switch (key) {
      case 'p':
      case 'P':
        event.preventDefault();
        this.togglePanels();
        break;
      case 'c':
      case 'C':
        event.preventDefault();
        this.toggleCodeView();
        break;
      case 's':
      case 'S':
        event.preventDefault();
        this.cycleViewMode();
        break;
      case 'l':
      case 'L':
        event.preventDefault();
        this.toggleLogVisibility();
        break;
    }
  }

  /**
   * Toggle panels visibility
   */
  togglePanels() {
    dispatch({ type: ActionTypes.UI_TOGGLE_LEFT_SIDEBAR });
    if (window.panelUIManager) {
      window.panelUIManager.toggleAllPanels();
    }
  }

  /**
   * Toggle code view (CodePanel)
   */
  toggleCodeView() {
    dispatch({ type: ActionTypes.UI_TOGGLE_RIGHT_SIDEBAR });
    if (window.panelUIManager) {
      window.panelUIManager.toggleCodeView();
    }
  }

  /**
   * Toggle log visibility
   */
  toggleLogVisibility() {
    dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
  }

  /**
   * Set view mode
   */
  setViewMode(mode) {
    if (!['preview', 'split'].includes(mode)) {
      console.warn(`[LayoutManager] Invalid view mode: ${mode}`);
      return;
    }
    
    if (mode !== this.state.viewMode) {
      dispatch({ 
        type: ActionTypes.UI_SET_VIEW_MODE, 
        payload: { viewMode: mode } 
      });
    }
  }

  /**
   * Cycle through view modes
   */
  cycleViewMode(preferredMode) {
    const modes = ['preview', 'split'];
    let nextMode;
    
    if (preferredMode && modes.includes(preferredMode)) {
      nextMode = preferredMode;
    } else {
      const currentIndex = modes.indexOf(this.state.viewMode);
      nextMode = modes[(currentIndex + 1) % modes.length];
    }
    
    this.setViewMode(nextMode);
  }

  /**
   * Handle panel layout changes from PanelManager
   */
  handlePanelLayoutChange(panelData) {
    this.state.panelsTotalWidth = panelData.totalWidth;
    this.updateLayout();
    this.savePreferences();
  }

  /**
   * Set log height
   */
  setLogHeight(height) {
    const validHeight = Math.max(100, Math.min(600, height));
    
    if (validHeight !== this.state.logHeight) {
      this.state.logHeight = validHeight;
      this.updateLayout();
      this.savePreferences();
    }
  }

  /**
   * Update layout - apply state to DOM
   */
  updateLayout() {
    this.updateCSSCustomProperties();
    this.updateBodyClasses();
    this.updateElementVisibility();
    
    console.log(`[LayoutManager] Layout updated:`, {
      panelsVisible: this.state.panelsVisible,
      codeViewVisible: this.state.codeViewVisible,
      viewMode: this.state.viewMode,
      logVisible: this.state.logVisible
    });
  }

  /**
   * Update CSS custom properties for responsive layout
   */
  updateCSSCustomProperties() {
    const root = this.elements.get('root');
    if (!root) return;

    const visiblePanelWidth = this.state.panelsVisible ? this.state.panelsTotalWidth : 0;
    const gutterWidth = 0; // Right gutter is now hidden
    
    root.style.setProperty('--panels-width', `${visiblePanelWidth}px`);
    root.style.setProperty('--gutter-width', `${gutterWidth}px`);
    root.style.setProperty('--log-height', `${this.state.logHeight}px`);
    root.style.setProperty('--content-width', `calc(100vw - ${visiblePanelWidth}px - ${gutterWidth}px)`);
  }

  /**
   * Update body classes for CSS-based layout switching
   */
  updateBodyClasses() {
    const body = this.elements.get('body');
    if (!body) return;

    // Panel-based classes (keep these on body for global layout)
    body.classList.toggle('panels-visible', this.state.panelsVisible);
    body.classList.toggle('code-view-visible', this.state.codeViewVisible);
    
    // View mode classes (keep these on body for global layout)
    body.classList.toggle('view-preview', this.state.viewMode === 'preview');
    body.classList.toggle('view-split', this.state.viewMode === 'split');
    
    // Compatibility classes for existing CSS
    body.classList.toggle('left-sidebar-visible', this.state.panelsVisible);
    body.classList.toggle('right-sidebar-visible', this.state.codeViewVisible);
    
    // Apply log visibility only to the log container itself
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.classList.toggle('log-visible', this.state.logVisible);
      logContainer.classList.toggle('log-hidden', !this.state.logVisible);
    }
  }

  /**
   * Update element visibility
   */
  updateElementVisibility() {
    const logContainer = this.elements.get('log-container');
    if (logContainer) {
      logContainer.style.display = this.state.logVisible ? 'block' : 'none';
    }

    const previewContainer = this.elements.get('preview');
    if (previewContainer) {
      previewContainer.classList.toggle('log-hidden', !this.state.logVisible);
    }
  }

  /**
   * Emit layout change events
   */
  emitLayoutChange() {
    if (!eventBus) return;

    const layoutInfo = this.getLayoutInfo();
    
    // Emit new panel-based event
    eventBus.emit('layout:panelStateChanged', layoutInfo);
    
    // Emit state change events for components that need them
    eventBus.emit('layout:modernStateChanged', {
      leftSidebarVisible: this.state.panelsVisible,
      rightSidebarVisible: this.state.codeViewVisible,
      viewMode: this.state.viewMode,
      logVisible: this.state.logVisible,
      leftSidebarWidth: this.state.panelsTotalWidth,
      logHeight: this.state.logHeight
    });
  }

  /**
   * Get preview type from view mode
   */
  getPreviewTypeFromViewMode() {
    switch (this.state.viewMode) {
      case 'preview': return 'inline';
      case 'split': return 'inline';
      default: return 'inline';
    }
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get layout information for other components
   */
  getLayoutInfo() {
    return {
      panelsVisible: this.state.panelsVisible,
      codeViewVisible: this.state.codeViewVisible,
      viewMode: this.state.viewMode,
      logVisible: this.state.logVisible,
      panelsTotalWidth: this.state.panelsTotalWidth,
      logHeight: this.state.logHeight,
      // Derived properties
      isSplitMode: this.state.viewMode === 'split',
      isRightSidebarVisible: this.state.codeViewVisible,
      contentWidth: this.calculateContentWidth(),
      availableHeight: this.calculateAvailableHeight()
    };
  }

  /**
   * Calculate main content width
   */
  calculateContentWidth() {
    const viewportWidth = window.innerWidth;
    const panelWidth = this.state.panelsVisible ? this.state.panelsTotalWidth : 0;
    const gutterWidth = 0; // Right gutter is now hidden
    
    return Math.max(300, viewportWidth - panelWidth - gutterWidth);
  }

  /**
   * Calculate available height for content
   */
  calculateAvailableHeight() {
    const viewportHeight = window.innerHeight;
    const topBarHeight = 50; // Navigation bar
    const logHeight = this.state.logVisible ? this.state.logHeight : 0;
    
    return Math.max(200, viewportHeight - topBarHeight - logHeight);
  }

  /**
   * Check if layout is in compact mode
   */
  isCompactLayout() {
    return window.innerWidth < 1024;
  }

  /**
   * Get active layout type for theming
   */
  getActiveLayoutType() {
    if (this.isCompactLayout()) return 'compact';
    if (this.state.viewMode === 'split') return 'split';
    return 'standard';
  }

  /**
   * Cleanup resources
   */
  destroy() {
    console.log('[LayoutManager] Destroying...');
    
    // Unsubscribe from app store
    if (this.appStateUnsubscribe) {
      this.appStateUnsubscribe();
      this.appStateUnsubscribe = null;
    }
    
    // Remove event listeners
    this.cleanup.forEach(fn => fn());
    this.cleanup = [];
    
    // Clear references
    this.elements.clear();
    
    // Remove global reference
    if (window.layoutManager === this) {
      delete window.layoutManager;
    }
    
    console.log('[LayoutManager] Destroyed');
  }
}

// Export for use in other modules
export default LayoutManager;