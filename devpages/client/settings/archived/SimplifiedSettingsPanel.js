/**
 * Simplified Settings Panel
 * Replaces the complex 464-line SettingsPanel.js with a clean, direct approach
 */

import { settingsRegistry } from './SettingsRegistry.js';
import { settingsEvents, EVENTS } from './EventBus.js';

export class SimplifiedSettingsPanel {
  constructor() {
    this.element = null;
    this.contentElement = null;
    this.closeButton = null;
    this.panelInstances = new Map();
    this.isVisible = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    
    this.position = this.loadPosition();
    this.size = this.loadSize();
    
    this.createPanel();
    this.setupEvents();
    this.renderPanels();
    
    // Mark registry as initialized
    settingsRegistry.markInitialized();
    
    console.log('[SimplifiedSettingsPanel] Initialized with', settingsRegistry.count(), 'panels');
  }
  
  /**
   * Create the main settings panel DOM
   */
  createPanel() {
    this.element = document.createElement('div');
    this.element.className = 'simplified-settings-panel';
    this.element.style.display = 'none';
    this.element.innerHTML = `
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="settings-close" aria-label="Close Settings">×</button>
      </div>
      <div class="settings-content"></div>
    `;
    
    this.contentElement = this.element.querySelector('.settings-content');
    this.closeButton = this.element.querySelector('.settings-close');
    
    // Apply saved position and size
    this.updatePosition();
    this.updateSize();
    
    document.body.appendChild(this.element);
    this.loadCSS();
  }
  
  /**
   * Load simplified CSS
   */
  loadCSS() {
    if (!document.getElementById('simplified-settings-css')) {
      const link = document.createElement('link');
      link.id = 'simplified-settings-css';
      link.rel = 'stylesheet';
      link.href = '/client/settings/simplified-settings.css';
      document.head.appendChild(link);
    }
  }
  
  /**
   * Setup event listeners
   */
  setupEvents() {
    // Close button
    this.closeButton.addEventListener('click', () => this.hide());
    
    // Dragging
    const header = this.element.querySelector('.settings-header');
    header.addEventListener('mousedown', (e) => this.startDrag(e));
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
    
    // Registry events
    settingsEvents.on(EVENTS.PANEL_REGISTERED, () => this.renderPanels());
    settingsEvents.on(EVENTS.PANEL_TOGGLED, (data) => this.handlePanelToggle(data));
    
    // Global mouse events for dragging
    document.addEventListener('mousemove', (e) => this.doDrag(e));
    document.addEventListener('mouseup', () => this.endDrag());
  }
  
  /**
   * Render all registered panels
   */
  renderPanels() {
    // Clear existing panels
    this.destroyPanelInstances();
    this.contentElement.innerHTML = '';
    
    const panels = settingsRegistry.getPanelsWithState();
    
    panels.forEach(panelConfig => {
      try {
        const section = this.createSection(panelConfig);
        this.contentElement.appendChild(section);
        
        // Instantiate panel if not collapsed
        if (!panelConfig.isCollapsed) {
          this.instantiatePanel(panelConfig);
        }
      } catch (error) {
        console.error(`[SimplifiedSettingsPanel] Failed to create panel '${panelConfig.id}':`, error);
        this.createErrorSection(panelConfig, error);
      }
    });
    
    console.debug('[SimplifiedSettingsPanel] Rendered', panels.length, 'panels');
  }
  
  /**
   * Create a section for a panel
   */
  createSection(config) {
    const section = document.createElement('div');
    section.className = 'settings-section';
    section.dataset.panelId = config.id;
    
    const isCollapsed = config.isCollapsed;
    
    section.innerHTML = `
      <div class="section-header" data-panel-id="${config.id}">
        <span class="collapse-icon">${isCollapsed ? '▶' : '▼'}</span>
        <h3 class="section-title">${config.title}</h3>
      </div>
      <div class="section-content" ${isCollapsed ? 'style="display: none"' : ''}></div>
    `;
    
    // Add click handler for header
    const header = section.querySelector('.section-header');
    header.addEventListener('click', () => {
      this.toggleSection(config.id);
    });
    
    return section;
  }
  
  /**
   * Create error section for failed panels
   */
  createErrorSection(config, error) {
    const section = document.createElement('div');
    section.className = 'settings-section settings-section--error';
    section.innerHTML = `
      <div class="section-header">
        <span class="collapse-icon">⚠</span>
        <h3 class="section-title">${config.title} (Error)</h3>
      </div>
      <div class="section-content">
        <div class="error-message">
          <p>Failed to load this panel.</p>
          <details>
            <summary>Error details</summary>
            <pre>${error.message}\n${error.stack}</pre>
          </details>
        </div>
      </div>
    `;
    
    this.contentElement.appendChild(section);
  }
  
  /**
   * Instantiate a panel component
   */
  instantiatePanel(config) {
    const section = this.element.querySelector(`[data-panel-id="${config.id}"]`);
    const contentElement = section.querySelector('.section-content');
    
    try {
      const PanelComponent = config.component;
      const panelInstance = new PanelComponent(contentElement);
      this.panelInstances.set(config.id, panelInstance);
      
      // Call onShow if it exists
      if (typeof panelInstance.onShow === 'function') {
        panelInstance.onShow();
      }
      
    } catch (error) {
      console.error(`[SimplifiedSettingsPanel] Failed to instantiate panel '${config.id}':`, error);
      contentElement.innerHTML = `<div class="error-message">Error loading panel: ${error.message}</div>`;
    }
  }
  
  /**
   * Toggle section collapsed state
   */
  toggleSection(panelId) {
    const section = this.element.querySelector(`[data-panel-id="${panelId}"]`);
    if (!section) return;
    
    const content = section.querySelector('.section-content');
    const icon = section.querySelector('.collapse-icon');
    
    const isCurrentlyVisible = content.style.display !== 'none';
    const newCollapsed = isCurrentlyVisible;
    
    // Update UI
    content.style.display = newCollapsed ? 'none' : 'block';
    icon.textContent = newCollapsed ? '▶' : '▼';
    
    // Update registry
    settingsRegistry.setCollapsed(panelId, newCollapsed);
    
    // Handle panel lifecycle
    if (newCollapsed) {
      // Panel is being collapsed
      const panelInstance = this.panelInstances.get(panelId);
      if (panelInstance && typeof panelInstance.onHide === 'function') {
        panelInstance.onHide();
      }
    } else {
      // Panel is being expanded - instantiate if needed
      if (!this.panelInstances.has(panelId)) {
        const config = settingsRegistry.getPanel(panelId);
        if (config) {
          this.instantiatePanel(config);
        }
      } else {
        const panelInstance = this.panelInstances.get(panelId);
        if (panelInstance && typeof panelInstance.onShow === 'function') {
          panelInstance.onShow();
        }
      }
    }
    
    // Emit event
    settingsEvents.emit(EVENTS.PANEL_TOGGLED, { panelId, collapsed: newCollapsed });
  }
  
  /**
   * Handle panel toggle events
   */
  handlePanelToggle(data) {
    // Update UI if needed (registry already updated)
    const section = this.element.querySelector(`[data-panel-id="${data.panelId}"]`);
    if (section) {
      const content = section.querySelector('.section-content');
      const icon = section.querySelector('.collapse-icon');
      
      content.style.display = data.collapsed ? 'none' : 'block';
      icon.textContent = data.collapsed ? '▶' : '▼';
    }
  }
  
  /**
   * Show the settings panel
   */
  show() {
    this.isVisible = true;
    this.element.style.display = 'flex';
    settingsEvents.emit(EVENTS.PANEL_SHOWN);
  }
  
  /**
   * Hide the settings panel
   */
  hide() {
    this.isVisible = false;
    this.element.style.display = 'none';
    settingsEvents.emit(EVENTS.PANEL_HIDDEN);
  }
  
  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Dragging functionality
   */
  startDrag(e) {
    this.isDragging = true;
    const rect = this.element.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    this.element.style.cursor = 'grabbing';
  }
  
  doDrag(e) {
    if (!this.isDragging) return;
    
    this.position.x = e.clientX - this.dragOffset.x;
    this.position.y = e.clientY - this.dragOffset.y;
    
    this.updatePosition();
  }
  
  endDrag() {
    if (this.isDragging) {
      this.isDragging = false;
      this.element.style.cursor = '';
      this.savePosition();
    }
  }
  
  /**
   * Position and size management
   */
  updatePosition() {
    this.element.style.left = `${this.position.x}px`;
    this.element.style.top = `${this.position.y}px`;
  }
  
  updateSize() {
    this.element.style.width = `${this.size.width}px`;
    this.element.style.height = `${this.size.height}px`;
  }
  
  loadPosition() {
    try {
      const saved = localStorage.getItem('devpages_settings_panel_position');
      return saved ? JSON.parse(saved) : { x: 100, y: 100 };
    } catch (e) {
      return { x: 100, y: 100 };
    }
  }
  
  loadSize() {
    try {
      const saved = localStorage.getItem('devpages_settings_panel_size');
      return saved ? JSON.parse(saved) : { width: 450, height: 600 };
    } catch (e) {
      return { width: 450, height: 600 };
    }
  }
  
  savePosition() {
    try {
      localStorage.setItem('devpages_settings_panel_position', JSON.stringify(this.position));
    } catch (e) {
      console.warn('[SimplifiedSettingsPanel] Failed to save position:', e);
    }
  }
  
  saveSize() {
    try {
      localStorage.setItem('devpages_settings_panel_size', JSON.stringify(this.size));
    } catch (e) {
      console.warn('[SimplifiedSettingsPanel] Failed to save size:', e);
    }
  }
  
  /**
   * Cleanup
   */
  destroyPanelInstances() {
    for (const [panelId, instance] of this.panelInstances) {
      if (typeof instance.destroy === 'function') {
        try {
          instance.destroy();
        } catch (error) {
          console.error(`[SimplifiedSettingsPanel] Error destroying panel '${panelId}':`, error);
        }
      }
    }
    this.panelInstances.clear();
  }
  
  destroy() {
    this.destroyPanelInstances();
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Clean up CSS
    const cssLink = document.getElementById('simplified-settings-css');
    if (cssLink) {
      cssLink.remove();
    }
  }
}

// Auto-instantiate when imported (like the original)
let settingsPanelInstance = null;

export function createSettingsPanel() {
  if (!settingsPanelInstance) {
    settingsPanelInstance = new SimplifiedSettingsPanel();
  }
  return settingsPanelInstance;
}

export function getSettingsPanel() {
  return settingsPanelInstance;
}

export function toggleSettingsPanel() {
  const panel = settingsPanelInstance || createSettingsPanel();
  panel.toggle();
}

// Make available globally
if (typeof window !== 'undefined') {
  window.toggleSettingsPanel = toggleSettingsPanel;
  window.getSettingsPanel = getSettingsPanel;
} 