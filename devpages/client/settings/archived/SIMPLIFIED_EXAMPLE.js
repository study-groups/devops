// Example: Simplified CSS Panel Implementation
// client/settings/panels/CssPanel.js

import { settingsEvents } from '../EventBus.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export class CssPanel {
  constructor(container) {
    this.container = container;
    this.files = [];
    this.unsubscribe = null;
    
    this.render();
    this.attachEvents();
    this.subscribeToStore();
  }
  
  render() {
    const state = appStore.getState().settings?.preview || {};
    const files = state.cssFiles || [];
    const bundling = state.bundleCss !== false;
    const rootCss = state.enableRootCss !== false;
    
    this.container.innerHTML = `
      <div class="css-panel">
        <div class="css-section">
          <h4>CSS Files</h4>
          <div class="css-files">
            ${this.renderFilesList(files, rootCss)}
          </div>
          <button class="add-file-btn">+ Add CSS File</button>
        </div>
        
        <div class="css-section">
          <h4>Options</h4>
          <label class="checkbox-label">
            <input type="checkbox" ${bundling ? 'checked' : ''} data-action="toggle-bundling">
            Bundle CSS files
          </label>
        </div>
      </div>
    `;
  }
  
  renderFilesList(files, rootCss) {
    const allFiles = [
      { path: 'styles.css', enabled: rootCss, isDefault: true },
      ...files
    ];
    
    return allFiles.map(file => `
      <div class="css-file ${file.enabled ? 'enabled' : 'disabled'}">
        <div class="file-info">
          <span class="file-path">${file.path}</span>
          ${file.isDefault ? '<span class="default-badge">default</span>' : ''}
        </div>
        <div class="file-actions">
          <button class="toggle-btn" data-file="${file.path}" data-action="toggle-file">
            ${file.enabled ? 'Disable' : 'Enable'}
          </button>
          ${!file.isDefault ? `<button class="remove-btn" data-file="${file.path}" data-action="remove-file">Remove</button>` : ''}
        </div>
      </div>
    `).join('');
  }
  
  attachEvents() {
    this.container.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const file = e.target.dataset.file;
      
      switch (action) {
        case 'toggle-file':
          this.toggleFile(file);
          break;
        case 'remove-file':
          this.removeFile(file);
          break;
        case 'toggle-bundling':
          this.toggleBundling();
          break;
      }
      
      if (e.target.classList.contains('add-file-btn')) {
        this.showAddFileDialog();
      }
    });
  }
  
  toggleFile(filePath) {
    if (filePath === 'styles.css') {
      dispatch({ type: ActionTypes.SETTINGS_TOGGLE_ROOT_CSS_ENABLED });
    } else {
      dispatch({ 
        type: ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED, 
        payload: filePath 
      });
    }
    
    // Emit event for other panels
    settingsEvents.emit('css-file-toggled', { filePath });
  }
  
  removeFile(filePath) {
    dispatch({ 
      type: ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS, 
      payload: filePath 
    });
    
    settingsEvents.emit('css-file-removed', { filePath });
  }
  
  toggleBundling() {
    const current = appStore.getState().settings?.preview?.bundleCss !== false;
    dispatch({ 
      type: ActionTypes.SETTINGS_SET_CSS_BUNDLING_ENABLED, 
      payload: !current 
    });
  }
  
  showAddFileDialog() {
    const path = prompt('Enter CSS file path:');
    if (path && path.trim()) {
      dispatch({ 
        type: ActionTypes.SETTINGS_ADD_PREVIEW_CSS, 
        payload: path.trim() 
      });
      
      settingsEvents.emit('css-file-added', { filePath: path.trim() });
    }
  }
  
  subscribeToStore() {
    this.unsubscribe = appStore.subscribe((newState, prevState) => {
      const newCss = newState.settings?.preview;
      const prevCss = prevState?.settings?.preview;
      
      if (JSON.stringify(newCss) !== JSON.stringify(prevCss)) {
        this.render();
      }
    });
  }
  
  // Lifecycle methods
  onShow() {
    // Called when panel becomes visible
    console.log('CSS Panel shown');
  }
  
  onHide() {
    // Called when panel is hidden
    console.log('CSS Panel hidden');
  }
  
  validate() {
    const state = appStore.getState().settings?.preview || {};
    const files = state.cssFiles || [];
    const rootCss = state.enableRootCss !== false;
    
    const errors = [];
    const warnings = [];
    
    if (files.length === 0 && !rootCss) {
      warnings.push('No CSS files configured');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Simple registration - no complex schemas
import { settingsRegistry } from '../SettingsRegistry.js';

settingsRegistry.register({
  id: 'css-panel',
  title: 'CSS Files',
  component: CssPanel,
  defaultCollapsed: false
}); 