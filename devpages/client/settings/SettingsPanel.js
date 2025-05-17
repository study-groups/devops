/**
 * client/settings/SettingsPanel.js
 * Draggable, resizable settings panel component.
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { PluginsPanel } from './PluginsPanel.js'; // Import the new panel
import { CssSettingsPanel } from './CssSettingsPanel.js';
import { JavaScriptPanel } from './JavaScriptPanel.js';
import { DeveloperPanel } from './DeveloperPanel.js';

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
    this.cssSettingsPanelInstance = null; // Renamed from cssSettingsInstance
    this.jsPanelInstance = null;
    this.developerPanelInstance = null;

    this.isDragging = false;
    this.isResizing = false;
    this.dragOffset = { x: 0, y: 0 };
    this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };

    // Get initial state directly from the store
    const initialState = appStore.getState().settingsPanel;
    this.currentPos = { ...initialState.position }; // Local copy for interaction updates
    this.currentSize = { ...initialState.size }; // Local copy for interaction updates

    this.stateUnsubscribe = null;

    this.initializePanel();
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
    header.setAttribute('aria-expanded', 'true'); // Default state
    
    // Title Text
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    
    // Collapse Indicator
    const indicator = document.createElement('span');
    indicator.classList.add('collapse-indicator');
    indicator.innerHTML = '&#9660;'; // Down arrow initially (expanded)
    indicator.setAttribute('aria-hidden', 'true'); // Hide from screen readers

    header.appendChild(indicator);
    header.appendChild(titleSpan);
    
    // Click listener for collapsing
    header.addEventListener('click', () => this.toggleSectionCollapse(id, container, header, indicator));
    // Allow keyboard activation (Enter/Space)
    header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.toggleSectionCollapse(id, container, header, indicator);
        }
    });

    container.appendChild(header);
    // Content of the section will be added later by the specific panel
    return container;
  }

  // --- NEW Method to handle section collapse/expand ---
  toggleSectionCollapse(sectionId, containerElement, headerElement, indicatorElement) {
    logSettings(`Toggling collapse for section: ${sectionId}`);
    const isCurrentlyCollapsed = containerElement.classList.contains('collapsed');
    const shouldCollapse = !isCurrentlyCollapsed;

    // Dispatch action to update state
    dispatch({
        type: ActionTypes.SETTINGS_PANEL_TOGGLE_SECTION,
        payload: { sectionId: sectionId }
    });

    // Update UI immediately (state update will confirm later via render)
    containerElement.classList.toggle('collapsed', shouldCollapse);
    headerElement.setAttribute('aria-expanded', !shouldCollapse);
    indicatorElement.innerHTML = shouldCollapse ? '&#9654;' : '&#9660;'; // Right/Down arrow
  }
  // --- End NEW Method --- 
  
  // --- Moved updatePanelState Method ---
  updatePanelState() {
    if (!this.panelElement) return;
    const state = appStore.getState().settingsPanel || {};

    // Update visibility based on internal state (controlled by toggleVisibility)
    this.panelElement.style.display = this.isVisible ? 'flex' : 'none';

    // Use local copies for position/size if dragging/resizing
    const posX = this.isDragging ? this.currentPos.x : state.position.x;
    const posY = this.isDragging ? this.currentPos.y : state.position.y;
    const width = this.isResizing ? this.currentSize.width : state.size.width;
    const height = this.isResizing ? this.currentSize.height : state.size.height;

    this.panelElement.style.left = `${posX}px`;
    this.panelElement.style.top = `${posY}px`;
    this.panelElement.style.width = `${width}px`;
    this.panelElement.style.height = `${height}px`;
    
    // Update ARIA hidden state based on visibility
    this.panelElement.setAttribute('aria-hidden', !this.isVisible);

    logSettings('Panel state updated (pos, size, visibility).', 'debug');
  }
  // --- End Moved updatePanelState ---

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

    // --- CREATE RESIZE HANDLE --- (Ensure it's created here)
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.classList.add('settings-panel-resize-handle');
    this.resizeHandle.setAttribute('aria-label', 'Resize Settings Panel');
    this.resizeHandle.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8L14 14M10 14H14V10" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"/></svg>`;
    logSettings('[DEBUG] Main panel elements created.', 'debug');

    // 2. Append main parts to panelElement
    this.panelElement.appendChild(this.headerElement);
    this.panelElement.appendChild(this.contentElement); 
    this.panelElement.appendChild(this.resizeHandle); // Append the handle
    logSettings('[DEBUG] Main panel structure assembled.', 'debug');

    // 3. Append the main panel to the document body
    document.body.appendChild(this.panelElement);
    logSettings('[DEBUG] Panel appended to body.', 'debug');

    // 4. Now, create section containers and instantiate sub-panels within the contentElement
    const collapsedSections = appStore.getState().settingsPanel.collapsedSections || {}; // Get initial collapsed state
    
    // Instantiate PluginsPanel
    logSettings('[DEBUG] Creating Plugins Panel Section...', 'debug');
    const pluginsContainer = this.createSectionContainer('plugins-settings-container', 'Plugins');
    if (collapsedSections['plugins-settings-container']) { pluginsContainer.classList.add('collapsed'); } // Apply initial state
    if (pluginsContainer instanceof Node) {
        this.contentElement.appendChild(pluginsContainer);
        try {
            this.pluginsPanelInstance = new PluginsPanel(pluginsContainer);
            logSettings('[DEBUG] PluginsPanel Instantiated successfully.', 'debug');
        } catch (error) {
            logSettings(`Failed to init PluginsPanel: ${error}`, 'error');
            pluginsContainer.innerHTML = '<p style="color: red;">Error loading plugin settings.</p>';
        }
    } else {
        logSettings('[ERROR] pluginsContainer was not a valid Node!', 'error');
    }

    // Instantiate CssSettingsPanel
    logSettings('[DEBUG] Creating CSS Panel Section...', 'debug');
    const cssContainer = this.createSectionContainer('css-settings-container', 'Preview CSS');
    if (collapsedSections['css-settings-container']) { cssContainer.classList.add('collapsed'); } // Apply initial state
    if (cssContainer instanceof Node) {
        this.contentElement.appendChild(cssContainer);
        try {
            this.cssSettingsPanelInstance = new CssSettingsPanel(cssContainer); 
            logSettings('[DEBUG] CssSettingsPanel Instantiated successfully.', 'debug');
        } catch (error) {
            logSettings(`Failed to init CssSettingsPanel: ${error}`, 'error');
            cssContainer.innerHTML = '<p style="color: red;">Error loading CSS settings.</p>';
        }
    } else {
         logSettings('[ERROR] cssContainer was not a valid Node!', 'error');
    }
    
    // Instantiate JavaScriptPanel
    logSettings('[DEBUG] Creating JS Panel Section...', 'debug');
    const jsContainer = this.createSectionContainer('js-settings-container', 'Preview JavaScript');
    if (collapsedSections['js-settings-container']) { jsContainer.classList.add('collapsed'); } // Apply initial state
    if (jsContainer instanceof Node) {
        this.contentElement.appendChild(jsContainer);
        try {
            logSettings('[DEBUG] Instantiating JavaScriptPanel...', 'debug');
            this.jsPanelInstance = new JavaScriptPanel(jsContainer);
            logSettings('[DEBUG] JavaScriptPanel Instantiated successfully.', 'debug');
        } catch (error) {
            logSettings(`Failed to init JavaScriptPanel: ${error}`, 'error');
            jsContainer.innerHTML = '<p style="color: red;">Error loading JavaScript info.</p>';
        }
    } else {
        logSettings('[ERROR] jsContainer was not a valid Node!', 'error');
    }

    // Instantiate DeveloperPanel
    logSettings('[DEBUG] Creating Developer Options Section...', 'debug');
    const devContainer = this.createSectionContainer('dev-settings-container', 'Developer Options');
    if (collapsedSections['dev-settings-container']) { devContainer.classList.add('collapsed'); }
    if (devContainer instanceof Node) {
        this.contentElement.appendChild(devContainer);
        try {
            this.developerPanelInstance = new DeveloperPanel(devContainer);
            logSettings('[DEBUG] DeveloperPanel Instantiated successfully.', 'debug');
        } catch (error) {
            logSettings(`Failed to init DeveloperPanel: ${error}`, 'error');
            devContainer.innerHTML = '<p style="color: red;">Error loading developer options.</p>';
        }
    } else {
        logSettings('[ERROR] devContainer was not a valid Node!', 'error');
    }

    logSettings('Panel content and sub-panels created.', 'debug');
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

    // Destroy child panels
    this.cssSettingsPanelInstance?.destroy();
    this.jsPanelInstance?.destroy();
    this.developerPanelInstance?.destroy();

    // --- Remove CSS --- 
    this.removeStyles();

    logSettings('SettingsPanel destroyed.');
  }
}

// Optionally, automatically instantiate if needed globally
// export const globalSettingsPanel = new SettingsPanel();
