/**
 * PanelIntrospector.js - Generic panel introspection utility
 * Provides long-click functionality to show panel inner workings including:
 * - Panel configuration and state
 * - AppState storage related to the panel
 * - MessageQueue events and history
 * - Panel instance details
 */

import { appStore } from '/client/appState.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';
import { eventBus } from '/client/eventBus.js';

export class PanelIntrospector {
  constructor() {
    this.popup = null;
    this.currentPanelId = null;
    this.messageQueueHistory = [];
    this.isListening = false;
    
    // Start listening to message queue events
    this.startMessageQueueMonitoring();
  }

  /**
   * Start monitoring message queue events
   */
  startMessageQueueMonitoring() {
    if (this.isListening) return;
    
    // We'll use the appStore subscription mechanism to monitor state changes
    // which is more reliable than trying to hook into dispatch
    if (typeof window !== 'undefined' && window.appStore) {
      try {
        // Subscribe to all state changes
        window.appStore.subscribe((newState, prevState, action) => {
          if (action) {
            this.captureMessageQueueEvent(action);
          }
        });
        
        this.isListening = true;
        console.log('[PanelIntrospector] Started monitoring state changes via appStore');
      } catch (err) {
        console.error('[PanelIntrospector] Failed to subscribe to appStore:', err);
      }
    } else {
      // Fallback: try again in a few milliseconds
      setTimeout(() => {
        if (!this.isListening) {
          this.startMessageQueueMonitoring();
        }
      }, 100);
    }
  }

  /**
   * Capture message queue events for introspection
   */
  captureMessageQueueEvent(action) {
    const timestamp = new Date().toISOString();
    const event = {
      timestamp,
      type: action.type,
      payload: JSON.parse(JSON.stringify(action.payload || {})),
      stackTrace: new Error().stack
    };
    
    this.messageQueueHistory.unshift(event);
    
    // Keep only last 50 events
    if (this.messageQueueHistory.length > 50) {
      this.messageQueueHistory = this.messageQueueHistory.slice(0, 50);
    }
  }

  /**
   * Show introspection popup for a panel
   */
  showIntrospection(panelId, panelInstance = null) {
    this.currentPanelId = panelId;
    
    // Get panel configuration
    const panelConfig = panelRegistry.getPanel(panelId);
    const panelWithState = panelRegistry.getPanelsWithState(appStore).find(p => p.id === panelId);
    
    // Get current app state
    const appState = appStore.getState();
    
    // Filter relevant message queue events
    const relevantEvents = this.getRelevantEvents(panelId);
    
    // Create popup
    this.createPopup(panelId, {
      panelConfig,
      panelWithState,
      panelInstance,
      appState,
      relevantEvents,
      eventBusStats: { 
        mainEventBus: 'Connected',
        panelEventBus: 'Deprecated - using main eventBus now'
      }
    });
  }

  /**
   * Get message queue events relevant to the panel
   */
  getRelevantEvents(panelId) {
    return this.messageQueueHistory.filter(event => {
      const payload = event.payload;
      
      // Check if event is related to this panel
      return (
        payload.panelId === panelId ||
        payload.sectionId === panelId ||
        event.type.includes(panelId.toUpperCase()) ||
        event.type.includes('SETTINGS') ||
        (payload.id && payload.id === panelId)
      );
    }).slice(0, 20); // Show last 20 relevant events
  }

  /**
   * Create and show the introspection popup
   */
  createPopup(panelId, data) {
    // Remove existing popup
    this.closePopup();
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'panel-introspector-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // Create popup
    const popup = document.createElement('div');
    popup.className = 'panel-introspector-popup';
    popup.style.cssText = `
      background: var(--color-background-elevated, #ffffff);
      border-radius: var(--radius-lg, 8px);
      box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1));
      max-width: 90vw;
      max-height: 90vh;
      width: 800px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    popup.innerHTML = this.generatePopupContent(panelId, data);
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    this.popup = overlay;
    
    // Add event listeners
    this.attachPopupEventListeners(overlay, popup);
  }

  /**
   * Generate popup content HTML
   */
  generatePopupContent(panelId, data) {
    const { panelConfig, panelWithState, panelInstance, appState, relevantEvents, eventBusStats } = data;
    
    return `
      <div class="introspector-header">
        <h2>Panel Introspection: ${panelConfig?.title || panelId}</h2>
        <button class="close-btn" aria-label="Close">×</button>
      </div>
      
      <div class="introspector-content">
        <div class="introspector-tabs">
          <button class="tab-btn active" data-tab="overview">Overview</button>
          <button class="tab-btn" data-tab="config">Configuration</button>
          <button class="tab-btn" data-tab="state">App State</button>
          <button class="tab-btn" data-tab="events">Message Queue</button>
          <button class="tab-btn" data-tab="instance">Instance</button>
        </div>
        
        <div class="introspector-tab-content">
          <div class="tab-panel active" data-panel="overview">
            ${this.generateOverviewPanel(panelId, data)}
          </div>
          
          <div class="tab-panel" data-panel="config">
            ${this.generateConfigPanel(panelConfig, panelWithState)}
          </div>
          
          <div class="tab-panel" data-panel="state">
            ${this.generateStatePanel(panelId, appState)}
          </div>
          
          <div class="tab-panel" data-panel="events">
            ${this.generateEventsPanel(relevantEvents, eventBusStats)}
          </div>
          
          <div class="tab-panel" data-panel="instance">
            ${this.generateInstancePanel(panelInstance)}
          </div>
        </div>
      </div>
      
      <div class="introspector-footer">
        <div class="introspector-actions">
          <button class="copy-btn" data-copy="all">Copy All Data</button>
          <button class="copy-btn" data-copy="config">Copy Config</button>
          <button class="copy-btn" data-copy="state">Copy State</button>
        </div>
      </div>
    `;
  }

  /**
   * Generate overview panel content
   */
  generateOverviewPanel(panelId, data) {
    const { panelConfig, panelWithState, relevantEvents } = data;
    
    return `
      <div class="overview-section">
        <h3>Panel Overview</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Panel ID:</label>
            <code>${panelId}</code>
          </div>
          <div class="info-item">
            <label>Title:</label>
            <span>${panelConfig?.title || 'Unknown'}</span>
          </div>
          <div class="info-item">
            <label>Component:</label>
            <code>${panelConfig?.component?.name || 'Unknown'}</code>
          </div>
          <div class="info-item">
            <label>Current State:</label>
            <span class="state-badge ${panelWithState?.isCollapsed ? 'collapsed' : 'expanded'}">
              ${panelWithState?.isCollapsed ? 'Collapsed' : 'Expanded'}
            </span>
          </div>
          <div class="info-item">
            <label>Default Collapsed:</label>
            <span>${panelConfig?.defaultCollapsed ? 'Yes' : 'No'}</span>
          </div>
          <div class="info-item">
            <label>Recent Events:</label>
            <span>${relevantEvents.length} events</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate configuration panel content
   */
  generateConfigPanel(panelConfig, panelWithState) {
    return `
      <div class="config-section">
        <h3>Panel Configuration</h3>
        <pre class="code-block">${JSON.stringify(panelConfig, null, 2)}</pre>
        
        <h3>Panel State</h3>
        <pre class="code-block">${JSON.stringify(panelWithState, null, 2)}</pre>
      </div>
    `;
  }

  /**
   * Generate app state panel content
   */
  generateStatePanel(panelId, appState) {
    // Extract relevant parts of app state
    const relevantState = {
      settingsPanel: appState.settingsPanel,
      ui: appState.ui,
      panels: appState.panels
    };
    
    return `
      <div class="state-section">
        <h3>Relevant App State</h3>
        <div class="state-subsection">
          <h4>Settings Panel State</h4>
          <pre class="code-block">${JSON.stringify(appState.settingsPanel, null, 2)}</pre>
        </div>
        
        <div class="state-subsection">
          <h4>UI State</h4>
          <pre class="code-block">${JSON.stringify(appState.ui, null, 2)}</pre>
        </div>
        
        <div class="state-subsection">
          <h4>Panels State</h4>
          <pre class="code-block">${JSON.stringify(appState.panels, null, 2)}</pre>
        </div>
      </div>
    `;
  }

  /**
   * Generate events panel content
   */
  generateEventsPanel(relevantEvents, eventBusStats) {
    return `
      <div class="events-section">
        <h4>Recent Message Queue Events (Last 20)</h4>
        <div class="events-list">
          ${relevantEvents.length > 0 ? 
            relevantEvents.map(event => `
              <div class="event-item">
                <div class="event-header">
                  <span class="event-type">${event.type}</span>
                  <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="event-payload">
                  <pre class="code-block">${JSON.stringify(event.payload, null, 2)}</pre>
                </div>
              </div>
            `).join('') : 
            '<p class="no-events">No relevant events found</p>'
          }
        </div>
        
        <h4>Event Bus Status</h4>
        <div class="stats-section">
          <pre class="code-block">${JSON.stringify(eventBusStats, null, 2)}</pre>
        </div>
      </div>
    `;
  }

  /**
   * Generate instance panel content
   */
  generateInstancePanel(panelInstance) {
    if (!panelInstance) {
      return `
        <div class="instance-section">
          <h3>Panel Instance</h3>
          <p>No panel instance available</p>
        </div>
      `;
    }
    
    // Get instance properties (safely)
    const instanceInfo = {};
    try {
      Object.getOwnPropertyNames(panelInstance).forEach(prop => {
        if (typeof panelInstance[prop] !== 'function') {
          instanceInfo[prop] = panelInstance[prop];
        }
      });
    } catch (e) {
      instanceInfo.error = 'Could not inspect instance properties';
    }
    
    return `
      <div class="instance-section">
        <h3>Panel Instance</h3>
        <div class="instance-info">
          <label>Constructor:</label>
          <code>${panelInstance.constructor.name}</code>
        </div>
        
        <h4>Instance Properties</h4>
        <pre class="code-block">${JSON.stringify(instanceInfo, null, 2)}</pre>
        
        <h4>Instance Methods</h4>
        <div class="methods-list">
          ${Object.getOwnPropertyNames(Object.getPrototypeOf(panelInstance))
            .filter(prop => typeof panelInstance[prop] === 'function' && prop !== 'constructor')
            .map(method => `<code class="method-name">${method}()</code>`)
            .join(', ') || 'No methods found'}
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to popup
   */
  attachPopupEventListeners(overlay, popup) {
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closePopup();
      }
    });
    
    // Close button
    const closeBtn = popup.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePopup());
    }
    
    // Tab switching
    const tabBtns = popup.querySelectorAll('.tab-btn');
    const tabPanels = popup.querySelectorAll('.tab-panel');
    
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        // Update active tab
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active panel
        tabPanels.forEach(p => p.classList.remove('active'));
        const targetPanel = popup.querySelector(`[data-panel="${tabId}"]`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });
    
    // Copy buttons
    const copyBtns = popup.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleCopy(btn.dataset.copy);
      });
    });
    
    // Escape key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        this.closePopup();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Handle copy functionality
   */
  handleCopy(type) {
    const { panelConfig, panelWithState, panelInstance, appState, relevantEvents } = this.getCurrentPanelData();
    let dataToCopy;
    
    switch(type) {
      case 'config':
        dataToCopy = { panelConfig, panelWithState };
        break;
      case 'state':
        dataToCopy = this.getRelevantAppState(this.currentPanelId, appState);
        break;
      case 'all':
        dataToCopy = {
          panelConfig,
          panelWithState,
          appState: this.getRelevantAppState(this.currentPanelId, appState),
          relevantEvents: this.getRelevantEvents(this.currentPanelId)
        };
        break;
      default:
        return;
    }
    
    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
    this.showCopyFeedback();
  }
  
  getCurrentPanelData() {
    const panelConfig = panelRegistry.getPanel(this.currentPanelId);
    const panelWithState = panelRegistry.getPanelsWithState(appStore).find(p => p.id === this.currentPanelId);
    const appState = appStore.getState();
    const relevantEvents = this.getRelevantEvents(this.currentPanelId);
    
    return {
      panelConfig,
      panelWithState,
      appState,
      relevantEvents
    };
  }

  /**
   * Show copy feedback
   */
  showCopyFeedback() {
    const feedback = document.createElement('div');
    feedback.textContent = 'Copied to clipboard!';
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-success, #22c55e);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 10001;
      font-size: 14px;
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 2000);
  }

  /**
   * Close the introspection popup
   */
  closePopup() {
    if (this.popup) {
      document.body.removeChild(this.popup);
      this.popup = null;
      this.currentPanelId = null;
    }
  }
}

// Create global instance
export const panelIntrospector = new PanelIntrospector();

// Make it globally accessible for debugging
if (typeof window !== 'undefined') {
  window.panelIntrospector = panelIntrospector;
  
  // Also add to devpages namespace
  window.devpages = window.devpages || {};
  window.devpages.panelIntrospector = panelIntrospector;
}

// Add styles
const style = document.createElement('style');
style.textContent = `
  .panel-introspector-overlay {
    font-family: var(--font-family-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    font-size: 14px;
    line-height: 1.5;
  }
  
  .panel-introspector-popup {
    border: 1px solid var(--color-border, #e2e8f0);
  }
  
  .introspector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-background-secondary, #f8fafc);
  }
  
  .introspector-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-foreground, #0f172a);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--color-foreground-secondary, #64748b);
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  
  .close-btn:hover {
    background: var(--color-background, #ffffff);
    color: var(--color-foreground, #0f172a);
  }
  
  .introspector-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  
  .introspector-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-background-secondary, #f8fafc);
  }
  
  .tab-btn {
    padding: 12px 16px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-foreground-secondary, #64748b);
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }
  
  .tab-btn:hover {
    color: var(--color-foreground, #0f172a);
    background: var(--color-background, #ffffff);
  }
  
  .tab-btn.active {
    color: var(--color-primary, #2563eb);
    border-bottom-color: var(--color-primary, #2563eb);
    background: var(--color-background, #ffffff);
  }
  
  .introspector-tab-content {
    flex: 1;
    overflow: auto;
  }
  
  .tab-panel {
    display: none;
    padding: 20px;
  }
  
  .tab-panel.active {
    display: block;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 12px;
    margin-top: 16px;
  }
  
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .info-item label {
    font-weight: 500;
    color: var(--color-foreground-secondary, #64748b);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  
  .info-item code {
    font-family: var(--font-family-mono, 'JetBrains Mono', monospace);
    background: var(--color-background-secondary, #f8fafc);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 13px;
    border: 1px solid var(--color-border, #e2e8f0);
  }
  
  .state-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  
  .state-badge.collapsed {
    background: var(--color-warning, #f59e0b);
    color: white;
  }
  
  .state-badge.expanded {
    background: var(--color-success, #22c55e);
    color: white;
  }
  
  .code-block {
    background: var(--color-background-secondary, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 6px;
    padding: 16px;
    font-family: var(--font-family-mono, 'JetBrains Mono', monospace);
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    margin: 12px 0;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .events-stats {
    display: flex;
    gap: 24px;
    margin: 16px 0;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .stat label {
    font-weight: 500;
    color: var(--color-foreground-secondary, #64748b);
    font-size: 12px;
  }
  
  .stat span {
    font-weight: 600;
    color: var(--color-foreground, #0f172a);
  }
  
  .events-list {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .event-item {
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 6px;
    margin-bottom: 12px;
    overflow: hidden;
  }
  
  .event-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--color-background-secondary, #f8fafc);
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }
  
  .event-type {
    font-weight: 500;
    color: var(--color-primary, #2563eb);
    font-family: var(--font-family-mono, 'JetBrains Mono', monospace);
    font-size: 12px;
  }
  
  .event-time {
    font-size: 11px;
    color: var(--color-foreground-secondary, #64748b);
  }
  
  .event-payload {
    padding: 12px;
  }
  
  .event-payload pre {
    margin: 0;
    font-size: 11px;
    max-height: 150px;
    overflow-y: auto;
  }
  
  .methods-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  
  .method-name {
    background: var(--color-background-secondary, #f8fafc);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    border: 1px solid var(--color-border, #e2e8f0);
  }
  
  .introspector-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-background-secondary, #f8fafc);
  }
  
  .introspector-actions {
    display: flex;
    gap: 8px;
  }
  
  .copy-btn {
    padding: 8px 16px;
    background: var(--color-primary, #2563eb);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.2s;
  }
  
  .copy-btn:hover {
    background: var(--color-primary-dark, #1d4ed8);
  }
  
  .state-subsection {
    margin-bottom: 24px;
  }
  
  .state-subsection h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-foreground, #0f172a);
  }
  
  .instance-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  
  .instance-info label {
    font-weight: 500;
    color: var(--color-foreground-secondary, #64748b);
  }
`;

document.head.appendChild(style); 