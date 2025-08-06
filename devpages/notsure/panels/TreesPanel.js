/**
 * Trees Panel - Container for various tree-based child panels
 * Contains child panels for different tree types (File, etc.)
 */

import { logMessage } from '/client/log/index.js';

export class TreesPanel {
  constructor(containerElement, options = {}) {
    this.containerElement = containerElement;
    this.childPanels = new Map();
    this.activeChildPanel = null;
    
    // Panel context - determines behavior and styling
    this.isChildPanel = options.isChildPanel || false;
    this.parentPanel = options.parentPanel || null;
    this.panelDepth = options.panelDepth || 0;
    
    this.init();
    logMessage('TreesPanel instance created.', 'debug', 'TREES_PANEL');
  }

  async init() {
    this.createPanelStructure();
    await this.loadChildPanels();
    this.render();
  }

  createPanelStructure() {
    // Adapt styling based on panel context
    const headerStyle = this.isChildPanel ? 
      'padding: 4px 8px; font-size: 14px; border-bottom: 1px solid var(--color-border-light, #f0f0f0);' :
      'padding: 8px 12px; font-size: 16px; border-bottom: 1px solid var(--color-border, #e1e5e9);';
    
    const containerPadding = this.isChildPanel ? '2px' : '4px';
    const tabPadding = this.isChildPanel ? '4px 8px' : '6px 12px';
    const tabFontSize = this.isChildPanel ? '11px' : '12px';

    this.containerElement.innerHTML = `
      <div class="trees-panel-container ${this.isChildPanel ? 'child-panel' : 'standalone-panel'}" style="
        font-family: var(--font-family-sans, system-ui);
        color: var(--color-foreground);
        background: var(--color-background, white);
        border-radius: ${this.isChildPanel ? '4px' : '6px'};
        padding: ${containerPadding};
        height: 100%;
        display: flex;
        flex-direction: column;
        ${this.isChildPanel ? 'border: 1px solid var(--color-border-light, #f0f0f0);' : ''}
      ">
        <div class="trees-panel-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          ${headerStyle}
          margin-bottom: ${this.isChildPanel ? '4px' : '8px'};
        ">
          <h3 style="margin: 0; color: var(--color-foreground);">
            ${this.isChildPanel ? '📁 Trees' : 'Trees'}
          </h3>
          <div class="trees-panel-controls">
            <button class="btn ${this.isChildPanel ? 'btn-sm' : ''} btn-primary refresh-trees-btn">
              Refresh
            </button>
          </div>
        </div>
        
        <div class="trees-panel-tabs" style="
          display: flex;
          gap: ${this.isChildPanel ? '2px' : '4px'};
          padding: 0 ${this.isChildPanel ? '8px' : '12px'};
          margin-bottom: ${this.isChildPanel ? '4px' : '8px'};
        ">
          <!-- Tabs will be populated dynamically -->
        </div>
        
        <div class="trees-panel-content" style="
          flex: 1;
          padding: 0 ${this.isChildPanel ? '8px' : '12px'};
          overflow-y: auto;
        ">
          <!-- Child panel content will be rendered here -->
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  async loadChildPanels() {
    try {
      // Load File tree child panel
              const { FileTreePanel } = await import('./FileTreePanel.js'); // Both panels now in notsure/
      this.registerChildPanel('file', 'File', FileTreePanel);
      
      // Set default active child panel
      this.activeChildPanel = 'file';
      
      logMessage('Trees child panels loaded successfully', 'debug', 'TREES_PANEL');
    } catch (error) {
      logMessage(`Failed to load trees child panels: ${error.message}`, 'error', 'TREES_PANEL');
      console.error('[TREES_PANEL] Child panel loading error:', error);
    }
  }

  registerChildPanel(id, title, PanelClass) {
    this.childPanels.set(id, {
      id,
      title,
      PanelClass,
      instance: null
    });
  }

  render() {
    this.renderTabs();
    this.renderActiveChildPanel();
  }

  renderTabs() {
    const tabsContainer = this.containerElement.querySelector('.trees-panel-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    
    const tabPadding = this.isChildPanel ? '4px 8px' : '6px 12px';
    const tabFontSize = this.isChildPanel ? '11px' : '12px';
    
    for (const [id, childPanel] of this.childPanels) {
      const tab = document.createElement('button');
      tab.className = `trees-tab ${id === this.activeChildPanel ? 'active' : ''}`;
      tab.textContent = childPanel.title;
      tab.dataset.childPanelId = id;
      tab.style.cssText = `
        padding: ${tabPadding};
        border: 1px solid var(--color-border, #e1e5e9);
        background: ${id === this.activeChildPanel ? 'var(--color-primary, #007bff)' : 'var(--color-background, white)'};
        color: ${id === this.activeChildPanel ? 'white' : 'var(--color-foreground)'};
        border-radius: ${this.isChildPanel ? '3px' : '4px'};
        cursor: pointer;
        font-size: ${tabFontSize};
        transition: all 0.2s;
      `;
      
      tabsContainer.appendChild(tab);
    }
  }

  renderActiveChildPanel() {
    const contentContainer = this.containerElement.querySelector('.trees-panel-content');
    if (!contentContainer) return;

    // Clear previous content
    contentContainer.innerHTML = '';

    if (!this.activeChildPanel || !this.childPanels.has(this.activeChildPanel)) {
      contentContainer.innerHTML = '<p>No child panel selected</p>';
      return;
    }

    const childPanel = this.childPanels.get(this.activeChildPanel);
    
    // Create container for the child panel
    const childPanelContainer = document.createElement('div');
    childPanelContainer.className = 'trees-child-panel-container';
    childPanelContainer.style.cssText = 'height: 100%; overflow-y: auto;';
    contentContainer.appendChild(childPanelContainer);

    // Create or reuse child panel instance with context
    if (!childPanel.instance) {
      childPanel.instance = new childPanel.PanelClass(childPanelContainer, {
        isChildPanel: true,
        parentPanel: this,
        panelDepth: this.panelDepth + 1
      });
    } else {
      // If instance exists, just re-attach it to the new container
      childPanelContainer.appendChild(childPanel.instance.containerElement || childPanelContainer);
    }
  }

  setupEventListeners() {
    // Tab switching
    this.containerElement.addEventListener('click', (e) => {
      if (e.target.classList.contains('trees-tab')) {
        const childPanelId = e.target.dataset.childPanelId;
        this.switchToChildPanel(childPanelId);
      }
      
      if (e.target.classList.contains('refresh-trees-btn')) {
        this.refreshActiveChildPanel();
      }
    });
  }

  switchToChildPanel(childPanelId) {
    if (this.activeChildPanel === childPanelId) return;
    
    this.activeChildPanel = childPanelId;
    this.render();
    
    logMessage(`Switched to child panel: ${childPanelId}`, 'debug', 'TREES_PANEL');
  }

  refreshActiveChildPanel() {
    if (!this.activeChildPanel || !this.childPanels.has(this.activeChildPanel)) return;
    
    const childPanel = this.childPanels.get(this.activeChildPanel);
    if (childPanel.instance && typeof childPanel.instance.refresh === 'function') {
      childPanel.instance.refresh();
    }
    
    logMessage(`Refreshed child panel: ${this.activeChildPanel}`, 'debug', 'TREES_PANEL');
  }

  // Methods for parent panel communication
  notifyParent(event, data) {
    if (this.parentPanel && typeof this.parentPanel.onChildPanelEvent === 'function') {
      this.parentPanel.onChildPanelEvent(this, event, data);
    }
  }

  // Method to handle events from child panels
  onChildPanelEvent(childPanel, event, data) {
    logMessage(`Child panel event: ${event}`, 'debug', 'TREES_PANEL');
    // Handle child panel events here
  }

  destroy() {
    // Destroy all child panel instances
    for (const [id, childPanel] of this.childPanels) {
      if (childPanel.instance && typeof childPanel.instance.destroy === 'function') {
        childPanel.instance.destroy();
      }
    }
    
    this.childPanels.clear();
    logMessage('TreesPanel destroyed.', 'debug', 'TREES_PANEL');
  }
} 