/**
 * client/settings/SettingsPanel.js
 * Draggable, resizable settings panel component.
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { PluginsPanel } from './PluginsPanel.js'; // Import the new panel

const SETTINGS_CSS_ID = 'settings-panel-styles-link'; // Unique ID for the link tag
const SETTINGS_PANEL_VISIBLE_KEY = 'settings_panel_visible';

// Helper for logging
function logSettings(message, level = 'info') {
  const type = 'SETTINGS_PANEL';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
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

    this.pluginsPanelInstance = null; // Add property to hold the instance

    this.isDragging = false;
    this.isResizing = false;
    this.dragOffset = { x: 0, y: 0 };
    this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };

    // Get initial state directly from the store
    const initialState = appStore.getState().settingsPanel;
    this.currentPos = { ...initialState.position }; // Local copy for interaction updates
    this.currentSize = { ...initialState.size }; // Local copy for interaction updates

    this.stateUnsubscribe = null;

    this.createPanelDOM();
    this.attachEventListeners();
    this.subscribeToState();

    // Initial render based on store state
    this.render(initialState);
    
    // IMPORTANT: After render, check localStorage for saved visibility
    try {
      const savedVisible = localStorage.getItem(SETTINGS_PANEL_VISIBLE_KEY);
      if (savedVisible === 'true') {
        // Direct DOM update, don't use toggleVisibility to avoid unnecessary state changes
        this.panelElement.style.display = 'flex';
        this.isVisible = true;
      } else {
        // Ensure panel is hidden by default
        this.panelElement.style.display = 'none';
        this.isVisible = false;
      }
    } catch (e) {
      console.error('Error restoring settings panel visibility:', e);
    }
    
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

  createPanelDOM() {
    this.panelElement = document.createElement('div');
    this.panelElement.id = 'settings-panel';
    this.panelElement.classList.add('settings-panel');
    // Add ARIA roles for accessibility
    this.panelElement.setAttribute('role', 'dialog');
    this.panelElement.setAttribute('aria-label', 'Application Settings Panel');
    this.panelElement.setAttribute('aria-modal', 'true'); // Treat as modal when visible
    this.panelElement.style.position = 'fixed'; // Essential for dragging
    this.panelElement.style.zIndex = '9998'; // High z-index
    this.panelElement.style.display = 'none'; // Initially hidden

    // Header for dragging and title
    this.headerElement = document.createElement('div');
    this.headerElement.classList.add('settings-panel-header');
    this.headerElement.innerHTML = `
        <span class="settings-panel-title">Settings</span>
        <button class="settings-panel-close" aria-label="Close Settings Panel">X</button>
    `;
    this.closeButton = this.headerElement.querySelector('.settings-panel-close');

    // Content area
    this.contentElement = document.createElement('div');
    this.contentElement.classList.add('settings-panel-content');
    this.contentElement.innerHTML = '<p>Settings content will go here...</p>'; // Placeholder

    // Clear the placeholder content before adding the plugins panel
    this.contentElement.innerHTML = ''; 

    // Instantiate PluginsPanel and attach its content
    try {
      this.pluginsPanelInstance = new PluginsPanel(this.contentElement);
    } catch (error) {
      logSettings(`Failed to initialize PluginsPanel: ${error}`, 'error');
      this.contentElement.innerHTML = '<p style="color: red;">Error loading plugin settings.</p>';
    }

    // Resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.classList.add('settings-panel-resize-handle');
    this.resizeHandle.setAttribute('aria-label', 'Resize Settings Panel');
    // Basic SVG handle indicator
    this.resizeHandle.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8L14 14M10 14H14V10" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"/></svg>`;

    this.panelElement.appendChild(this.headerElement);
    this.panelElement.appendChild(this.contentElement);
    this.panelElement.appendChild(this.resizeHandle);

    document.body.appendChild(this.panelElement);
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
        logSettings('SettingsPanel state change detected, rendering.', 'debug');
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
  }

  // --- Interaction Handlers --- 

  toggleVisibility(forceShow) {
    // Allow explicit showing/hiding, or toggle current state
    const newVisibility = forceShow !== undefined ? forceShow : !(this.panelElement.style.display === 'flex');
    
    // Apply the visibility directly to the DOM
    this.panelElement.style.display = newVisibility ? 'flex' : 'none';
    this.isVisible = newVisibility; // Update the internal state variable
    
    // Save state to localStorage
    try {
      localStorage.setItem(SETTINGS_PANEL_VISIBLE_KEY, newVisibility);
    } catch (e) {
      console.error('Failed to save settings panel state:', e);
    }
    
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
    logSettings(`Drag ended. Dispatching new position: ${JSON.stringify(this.currentPos)}`, 'debug');
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
    logSettings('Resize started.', 'debug');
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
    logSettings(`Resize ended. Dispatching new size: ${JSON.stringify(this.currentSize)}`, 'debug');
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

    // Destroy the PluginsPanel instance if it exists
    if (this.pluginsPanelInstance) {
        this.pluginsPanelInstance.destroy();
        this.pluginsPanelInstance = null;
    }

    // --- Remove CSS --- 
    this.removeStyles();

    logSettings('SettingsPanel destroyed.');
  }
}

// Optionally, automatically instantiate if needed globally
// export const globalSettingsPanel = new SettingsPanel();
