/**
 * client/settings/SettingsPanel.js
 * Draggable, resizable settings panel component.
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { panelRegistry } from './panelRegistry.js';
import { logMessage } from '/client/log/index.js';

// Import all panels to ensure they register themselves
import './ThemeSettingsPanel.js';
import './DesignerThemePanel.js';
import './PluginsPanel.js';
import './CssSettingsPanel.js';
import './SystemCssPanel.js';
import './PublishSettingsPanel.js';
import './PreviewSettingsPanel.js';
import './JavaScriptPanel.js';
import './ConsoleLogPanel.js';
import './DevToolsPanel.js';
import './DesignTokensPanel.js';

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
    // --- Inject CSS --- 
    this.injectStyles();

    this.panelElement = null;
    this.headerElement = null;
    this.contentElement = null;
    this.resizeHandle = null;
    this.closeButton = null;

    // Generic container for all panel instances
    this.panelInstances = {};

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
    
    // Visibility is managed by the reducer system, not localStorage directly
    this.isVisible = false; // Default to hidden
    
    logSettings('SettingsPanel instance created and initialized.');
  }

  // --- Method to inject CSS link tag --- 
  injectStyles() {
    if (!document.getElementById(SETTINGS_CSS_ID)) {
      const link = document.createElement('link');
      link.id = SETTINGS_CSS_ID;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = '/client/settings/settings.css'; // Path to the CSS file
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

  // --- Moved Helper Method --- 
  // Helper to create section containers with headers
  createSectionContainer(id, title) {
    const container = document.createElement('div');
    container.id = id;
    container.classList.add('settings-section-container');

    const header = document.createElement('h4');
    header.classList.add('settings-section-header');
    header.tabIndex = 0; // Make focusable
    header.setAttribute('role', 'button'); // Indicate interactive
    
    // Get current state from registry (which includes store state)
    const panelWithState = panelRegistry.getPanelWithState(id);
    const isCollapsed = panelWithState ? panelWithState.isCollapsed : false;
    
    header.setAttribute('aria-expanded', !isCollapsed); // Set based on current state
    
    // Title Text
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    
    // Collapse Indicator - Set based on current state
    const indicator = document.createElement('span');
    indicator.classList.add('collapse-indicator');
    indicator.innerHTML = isCollapsed ? '&#9654;' : '&#9660;'; // Right for collapsed, Down for expanded
    indicator.setAttribute('aria-hidden', 'true'); // Hide from screen readers

    header.appendChild(indicator);
    header.appendChild(titleSpan);
    
    // Click listener for collapsing - use registry method
    header.addEventListener('click', () => this.toggleSectionCollapse(id));
    // Allow keyboard activation (Enter/Space)
    header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.toggleSectionCollapse(id);
        }
    });

    container.appendChild(header);
    
    // Apply collapsed state to container based on current state
    if (isCollapsed) {
      container.classList.add('collapsed');
      logSettings(`Section ${id} restored as collapsed`, 'debug');
    } else {
      logSettings(`Section ${id} restored as expanded`, 'debug');
    }
    
    // Content of the section will be added later by the specific panel
    return container;
  }

  // --- IMPROVED Method to handle section collapse/expand ---
  toggleSectionCollapse(sectionId) {
    logSettings(`Toggling collapse for section: ${sectionId}`);
    
    // Use registry method to toggle through the store
    panelRegistry.togglePanel(sectionId);
    
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

    // --- CREATE RESIZE HANDLE ---
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.classList.add('settings-panel-resize-handle');
    this.resizeHandle.setAttribute('aria-label', 'Resize Settings Panel');
    this.resizeHandle.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8L14 14M10 14H14V10" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"/></svg>`;
    logSettings('[DEBUG] Main panel elements created.', 'debug');

    // 2. Append main parts to panelElement
    this.panelElement.appendChild(this.headerElement);
    this.panelElement.appendChild(this.contentElement); 
    this.panelElement.appendChild(this.resizeHandle);
    logSettings('[DEBUG] Main panel structure assembled.', 'debug');

    // 3. Append the main panel to the document body
    document.body.appendChild(this.panelElement);
    logSettings('[DEBUG] Panel appended to body.', 'debug');

    // 4. DATA-DRIVEN PANEL CREATION - Get panels from registry with their current state
    const panelsToRender = panelRegistry.getPanelsWithState();
    logSettings(`[DEBUG] Found ${panelsToRender.length} registered panels to render`, 'debug');

    panelsToRender.forEach(panelData => {
      logSettings(`[DEBUG] Creating panel: ${panelData.id} (${panelData.title})`, 'debug');
      
      try {
        // Create the section container using the data's properties
        const container = this.createSectionContainer(panelData.id, panelData.title);
        
        // Apply current collapsed state from registry (which includes store state)
        if (panelData.isCollapsed) {
          container.classList.add('collapsed');
        }
        
        if (container instanceof Node) {
          this.contentElement.appendChild(container);
          
          // Create a content wrapper inside the container for the panel to use
          const contentWrapper = document.createElement('div');
          contentWrapper.classList.add('settings-section-content');
          container.appendChild(contentWrapper);
          
          // Instantiate the component from the data, passing the content wrapper
          const PanelComponent = panelData.component;
          this.panelInstances[panelData.id] = new PanelComponent(contentWrapper);
          
          logSettings(`[DEBUG] ${panelData.id} instantiated successfully.`, 'debug');
        } else {
          logSettings(`[ERROR] Container for ${panelData.id} was not a valid Node!`, 'error');
        }
      } catch (error) {
        logSettings(`Failed to init ${panelData.id}: ${error}`, 'error');
        // Create error container if panel creation failed
        const errorContainer = this.createSectionContainer(panelData.id, panelData.title);
        const errorContent = document.createElement('div');
        errorContent.classList.add('settings-section-content');
        errorContent.innerHTML = '<p style="color: var(--color-warning, #f59e0b); background-color: var(--color-warning-background, #fff3cd); padding: 0.5rem; border-radius: 0.25rem; margin: 0.5rem 0;">Error loading panel.</p>';
        errorContainer.appendChild(errorContent);
        this.contentElement.appendChild(errorContainer);
      }
    });

    logSettings('Data-driven panel creation completed.', 'debug');
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

    // Don't update display property here - we handle that in toggleVisibility
    // Only manage other properties
    
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

    // Update collapsed sections based on state - use registry to get current state
    const panelsWithState = panelRegistry.getPanelsWithState();
    panelsWithState.forEach(panel => {
      const container = this.contentElement?.querySelector(`#${panel.id}`);
      const isCollapsed = panel.isCollapsed;
      
      if (container) {
        const header = container.querySelector('.settings-section-header');
        const indicator = container.querySelector('.collapse-indicator');
        
        container.classList.toggle('collapsed', isCollapsed);
        if (header) {
          header.setAttribute('aria-expanded', !isCollapsed);
        }
        if (indicator) {
          indicator.innerHTML = isCollapsed ? '&#9654;' : '&#9660;';
        }
      }
    });
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
    Object.values(this.panelInstances).forEach(panelInstance => {
      if (panelInstance && typeof panelInstance.destroy === 'function') {
        panelInstance.destroy();
      }
    });
    this.panelInstances = {};

    // --- Remove CSS --- 
    this.removeStyles();

    logSettings('SettingsPanel destroyed.');
  }
}
