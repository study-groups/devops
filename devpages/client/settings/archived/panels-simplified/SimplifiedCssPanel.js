/**
 * Simplified CSS Panel
 * Replaces the complex CssSettingsPanel.js with a clean, direct approach
 * Demonstrates the dramatic simplification achievable with the new architecture
 */

import { settingsRegistry } from '../SettingsRegistry.js';
import { settingsEvents, EVENTS } from '../EventBus.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export class SimplifiedCssPanel {
  constructor(container) {
    this.container = container;
    this.unsubscribe = null;
    
    this.render();
    this.attachEvents();
    this.subscribeToStore();
    
    // Listen for relevant events
    settingsEvents.on(EVENTS.THEME_CHANGED, () => this.handleThemeChange());
  }
  
  /**
   * Render the panel content
   */
  render() {
    const state = appStore.getState().settings?.preview || {};
    const files = state.cssFiles || [];
    const bundling = state.bundleCss !== false;
    const rootCss = state.enableRootCss !== false;
    const renderMode = state.renderMode || 'direct';
    
    this.container.innerHTML = `
      <div class="css-panel">
        <!-- Render Mode Section -->
        <div class="panel-section">
          <h4>Rendering Mode</h4>
          <div class="form-group">
            <label class="radio-label">
              <input type="radio" name="render-mode" value="direct" ${renderMode === 'direct' ? 'checked' : ''}>
              Direct Rendering
            </label>
            <label class="radio-label">
              <input type="radio" name="render-mode" value="iframe" ${renderMode === 'iframe' ? 'checked' : ''}>
              Iframe Rendering
            </label>
          </div>
        </div>
        
        <!-- CSS Files Section -->
        <div class="panel-section">
          <h4>CSS Files</h4>
          <div class="file-list">
            ${this.renderFilesList(files, rootCss)}
          </div>
          <button class="btn btn--primary btn--small" data-action="add-file" style="margin-top: 8px;">
            + Add CSS File
          </button>
        </div>
        
        <!-- Options Section -->
        <div class="panel-section">
          <h4>CSS Options</h4>
          <label class="checkbox-label">
            <input type="checkbox" ${bundling ? 'checked' : ''} data-action="toggle-bundling">
            Bundle CSS files into HTML
          </label>
          <p style="font-size: 12px; color: var(--settings-text-muted); margin: 8px 0 0 24px;">
            When enabled, CSS files are included directly in the HTML. When disabled, they are linked externally.
          </p>
        </div>
        
        <!-- Status Section -->
        <div class="panel-section">
          <h4>Status</h4>
          ${this.renderStatus(files, rootCss, bundling)}
        </div>
      </div>
    `;
  }
  
  /**
   * Render the files list
   */
  renderFilesList(files, rootCss) {
    const allFiles = [
      { path: 'styles.css', enabled: rootCss, isDefault: true },
      ...files
    ];
    
    if (allFiles.length === 0) {
      return '<div class="file-item">No CSS files configured</div>';
    }
    
    return allFiles.map(file => `
      <div class="file-item ${file.enabled ? '' : 'file-item--disabled'}">
        <div style="flex: 1;">
          <span class="file-path">${file.path}</span>
          ${file.isDefault ? '<span class="status-badge status-badge--default">default</span>' : ''}
        </div>
        <div class="file-actions">
          <button class="btn btn--small" data-action="toggle-file" data-file="${file.path}">
            ${file.enabled ? 'Disable' : 'Enable'}
          </button>
          ${!file.isDefault ? `
            <button class="btn btn--small btn--danger" data-action="remove-file" data-file="${file.path}">
              Remove
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }
  
  /**
   * Render status information
   */
  renderStatus(files, rootCss, bundling) {
    const enabledFiles = files.filter(f => f.enabled).length + (rootCss ? 1 : 0);
    const totalFiles = files.length + 1; // +1 for styles.css
    
    let statusClass = 'success';
    let statusText = 'CSS configuration looks good';
    
    if (enabledFiles === 0) {
      statusClass = 'error';
      statusText = 'No CSS files are enabled';
    } else if (enabledFiles < totalFiles) {
      statusClass = 'warning';
      statusText = `${totalFiles - enabledFiles} CSS files are disabled`;
    }
    
    return `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span class="status-badge status-badge--${statusClass}">${statusText}</span>
      </div>
      <div style="font-size: 12px; color: var(--settings-text-muted);">
        <div>Total files: ${totalFiles}</div>
        <div>Enabled: ${enabledFiles}</div>
        <div>Bundling: ${bundling ? 'Enabled' : 'Disabled'}</div>
      </div>
    `;
  }
  
  /**
   * Attach event listeners
   */
  attachEvents() {
    this.container.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const file = e.target.dataset.file;
      
      switch (action) {
        case 'add-file':
          this.showAddFileDialog();
          break;
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
    });
    
    // Handle radio button changes
    this.container.addEventListener('change', (e) => {
      if (e.target.name === 'render-mode') {
        this.setRenderMode(e.target.value);
      }
    });
  }
  
  /**
   * Show add file dialog
   */
  showAddFileDialog() {
    const path = prompt('Enter CSS file path (relative to markdown directory):');
    if (path && path.trim()) {
      const cleanPath = path.trim();
      
      // Basic validation
      if (!cleanPath.endsWith('.css')) {
        alert('File must have a .css extension');
        return;
      }
      
      dispatch({
        type: ActionTypes.SETTINGS_ADD_PREVIEW_CSS,
        payload: cleanPath
      });
      
      settingsEvents.emit(EVENTS.CSS_FILE_ADDED, { filePath: cleanPath });
    }
  }
  
  /**
   * Toggle file enabled state
   */
  toggleFile(filePath) {
    if (filePath === 'styles.css') {
      dispatch({ type: ActionTypes.SETTINGS_TOGGLE_ROOT_CSS_ENABLED });
    } else {
      dispatch({
        type: ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED,
        payload: filePath
      });
    }
    
    settingsEvents.emit(EVENTS.CSS_FILE_TOGGLED, { filePath });
  }
  
  /**
   * Remove file
   */
  removeFile(filePath) {
    if (confirm(`Remove CSS file "${filePath}"?`)) {
      dispatch({
        type: ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS,
        payload: filePath
      });
      
      settingsEvents.emit(EVENTS.CSS_FILE_REMOVED, { filePath });
    }
  }
  
  /**
   * Toggle CSS bundling
   */
  toggleBundling() {
    const current = appStore.getState().settings?.preview?.bundleCss !== false;
    dispatch({
      type: ActionTypes.SETTINGS_SET_CSS_BUNDLING_ENABLED,
      payload: !current
    });
    
    settingsEvents.emit(EVENTS.CSS_BUNDLING_CHANGED, { enabled: !current });
  }
  
  /**
   * Set render mode
   */
  setRenderMode(mode) {
    dispatch({
      type: ActionTypes.SETTINGS_SET_PREVIEW_MODE,
      payload: mode
    });
    
    settingsEvents.emit(EVENTS.SETTINGS_CHANGED, { 
      setting: 'renderMode', 
      value: mode 
    });
  }
  
  /**
   * Handle theme changes
   */
  handleThemeChange() {
    // Re-render to update status or suggest theme files
    this.render();
  }
  
  /**
   * Subscribe to store changes
   */
  subscribeToStore() {
    this.unsubscribe = appStore.subscribe((newState, prevState) => {
      const newCss = newState.settings?.preview;
      const prevCss = prevState?.settings?.preview;
      
      // Only re-render if CSS settings actually changed
      if (JSON.stringify(newCss) !== JSON.stringify(prevCss)) {
        this.render();
      }
    });
  }
  
  /**
   * Validate CSS configuration
   * @returns {Object} Validation result
   */
  validate() {
    const state = appStore.getState().settings?.preview || {};
    const files = state.cssFiles || [];
    const rootCss = state.enableRootCss !== false;
    
    const errors = [];
    const warnings = [];
    
    // Check if any files are enabled
    const enabledFiles = files.filter(f => f.enabled).length + (rootCss ? 1 : 0);
    if (enabledFiles === 0) {
      warnings.push('No CSS files are enabled - your preview may not be styled');
    }
    
    // Check for duplicate files
    const paths = files.map(f => f.path);
    const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate CSS files: ${duplicates.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: `${enabledFiles} CSS files enabled`
    };
  }
  
  // Lifecycle methods
  onShow() {
    console.debug('[SimplifiedCssPanel] Panel shown');
  }
  
  onHide() {
    console.debug('[SimplifiedCssPanel] Panel hidden');
  }
  
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    // Clear event listeners (handled by container removal)
  }
}

// Register with the simplified registry
settingsRegistry.register({
  id: 'simplified-css-panel',
  title: 'CSS Files (Simplified)',
  component: SimplifiedCssPanel,
  defaultCollapsed: false
}); 