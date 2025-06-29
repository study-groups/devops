/**
 * client/settings/SettingsPanel.js
 * Draggable, resizable settings panel component.
 */

import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { appStore } from '/client/appState.js';
import { settingsRegistry } from './settingsRegistry.js';
import { logMessage } from '/client/log/index.js';
import { panelEventBus } from './panelEventBus.js';
import { renderSettingsSections } from './SettingsSectionRenderer.js';
import { zIndexManager } from '/client/utils/ZIndexManager.js';

// DO NOT import panels here - they will be loaded dynamically after reducer is set
// This prevents the "No reducer set" error during initialization

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

// Track if panels have been loaded to avoid loading multiple times
let panelsLoaded = false;

// Dynamic panel loading function
async function loadAllPanels() {
  if (panelsLoaded) {
    logSettings('Panels already loaded, skipping...', 'debug');
    return;
  }

  logSettings('Starting dynamic panel loading...', 'debug');
  
  try {
    // Load all panels dynamically - this ensures they register after reducer is set
    const panelImports = [
      import('../panels/themes/ThemeSelectorPanel.js'),
      import('../panels/css-design/DesignTokensPanel.js'),
      import('../panels/icons/IconsPanel.js'),
      import('../panels/plugins/PluginsPanel.js'),
      import('../panels/publish/PublishSettingsPanel.js'),
      import('../panels/preview/PreviewSettingsPanel.js'),
      import('../panels/html-render/HtmlRenderSettingsPanel.js'),
      import('../panels/javascript/JavaScriptPanel.js'),
      import('../panels/console/ConsoleLogPanel.js'),
      import('../panels/dev-tools/DevToolsPanel.js'),
      import('../panels/api-tokens/ApiTokenPanel.js'),
      import('../panels/css-files/CssFilesPanel.js'),
      import('../panels/context/ContextManagerPanel.js')
    ];

    logSettings(`Attempting to load ${panelImports.length} panel modules...`, 'info');
    
    // Load panels one by one to better identify which one might be failing
    for (let i = 0; i < panelImports.length; i++) {
      try {
        const importPromise = panelImports[i];
        const modulePath = importPromise.toString();
        logSettings(`Loading panel module ${i+1}/${panelImports.length}: ${modulePath}`, 'debug');
        await importPromise;
        logSettings(`Successfully loaded panel module ${i+1}`, 'debug');
      } catch (error) {
        logSettings(`Failed to load panel module ${i+1}: ${error.message}`, 'error');
        console.error(`[SETTINGS PANEL] Failed to load panel module ${i+1}:`, error);
        // Continue with other panels even if one fails
      }
    }
    
    panelsLoaded = true;
    
    // Check registry state after loading
    logSettings(`After loading panels: ${settingsRegistry.count()} panels registered`, 'info');
    
    // If no panels were registered, something went wrong
    if (settingsRegistry.count() === 0) {
      logSettings('WARNING: No panels were registered after loading all modules!', 'warn');
      
      // Check if registry is accessible through devpages namespace
      if (window.devpages && window.devpages.settings && window.devpages.settings.registry) {
        const devpagesCount = window.devpages.settings.registry.count();
        logSettings(`Registry in devpages.settings.registry has ${devpagesCount} panels`, 'info');
      }
    }
    
    logSettings(`Successfully loaded ${settingsRegistry.count()} panels`, 'debug');
  } catch (error) {
    logSettings(`Failed to load panels: ${error.message}`, 'error');
    console.error('[SETTINGS PANEL] Panel loading error:', error);
    throw error;
  }
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

  // --- Method to dynamically load panels (called after reducer is set) ---
  async loadPanels() {
    try {
      logSettings('Starting to load panels...', 'info');
      
      await loadAllPanels();
      logSettings('All panel modules loaded successfully', 'info');
      
      // Check registry state before initializing
      logSettings(`Registry state before initializing: ${settingsRegistry.count()} panels registered`, 'info');
      settingsRegistry.debug();
      
      // Initialize all section states now that panels are registered and reducer is ready
      settingsRegistry.initializeAllStates();
      logSettings('All panel states initialized', 'info');
      
      // Check if registry is accessible through devpages namespace
      if (window.devpages && window.devpages.settings && window.devpages.settings.registry) {
        logSettings('Registry found in devpages.settings.registry', 'info');
      } else {
        logSettings('WARNING: Registry not found in devpages.settings.registry', 'warn');
      }
      
      // Now render all the sections since panels are loaded and registered
      logSettings('Rendering settings sections...', 'info');
      renderSettingsSections(
        this.contentElement,
        this.sectionInstances,
        this.toggleSectionCollapse.bind(this)
      );
      
      // Re-render after panels are loaded to show them
      const currentState = appStore.getState().settingsPanel;
      this.render(currentState);
      
      logSettings('Panel loading and rendering complete', 'info');
      return true;
    } catch (error) {
      logSettings(`Error loading panels: ${error.message}`, 'error');
      console.error('[SETTINGS_PANEL] Panel loading error:', error);
      
      // Add a visible error message to the panel
      if (this.contentElement) {
        this.contentElement.innerHTML = `
          <div class="settings-error-container">
            <h3>Error Loading Settings Panels</h3>
            <p>${error.message}</p>
            <pre>${error.stack}</pre>
          </div>
        `;
      }
      
      return false;
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
    
    // Add additional styles for Z-Index management
    if (!document.getElementById('settings-panel-z-index-styles')) {
      const additionalStyles = document.createElement('style');
      additionalStyles.id = 'settings-panel-z-index-styles';
      additionalStyles.textContent = `
        .settings-panel.brought-to-front {
          animation: bringToFrontFlash 0.2s ease-out;
        }
        
        @keyframes bringToFrontFlash {
          0% { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5); }
          100% { box-shadow: none; }
        }
        
        .settings-panel[data-z-managed="true"] {
          transition: box-shadow 0.2s ease;
        }
        
        .settings-panel[data-z-managed="true"]:hover {
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
        }
      `;
      document.head.appendChild(additionalStyles);
      logSettings('Injected Z-Index management styles.', 'debug');
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
    if (!sectionId) return;
    
    logSettings(`Toggle section collapse for ${sectionId}`, 'debug');
    
    try {
      // Dispatch action to toggle section collapse state
      dispatch({ 
        type: ActionTypes.SETTINGS_PANEL_TOGGLE_SECTION,
        payload: { sectionId }
      });
    } catch (e) {
      console.error(`Failed to toggle section ${sectionId}:`, e);
    }
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
    this.registerWithZIndexManager();
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

    // DO NOT render sections here - they will be rendered after panels are loaded
    // renderSettingsSections will be called in loadPanels() after dynamic loading

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

    // --- Click to bring to front ---
    this.panelElement.addEventListener('mousedown', (e) => {
      // Only bring to front if not clicking on specific interactive elements
      if (!e.target.closest('button, input, select, textarea, .settings-section-header')) {
        this.bringToFront();
      }
    });

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
    if (!this.panelElement || !this.contentElement) {
      logSettings('[DEBUG] Render called before panel DOM created. Aborting.', 'warn');
      return;
    }
    
    // Always re-render the sections to ensure new panels are shown
    renderSettingsSections(
      this.contentElement,
      this.sectionInstances,
      this.toggleSectionCollapse.bind(this)
    );

    // Update panel position and size from state
    this.panelElement.style.left = `${settingsState.position.x}px`;
    this.panelElement.style.top = `${settingsState.position.y}px`;
    this.panelElement.style.width = `${settingsState.size.width}px`;
    this.panelElement.style.height = `${settingsState.size.height}px`;

    // Update visibility from state
    this.panelElement.style.display = settingsState.visible ? 'flex' : 'none';
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

  // --- Z-Index Management ---

  registerWithZIndexManager() {
    if (this.panelElement && zIndexManager) {
      // Register the settings panel in the UI layer with medium priority
      this.zIndex = zIndexManager.register(this.panelElement, 'UI', 50, {
        name: 'Settings Panel',
        type: 'panel',
        resizable: true,
        draggable: true
      });
      
      logSettings(`Registered with Z-Index Manager: z-index ${this.zIndex}`, 'debug');
    }
  }

  bringToFront() {
    if (this.panelElement && zIndexManager) {
      const newZIndex = zIndexManager.bringToFront(this.panelElement);
      this.zIndex = newZIndex;
      logSettings(`Brought to front: z-index ${newZIndex}`, 'debug');
      
      // Add visual feedback
      this.panelElement.classList.add('brought-to-front');
      setTimeout(() => {
        this.panelElement.classList.remove('brought-to-front');
      }, 200);
    }
  }

  unregisterFromZIndexManager() {
    if (this.panelElement && zIndexManager) {
      zIndexManager.unregister(this.panelElement);
      logSettings('Unregistered from Z-Index Manager', 'debug');
    }
  }

  // Method to clean up listeners and remove element
  destroy() {
    logSettings('Destroying SettingsPanel instance...');
    
    // Unregister from Z-Index Manager
    this.unregisterFromZIndexManager();
    
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
