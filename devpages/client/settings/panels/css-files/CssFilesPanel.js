/**
 * CSS Files Panel - Simple DOM-based implementation matching real DevPages architecture
 * Manages CSS files and shows all loaded CSS files with toggle/view capabilities
 * Theme settings have been moved to the dedicated Theme Selector Panel
 */

import { settingsSectionRegistry } from '../../core/settingsSectionRegistry.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

class CssFilesPanel {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.loadedCssFiles = new Map(); // Track all loaded CSS files
    this.systemCssFiles = new Map(); // Track system CSS files
    this.themeCssFiles = new Map(); // Track actual theme CSS files (from MD_DIR/themes)
    this.mdDir = null; // Will be fetched from server
    
    this.init();
  }

  async init() {
    // Load panel-specific styles
    this.loadPanelStyles();
    
    // Fetch MD_DIR from config
    try {
      const configResponse = await fetch('/api/config');
      if (configResponse.ok) {
        const config = await configResponse.json();
        this.mdDir = config.MD_DIR || '';
        console.log(`[CssFilesPanel] Got MD_DIR: ${this.mdDir}`);
      }
    } catch (error) {
      console.error(`[CssFilesPanel] Error fetching MD_DIR:`, error);
    }
    
    // Scan CSS files
    this.scanCssFiles();
    
    // Render the panel
    this.render();
  }

  /**
   * Load panel-specific styles
   */
  loadPanelStyles() {
    if (!document.getElementById('css-files-panel-styles')) {
      const link = document.createElement('link');
      link.id = 'css-files-panel-styles';
      link.rel = 'stylesheet';
      link.href = '/client/settings/panels/css-files/CssFilesPanel.css';
      document.head.appendChild(link);
    }
  }

  /**
   * Scan the document for all loaded CSS files
   */
  scanCssFiles() {
    const newLoadedFiles = new Map();
    const newSystemFiles = new Map();
    const newThemeFiles = new Map();

    // Scan <link> elements
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.href;
      const id = link.id || `link-${Date.now()}-${Math.random()}`;
      
      const fileInfo = {
        element: link,
        href: href,
        id: id,
        type: 'link',
        enabled: !link.disabled,
        isSystem: this.isSystemCssFile(href),
        isTheme: this.isThemeCssFile(href),
        size: 'unknown',
        loadTime: 'unknown'
      };

      newLoadedFiles.set(href, fileInfo);
      
      if (fileInfo.isSystem) {
        newSystemFiles.set(href, fileInfo);
      } else if (fileInfo.isTheme) {
        newThemeFiles.set(href, fileInfo);
      }
    });

    // Scan <style> elements
    document.querySelectorAll('style').forEach((style, index) => {
      // Generate stable ID based on content hash or position, not random timestamp
      let id = style.id;
      if (!id) {
        // Create a stable ID based on content hash or position
        const contentHash = this.generateContentHash(style.textContent);
        id = `style-${contentHash}`;
        // Assign the stable ID to the element so it persists
        style.id = id;
      }
      const content = style.textContent;
      
      const fileInfo = {
        element: style,
        href: `inline-${id}`,
        id: id,
        type: 'inline',
        enabled: !style.disabled,
        isSystem: this.isSystemInlineStyle(content),
        isTheme: this.isThemeInlineStyle(content, style),
        size: content.length,
        loadTime: 'inline'
      };

      newLoadedFiles.set(fileInfo.href, fileInfo);
      
      if (fileInfo.isSystem) {
        newSystemFiles.set(fileInfo.href, fileInfo);
      } else if (fileInfo.isTheme) {
        newThemeFiles.set(fileInfo.href, fileInfo);
      }
    });

    // Update our tracking
    this.loadedCssFiles = newLoadedFiles;
    this.systemCssFiles = newSystemFiles;
    this.themeCssFiles = newThemeFiles;

    // Re-render if data changed
    this.render();
  }

  /**
   * Refresh CSS files with user feedback
   */
  refreshCssFiles() {
    const refreshBtn = this.containerElement.querySelector('.css-refresh-btn, #css-refresh-btn');
    
    if (refreshBtn) {
      // Show loading state
      const originalText = refreshBtn.textContent;
      refreshBtn.textContent = 'Refreshing...';
      refreshBtn.disabled = true;
      
      // Perform the scan
      this.scanCssFiles();
      
      // Reset button state
      setTimeout(() => {
        refreshBtn.textContent = 'Refreshed!';
        setTimeout(() => {
          refreshBtn.textContent = originalText;
          refreshBtn.disabled = false;
        }, 1000);
      }, 100);
    } else {
      // Fallback if button not found
      this.scanCssFiles();
    }
    
    console.log('[CssFilesPanel] Manual refresh triggered');
  }

  /**
   * Generate a stable hash for CSS content to create consistent IDs
   */
  generateContentHash(content) {
    if (!content) return 'empty';
    
    // Simple hash function for stable IDs
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Return absolute value as hex string
    return Math.abs(hash).toString(16);
  }

  /**
   * Determine if a CSS file is a system CSS file (not a theme)
   */
  isSystemCssFile(href) {
    const systemPatterns = [
      /\/client\//,
      /viewControls\.css/,
      /layout\.css/,
      /fileSummaryDisplay\.css/,
      /system\.css/,
      /design-system\.css/,
      /bootstrap/,
      /normalize/,
      /reset/,
      /global/,
      /app\.css/,
      /main\.css/,
      /index\.css/
    ];
    
    return systemPatterns.some(pattern => pattern.test(href));
  }

  /**
   * Determine if a CSS file is an actual theme file (from themes directory)
   */
  isThemeCssFile(href) {
    // Check for theme directory patterns in URL
    const themePatterns = [
      /\/themes\//,
      /theme-/,
      /\.theme\./
    ];
    
    return themePatterns.some(pattern => pattern.test(href)) && 
           !this.isSystemCssFile(href);
  }

  /**
   * Determine if inline style content is system-related
   */
  isSystemInlineStyle(content) {
    const systemKeywords = [
      'design-system',
      'app-styles',
      'global-styles',
      'bootstrap',
      'normalize'
    ];
    
    return systemKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Determine if inline style content is theme-related
   */
  isThemeInlineStyle(content, element) {
    // Check for data-theme attribute on the element itself
    if (element && (element.hasAttribute('data-theme') || element.hasAttribute('data-theme-path'))) {
      return true;
    }
    
    // For inline styles, we're more conservative - only if it explicitly mentions themes
    const themeKeywords = [
      'theme-',
      'data-theme',
      'color-scheme:',
      'prefers-color-scheme'
    ];
    
    return themeKeywords.some(keyword => content.includes(keyword)) &&
           !this.isSystemInlineStyle(content);
  }

  /**
   * Render the entire panel
   */
  render() {
    const systemFiles = Array.from(this.systemCssFiles.values());
    const themeFiles = Array.from(this.themeCssFiles.values());
    const loadedFiles = Array.from(this.loadedCssFiles.values());
    const stats = {
      totalFiles: this.loadedCssFiles.size,
      systemFiles: this.systemCssFiles.size,
      themeFiles: this.themeCssFiles.size,
      enabledFiles: loadedFiles.filter(f => f.enabled).length
    };

    this.containerElement.innerHTML = `
      <div class="css-files-panel">
        <!-- Panel Header -->
        <div class="css-files-header">
          <div class="css-header-top">
            <h3>CSS Files Manager</h3>
            <button class="css-refresh-btn" id="css-refresh-btn" title="Refresh CSS files list">
              Refresh
            </button>
          </div>
          <p>Manage loaded CSS files. Theme settings are now in the <strong>Themes</strong> panel.</p>
          <div class="css-stats">
            <span class="stat">${stats.totalFiles} total</span>
            <span class="stat">${stats.systemFiles} system</span>
            <span class="stat">${stats.themeFiles} theme</span>
            <span class="stat">${stats.enabledFiles} enabled</span>
          </div>
        </div>

        <!-- Theme Files Section -->
        <div class="css-section">
          <h3 class="css-section-title">Theme Files</h3>
          <div class="css-section-content">
            ${this.renderThemeFilesSection(themeFiles)}
          </div>
        </div>

        <!-- System Files Section -->
        <div class="css-section">
          <h3 class="css-section-title">System CSS Files</h3>
          <div class="css-section-content">
            ${this.renderSystemFilesSection(systemFiles)}
          </div>
        </div>

        <!-- All CSS Files Section -->
        <div class="css-section">
          <h3 class="css-section-title">All Loaded CSS Files</h3>
          <div class="css-section-content">
            ${this.renderAllFilesSection(loadedFiles, stats)}
          </div>
        </div>
      </div>
    `;
    
    this.setupEventListeners();
  }

  /**
   * Render theme files section
   */
  renderThemeFilesSection(themeFiles) {
    if (themeFiles.length === 0) {
      return `
        <div class="files-empty-state">
          <p>No theme files currently loaded</p>
          <small>Theme files from <code>${this.mdDir}/themes/[theme]/{core,light,dark}.css</code> will appear here when loaded</small>
          <small>Use the <strong>Themes</strong> panel to select and apply themes</small>
        </div>
      `;
    }

    return `
      <div class="files-list">
        ${themeFiles.map(file => this.renderFileItem(file, 'theme')).join('')}
      </div>
    `;
  }

  /**
   * Render system files section
   */
  renderSystemFilesSection(systemFiles) {
    if (systemFiles.length === 0) {
      return `
        <div class="files-empty-state">
          <p>No system files detected</p>
          <small>System CSS files (design-system.css, viewControls.css, etc.) will appear here</small>
        </div>
      `;
    }

    return `
      <div class="files-list">
        ${systemFiles.map(file => this.renderFileItem(file, 'system')).join('')}
      </div>
    `;
  }

  /**
   * Render all files section
   */
  renderAllFilesSection(loadedFiles, stats) {
    return `
      <div class="all-files-container">
        <div class="files-list">
          ${loadedFiles.map(file => this.renderFileItem(file, 'all')).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render individual file item
   */
  renderFileItem(file, context) {
    // Get the display name - prefer theme-path attribute for theme files
    let fileName = file.href.split('/').pop() || 'Inline Style';
    let themePath = '';
    let fullPath = '';
    
    if (file.isTheme && file.element && file.element.getAttribute('data-theme-path')) {
      themePath = file.element.getAttribute('data-theme-path');
      fileName = themePath.split('/').pop() || fileName;
      
      // If we have a theme path like 'themes/arcade/core.css', transform it to full path
      if (themePath.startsWith('themes/')) {
        const themeName = themePath.split('/')[1]; // Get 'arcade' from 'themes/arcade/core.css'
        const fileType = themePath.split('/')[2]; // Get 'core.css' from 'themes/arcade/core.css'
        fullPath = `${this.mdDir}/themes/${themeName}/${fileType}`;
      } else {
        fullPath = themePath;
      }
    }
    
    const fileTypeClass = file.isTheme ? 'theme-file' : file.isSystem ? 'system-file' : 'other-file';
    
    return `
      <div class="css-file-item ${file.enabled ? 'enabled' : 'disabled'} ${fileTypeClass}">
        <div class="file-info">
          <div class="file-name">
            <span class="name-text">${fileName}</span>
            <div class="file-badges">
              ${file.isTheme ? '<span class="badge theme-badge">THEME</span>' : ''}
              ${file.isSystem ? '<span class="badge system-badge">SYSTEM</span>' : ''}
              <span class="badge type-badge">${file.type.toUpperCase()}</span>
            </div>
          </div>
          <div class="file-path" title="${fullPath || themePath || file.href}">${fullPath || themePath || file.href}</div>
          <div class="file-meta">
            ${file.id ? `ID: ${file.id} • ` : ''}
            ${file.element && file.element.getAttribute('data-theme') ? `Theme Type: ${file.element.getAttribute('data-theme')} • ` : ''}
            ${file.type === 'inline' ? `${file.size} chars` : 'External file'}
          </div>
        </div>
        <div class="file-controls">
          <label class="file-toggle">
            <input type="checkbox" 
                   ${file.enabled ? 'checked' : ''} 
                   data-css-toggle="${file.href}">
            <span class="toggle-slider"></span>
          </label>
          <button class="file-view" data-css-view="${file.href}" title="View CSS content">
            View
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners for the panel
   */
  setupEventListeners() {
    // Refresh button
    this.containerElement.addEventListener('click', (event) => {
      if (event.target.matches('#css-refresh-btn, .css-refresh-btn')) {
        this.refreshCssFiles();
      }
    });

    // CSS file toggles
    this.containerElement.addEventListener('change', (event) => {
      if (event.target.matches('[data-css-toggle]')) {
        const href = event.target.dataset.cssToggle;
        const enabled = event.target.checked;
        this.toggleCssFile(href, enabled);
      }
    });

    // View CSS files
    this.containerElement.addEventListener('click', (event) => {
      if (event.target.matches('[data-css-view]')) {
        const href = event.target.dataset.cssView;
        this.viewCssFile(href);
      }
    });
  }

  /**
   * Toggle CSS file enabled/disabled state
   */
  toggleCssFile(href, enabled) {
    const fileInfo = this.loadedCssFiles.get(href);
    if (!fileInfo) return;

    try {
      if (fileInfo.element) {
        fileInfo.element.disabled = !enabled;
        fileInfo.enabled = enabled;
        
        console.log(`[CssFilesPanel] ${enabled ? 'Enabled' : 'Disabled'} CSS file: ${href}`);
        
        // Update our tracking
        this.loadedCssFiles.set(href, fileInfo);
        
        // Update the corresponding category maps
        if (fileInfo.isTheme) {
          this.themeCssFiles.set(href, fileInfo);
        } else if (fileInfo.isSystem) {
          this.systemCssFiles.set(href, fileInfo);
        }
      }
    } catch (error) {
      console.error(`[CssFilesPanel] Error toggling CSS file: ${error.message}`);
    }
  }

  /**
   * View CSS file content in modal
   */
  async viewCssFile(href) {
    try {
      let content = '';
      const fileInfo = this.loadedCssFiles.get(href);
      
      if (fileInfo?.type === 'inline' && fileInfo.element) {
        content = fileInfo.element.textContent || '';
      } else {
        const response = await fetch(href);
        if (response.ok) {
          content = await response.text();
        } else {
          content = 'Failed to load CSS content';
        }
      }

      this.showCssModal(content, href);
    } catch (error) {
      this.showCssModal('Error loading CSS content: ' + error.message, href);
    }
  }

  /**
   * Show CSS content in modal
   */
  showCssModal(content, title) {
    const modal = document.createElement('div');
    modal.className = 'css-modal-overlay';
    modal.innerHTML = `
      <div class="css-modal">
        <div class="css-modal-header">
          <h3 class="css-modal-title">CSS Content: ${title}</h3>
          <button class="css-modal-close">✕</button>
        </div>
        <div class="css-modal-content">
          <pre class="css-content"><code>${this.escapeHtml(content)}</code></pre>
        </div>
        <div class="css-modal-footer">
          <button class="css-copy-button">Copy to Clipboard</button>
          <small class="css-modal-info">Lines: ${content.split('\n').length} | Chars: ${content.length}</small>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    const closeModal = () => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    };

    modal.querySelector('.css-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.css-copy-button').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(content);
        modal.querySelector('.css-copy-button').textContent = 'Copied!';
        setTimeout(() => {
          modal.querySelector('.css-copy-button').textContent = 'Copy to Clipboard';
        }, 2000);
      } catch (err) {
        modal.querySelector('.css-copy-button').textContent = 'Copy Failed';
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function handleEscape(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    });
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup
   */
  destroy() {
    // No longer need to clear interval since we removed polling
    console.log('[CssFilesPanel] Panel destroyed');
  }
}

// Register the panel
settingsSectionRegistry.register({
  id: 'css-files',
  title: 'CSS Files',
  icon: '▣',
  order: 4,
  component: CssFilesPanel
});

export default CssFilesPanel; 