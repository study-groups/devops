/**
 * LayoutManager.js - Centralized layout management for DevPages
 * 
 * Manages:
 * - Left sidebar (code sidebar) toggle
 * - Right sidebar (context/CLI sidebar) toggle  
 * - Content view modes (editor/preview/split)
 * - Log panel visibility
 * - Layout persistence
 * - Responsive behavior
 */

import { eventBus } from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export class LayoutManager {
  constructor() {
    this.state = {
      leftSidebarVisible: false,
      rightSidebarVisible: false,
      contentMode: 'split', // 'editor', 'preview', 'split'
      logVisible: false,
      leftSidebarWidth: 250,
      rightSidebarWidth: 320,
      logHeight: 300,
      // Enhanced layout properties
      previewType: 'inline', // 'inline', 'popup-iframe', 'hidden'
      editorType: 'markdown' // 'markdown', 'raw-text'
    };

    this.elements = {
      leftSidebar: null,
      rightSidebar: null,
      mainContainer: null,
      contentWrapper: null,
      logContainer: null,
      body: document.body
    };

    this.listeners = [];
    this.appStateUnsubscribe = null;
    
    this.initialize();
  }

  /**
   * Initialize the layout manager
   */
  initialize() {
    this.cacheElements();
    this.loadPreferences();
    this.setupEventListeners();
    this.subscribeToAppState();
    this.applyInitialLayout();
    
    // Expose to window for debugging
    window.layoutManager = this;
    
    console.log('[LayoutManager] Initialized');
  }

  /**
   * Cache DOM elements for performance
   */
  cacheElements() {
    this.elements = {
      leftSidebar: document.getElementById('code-sidebar'),
      rightSidebar: document.getElementById('right-sidebar'),
      mainContainer: document.getElementById('main-container'),
      contentWrapper: document.getElementById('content-view-wrapper'),
      logContainer: document.getElementById('log-container'),
      body: document.body
    };

    // Log missing elements for debugging
    Object.entries(this.elements).forEach(([key, element]) => {
      if (!element && key !== 'body') {
        console.warn(`[LayoutManager] Element not found: ${key}`);
      }
    });
  }

  /**
   * Load layout preferences from localStorage
   */
  loadPreferences() {
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
   * Save layout preferences to localStorage
   */
  savePreferences() {
    try {
      localStorage.setItem('layoutPreferences', JSON.stringify(this.state));
    } catch (error) {
      console.warn('[LayoutManager] Failed to save preferences:', error);
    }
  }

  /**
   * Subscribe to app state changes
   */
  subscribeToAppState() {
    this.appStateUnsubscribe = appStore.subscribe((newState, prevState) => {
      const ui = newState.ui || {};
      const prevUI = prevState.ui || {};

      // Update from app state if changed
      if (ui.viewMode !== prevUI.viewMode && ui.viewMode !== this.state.contentMode) {
        this.setContentMode(ui.viewMode, false); // false = don't dispatch back
      }

      if (ui.logVisible !== prevUI.logVisible && ui.logVisible !== this.state.logVisible) {
        this.setLogVisibility(ui.logVisible, false); // false = don't dispatch back
      }
    });
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    
    // Window resize
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // EventBus listeners
    if (eventBus) {
      eventBus.on('layout:toggleLeftSidebar', () => this.toggleLeftSidebar());
      eventBus.on('layout:toggleRightSidebar', () => this.toggleRightSidebar());
      eventBus.on('layout:setContentMode', (data) => this.setContentMode(data.mode));
      eventBus.on('layout:toggleLog', () => this.toggleLogVisibility());
    }
  }

  /**
   * Apply initial layout based on current state
   */
  applyInitialLayout() {
    this.updateLayout();
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(event) {
    const { ctrlKey, metaKey, altKey, shiftKey, key } = event;
    const cmdOrCtrl = ctrlKey || metaKey;

    // Alt + L = Toggle left sidebar
    if (altKey && key.toLowerCase() === 'l' && !cmdOrCtrl && !shiftKey) {
      event.preventDefault();
      this.toggleLeftSidebar();
      return;
    }

    // Alt + R = Toggle right sidebar  
    if (altKey && key.toLowerCase() === 'r' && !cmdOrCtrl && !shiftKey) {
      event.preventDefault();
      this.toggleRightSidebar();
      return;
    }

    // Alt + C = Toggle code mode
    if (altKey && key.toLowerCase() === 'c' && !cmdOrCtrl && !shiftKey) {
      event.preventDefault();
      this.toggleCodeMode();
      return;
    }

    // Alt + P = Toggle preview
    if (altKey && key.toLowerCase() === 'p' && !cmdOrCtrl && !shiftKey) {
      event.preventDefault();
      this.togglePreview();
      return;
    }

    // Alt + S = Toggle split
    if (altKey && key.toLowerCase() === 's' && !cmdOrCtrl && !shiftKey) {
      event.preventDefault();
      this.toggleSplit();
      return;
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Responsive behavior
    const width = window.innerWidth;
    
    if (width < 768) {
      // Mobile: hide sidebars
      if (this.state.leftSidebarVisible || this.state.rightSidebarVisible) {
        this.setLeftSidebarVisibility(false);
        this.setRightSidebarVisibility(false);
      }
    }
    
    this.updateLayout();
  }

  /**
   * Toggle left sidebar visibility
   */
  toggleLeftSidebar() {
    this.setLeftSidebarVisibility(!this.state.leftSidebarVisible);
  }

  /**
   * Toggle right sidebar visibility
   */
  toggleRightSidebar() {
    this.setRightSidebarVisibility(!this.state.rightSidebarVisible);
  }

  /**
   * Toggle log panel visibility
   */
  toggleLogVisibility() {
    this.setLogVisibility(!this.state.logVisible);
  }

  /**
   * Set left sidebar visibility
   */
  setLeftSidebarVisibility(visible, persist = true) {
    this.state.leftSidebarVisible = visible;
    
    if (persist) {
      this.savePreferences();
    }
    
    this.updateLayout();
    
    // Emit event for other components
    if (eventBus) {
      eventBus.emit('layout:leftSidebarChanged', { visible });
    }
  }

  /**
   * Set right sidebar visibility
   */
  setRightSidebarVisibility(visible, persist = true) {
    this.state.rightSidebarVisible = visible;
    
    if (persist) {
      this.savePreferences();
    }
    
    this.updateLayout();
    
    // Emit event for other components
    if (eventBus) {
      eventBus.emit('layout:rightSidebarChanged', { visible });
    }
  }

  /**
   * Set content mode (editor/preview/split)
   */
  setContentMode(mode, updateAppState = true) {
    if (!['editor', 'preview', 'split'].includes(mode)) {
      console.warn(`[LayoutManager] Invalid content mode: ${mode}`);
      return;
    }

    this.state.contentMode = mode;
    this.savePreferences();
    this.updateLayout();

    // Update app state if requested
    if (updateAppState) {
      dispatch({
        type: ActionTypes.UI_SET_VIEW_MODE,
        payload: { viewMode: mode }
      });
    }

    // Emit event for other components
    if (eventBus) {
      eventBus.emit('layout:contentModeChanged', { 
        mode, 
        editorType: this.state.editorType,
        previewType: this.state.previewType 
      });
    }
  }

  /**
   * Toggle between markdown and code editing modes
   */
  toggleCodeMode() {
    if (this.state.editorType === 'markdown') {
      this.state.editorType = 'raw-text';
      // In code mode, hide sidebars for full-width editing
      this.state.leftSidebarVisible = false;
      this.state.rightSidebarVisible = false;
    } else {
      this.state.editorType = 'markdown';
    }
    
    this.savePreferences();
    this.updateLayout();
    this.emitLayoutChange();
  }

  /**
   * Toggle preview visibility/type
   */
  togglePreview() {
    if (this.state.editorType === 'raw-text') {
      // In code mode: cycle through hidden -> popup -> inline
      switch (this.state.previewType) {
        case 'hidden':
          this.state.previewType = 'popup-iframe';
          break;
        case 'popup-iframe':
          this.state.previewType = 'inline';
          break;
        case 'inline':
          this.state.previewType = 'hidden';
          break;
        default:
          this.state.previewType = 'hidden';
      }
    } else {
      // In markdown mode: toggle preview visibility
      if (this.state.contentMode === 'editor') {
        this.state.contentMode = 'split';
      } else if (this.state.contentMode === 'preview') {
        this.state.contentMode = 'editor';
      } else {
        // In split mode, go to preview-only
        this.state.contentMode = 'preview';
      }
    }
    
    this.savePreferences();
    this.updateLayout();
    this.emitLayoutChange();
  }

  /**
   * Toggle split view
   */
  toggleSplit() {
    if (this.state.editorType === 'raw-text') {
      // In code mode: toggle between single editor and split with preview
      if (this.state.previewType === 'hidden') {
        this.state.previewType = 'inline';
      } else if (this.state.previewType === 'inline') {
        this.state.previewType = 'hidden';
      }
      // popup-iframe stays as is - it's independent of split toggle
    } else {
      // In markdown mode: toggle split view
      if (this.state.contentMode === 'split') {
        this.state.contentMode = 'editor';
      } else {
        this.state.contentMode = 'split';
      }
    }
    
    this.savePreferences();
    this.updateLayout();
    this.emitLayoutChange();
  }

  /**
   * Emit layout change event
   */
  emitLayoutChange() {
    if (eventBus) {
      eventBus.emit('layout:stateChanged', { 
        editorType: this.state.editorType,
        previewType: this.state.previewType,
        contentMode: this.state.contentMode,
        leftSidebarVisible: this.state.leftSidebarVisible,
        rightSidebarVisible: this.state.rightSidebarVisible
      });
    }
  }

  /**
   * Toggle preview type between inline and popup (for code mode)
   */
  togglePreviewType() {
    if (this.state.contentMode !== 'code') {
      console.warn('[LayoutManager] Preview type toggle only available in code mode');
      return;
    }

    this.state.previewType = this.state.previewType === 'inline' ? 'popup-iframe' : 'inline';
    this.savePreferences();
    
    // Emit event for preview system to update
    if (eventBus) {
      eventBus.emit('layout:previewTypeChanged', { 
        previewType: this.state.previewType,
        contentMode: this.state.contentMode
      });
    }

    // Update layout to show/hide preview container
    this.updateLayout();
  }

  /**
   * Set log panel visibility
   */
  setLogVisibility(visible, updateAppState = true) {
    this.state.logVisible = visible;
    this.savePreferences();
    this.updateLayout();

    // Update app state if requested
    if (updateAppState) {
      dispatch({
        type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY,
        payload: { logVisible: visible }
      });
    }

    // Emit event for other components
    if (eventBus) {
      eventBus.emit('layout:logVisibilityChanged', { visible });
    }
  }

  /**
   * Update the actual DOM layout based on current state
   */
  updateLayout() {
    this.updateSidebars();
    this.updateContentArea();
    this.updateLogPanel();
    this.updateBodyClasses();
    this.updateCSS();
  }

  /**
   * Update sidebar visibility and dimensions
   */
  updateSidebars() {
    const { leftSidebar, rightSidebar } = this.elements;
    
    // Left sidebar
    if (leftSidebar) {
      leftSidebar.style.display = this.state.leftSidebarVisible ? 'flex' : 'none';
      leftSidebar.style.width = `${this.state.leftSidebarWidth}px`;
    }

    // Right sidebar
    if (rightSidebar) {
      rightSidebar.style.display = this.state.rightSidebarVisible ? 'flex' : 'none';
      rightSidebar.style.width = `${this.state.rightSidebarWidth}px`;
    }
  }

  /**
   * Update content area layout
   */
  updateContentArea() {
    const { contentWrapper } = this.elements;
    
    if (contentWrapper) {
      // Remove existing mode classes
      contentWrapper.classList.remove('mode-editor', 'mode-preview', 'mode-split');
      
      // In code mode, determine effective content mode
      if (this.state.editorType === 'raw-text') {
        if (this.state.previewType === 'hidden') {
          contentWrapper.classList.add('mode-editor');
        } else if (this.state.previewType === 'inline') {
          contentWrapper.classList.add('mode-split');
        } else {
          // popup-iframe - show editor only
          contentWrapper.classList.add('mode-editor');
        }
      } else {
        // Normal markdown mode
        contentWrapper.classList.add(`mode-${this.state.contentMode}`);
      }
      
      // Add editor type class
      contentWrapper.classList.remove('editor-markdown', 'editor-raw-text');
      contentWrapper.classList.add(`editor-${this.state.editorType}`);
      
      // Add preview type class
      contentWrapper.classList.remove('preview-inline', 'preview-popup-iframe', 'preview-hidden');
      contentWrapper.classList.add(`preview-${this.state.previewType}`);
    }
  }

  /**
   * Update log panel
   */
  updateLogPanel() {
    const { logContainer, mainContainer } = this.elements;
    
    if (logContainer) {
      logContainer.style.display = this.state.logVisible ? 'block' : 'none';
      logContainer.style.height = this.state.logVisible ? `${this.state.logHeight}px` : '0px';
    }

    if (mainContainer) {
      mainContainer.classList.toggle('log-hidden', !this.state.logVisible);
    }
  }

  /**
   * Update body classes for styling
   */
  updateBodyClasses() {
    const { body } = this.elements;
    
    // Remove old classes
    body.classList.remove('view-editor', 'view-preview', 'view-split', 'view-code');
    body.classList.remove('left-sidebar-visible', 'right-sidebar-visible');
    body.classList.remove('log-visible', 'log-hidden');

    // Add current content mode class
    if (this.state.editorType === 'raw-text') { // Modified to handle editorType
      body.classList.add('view-code');
      // The specific view (editor/split) is handled by classes on contentWrapper now
    } else {
      body.classList.add(`view-${this.state.contentMode}`);
    }

    // Add sidebar classes
    if (this.state.leftSidebarVisible) {
      body.classList.add('left-sidebar-visible');
    }
    if (this.state.rightSidebarVisible) {
      body.classList.add('right-sidebar-visible');
    }

    // Add log classes
    body.classList.add(this.state.logVisible ? 'log-visible' : 'log-hidden');
  }

  /**
   * Update CSS custom properties
   */
  updateCSS() {
    const { leftSidebar, rightSidebar } = this.elements;
    
    if (leftSidebar) {
      leftSidebar.style.cssText = `--left-sidebar-width: ${this.state.leftSidebarWidth}px;`;
    }

    if (rightSidebar) {
      rightSidebar.style.cssText = `--right-sidebar-width: ${this.state.rightSidebarWidth}px;`;
    }
  }

  /**
   * Get current layout state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Set layout state programmatically
   */
  setState(newState, persist = true) {
    this.state = { ...this.state, ...newState };
    
    if (persist) {
      this.savePreferences();
    }
    
    this.updateLayout();
  }

  /**
   * Reset layout to defaults
   */
  resetLayout() {
    this.state = {
      leftSidebarVisible: false,
      rightSidebarVisible: false,
      contentMode: 'split',
      logVisible: false,
      leftSidebarWidth: 250,
      rightSidebarWidth: 320,
      logHeight: 300,
      previewType: 'inline',
      editorType: 'markdown'
    };
    
    this.savePreferences();
    this.updateLayout();
  }

  /**
   * Destroy the layout manager
   */
  destroy() {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    window.removeEventListener('resize', this.handleResize.bind(this));
    
    // Unsubscribe from app state
    if (this.appStateUnsubscribe) {
      this.appStateUnsubscribe();
    }
    
    // Clean up window reference
    if (window.layoutManager === this) {
      delete window.layoutManager;
    }
    
    console.log('[LayoutManager] Destroyed');
  }
}