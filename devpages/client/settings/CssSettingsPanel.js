/**
 * client/settings/CssSettingsPanel.js
 * Component to manage preview CSS file settings with collapsible subsections.
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { logMessage } from '/client/log/index.js';

// Create a clean CSS settings API that wraps the message dispatch system
const cssSettings = {
  // CSS Files
  addFile: (path) => {
    dispatch({
      type: ActionTypes.SETTINGS_ADD_PREVIEW_CSS,
      payload: path
    });
  },
  
  removeFile: (path) => {
    dispatch({
      type: ActionTypes.SETTINGS_REMOVE_PREVIEW_CSS,
      payload: path
    });
  },
  
  toggleFile: (path) => {
    dispatch({
      type: ActionTypes.SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED,
      payload: path
    });
  },
  
  setFiles: (files) => {
    dispatch({
      type: ActionTypes.SETTINGS_SET_PREVIEW_CSS_FILES,
      payload: files
    });
  },
  
  // CSS Options
  setBundling: (enabled) => {
    dispatch({
      type: ActionTypes.SETTINGS_SET_CSS_BUNDLING_ENABLED,
      payload: enabled
    });
  },
  
  setPrefix: (prefix) => {
    dispatch({
      type: ActionTypes.SETTINGS_SET_CSS_PREFIX,
      payload: prefix
    });
  },
  
  toggleRootCss: () => {
    dispatch({
      type: ActionTypes.SETTINGS_TOGGLE_ROOT_CSS_ENABLED
    });
  },
  
  // Preview Mode
  setPreviewMode: (mode) => {
    dispatch({
      type: ActionTypes.SETTINGS_SET_PREVIEW_MODE,
      payload: mode
    });
  },
  
  // Getters for current state
  get: () => appStore.getState().settings?.preview || {},
  getBundling: () => appStore.getState().settings?.preview?.bundleCss !== false,
  getPrefix: () => appStore.getState().settings?.preview?.cssPrefix || '',
  getRootCss: () => appStore.getState().settings?.preview?.enableRootCss !== false,
  getFiles: () => appStore.getState().settings?.preview?.cssFiles || [],
  getPreviewMode: () => appStore.getState().settings?.preview?.renderMode || 'direct'
};

export class CssSettingsPanel {
  constructor(containerElement) {
    if (!containerElement) {
      throw new Error("CssSettingsPanel requires a container element.");
    }
    
    // The containerElement is the section container created by SettingsPanel
    // We need to append our content to it, not replace it
    this.sectionContainer = containerElement;
    this.containerElement = null; // We'll create our own content container
    this.unsubscribeSettings = null;
    this.isAddingNew = false;
    
    // Track collapsed state for subsections
    this.collapsedSections = this.loadCollapsedState();

    // Load our CSS
    this.loadCSS();
    
    // Wait a bit for the store to initialize, then render
    setTimeout(() => {
      this.render();
      this.subscribeToState();
    }, 50);

    logMessage('CssSettingsPanel instance created.', 'debug', 'SETTINGS');
  }

  loadCSS() {
    if (!document.getElementById('css-settings-panel-css')) {
      const link = document.createElement('link');
      link.id = 'css-settings-panel-css';
      link.rel = 'stylesheet';
      link.href = '/client/settings/CssSettingsPanel.css';
      document.head.appendChild(link);
    }
  }

  loadCollapsedState() {
    try {
      const saved = localStorage.getItem('css_subsection_collapsed_state');
      return saved ? JSON.parse(saved) : {
        'preview-settings': false, // Main group
        'rendering-mode': false,
        'css-files': false,
        'css-options': false
      };
    } catch (e) {
      return {
        'preview-settings': false,
        'rendering-mode': false,
        'css-files': false,
        'css-options': false
      };
    }
  }

  saveCollapsedState() {
    try {
      localStorage.setItem('css_subsection_collapsed_state', JSON.stringify(this.collapsedSections));
    } catch (e) {
      console.error('Failed to save collapsed state:', e);
    }
  }

  createCollapsibleSection(id, title, content, isCollapsed = false) {
    const collapsed = this.collapsedSections[id] || isCollapsed;
    const collapsedClass = collapsed ? 'collapsed' : '';
    const ariaExpanded = collapsed ? 'false' : 'true';
    const indicatorIcon = collapsed ? '&#9654;' : '&#9660;';

    return `
      <div class="css-subsection ${collapsedClass}" data-section-id="${id}">
        <div class="css-subsection-header" data-toggle="${id}" tabindex="0" role="button" aria-expanded="${ariaExpanded}">
          <span class="css-collapse-indicator">${indicatorIcon}</span>
          <h5 class="css-subsection-title">${title}</h5>
        </div>
        <div class="css-subsection-content">
          ${content}
        </div>
      </div>
    `;
  }

  render() {
    const files = cssSettings.getFiles();
    const bundling = cssSettings.getBundling();
    const rootCss = cssSettings.getRootCss();
    const prefix = cssSettings.getPrefix();
    const previewMode = cssSettings.getPreviewMode();

    // Create combined file list with default styles.css at the top
    const allFiles = [
      {
        path: 'styles.css',
        enabled: rootCss,
        isDefault: true
      },
      ...files
    ];

    // Create our content container if it doesn't exist
    if (!this.containerElement) {
      this.containerElement = document.createElement('div');
      this.containerElement.className = 'css-settings-content';
      this.sectionContainer.appendChild(this.containerElement);
    }

    // Render our subsections inside our content container
    this.containerElement.innerHTML = `
      ${this.createCollapsibleSection('rendering-mode', 'Rendering Mode', this.renderModeContent(previewMode))}
      ${this.createCollapsibleSection('css-files', 'CSS Files', this.renderFilesContent(allFiles))}
      ${this.createCollapsibleSection('css-options', 'CSS Options', this.renderOptionsContent(bundling, prefix))}
    `;

    this.attachEventListeners();
  }

  renderModeContent(previewMode) {
    return `
      <label class="css-option css-radio-option">
        <input type="radio" name="preview-mode" value="direct" ${previewMode === 'direct' ? 'checked' : ''}>
        <div class="option-content">
          <strong>Direct Attachment</strong>
          <p>Render content directly in the preview container (faster, may have CSS conflicts)</p>
        </div>
      </label>
      
      <label class="css-option css-radio-option">
        <input type="radio" name="preview-mode" value="iframe" ${previewMode === 'iframe' ? 'checked' : ''}>
        <div class="option-content">
          <strong>Iframe Isolation</strong>
          <p>Render content in an isolated iframe (better CSS isolation, slightly slower)</p>
        </div>
      </label>
    `;
  }

  renderFilesContent(allFiles) {
    return `
      <div class="css-files-header">
        <button class="add-css-btn" data-action="add">+ Add File</button>
      </div>
      
      ${this.isAddingNew ? this.renderAddForm() : ''}
      
      <div class="css-file-list">
        ${allFiles.map(file => this.renderFileRow(file)).join('')}
      </div>
    `;
  }

  renderOptionsContent(bundling, prefix) {
    return `
      <label class="css-option">
        <input type="checkbox" class="css-option-checkbox" data-action="toggle-bundling" ${bundling ? 'checked' : ''}>
        <span class="css-option-text">Bundle CSS for publishing</span>
      </label>
      
      ${!bundling ? this.renderPrefixOption(prefix) : ''}
    `;
  }

  renderFileRow(file) {
    const isDefault = file.isDefault;
    const removeButton = isDefault ? 
      `<span class="css-file-default-badge">default</span>` : 
      `<button class="remove-css-btn" data-action="remove-file" data-path="${this.escapeHtml(file.path)}" title="Remove ${this.escapeHtml(file.path)}">×</button>`;
    
    const rowClass = isDefault ? 'css-list-item css-list-item-default' : 'css-list-item';
    const toggleAction = isDefault ? 'toggle-root' : 'toggle-file';

    return `
      <div class="${rowClass}">
        <input type="checkbox" class="css-enable-toggle" data-action="${toggleAction}" data-path="${this.escapeHtml(file.path)}" ${file.enabled ? 'checked' : ''}>
        <span class="css-file-path">${this.escapeHtml(file.path)}</span>
        ${removeButton}
      </div>
    `;
  }

  renderAddForm() {
    return `
      <div class="css-list-item css-list-item-new">
        <input type="text" class="css-path-input" placeholder="Enter CSS file path (e.g., @md/styles/dark.css)" data-input="new-path">
        <div class="css-list-item-buttons">
          <button class="css-list-item-add" data-action="confirm-add">Add</button>
          <button class="css-list-item-cancel" data-action="cancel-add">Cancel</button>
        </div>
      </div>
    `;
  }

  renderPrefixOption(prefix) {
    return `
      <div class="css-prefix-container">
        <label class="css-prefix-label">CSS URL Prefix:</label>
        <input type="text" class="css-prefix-input" data-action="update-prefix" value="${this.escapeHtml(prefix)}" placeholder="e.g., https://cdn.example.com/css/">
        <small class="css-prefix-help">Used when CSS bundling is disabled</small>
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  toggleSubsection(sectionId) {
    const section = this.containerElement.querySelector(`[data-section-id="${sectionId}"]`);
    const header = this.containerElement.querySelector(`[data-toggle="${sectionId}"]`);
    const indicator = header.querySelector('.css-collapse-indicator');
    
    if (!section || !header || !indicator) return;

    const isCollapsed = section.classList.contains('collapsed');
    
    if (isCollapsed) {
      section.classList.remove('collapsed');
      header.setAttribute('aria-expanded', 'true');
      indicator.innerHTML = '&#9660;'; // Down arrow (expanded)
      this.collapsedSections[sectionId] = false;
    } else {
      section.classList.add('collapsed');
      header.setAttribute('aria-expanded', 'false');
      indicator.innerHTML = '&#9654;'; // Right arrow (collapsed)
      this.collapsedSections[sectionId] = true;
    }
    
    this.saveCollapsedState();
  }

  attachEventListeners() {
    // Remove existing listeners to prevent duplicates
    const oldHandler = this.containerElement._cssEventHandler;
    if (oldHandler) {
      this.containerElement.removeEventListener('click', oldHandler);
      this.containerElement.removeEventListener('keypress', oldHandler.keyHandler);
      this.containerElement.removeEventListener('input', oldHandler.inputHandler);
      this.containerElement.removeEventListener('change', oldHandler.changeHandler);
    }

    const clickHandler = (e) => {
      const action = e.target.dataset.action;
      const path = e.target.dataset.path;
      const toggle = e.target.dataset.toggle || e.target.closest('[data-toggle]')?.dataset.toggle;

      if (toggle) {
        e.preventDefault();
        this.toggleSubsection(toggle);
        return;
      }

      switch (action) {
        case 'add':
          this.showAddForm();
          break;
        case 'confirm-add':
          this.confirmAdd();
          break;
        case 'cancel-add':
          this.cancelAdd();
          break;
        case 'remove-file':
          cssSettings.removeFile(path);
          break;
        case 'toggle-file':
          cssSettings.toggleFile(path);
          break;
        case 'toggle-root':
          cssSettings.toggleRootCss();
          break;
        case 'toggle-bundling':
          cssSettings.setBundling(e.target.checked);
          break;
      }
    };

    const changeHandler = (e) => {
      // Handle radio button changes for preview mode
      if (e.target.name === 'preview-mode') {
        console.log('[CSS Settings] Preview mode changed to:', e.target.value);
        cssSettings.setPreviewMode(e.target.value);
      }
    };

    const keyHandler = (e) => {
      if (e.key === 'Enter' && e.target.dataset.input === 'new-path') {
        this.confirmAdd();
      } else if (e.key === 'Escape' && e.target.dataset.input === 'new-path') {
        this.cancelAdd();
      } else if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.toggle) {
        e.preventDefault();
        this.toggleSubsection(e.target.dataset.toggle);
      }
    };

    const inputHandler = (e) => {
      if (e.target.dataset.action === 'update-prefix') {
        cssSettings.setPrefix(e.target.value);
      }
    };

    this.containerElement.addEventListener('click', clickHandler);
    this.containerElement.addEventListener('change', changeHandler);
    this.containerElement.addEventListener('keypress', keyHandler);
    this.containerElement.addEventListener('input', inputHandler);

    // Store handlers for cleanup
    this.containerElement._cssEventHandler = clickHandler;
    this.containerElement._cssEventHandler.changeHandler = changeHandler;
    this.containerElement._cssEventHandler.keyHandler = keyHandler;
    this.containerElement._cssEventHandler.inputHandler = inputHandler;
  }

  showAddForm() {
    this.isAddingNew = true;
    this.render();
    // Focus the input after rendering
    setTimeout(() => {
      const input = this.containerElement.querySelector('[data-input="new-path"]');
      if (input) input.focus();
    }, 0);
  }

  confirmAdd() {
    const input = this.containerElement.querySelector('[data-input="new-path"]');
    const path = input?.value.trim();
    if (path) {
      // Prevent adding styles.css as a custom file
      if (path === 'styles.css') {
        alert('styles.css is already included as the default stylesheet. You can toggle it on/off in the list above.');
        return;
      }
      
      // Validate the path format
      if (!this.isValidCssPath(path)) {
        alert('Please enter a valid CSS file path (e.g., styles.dark.css, themes/blue.css)');
        return;
      }
      
      cssSettings.addFile(path);
      this.isAddingNew = false;
      this.render();
    }
  }

  isValidCssPath(path) {
    // Basic validation: should be a non-empty string that looks like a CSS file
    if (typeof path !== 'string' || path.length === 0) return false;
    
    // Should end with .css
    if (!path.toLowerCase().endsWith('.css')) return false;
    
    // Should not contain dangerous characters
    const dangerousChars = /[<>"|*?]/;
    if (dangerousChars.test(path)) return false;
    
    return true;
  }

  cancelAdd() {
    this.isAddingNew = false;
    this.render();
  }

  subscribeToState() {
    this.unsubscribeSettings = appStore.subscribe((newState, prevState) => {
      const newCssFiles = newState.settings?.preview?.cssFiles || [];
      const prevCssFiles = prevState?.settings?.preview?.cssFiles || [];
      const newBundling = newState.settings?.preview?.bundleCss !== false;
      const prevBundling = prevState?.settings?.preview?.bundleCss !== false;
      const newRootCss = newState.settings?.preview?.enableRootCss !== false;
      const prevRootCss = prevState?.settings?.preview?.enableRootCss !== false;
      const newPrefix = newState.settings?.preview?.cssPrefix || '';
      const prevPrefix = prevState?.settings?.preview?.cssPrefix || '';
      const newPreviewMode = newState.settings?.preview?.renderMode || 'direct';
      const prevPreviewMode = prevState?.settings?.preview?.renderMode || 'direct';

      if (JSON.stringify(newCssFiles) !== JSON.stringify(prevCssFiles) ||
          newBundling !== prevBundling ||
          newRootCss !== prevRootCss ||
          newPrefix !== prevPrefix ||
          newPreviewMode !== prevPreviewMode) {
        this.render();
      }
    });
  }

  destroy() {
    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
    }
    // Clean up event listeners
    const oldHandler = this.containerElement._cssEventHandler;
    if (oldHandler) {
      this.containerElement.removeEventListener('click', oldHandler);
      this.containerElement.removeEventListener('keypress', oldHandler.keyHandler);
      this.containerElement.removeEventListener('input', oldHandler.inputHandler);
      this.containerElement.removeEventListener('change', oldHandler.changeHandler);
    }
  }
}