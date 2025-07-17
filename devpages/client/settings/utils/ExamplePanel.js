/**
 * client/settings/ExamplePanel.js
 * Example panel demonstrating the SDK usage
 * 
 * This is a working example you can copy and modify!
 */

import { panelRegistry } from '/client/panels/panelRegistry.js';
import { appStore } from '/client/appState.js';

export class ExamplePanel {
  constructor(containerElement) {
    this.container = containerElement;
    this.clickCount = 0;
    this.unsubscribe = null;
    
    this.render();
    this.attachEvents();
    this.subscribeToState();
    
    console.log('🎉 ExamplePanel created! Check the settings panel.');
  }

  render() {
    const currentTheme = appStore.getState().ui?.theme || 'unknown';
    
    this.container.innerHTML = `
      <div class="settings-section-content">
        <h4>Example Panel</h4>
        <p class="settings-description">
          This is a working example panel that demonstrates the SDK features.
        </p>
        
        <div class="settings-input-group">
          <label class="settings-label">
            <input type="checkbox" class="settings-checkbox" id="example-toggle">
            Enable example feature
          </label>
        </div>
        
        <div class="settings-input-group">
          <label class="settings-label" for="example-select">Example mode:</label>
          <select id="example-select" class="settings-select">
            <option value="demo">Demo Mode</option>
            <option value="test">Test Mode</option>
            <option value="production">Production Mode</option>
          </select>
        </div>
        
        <div class="settings-input-group">
          <button class="settings-button" id="example-action">
            Click me! (${this.clickCount} clicks)
          </button>
        </div>
        
        <div class="example-status">
          <strong>Current theme:</strong> ${currentTheme}
          <br>
          <strong>Panel status:</strong> Active
          <br>
          <strong>Last updated:</strong> ${new Date().toLocaleTimeString()}
        </div>
      </div>
    `;
  }

  attachEvents() {
    const toggle = this.container.querySelector('#example-toggle');
    const select = this.container.querySelector('#example-select');
    const button = this.container.querySelector('#example-action');

    toggle?.addEventListener('change', (e) => {
      console.log('Example feature enabled:', e.target.checked);
      this.showNotification(`Feature ${e.target.checked ? 'enabled' : 'disabled'}`);
    });

    select?.addEventListener('change', (e) => {
      console.log('Example mode changed to:', e.target.value);
      this.showNotification(`Mode: ${e.target.value}`);
    });

    button?.addEventListener('click', () => {
      this.clickCount++;
      console.log('Example button clicked!', this.clickCount, 'times');
      this.render(); // Re-render to update click count
      this.attachEvents(); // Re-attach events after re-render
    });
  }

  subscribeToState() {
    this.unsubscribe = appStore.subscribe((newState, prevState) => {
      // Re-render when theme changes to show current theme
      if (newState.ui?.theme !== prevState.ui?.theme) {
        console.log('Theme changed, updating example panel');
        this.render();
        this.attachEvents();
      }
    });
  }

  showNotification(message) {
    // Simple notification system
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-success, #4CAF50);
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
    `;
    notification.textContent = `Example Panel: ${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  destroy() {
    console.log('🧹 ExamplePanel destroyed - cleaning up');
    
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    // Any other cleanup would go here
    // Event listeners are automatically cleaned up when DOM is removed
  }
}

// Register this panel with the registry
// COMMENTED OUT - Example panel removed from settings
// panelRegistry.register({
//   id: 'example-panel-container',
//   title: '🎯 Example Panel',
//   component: ExamplePanel,
//   order: 15, // Will appear between Theme (10) and Plugins (20)
//   defaultCollapsed: false // Start expanded so people can see it
// });

// console.log('📝 ExamplePanel registered! Import this file to see it in action.'); 