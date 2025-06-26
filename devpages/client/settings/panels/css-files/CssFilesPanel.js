/**
 * CSS Files Panel - Simple DOM-based implementation matching real DevPages architecture
 * Manages CSS files and shows all loaded CSS files with toggle/view capabilities
 * Theme settings have been moved to the dedicated Theme Selector Panel
 */

import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { appStore } from '/client/appState.js';
import { settingsSectionRegistry } from '../../core/settingsSectionRegistry.js';

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
    
    // Initial render
    this.render();
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

    // Do not re-render from here to avoid the infinite loop.
  }

  /**
   * Refresh CSS files with user feedback
   */
  refreshCssFiles() {
    const refreshBtn = this.containerElement.querySelector('#css-refresh-btn');
    if (refreshBtn) {
      const originalContent = refreshBtn.innerHTML;
      refreshBtn.innerHTML = 'Refreshing...';
      refreshBtn.disabled = true;

      // Use a short timeout to allow the UI to update before the scan,
      // which can sometimes be slow.
      setTimeout(() => {
        this.render(); // Re-render the panel. This will re-scan and build the UI.
        // The button will be replaced by the render() call, so no need to reset its state.
      }, 50);
    } else {
      this.render();
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
   * Main render function - rebuilds the panel content
   */
  render() {
    this.scanCssFiles();

    const stats = {
        total: this.loadedCssFiles.size,
        system: this.systemCssFiles.size,
        theme: this.themeCssFiles.size,
        inline: Array.from(this.loadedCssFiles.values()).filter(f => f.type === 'inline').length,
        linked: Array.from(this.loadedCssFiles.values()).filter(f => f.type === 'link').length,
    };
    
    const themeFiles = Array.from(this.themeCssFiles.values());
    const systemFiles = Array.from(this.systemCssFiles.values());
    const otherFiles = Array.from(this.loadedCssFiles.values()).filter(f => !f.isTheme && !f.isSystem);

    this.containerElement.innerHTML = `
        <div class="css-panel-content">
            ${this.renderSummarySection(stats)}
            ${this.renderSection('Theme Stylesheets', this.renderFileList(themeFiles, 'theme'))}
            ${this.renderSection('System & Framework Stylesheets', this.renderFileList(systemFiles, 'system'))}
            ${this.renderSection('Other Loaded Stylesheets', this.renderFileList(otherFiles, 'other'))}
        </div>
        ${this.renderCssModal()}
    `;

    this.setupEventListeners();
  }
  
  /**
   * Renders the summary section with stats
   */
   renderSummarySection(stats) {
       return this.renderSection('CSS Overview', `
        <div class="settings-grid">
            <div class="stat-item"><span class="stat-label">Total Sheets</span><span class="stat-value">${stats.total}</span></div>
            <div class="stat-item"><span class="stat-label">Theme Sheets</span><span class="stat-value">${stats.theme}</span></div>
            <div class="stat-item"><span class="stat-label">System Sheets</span><span class="stat-value">${stats.system}</span></div>
            <div class="stat-item"><span class="stat-label">Linked Files</span><span class="stat-value">${stats.linked}</span></div>
            <div class="stat-item"><span class="stat-label">Inline Styles</span><span class="stat-value">${stats.inline}</span></div>
        </div>
        <hr class="settings-divider">
        <div class="settings-flex" style="justify-content: flex-end;">
            <button id="css-refresh-btn" class="settings-button">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                Refresh
            </button>
        </div>
       `);
   }

  /**
   * Generic function to render a collapsible section
   */
  renderSection(title, content) {
    // Unique ID for checkbox and label to ensure they are linked
    const sectionId = `css-section-${title.replace(/\s+/g, '-')}`;
    
    return `
      <div class="settings-section-container">
        <h2 class="settings-section-header" tabindex="0">
          <span class="collapse-indicator">▼</span>
          ${title}
        </h2>
        <div class="settings-section-content">
          ${content}
        </div>
      </div>
    `;
  }
  
  /**
   * Renders a list of files
   */
  renderFileList(files, context) {
      if (files.length === 0) {
          return '<p class="settings-text--muted">No stylesheets found in this category.</p>';
      }
      
      const fileItems = files.map(file => this.renderFileItem(file, context)).join('');
      
      return `<div class="stylesheet-list">${fileItems}</div>`;
  }
  
  /**
   * Renders a single file item in the list
   */
  renderFileItem(file, context) {
    const typeClass = file.isTheme ? 'theme' : (file.isSystem ? 'system' : 'other');
    const path = file.type === 'link' ? new URL(file.href).pathname : file.href;
    const size = typeof file.size === 'number' ? `${(file.size / 1024).toFixed(2)} KB` : file.size;
    const disabledClass = file.enabled ? '' : 'stylesheet-disabled';

    return `
      <div class="stylesheet-item ${disabledClass}" data-href="${file.href}">
        <div class="stylesheet-info">
          <span class="stylesheet-type ${typeClass}">${typeClass}</span>
          <span class="stylesheet-path" title="${path}">${path}</span>
        </div>
        <span class="stylesheet-size">${size}</span>
        <div class="stylesheet-actions">
            <label class="settings-toggle" title="${file.enabled ? 'Disable' : 'Enable'} stylesheet">
                <input type="checkbox" class="stylesheet-toggle-input" ${file.enabled ? 'checked' : ''}>
                <span class="settings-toggle-slider"></span>
            </label>
            <button class="stylesheet-action view-css-btn" title="View Stylesheet">View</button>
        </div>
      </div>
    `;
  }

  /**
   * Sets up event listeners for the panel
   */
  setupEventListeners() {
    // Collapsible sections
    this.containerElement.querySelectorAll('.settings-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const container = header.closest('.settings-section-container');
            container.classList.toggle('collapsed');
            const indicator = header.querySelector('.collapse-indicator');
            if (indicator) {
                indicator.textContent = container.classList.contains('collapsed') ? '►' : '▼';
            }
        });
        header.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                header.click();
            }
        });
    });

    // Refresh button
    const refreshBtn = this.containerElement.querySelector('#css-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshCssFiles());
    }

    // Toggle and View buttons
    this.containerElement.querySelectorAll('.stylesheet-item').forEach(item => {
      const href = item.dataset.href;
      
      const toggle = item.querySelector('.stylesheet-toggle-input');
      if (toggle) {
        toggle.addEventListener('change', (e) => {
          this.toggleCssFile(href, e.target.checked);
        });
      }
      
      const viewBtn = item.querySelector('.view-css-btn');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          this.viewCssFile(href);
        });
      }
    });
  }

  /**
   * Toggles a CSS file's disabled state
   */
  toggleCssFile(href, enabled) {
    const file = this.loadedCssFiles.get(href);
    if (file && file.element) {
      file.element.disabled = !enabled;
      file.enabled = enabled;
      // Visually update the item
      const itemElement = this.containerElement.querySelector(`.stylesheet-item[data-href="${href}"]`);
      if (itemElement) {
        itemElement.classList.toggle('stylesheet-disabled', !enabled);
      }
      console.log(`[CssFilesPanel] Toggled ${href} to ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Fetches and displays a CSS file's content
   */
  async viewCssFile(href) {
    const file = this.loadedCssFiles.get(href);
    let content = '';
    let title = href;

    if (!file) {
      content = 'Error: File not found in tracked stylesheets.';
    } else if (file.type === 'inline') {
      content = file.element.textContent;
      title = `Inline Style: ${file.id}`;
    } else {
      try {
        const response = await fetch(href);
        if (response.ok) {
          content = await response.text();
        } else {
          content = `Error: Could not fetch stylesheet. Status: ${response.status}`;
        }
      } catch (error) {
        content = `Error: Could not fetch stylesheet. ${error.message}`;
      }
    }

    this.showCssModal(content, title);
  }

  /**
   * Renders and shows the CSS content modal
   */
  showCssModal(content, title) {
    const modal = this.containerElement.querySelector('.stylesheet-modal');
    if (modal) {
      modal.querySelector('.stylesheet-modal-header h3').textContent = title;
      modal.querySelector('.stylesheet-content').value = content;
      modal.style.display = 'flex';

      const closeModal = () => {
        modal.style.display = 'none';
        document.removeEventListener('keydown', handleEscape);
      };

      modal.querySelector('.stylesheet-modal-close').onclick = closeModal;
      modal.querySelector('.stylesheet-modal-backdrop').onclick = closeModal;
      
      function handleEscape(e) {
        if (e.key === 'Escape') {
          closeModal();
        }
      }
      document.addEventListener('keydown', handleEscape);
    }
  }

  /**
   * Renders the modal structure (initially hidden)
   */
   renderCssModal() {
       return `
        <div class="stylesheet-modal" style="display: none;">
            <div class="stylesheet-modal-backdrop"></div>
            <div class="stylesheet-modal-content">
                <div class="stylesheet-modal-header">
                    <h3>Stylesheet Content</h3>
                    <button class="stylesheet-modal-close">&times;</button>
                </div>
                <div class="stylesheet-modal-body">
                    <textarea class="stylesheet-content" readonly></textarea>
                </div>
            </div>
        </div>
       `;
   }

  /**
   * Unload styles and remove event listeners
   */
  destroy() {
    console.log('[CssFilesPanel] Destroyed');
    // No specific cleanup needed if we are just rebuilding innerHTML
  }
}

// Register this panel in the settings section registry
settingsSectionRegistry.register({
  id: 'css-files',
  title: 'CSS Files',
  component: CssFilesPanel,
  icon: 'file-code', // Example icon
  level: 2, // Advanced setting
});

export default CssFilesPanel; 