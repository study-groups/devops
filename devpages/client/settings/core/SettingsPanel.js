/**
 * client/settings/SettingsPanel.js
 * Draggable, resizable settings panel component.
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { settingsSectionRegistry } from './settingsSectionRegistry.js';
import { logMessage } from '/client/log/index.js';
import { panelEventBus } from './panelEventBus.js';
import { renderSettingsSections } from './SettingsSectionRenderer.js';

// Import all panels to ensure they register themselves
import '../panels/themes/ThemeSelectorPanel.js'; // Theme selector panel
import '../panels/css-design/ThemeEditorPanel.js'; // Theme Editor panel
import '../panels/icons/IconsPanel.js'; // Icons management panel
import '../panels/plugins/PluginsPanel.js';
import '../panels/publish/PublishSettingsPanel.js';
import '../panels/preview/PreviewSettingsPanel.js';
import '../panels/javascript/JavaScriptPanel.js';
import '../panels/console/ConsoleLogPanel.js';
import '../panels/dev-tools/DevToolsPanel.js';
import '../panels/api-tokens/ApiTokenPanel.js'; // API Token management panel
import '../panels/css-files/CssFilesPanel.js'; // Modern CSS file management panel
// Removed panels: ThemeSettingsPanel, ThemeDesignPanel, DesignerThemePanel, DesignTokensPanel, SystemCssPanel

const SETTINGS_CSS_ID = 'settings-panel-styles-link'; // Unique ID for the link tag
const SETTINGS_PANEL_STATE_KEY = 'devpages_settings_panel_state'; // Single source of truth

// Helper for logging
function logSettings(message, level = 'info') {
  const type = 'SETTINGS_PANEL';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

// Helper to load persisted settings panel state
function loadPersistedSettingsState() {
  try {
    const savedState = localStorage.getItem(SETTINGS_PANEL_STATE_KEY);
    if (savedState) {
      const parsed = JSON.parse(savedState);
      logSettings(`Loaded persisted settings state: ${JSON.stringify(parsed)}`, 'debug');
      return parsed;
    }
  } catch (e) {
    logSettings(`Failed to load persisted settings state: ${e}`, 'error');
  }
  return null;
}

export class SettingsPanel {
  constructor(options = {}) {
    try {
      logSettings('[DEBUG] SettingsPanel constructor started.');
      
      // --- Inject CSS --- 
      logSettings('[DEBUG] Injecting styles...');
      this.injectStyles();
      logSettings('[DEBUG] Styles injected successfully.');

    this.panelElement = null;
    this.headerElement = null;
    this.contentElement = null;
    this.resizeHandle = null;
    this.closeButton = null;

    // Generic container for all panel instances
    this.sectionInstances = {};

    this.isDragging = false;
    this.isResizing = false;
    this.dragOffset = { x: 0, y: 0 };
    this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };

    // Load persisted state first, then merge with store state
    const persistedState = loadPersistedSettingsState();
    if (persistedState) {
      // Dispatch to update store with persisted state
      dispatch({
        type: ActionTypes.SETTINGS_PANEL_SET_STATE,
        payload: persistedState
      });
    }

    // Get initial state directly from the store (now updated with persisted state)
    const initialState = appStore.getState().settingsPanel;
    this.currentPos = { ...initialState.position }; // Local copy for interaction updates
    this.currentSize = { ...initialState.size }; // Local copy for interaction updates

    this.stateUnsubscribe = null;

    this.initializePanel();
    this.subscribeToState();

    // Initial render based on store state
    this.render(initialState);
    
    // Initialize visibility from store state, not hardcoded
    this.isVisible = initialState.visible || false;
    
    // Apply initial visibility state to DOM
    this.updatePanelState();
    
    logSettings('SettingsPanel instance created and initialized.');
    logSettings(`Initial visibility state: ${this.isVisible}`, 'debug');
    } catch (error) {
      logSettings(`[ERROR] SettingsPanel constructor failed: ${error.message}`, 'error');
      console.error('[SETTINGS PANEL] Constructor error:', error);
      throw error; // Re-throw to let the initializer handle it
    }
  }

  // --- Method to inject CSS link tag --- 
  injectStyles() {
    if (!document.getElementById(SETTINGS_CSS_ID)) {
      const link = document.createElement('link');
      link.id = SETTINGS_CSS_ID;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = '/client/settings/core/settings.css'; // Path to the CSS file
      document.head.appendChild(link);
      logSettings('Injected settings.css link tag.', 'debug');
    } else {
      logSettings('settings.css link tag already exists.', 'debug');
    }
  }

  // --- Method to remove CSS link tag --- 
  removeStyles() {
    const link = document.getElementById(SETTINGS_CSS_ID);
    if (link) {
      document.head.removeChild(link);
      logSettings('Removed settings.css link tag.', 'debug');
    }
  }

  // --- IMPROVED Method to handle section collapse/expand ---
  toggleSectionCollapse(sectionId) {
    logSettings(`Toggling collapse for section: ${sectionId}`);
    
    // Use registry method to toggle through the store
    settingsSectionRegistry.toggleSection(sectionId);
    
    logSettings(`Section ${sectionId} toggle dispatched`, 'debug');
  }
  // --- End IMPROVED Method --- 
  
  // --- IMPROVED updatePanelState Method ---
  updatePanelState() {
    if (!this.panelElement) return;
    const state = appStore.getState().settingsPanel || {};

    // Update visibility based on internal state (controlled by toggleVisibility)
    const shouldBeVisible = this.isVisible;
    this.panelElement.style.display = shouldBeVisible ? 'flex' : 'none';

    // Use local copies for position/size if dragging/resizing
    const posX = this.isDragging ? this.currentPos.x : state.position.x;
    const posY = this.isDragging ? this.currentPos.y : state.position.y;
    const width = this.isResizing ? this.currentSize.width : state.size.width;
    const height = this.isResizing ? this.currentSize.height : state.size.height;

    this.panelElement.style.left = `${posX}px`;
    this.panelElement.style.top = `${posY}px`;
    this.panelElement.style.width = `${width}px`;
    this.panelElement.style.height = `${height}px`;
    
    // Handle accessibility attributes
    if (shouldBeVisible) {
      this.panelElement.removeAttribute('aria-hidden');
      this.panelElement.removeAttribute('inert');
    } else {
      this.panelElement.setAttribute('inert', '');
      this.panelElement.removeAttribute('aria-hidden');
    }
  }

  initializePanel() {
    this.createPanelDOM();
    this.attachEventListeners();
    this.updatePanelState();
  }

  createPanelDOM() {
    logSettings('[DEBUG] Starting createPanelDOM...');
    // 1. Create main panel elements
    this.panelElement = document.createElement('div');
    this.panelElement.id = 'settings-panel';
    this.panelElement.classList.add('settings-panel');
    this.panelElement.setAttribute('role', 'dialog');
    this.panelElement.setAttribute('aria-label', 'Application Settings Panel');
    this.panelElement.setAttribute('aria-modal', 'true');
    this.panelElement.style.position = 'fixed';
    this.panelElement.style.zIndex = '9998';
    this.panelElement.style.display = 'none';

    this.headerElement = document.createElement('div');
    this.headerElement.classList.add('settings-panel-header');
    this.headerElement.innerHTML = `
        <span class="settings-panel-title">Settings</span>
        <button class="settings-panel-close" aria-label="Close Settings Panel">X</button>
    `;
    this.closeButton = this.headerElement.querySelector('.settings-panel-close');

    this.contentElement = document.createElement('div');
    this.contentElement.classList.add('settings-panel-content');

    // Create resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.classList.add('settings-panel-resize-handle');
    this.resizeHandle.innerHTML = '⋰'; // Resize icon
    logSettings('[DEBUG] Resize handle created.', 'debug');

    // Use the new renderer for all sections
    renderSettingsSections(
      this.contentElement,
      this.sectionInstances,
      this.toggleSectionCollapse.bind(this)
    );

    // 5. Append elements and finish
    this.panelElement.appendChild(this.headerElement);
    this.panelElement.appendChild(this.contentElement);
    this.panelElement.appendChild(this.resizeHandle);
    document.body.appendChild(this.panelElement);
    logSettings('[DEBUG] Panel appended to body.', 'debug');
  }

  attachEventListeners() {
    // --- Dragging --- 
    this.headerElement.addEventListener('mousedown', this.startDrag.bind(this));

    // --- Resizing --- 
    this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));

    // --- Closing --- 
    this.closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleVisibility(false); // Explicitly pass false to hide
    });
    
    // Prevent drag start when clicking close button
    this.closeButton.addEventListener('mousedown', (e) => e.stopPropagation());

    // --- Global listeners for drag/resize --- 
    // Use arrow functions to maintain 'this' context
    this.handleMouseMove = (e) => {
        if (this.isDragging) this.doDrag(e);
        if (this.isResizing) this.doResize(e);
    };
    this.handleMouseUp = () => {
        if (this.isDragging) this.endDrag();
        if (this.isResizing) this.endResize();
    };

    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  subscribeToState() {
    this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
      // Only re-render if the relevant part of the state has changed
      if (newState.settingsPanel !== prevState.settingsPanel) {
        this.render(newState.settingsPanel);
      }
    });
  }

  // Render updates based on the settingsPanel state slice
  render(settingsState) {
    if (!this.panelElement) return;

    logSettings('[DEBUG] render() called', 'debug');
    logSettings(`[DEBUG] settingsState.collapsedSections: ${JSON.stringify(settingsState.collapsedSections)}`, 'debug');

    // Update visibility state from store if it has changed
    if (this.isVisible !== settingsState.visible) {
      this.isVisible = settingsState.visible;
      logSettings(`Visibility state updated from store: ${this.isVisible}`, 'debug');
    }
    
    // Only update position/size if not actively dragging/resizing
    if (!this.isDragging) {
      this.panelElement.style.left = `${settingsState.position.x}px`;
      this.panelElement.style.top = `${settingsState.position.y}px`;
      this.currentPos = { ...settingsState.position };
    }
    
    if (!this.isResizing) {
      this.panelElement.style.width = `${settingsState.size.width}px`;
      this.panelElement.style.height = `${settingsState.size.height}px`;
      this.currentSize = { ...settingsState.size };
    }

    // Update DOM visibility based on current state
    this.updatePanelState();

    // Update individual section states
    const collapsedSections = settingsState.collapsedSections || {};
    logSettings(`[DEBUG] Processing ${Object.keys(collapsedSections).length} collapsed section states`, 'debug');
    
    for (const sectionId in collapsedSections) {
        if (Object.prototype.hasOwnProperty.call(collapsedSections, sectionId)) {
            const isCollapsed = collapsedSections[sectionId];
            const sectionContainer = this.panelElement.querySelector(`#${sectionId}`);
            
            logSettings(`[DEBUG] Looking for section: ${sectionId}, found: ${!!sectionContainer}, collapsed: ${isCollapsed}`, 'debug');
            
            if (sectionContainer) {
                const header = sectionContainer.querySelector('.settings-section-header');
                const indicator = header ? header.querySelector('.collapse-indicator') : null;

                sectionContainer.classList.toggle('collapsed', isCollapsed);
                if (header) header.setAttribute('aria-expanded', !isCollapsed);
                if (indicator) indicator.innerHTML = isCollapsed ? '&#9654;' : '&#9660;';
                
                logSettings(`[DEBUG] Updated section ${sectionId} collapsed state to ${isCollapsed}`, 'debug');
            } else {
                logSettings(`[DEBUG] Section ${sectionId} not found in DOM - ignoring`, 'debug');
            }
        }
    }
    
    logSettings('[DEBUG] render() completed', 'debug');
  }

  // --- Interaction Handlers --- 

  toggleVisibility(forceShow) {
    // Allow explicit showing/hiding, or toggle current state
    const newVisibility = forceShow !== undefined ? forceShow : !(this.panelElement.style.display === 'flex');
    
    // Update the internal state variable FIRST
    this.isVisible = newVisibility;
    
    // Then update the DOM state via updatePanelState for consistency
    this.updatePanelState();
    
    // State is automatically persisted by the reducer
    
    // Update app state through dispatch
    try {
      dispatch({ 
        type: ActionTypes.SETTINGS_PANEL_TOGGLE,
        payload: { enabled: newVisibility }
      });
    } catch (e) {
      console.error('Failed to dispatch settings panel state change:', e);
    }
    
    return newVisibility;
  }

  startDrag(event) {
    // Prevent text selection during drag
    event.preventDefault();
    // Ensure drag only starts on header itself, not buttons inside
    if (event.target !== this.headerElement && event.target !== this.headerElement.querySelector('.settings-panel-title')) {
        return;
    }
    this.isDragging = true;
    const rect = this.panelElement.getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    this.panelElement.style.cursor = 'grabbing';
    this.panelElement.classList.add('dragging'); // Optional: for styling
    logSettings('Drag started.', 'debug');
  }

  doDrag(event) {
    if (!this.isDragging) return;
    // Calculate new position
    this.currentPos.x = event.clientX - this.dragOffset.x;
    this.currentPos.y = event.clientY - this.dragOffset.y;
    // Update element style directly for smooth feedback
    this.panelElement.style.left = `${this.currentPos.x}px`;
    this.panelElement.style.top = `${this.currentPos.y}px`;
  }

  endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.panelElement.style.cursor = 'grab';
    this.panelElement.classList.remove('dragging');
    // Dispatch final position to update the store
    dispatch({ type: ActionTypes.SETTINGS_PANEL_SET_POSITION, payload: this.currentPos });
  }

  startResize(event) {
    event.preventDefault();
    event.stopPropagation(); // Prevent drag start
    this.isResizing = true;
    this.resizeStart = {
      x: event.clientX,
      y: event.clientY,
      width: this.panelElement.offsetWidth,
      height: this.panelElement.offsetHeight
    };
    this.panelElement.classList.add('resizing'); // Optional: for styling
  }

  doResize(event) {
    if (!this.isResizing) return;
    // Calculate new dimensions (with minimum constraints)
    const newWidth = Math.max(250, this.resizeStart.width + (event.clientX - this.resizeStart.x));
    const newHeight = Math.max(150, this.resizeStart.height + (event.clientY - this.resizeStart.y));
    this.currentSize.width = newWidth;
    this.currentSize.height = newHeight;
    // Update element style directly
    this.panelElement.style.width = `${newWidth}px`;
    this.panelElement.style.height = `${newHeight}px`;
  }

  endResize() {
    if (!this.isResizing) return;
    this.isResizing = false;
    this.panelElement.classList.remove('resizing');
    // Dispatch final size to update the store
    dispatch({ type: ActionTypes.SETTINGS_PANEL_SET_SIZE, payload: this.currentSize });
  }

  // Method to clean up listeners and remove element
  destroy() {
    logSettings('Destroying SettingsPanel instance...');
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }

    // Remove global listeners
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);

    // Remove element from DOM
    if (this.panelElement && this.panelElement.parentNode) {
      this.panelElement.parentNode.removeChild(this.panelElement);
    }
    this.panelElement = null;
    this.headerElement = null;
    this.contentElement = null;
    this.resizeHandle = null;
    this.closeButton = null;

    // Destroy all panel instances
    Object.values(this.sectionInstances).forEach(sectionInstance => {
      if (sectionInstance && typeof sectionInstance.destroy === 'function') {
        sectionInstance.destroy();
      }
    });
    this.sectionInstances = {};

    // --- Remove CSS --- 
    this.removeStyles();

    logSettings('SettingsPanel destroyed.');
  }
}
