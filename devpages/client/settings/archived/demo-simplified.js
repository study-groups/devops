/**
 * Simplified Settings Demo
 * Script to test and demonstrate the new simplified architecture
 */

import { settingsRegistry } from './SettingsRegistry.js';
import { settingsEvents, EVENTS } from './EventBus.js';
import { createSettingsPanel } from './SimplifiedSettingsPanel.js';
import './panels-simplified/SimplifiedCssPanel.js'; // Import to trigger registration

// Demo Theme Panel (example of how simple a panel can be)
class DemoThemePanel {
  constructor(container) {
    this.container = container;
    this.render();
    this.attachEvents();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="panel-section">
        <h4>Theme Selection</h4>
        <div class="form-group">
          <select class="form-select" id="theme-select">
            <option value="light">Light Theme</option>
            <option value="dark">Dark Theme</option>
            <option value="auto">Auto (System)</option>
          </select>
        </div>
      </div>
      
      <div class="panel-section">
        <h4>Theme Directory</h4>
        <div class="form-group">
          <input type="text" class="form-input" id="theme-dir" placeholder="/themes/classic">
        </div>
        <button class="btn btn--primary" id="apply-theme">Apply Theme</button>
      </div>
    `;
  }
  
  attachEvents() {
    const select = this.container.querySelector('#theme-select');
    const input = this.container.querySelector('#theme-dir');
    const button = this.container.querySelector('#apply-theme');
    
    select.addEventListener('change', (e) => {
      console.log('Theme changed to:', e.target.value);
      settingsEvents.emit(EVENTS.THEME_CHANGED, { theme: e.target.value });
    });
    
    button.addEventListener('click', () => {
      const themeDir = input.value.trim();
      if (themeDir) {
        console.log('Applying theme from:', themeDir);
        settingsEvents.emit(EVENTS.THEME_CHANGED, { themeDir });
      }
    });
  }
  
  destroy() {
    // Simple cleanup
  }
}

// Demo JavaScript Panel
class DemoJavaScriptPanel {
  constructor(container) {
    this.container = container;
    this.render();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="panel-section">
        <h4>JavaScript Settings</h4>
        <label class="checkbox-label">
          <input type="checkbox" checked>
          Enable JavaScript execution
        </label>
        <label class="checkbox-label">
          <input type="checkbox">
          Show console logs
        </label>
      </div>
      
      <div class="panel-section">
        <h4>External Scripts</h4>
        <div class="file-list">
          <div class="file-item">
            <span class="file-path">script.js</span>
            <div class="file-actions">
              <button class="btn btn--small">Remove</button>
            </div>
          </div>
        </div>
        <button class="btn btn--primary btn--small" style="margin-top: 8px;">
          + Add Script
        </button>
      </div>
    `;
  }
  
  destroy() {}
}

// Register demo panels
settingsRegistry.register({
  id: 'demo-theme-panel',
  title: 'Theme Settings',
  component: DemoThemePanel,
  defaultCollapsed: false
});

settingsRegistry.register({
  id: 'demo-javascript-panel',
  title: 'JavaScript',
  component: DemoJavaScriptPanel,
  defaultCollapsed: true
});

// Demo initialization function
export function initializeSimplifiedDemo() {
  console.log('🚀 Initializing Simplified Settings Demo');
  
  // Enable debug mode for events
  settingsEvents.setDebugMode(true);
  
  // Create the simplified settings panel
  const settingsPanel = createSettingsPanel();
  
  // Add some demo event listeners
  settingsEvents.on(EVENTS.PANEL_SHOWN, () => {
    console.log('📖 Settings panel opened');
  });
  
  settingsEvents.on(EVENTS.PANEL_HIDDEN, () => {
    console.log('📕 Settings panel closed');
  });
  
  settingsEvents.on(EVENTS.PANEL_TOGGLED, (data) => {
    console.log(`📋 Panel '${data.panelId}' ${data.collapsed ? 'collapsed' : 'expanded'}`);
  });
  
  settingsEvents.on(EVENTS.CSS_FILE_ADDED, (data) => {
    console.log(`📄 CSS file added: ${data.filePath}`);
  });
  
  settingsEvents.on(EVENTS.THEME_CHANGED, (data) => {
    console.log('🎨 Theme changed:', data);
  });
  
  // Debug registry state
  console.group('📊 Registry Debug Info');
  settingsRegistry.debug();
  console.groupEnd();
  
  console.group('📊 Event Bus Debug Info');
  settingsEvents.debug();
  console.groupEnd();
  
  // Add global debug helpers
  if (typeof window !== 'undefined') {
    window.debugSimplifiedSettings = () => {
      console.group('🔍 Simplified Settings Debug');
      settingsRegistry.debug();
      settingsEvents.debug();
      console.groupEnd();
    };
    
    window.showSettings = () => settingsPanel.show();
    window.hideSettings = () => settingsPanel.hide();
    window.toggleSettings = () => settingsPanel.toggle();
  }
  
  console.log('✅ Simplified Settings Demo initialized');
  console.log('🔧 Try: window.toggleSettings() to test the panel');
  console.log('🔍 Try: window.debugSimplifiedSettings() for debug info');
  
  return settingsPanel;
}

// Auto-initialize if this is the main module
if (typeof window !== 'undefined' && !window.simplifiedSettingsInitialized) {
  window.simplifiedSettingsInitialized = true;
  initializeSimplifiedDemo();
} 