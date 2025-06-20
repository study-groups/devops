[1] /root/src/devops/devpages/client/settings/SettingsPanel.js
[2] /root/src/devops/devpages/client/settings/SettingsStateManager.js
[3] /root/src/devops/devpages/client/settings/settingsInitializer.js


#MULTICAT_START#
# dir: /root/src/devops/devpages/client/settings
# file: SettingsPanel.js
# notes:
#MULTICAT_END#
/**
 * client/settings/SettingsPanel.js
 * Draggable, resizable settings panel component.
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { PluginsPanel } from './PluginsPanel.js'; // Import the new panel
import { CssSettingsPanel } from './CssSettingsPanel.js';
import { PublishSettingsPanel } from './PublishSettingsPanel.js';
import { JavaScriptPanel } from './JavaScriptPanel.js';
import { ConsoleLogPanel } from './ConsoleLogPanel.js';
import { ThemeSettingsPanel } from './ThemeSettingsPanel.js';
import { clearCssCache } from '/client/utils/CssManager.js';
import { logMessage } from '/client/log/index.js';

const SETTINGS_CSS_ID = 'settings-panel-styles-link'; // Unique ID for the link tag
const SETTINGS_PANEL_VISIBLE_KEY = 'settings_panel_visible';
const SETTINGS_PANEL_STATE_KEY = 'devpages_settings_panel_state'; // Match the reducer key

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

    this.pluginsPanelInstance = null; // Add property to hold the instance
    this.cssSettingsPanelInstance = null; // Renamed from cssSettingsInstance
    this.publishSettingsPanelInstance = null; // Add property for publish settings
    this.jsPanelInstance = null;
    this.consoleLogPanelInstance = null;
    this.themeSettingsPanelInstance = null;

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
    
    // Check if this section should be collapsed based on persisted state
    const currentState = appStore.getState().settingsPanel;
    const isCollapsed = currentState.collapsedSections && currentState.collapsedSections[id];
    
    header.setAttribute('aria-expanded', !isCollapsed); // Set based on persisted state
    
    // Title Text
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    
    // Collapse Indicator - Set based on persisted state
    const indicator = document.createElement('span');
    indicator.classList.add('collapse-indicator');
    indicator.innerHTML = isCollapsed ? '&#9654;' : '&#9660;'; // Right for collapsed, Down for expanded
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
    
    // Apply collapsed state to container based on persisted state
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
  toggleSectionCollapse(sectionId, containerElement, headerElement, indicatorElement) {
    logSettings(`Toggling collapse for section: ${sectionId}`);
    const isCurrentlyCollapsed = containerElement.classList.contains('collapsed');
    const shouldCollapse = !isCurrentlyCollapsed;

    // Dispatch action to update state and persist
    dispatch({
        type: ActionTypes.SETTINGS_PANEL_TOGGLE_SECTION,
        payload: { sectionId: sectionId }
    });

    // Update UI immediately
    containerElement.classList.toggle('collapsed', shouldCollapse);
    headerElement.setAttribute('aria-expanded', !shouldCollapse);
    // Right arrow for collapsed, Down arrow for expanded
    indicatorElement.innerHTML = shouldCollapse ? '&#9654;' : '&#9660;';
    
    logSettings(`Section ${sectionId} ${shouldCollapse ? 'collapsed' : 'expanded'}`, 'debug');
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

    // 4. Now, create section containers and instantiate sub-panels within the contentElement
    
    // Instantiate ThemeSettingsPanel (KEEP EXPANDED BY DEFAULT for better UX)
    logSettings('[DEBUG] Creating Theme Settings Panel Section...', 'debug');
    const themeContainer = this.createSectionContainer('theme-settings-container', 'Theme & Design');
    // NOTE: createSectionContainer now handles collapsed state from persistence
    if (themeContainer instanceof Node) {
        this.contentElement.appendChild(themeContainer);
        try {
            this.themeSettingsPanelInstance = new ThemeSettingsPanel(themeContainer);
            logSettings('[DEBUG] ThemeSettingsPanel Instantiated successfully.', 'debug');
        } catch (error) {
            logSettings(`Failed to init ThemeSettingsPanel: ${error}`, 'error');
            themeContainer.innerHTML = '<p style="color: red;">Error loading theme settings.</p>';
        }
    } else {
        logSettings('[ERROR] themeContainer was not a valid Node!', 'error');
    }
    
    // Instantiate PluginsPanel
    logSettings('[DEBUG] Creating Plugins Panel Section...', 'debug');
    const pluginsContainer = this.createSectionContainer('plugins-settings-container', 'Plugins');
    // Start collapsed by default only if not persisted otherwise
    const currentState = appStore.getState().settingsPanel;
    if (!currentState.collapsedSections || currentState.collapsedSections['plugins-settings-container'] === undefined) {
      pluginsContainer.classList.add('collapsed'); // Default collapsed
    }
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
    const cssContainer = this.createSectionContainer('css-settings-container', 'CSS');
    // Default collapsed if not persisted otherwise
    if (!currentState.collapsedSections || currentState.collapsedSections['css-settings-container'] === undefined) {
      cssContainer.classList.add('collapsed');
    }
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
    
    // Instantiate PublishSettingsPanel
    logSettings('[DEBUG] Creating Publish Settings Panel Section...', 'debug');
    const publishContainer = this.createSectionContainer('publish-settings-container', 'Publish Settings');
    // Default collapsed if not persisted otherwise
    if (!currentState.collapsedSections || currentState.collapsedSections['publish-settings-container'] === undefined) {
      publishContainer.classList.add('collapsed');
    }
    if (publishContainer instanceof Node) {
        this.contentElement.appendChild(publishContainer);
        try {
            this.publishSettingsPanelInstance = new PublishSettingsPanel(publishContainer);
            logSettings('[DEBUG] PublishSettingsPanel Instantiated successfully.', 'debug');
        } catch (error) {
            logSettings(`Failed to init PublishSettingsPanel: ${error}`, 'error');
            publishContainer.innerHTML = '<p style="color: red;">Error loading publish settings.</p>';
        }
    } else {
        logSettings('[ERROR] publishContainer was not a valid Node!', 'error');
    }
    
    // Instantiate JavaScriptPanel
    logSettings('[DEBUG] Creating JS Panel Section...', 'debug');
    const jsContainer = this.createSectionContainer('js-settings-container', 'Preview JavaScript');
    // Default collapsed if not persisted otherwise
    if (!currentState.collapsedSections || currentState.collapsedSections['js-settings-container'] === undefined) {
      jsContainer.classList.add('collapsed');
    }
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

    // Instantiate ConsoleLogPanel
    logSettings('[DEBUG] Creating Console Log Panel Section...', 'debug');
    const consoleLogContainer = this.createSectionContainer('console-log-settings-container', 'Console Log Options');
    // Default collapsed if not persisted otherwise
    if (!currentState.collapsedSections || currentState.collapsedSections['console-log-settings-container'] === undefined) {
      consoleLogContainer.classList.add('collapsed');
    }
    if (consoleLogContainer instanceof Node) {
        this.contentElement.appendChild(consoleLogContainer);
        try {
            this.consoleLogPanelInstance = new ConsoleLogPanel(consoleLogContainer); 
            logSettings('[DEBUG] ConsoleLogPanel Instantiated successfully.', 'debug');
        } catch (error) {
            logSettings(`Failed to init ConsoleLogPanel: ${error}`, 'error');
            consoleLogContainer.innerHTML = '<p style="color: red;">Error loading console log options.</p>';
        }
    } else {
        logSettings('[ERROR] consoleLogContainer was not a valid Node!', 'error');
    }

    // Create Development Tools Section
    logSettings('[DEBUG] Creating Development Tools Section...', 'debug');
    const devContainer = this.createSectionContainer('dev-tools-container', 'Development Tools');
    // Default collapsed if not persisted otherwise
    if (!currentState.collapsedSections || currentState.collapsedSections['dev-tools-container'] === undefined) {
      devContainer.classList.add('collapsed');
    }
    if (devContainer instanceof Node) {
        this.contentElement.appendChild(devContainer);
        try {
            this.createDevToolsContent(devContainer);
            logSettings('[DEBUG] Development Tools Section created successfully.', 'debug');
        } catch (error) {
            logSettings(`Failed to create Development Tools: ${error}`, 'error');
            devContainer.innerHTML = '<p style="color: red;">Error loading development tools.</p>';
        }
    } else {
        logSettings('[ERROR] devContainer was not a valid Node!', 'error');
    }

    logSettings('Panel content and sub-panels created.', 'debug');
  }

  // Create Development Tools content
  createDevToolsContent(container) {
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('settings-section-content');
    
    // Create cache status display
    const statusDiv = document.createElement('div');
    statusDiv.classList.add('dev-tools-status');
    statusDiv.innerHTML = `
      <div class="status-item">
        <strong>Cache Status:</strong>
        <span id="cache-status">Unknown</span>
      </div>
      <div class="status-item">
        <strong>Dev Mode:</strong>
        <span id="dev-mode-status">${!window.location.hostname.includes('production') ? 'Enabled' : 'Disabled'}</span>
      </div>
    `;
    
    // Create buttons container
    const buttonsDiv = document.createElement('div');
    buttonsDiv.classList.add('dev-tools-buttons');
    
    // Clear CSS Cache button
    const clearCssBtn = document.createElement('button');
    clearCssBtn.classList.add('settings-button', 'dev-tool-button');
    clearCssBtn.textContent = '🎨 Clear CSS Cache';
    clearCssBtn.title = 'Clear all CSS caches and refresh stylesheets';
    clearCssBtn.addEventListener('click', () => this.clearCssCache());
    
    // Hard Refresh button
    const hardRefreshBtn = document.createElement('button');
    hardRefreshBtn.classList.add('settings-button', 'dev-tool-button');
    hardRefreshBtn.textContent = '🔄 Hard Refresh';
    hardRefreshBtn.title = 'Clear all caches and reload the page';
    hardRefreshBtn.addEventListener('click', () => this.hardRefresh());
    
    // Show Cache Status button
    const showStatusBtn = document.createElement('button');
    showStatusBtn.classList.add('settings-button', 'dev-tool-button');
    showStatusBtn.textContent = '📊 Show Cache Status';
    showStatusBtn.title = 'Show detailed cache information in console';
    showStatusBtn.addEventListener('click', () => this.showCacheStatus());
    
    buttonsDiv.appendChild(clearCssBtn);
    buttonsDiv.appendChild(hardRefreshBtn);
    buttonsDiv.appendChild(showStatusBtn);
    
    contentDiv.appendChild(statusDiv);
    contentDiv.appendChild(buttonsDiv);
    container.appendChild(contentDiv);
    
    // Update cache status display
    this.updateCacheStatus();
  }

  // Development tool methods
  clearCssCache() {
    logMessage('🎨 Clearing CSS caches...', 'info', 'DEV_TOOLS');
    clearCssCache();
    
    // Clear CSS-related localStorage
    const cssKeys = Object.keys(localStorage).filter(key => 
        key.includes('css') || key.includes('styles')
    );
    cssKeys.forEach(key => {
        logMessage(`Clearing cache key: ${key}`, 'debug', 'DEV_TOOLS');
        localStorage.removeItem(key);
    });
    
    this.updateCacheStatus();
    logMessage('✅ CSS caches cleared', 'info', 'DEV_TOOLS');
  }

  hardRefresh() {
    logMessage('🔄 Performing hard refresh...', 'info', 'DEV_TOOLS');
    
    // Clear CSS cache
    clearCssCache();
    
    // Clear browser caches if available
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => registration.unregister());
        });
    }
    
    // Clear localStorage cache keys
    const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('cache') || key.includes('timestamp') || key.includes('devpages_css')
    );
    cacheKeys.forEach(key => localStorage.removeItem(key));
    
    // Force page reload with cache bypass
    setTimeout(() => {
        window.location.reload(true);
    }, 100);
  }

  showCacheStatus() {
    const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('cache') || key.includes('timestamp') || key.includes('devpages')
    );
    
    console.group('📊 Cache Status');
    console.log('🗄️ localStorage cache keys:', cacheKeys);
    console.log('🌍 Location:', window.location.href);
    console.log('🔄 Dev mode:', !window.location.hostname.includes('production'));
    console.groupEnd();
    
    logMessage('📊 Cache status displayed in console', 'info', 'DEV_TOOLS');
    this.updateCacheStatus();
  }

  updateCacheStatus() {
    const statusElement = document.getElementById('cache-status');
    if (statusElement) {
      const cacheKeys = Object.keys(localStorage).filter(key => 
          key.includes('cache') || key.includes('timestamp') || key.includes('devpages')
      );
      statusElement.textContent = `${cacheKeys.length} cached items`;
    }
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

    // Update collapsed sections based on state
    if (settingsState.collapsedSections) {
      Object.keys(settingsState.collapsedSections).forEach(sectionId => {
        const container = this.contentElement?.querySelector(`#${sectionId}`);
        const isCollapsed = settingsState.collapsedSections[sectionId];
        
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
  }

  // --- Interaction Handlers --- 

  toggleVisibility(forceShow) {
    // Allow explicit showing/hiding, or toggle current state
    const newVisibility = forceShow !== undefined ? forceShow : !(this.panelElement.style.display === 'flex');
    
    // Update the internal state variable FIRST
    this.isVisible = newVisibility;
    
    // Then update the DOM state via updatePanelState for consistency
    this.updatePanelState();
    
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

    // Destroy the PluginsPanel instance if it exists
    if (this.pluginsPanelInstance) {
        this.pluginsPanelInstance.destroy();
        this.pluginsPanelInstance = null;
    }

    // Destroy child panels
    this.themeSettingsPanelInstance?.destroy();
    this.cssSettingsPanelInstance?.destroy();
    this.publishSettingsPanelInstance?.destroy();
    this.jsPanelInstance?.destroy();
    this.consoleLogPanelInstance?.destroy();

    // --- Remove CSS --- 
    this.removeStyles();

    logSettings('SettingsPanel destroyed.');
  }
}

#MULTICAT_START#
# dir: /root/src/devops/devpages/client/settings
# file: SettingsStateManager.js
# notes:
#MULTICAT_END#
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
#MULTICAT_START#
# dir: /root/src/devops/devpages/client/settings
# file: settingsInitializer.js
# notes:
#MULTICAT_END#
/**
 * client/settings/settingsInitializer.js
 * Initializes the Settings Panel component.
 */
import { SettingsPanel } from './SettingsPanel.js';

// Helper for logging
function logSettingsInit(message, level = 'info') {
  const type = 'SETTINGS_INIT';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

let settingsPanelInstance = null;

export function initializeSettingsPanel() {
  if (settingsPanelInstance) {
    return settingsPanelInstance;
  }
  
  try {
    settingsPanelInstance = new SettingsPanel();
    window.settingsPanel = settingsPanelInstance;
    
    // Restore state from localStorage immediately after creation
    try {
      const savedVisible = localStorage.getItem('settings_panel_visible');
      if (savedVisible === 'true') {
        settingsPanelInstance.toggleVisibility(true);
      }
    } catch (e) {}
    
    return settingsPanelInstance;
  } catch (error) {
    console.error('[SETTINGS INIT ERROR]', error);
    return null;
  }
}

// Optional: Add a function to destroy/clean up if needed during HMR or teardown
export function destroySettingsPanel() {
    if (settingsPanelInstance) {
        settingsPanelInstance.destroy();
        settingsPanelInstance = null;
        window.settingsPanel = undefined; // Clear global reference
        logSettingsInit('SettingsPanel instance destroyed.');
    }
}

