/**
 * CSS Files Panel - Main panel controller
 * Manages CSS files and provides comprehensive CSS debugging capabilities
 */

import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { eventBus } from '/client/eventBus.js';
import { ZIndexAnalyzer } from './analysis/ZIndexAnalyzer.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';

// Temporarily disable modular imports due to import errors
// TODO: Fix import paths in modular components

export class CssFilesPanel {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.cssFiles = new Map();
    this.categories = { 
      theme: new Map(), 
      system: new Map(), 
      app: new Map(),
      inline: new Map(),
      other: new Map() 
    };
    this.cssRuleCache = new Map(); // Cache for computed styles
    
    // Throttling for CSS toggles to prevent rapid successive calls
    this.toggleThrottle = new Map(); // href -> timestamp
    this.throttleDelay = 100; // ms
    
    // Initialize Z-Index analyzer
    this.zIndexAnalyzer = new ZIndexAnalyzer();
    
    this.isLoaded = false;
    this.init();
  }

  async init() {
    this.renderInitialState();
  }

  loadPanel() {
    this.isLoaded = true;
    this.refresh();
  }

  renderInitialState() {
    this.containerElement.innerHTML = `
      <div class="css-panel-content" style="
        font-family: var(--font-family-sans, system-ui);
        color: var(--color-foreground);
        background: var(--color-background, white);
        border-radius: 6px;
        padding: 20px;
        text-align: center;
      ">
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px; font-weight: 600;">CSS Files Analysis</h3>
        <p style="margin-bottom: 20px; font-size: 13px; color: var(--color-foreground-muted);">
          To improve performance, this panel does not load automatically.
        </p>
        <button class="load-css-panel-btn" style="
          background: var(--color-primary, #0066cc); 
          color: white; 
          border: none; 
          padding: 10px 20px; 
          border-radius: 4px; 
          cursor: pointer; 
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
        " onmouseover="this.style.background='var(--color-primary-hover, #0052a3)'" onmouseout="this.style.background='var(--color-primary, #0066cc)'">
          Load Stylesheets
        </button>
      </div>
    `;
    this.setupInitialEventListeners();
  }
  
  setupInitialEventListeners() {
    const loadBtn = this.containerElement.querySelector('.load-css-panel-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => this.loadPanel(), { once: true });
    }
  }

  /**
   * Refresh CSS files data and re-render
   */
  refresh() {
    if (!this.isLoaded) {
      this.renderInitialState();
      return;
    }
    // Scan for CSS files using inline implementation
    this.scanCssFiles();
    this.analyzeZIndexUsage();
    this.render();
  }

  /**
   * Refresh CSS files (alias for refresh)
   */
  refreshCssFiles() {
    this.refresh();
  }

  /**
   * Main render function with inline implementation
   */
  render() {
    const stats = this.generateStats();
    
    this.containerElement.innerHTML = `
      <div class="css-panel-content" style="
        font-family: var(--font-family-sans, system-ui);
        color: var(--color-foreground);
        background: var(--color-background, white);
        border-radius: 6px;
        padding: 4px;
      ">
        ${this.renderSummarySection(stats)}
        ${this.renderCategorizedFileList()}
        ${this.zIndexAnalyzer.renderSubPanel()}
      </div>
    `;

    this.setupEventListeners();
  }

  /**
   * Fallback render function if modular components fail
   */
  renderFallback() {
    this.containerElement.innerHTML = `
      <div class="css-panel-content" style="font-family: var(--font-family-sans, system-ui);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border, #e1e5e9);">
          <div>
            <h3 style="margin: 0; font-size: 18px; color: var(--color-foreground); display: flex; align-items: center; gap: 8px;">
              CSS Files
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--color-foreground-muted, #666);">
              Manage and debug CSS files loaded on this page
            </p>
          </div>
          <button id="refresh-css" style="
            padding: 8px 16px; 
            background: var(--color-primary, #007bff); 
            color: white; 
            border: none; 
            border-radius: 6px; 
            cursor: pointer; 
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='var(--color-primary, #007bff)'">
            Refresh
          </button>
        </div>
        <div id="css-files-list"></div>
      </div>
    `;

    this.setupFallbackEventListeners();
  }

  /**
   * Sets up event listeners for the panel
   */
  setupEventListeners() {
    // Use event delegation to handle dynamic content
    this.containerElement.addEventListener('click', (e) => {
      // Refresh button
      const refreshBtn = e.target.closest('.refresh-css-btn');
      if (refreshBtn) {
        this.refreshCssFiles();
        return;
      }

      // Report button
      const reportBtn = e.target.closest('.report-css-btn');
      if (reportBtn) {
        this.generateReport();
        return;
      }

      // Toggle checkboxes
      const toggleCheckbox = e.target.closest('.css-toggle-checkbox');
      if (toggleCheckbox) {
        const href = toggleCheckbox.dataset.href;
        const enabled = toggleCheckbox.checked;
        console.log('[CssFilesPanel] Toggling CSS file via checkbox:', href, 'enabled:', enabled);
        this.toggleCssFile(href, enabled);
        return;
      }

      // View buttons
      const viewBtn = e.target.closest('.view-css-btn');
      if (viewBtn) {
        const href = viewBtn.dataset.href;
        this.viewCssFile(href);
        return;
      }

      // Debug buttons
      const debugBtn = e.target.closest('.debug-css-btn');
      if (debugBtn) {
        const href = debugBtn.dataset.href;
        this.debugCssFile(href);
        return;
      }
    });

    // Setup Z-Index analyzer event listeners
    this.zIndexAnalyzer.setupEventListeners(this.containerElement);
    
    // Listen for refresh events from Z-Index analyzer
    document.addEventListener('css-files-refresh', () => {
      this.refresh();
    });
  }

  /**
   * Generate statistics about CSS files
   */
  generateStats() {
    const cssFiles = Array.from(this.cssFiles.values());
    return {
      total: cssFiles.length,
      external: cssFiles.filter(f => f.type === 'external').length,
      inline: cssFiles.filter(f => f.type === 'inline').length,
      enabled: cssFiles.filter(f => !f.disabled).length,
      disabled: cssFiles.filter(f => f.disabled).length,
      theme: this.categories.theme.size,
      system: this.categories.system.size,
      app: this.categories.app.size,
      inlineStyles: this.categories.inline.size,
      other: this.categories.other.size,
      loadOrder: cssFiles.map((f, i) => ({ ...f, loadOrder: i + 1 }))
    };
  }

  /**
   * Check if CSS file is theme-related
   */
  isThemeCss(href) {
    // More specific theme detection - only actual theme files, not files with "theme" in path
    return /theme\.css$|dark-mode\.css$|light-mode\.css$|colors?\.css$|appearance\.css$/i.test(href) && 
           !/ThemeSelectorPanel|panels|settings/i.test(href);
  }

  /**
   * Check if CSS file is system-related
   */
  isSystemCss(href) {
    return /bootstrap|foundation|bulma|tailwind|normalize|reset|framework|vendor|lib|node_modules|cdn|googleapis/i.test(href);
  }

  /**
   * Check if CSS file is application-specific
   */
  isAppCss(href) {
    // Local application stylesheets
    return /^(?!https?:\/\/).*\.(css)$/i.test(href) && 
           !this.isThemeCss(href) && 
           !this.isSystemCss(href);
  }

  /**
   * Render summary section
   */
  renderSummarySection(stats) {
    return `
      <div style="
        background: var(--color-background-secondary, #f8f9fa); 
        border: 1px solid var(--color-border, #e1e5e9);
        padding: 20px; 
        border-radius: 6px; 
        margin-bottom: 24px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--color-text, var(--color-foreground));">CSS Files Overview</h3>
          <div style="display: flex; gap: 8px;">
            <button class="refresh-css-btn" style="
              background: var(--color-primary, #0066cc); 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              border-radius: 4px; 
              cursor: pointer; 
              font-size: 13px;
              font-weight: 500;
              transition: background-color 0.2s;
            " onmouseover="this.style.background='var(--color-primary-hover, #0052a3)'" onmouseout="this.style.background='var(--color-primary, #0066cc)'">
              Refresh
            </button>
            <button class="report-css-btn" style="
              background: var(--color-secondary, #6c757d);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 13px;
              font-weight: 500;
              transition: background-color 0.2s;
            " onmouseover="this.style.background='var(--color-secondary-hover, #545b62)'" onmouseout="this.style.background='var(--color-secondary, #6c757d)'">
              Report
            </button>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-primary, #0066cc); margin-bottom: 4px;">${stats.total}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">Total</div>
          </div>
          
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-success, #28a745); margin-bottom: 4px;">${stats.enabled}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">Active</div>
          </div>
          
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-info, #17a2b8); margin-bottom: 4px;">${stats.external}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">External</div>
          </div>
          
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-warning, #ffc107); margin-bottom: 4px;">${stats.inline}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">Inline</div>
          </div>
          
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-secondary, #6c757d); margin-bottom: 4px;">${stats.theme}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">Theme</div>
          </div>
          
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-secondary, #6c757d); margin-bottom: 4px;">${stats.system}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">System</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render categorized file list
   */
  renderCategorizedFileList() {
    return `
      <div class="css-files-list">
        ${this.renderLoadOrderSection()}
      </div>
    `;
  }

  /**
   * Render CSS load order section
   */
  renderLoadOrderSection() {
    const allFiles = Array.from(this.cssFiles.values())
      .sort((a, b) => a.loadOrder - b.loadOrder);
    
    if (allFiles.length === 0) return '';

    return `
      <div class="css-category" style="margin-bottom: 24px;">
        <h4 style="
          margin: 0 0 12px 0; 
          font-size: 14px; 
          font-weight: 600;
          color: var(--color-text, var(--color-foreground)); 
          padding: 8px 12px;
          background: var(--color-primary-background, #e3f2fd);
          border: 1px solid var(--color-primary, #0066cc);
          border-radius: 4px 4px 0 0;
        ">
          CSS Load Order (${allFiles.length}) - Cascade Priority [v2]
        </h4>
        <div style="border: 1px solid var(--color-primary, #0066cc); border-top: none; border-radius: 0 0 4px 4px; overflow: hidden;">
          ${allFiles.map(file => this.renderLoadOrderItem(file)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render load order item
   */
  renderLoadOrderItem(cssFile) {
    const fileName = this.getFileNameFromPath(cssFile.href);
    const isDisabled = cssFile.disabled;
    const fullPath = this.getFullPath(cssFile.href, cssFile);
    const categoryInfo = this.getCategoryInfo(cssFile.href, cssFile);
    
    return `
      <div class="css-file-item" data-href="${cssFile.href}" style="
        padding: 12px 16px; 
        border-bottom: 1px solid var(--color-border, #e1e5e9); 
        background: var(--color-background, white); 
        display: flex; 
        align-items: center;
        gap: 12px;
        transition: all 0.2s ease;
        ${isDisabled ? 'opacity: 0.6; background: var(--color-background-muted, #f5f5f5);' : ''}
      " title="${fullPath}" onmouseover="if(!${isDisabled}) this.style.background='var(--color-background-hover, #f8f9fa)'" onmouseout="this.style.background='var(--color-background, white)'">
        <div style="
          min-width: 30px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-primary, #0066cc);
          color: white;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          ${isDisabled ? 'text-decoration: line-through; opacity: 0.6;' : ''}
        ">
          ${cssFile.loadOrder}
        </div>
        
        <div style="
          width: 8px; 
          height: 8px; 
          border-radius: 50%; 
          background: ${cssFile.type === 'external' ? 'var(--color-info, #17a2b8)' : 'var(--color-warning, #ffc107)'};
          flex-shrink: 0;
        "></div>
        
        <div style="flex: 1; min-width: 0;">
          <span style="
            font-weight: 500; 
            font-size: 13px; 
            color: var(--color-text, var(--color-foreground)); 
            word-break: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
            ${isDisabled ? 'text-decoration: line-through; color: var(--color-foreground-muted, #888);' : ''}
          ">
            ${fileName}
          </span>
          ${cssFile.ruleCount === -1 ? `<span style="margin-left: 8px; font-size: 11px; color: var(--color-warning-text, #856404);">(CORS Policy)</span>` : cssFile.ruleCount > 0 ? `<span style="margin-left: 8px; font-size: 11px; color: var(--color-foreground-secondary, #666);">(${cssFile.ruleCount} rules)</span>` : ''}
        </div>
        
        <div style="display: flex; gap: 6px; align-items: center;">
          ${categoryInfo}
          
          <span style="
            padding: 2px 6px; 
            background: ${cssFile.type === 'external' ? 'var(--color-info-background, #d1ecf1)' : 'var(--color-warning-background, #fff3cd)'}; 
            color: ${cssFile.type === 'external' ? 'var(--color-info-text, #0c5460)' : 'var(--color-warning-text, #856404)'}; 
            border-radius: 3px; 
            font-size: 9px; 
            font-weight: 500;
            text-transform: uppercase;
          ">
            ${cssFile.type}
          </span>
          
          ${cssFile.isLoaded === false ? '<span style="padding: 2px 6px; background: var(--color-danger-background, #f8d7da); color: var(--color-danger-text, #721c24); border-radius: 3px; font-size: 9px; font-weight: 500;">FAILED</span>' : ''}
          
          <label style="display: flex; align-items: center; cursor: pointer; padding: 4px;" title="${isDisabled ? 'Enable this CSS file' : 'Disable this CSS file'}">
            <input type="checkbox" class="css-toggle-checkbox" data-href="${cssFile.href}" ${!isDisabled ? 'checked' : ''} style="
              margin: 0;
              width: 16px;
              height: 16px;
              cursor: pointer;
              accent-color: var(--color-primary, #0066cc);
              transform: scale(1.1);
            ">
          </label>
          
          <button class="view-css-btn" data-href="${cssFile.href}" style="
            background: var(--color-secondary, #6c757d); 
            color: white; 
            border: none; 
            padding: 4px 8px; 
            border-radius: 3px; 
            cursor: pointer; 
            font-size: 10px;
            font-weight: 500;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='var(--color-secondary-hover, #545b62)'" onmouseout="this.style.background='var(--color-secondary, #6c757d)'">
            View
          </button>
          
          <button class="debug-css-btn" data-href="${cssFile.href}" style="
            background: var(--color-info, #17a2b8); 
            color: white; 
            border: none; 
            padding: 4px 8px; 
            border-radius: 3px; 
            cursor: pointer; 
            font-size: 10px;
            font-weight: 500;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#138496'" onmouseout="this.style.background='var(--color-info, #17a2b8)'">
            Debug
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render a category of CSS files
   */
  renderCategory(title, files, categoryId) {
    if (files.size === 0) return '';

    const filesList = Array.from(files.entries())
      .map(([href, cssFile]) => this.renderCssFileItem(href, cssFile))
      .join('');

    return `
      <div class="css-category" style="margin-bottom: 24px;">
        <h4 style="
          margin: 0 0 12px 0; 
          font-size: 14px; 
          font-weight: 600;
          color: var(--color-text, var(--color-foreground)); 
          padding: 8px 12px;
          background: var(--color-background-secondary, #f8f9fa);
          border: 1px solid var(--color-border, #e1e5e9);
          border-radius: 4px 4px 0 0;
        ">
          ${title} (${files.size})
        </h4>
        <div style="border: 1px solid var(--color-border, #e1e5e9); border-top: none; border-radius: 0 0 4px 4px; overflow: hidden;">
          ${filesList}
        </div>
      </div>
    `;
  }

  /**
   * Render individual CSS file item
   */
  renderCssFileItem(href, cssFile) {
    const fileName = this.getFileNameFromPath(href);
    const isDisabled = cssFile.disabled;
    const fullPath = this.getFullPath(href, cssFile);
    const extraInfo = this.getExtraInfo(cssFile);

    
    return `
      <div class="css-file-item" data-href="${href}" style="
        border-bottom: 1px solid var(--color-border, #e1e5e9); 
        background: var(--color-background, white); 
        transition: all 0.2s ease;
        ${isDisabled ? 'opacity: 0.6; background: var(--color-background-muted, #f5f5f5);' : ''}
      ">
        <div style="
          padding: 16px; 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start;
          transition: all 0.2s ease;
        " onmouseover="if(!${isDisabled}) this.style.background='var(--color-background-hover, #f8f9fa)'" onmouseout="this.style.background='transparent'">
        
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <div style="
              width: 8px; 
              height: 8px; 
              border-radius: 50%; 
              background: ${cssFile.type === 'external' ? 'var(--color-info, #17a2b8)' : 'var(--color-warning, #ffc107)'};
              flex-shrink: 0;
            "></div>
            <span style="
              font-weight: 500; 
              font-size: 14px; 
              color: var(--color-text, var(--color-foreground)); 
              word-break: break-word;
              overflow-wrap: break-word;
              hyphens: auto;
              ${isDisabled ? 'text-decoration: line-through; color: var(--color-foreground-muted, #888);' : ''}
            ">
              ${fileName}
            </span>
          </div>
          
          <div style="font-size: 12px; color: var(--color-foreground-secondary, #666); margin-bottom: 4px; font-family: var(--font-family-mono, monospace);">
            ${fullPath}
          </div>
          
          <div style="display: flex; flex-wrap: gap: 8px; align-items: center;">
            <span style="
              padding: 2px 6px; 
              background: ${cssFile.type === 'external' ? 'var(--color-info-background, #d1ecf1)' : 'var(--color-warning-background, #fff3cd)'}; 
              color: ${cssFile.type === 'external' ? 'var(--color-info-text, #0c5460)' : 'var(--color-warning-text, #856404)'}; 
              border-radius: 3px; 
              font-size: 10px; 
              font-weight: 500;
              text-transform: uppercase;
            ">
              ${cssFile.type}
            </span>
            
            <span style="
              padding: 2px 6px; 
              background: var(--color-secondary-background, #e2e3e5); 
              color: var(--color-secondary-text, #383d41); 
              border-radius: 3px; 
              font-size: 10px;
            ">
              ${cssFile.media}
            </span>
            
            ${cssFile.loadOrder ? `
              <span style="
                padding: 2px 6px; 
                background: var(--color-primary-background, #cce5ff); 
                color: var(--color-primary-text, #004085); 
                border-radius: 3px; 
                font-size: 10px;
                font-weight: 500;
                ${isDisabled ? 'text-decoration: line-through; opacity: 0.6;' : ''}
              ">
                Load #${cssFile.loadOrder}
              </span>
            ` : ''}
            
            ${cssFile.ruleCount === -1 ? `
              <span style="
                padding: 2px 6px; 
                background: var(--color-warning-background, #fff3cd); 
                color: var(--color-warning-text, #856404); 
                border-radius: 3px; 
                font-size: 10px;
                font-weight: 500;
              ">
                Not Accessible (CORS)
              </span>
            ` : cssFile.ruleCount > 0 ? `
              <span style="
                padding: 2px 6px; 
                background: var(--color-success-background, #d4edda); 
                color: var(--color-success-text, #155724); 
                border-radius: 3px; 
                font-size: 10px;
              ">
                ${cssFile.ruleCount} rules
              </span>
            ` : ''}
            
            ${cssFile.isLoaded === false ? `
              <span style="
                padding: 2px 6px; 
                background: var(--color-danger-background, #f8d7da); 
                color: var(--color-danger-text, #721c24); 
                border-radius: 3px; 
                font-size: 10px;
                font-weight: 500;
              ">
                LOAD FAILED
              </span>
            ` : ''}
            
            ${extraInfo}
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 8px; margin-left: 16px; flex-shrink: 0;">
          <label style="display: flex; align-items: center; cursor: pointer; padding: 4px;" title="${isDisabled ? 'Enable this CSS file' : 'Disable this CSS file'}">
            <input type="checkbox" class="css-toggle-checkbox" data-href="${href}" ${!isDisabled ? 'checked' : ''} style="
              margin: 0;
              width: 18px;
              height: 18px;
              cursor: pointer;
              accent-color: var(--color-primary, #0066cc);
              transform: scale(1.2);
            ">
          </label>
          
          <button class="view-css-btn" data-href="${href}" style="
            background: var(--color-secondary, #6c757d); 
            color: white; 
            border: none; 
            padding: 6px 12px; 
            border-radius: 3px; 
            cursor: pointer; 
            font-size: 11px;
            font-weight: 500;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='var(--color-secondary-hover, #545b62)'" onmouseout="this.style.background='var(--color-secondary, #6c757d)'">
            View
          </button>
          
          <button class="debug-css-btn" data-href="${href}" style="
            background: var(--color-info, #17a2b8); 
            color: white; 
            border: none; 
            padding: 6px 12px; 
            border-radius: 3px; 
            cursor: pointer; 
            font-size: 11px;
            font-weight: 500;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#138496'" onmouseout="this.style.background='var(--color-info, #17a2b8)'">
            Debug
          </button>
        </div>
         </div>
      </div>
    `;
  }

  /**
   * Toggles a CSS file's disabled state with throttling
   */
  toggleCssFile(href, enabled) {
    // Throttle rapid successive toggles
    const now = Date.now();
    const lastToggle = this.toggleThrottle.get(href) || 0;
    
    if (now - lastToggle < this.throttleDelay) {
      console.log('[CssFilesPanel] Toggle throttled for:', href);
      return;
    }
    
    this.toggleThrottle.set(href, now);
    
    const cssFile = this.cssFiles.get(href);
    console.log('[CssFilesPanel] toggleCssFile:', href, 'enabled:', enabled, 'cssFile:', cssFile);
    
    if (cssFile && cssFile.element) {
      // Check if the state is already what we want
      const currentlyDisabled = cssFile.type === 'inline' ? 
        cssFile.element.hasAttribute('data-disabled') || cssFile.element.style.display === 'none' :
        cssFile.element.disabled;
      
      const shouldBeDisabled = !enabled;
      
      if (currentlyDisabled === shouldBeDisabled) {
        console.log('[CssFilesPanel] CSS file already in desired state:', href, 'disabled:', currentlyDisabled);
        return;
      }
      
      if (cssFile.type === 'inline') {
        // For inline styles, we hide/show the element instead of using disabled
        console.log('[CssFilesPanel] Toggling inline style:', enabled);
        if (enabled) {
          cssFile.element.style.display = '';
          cssFile.element.removeAttribute('data-disabled');
        } else {
          cssFile.element.style.display = 'none';
          cssFile.element.setAttribute('data-disabled', 'true');
        }
        cssFile.disabled = !enabled;
      } else {
        // For external stylesheets, use the disabled property
        console.log('[CssFilesPanel] Toggling external stylesheet:', enabled);
        cssFile.element.disabled = !enabled;
        cssFile.disabled = !enabled;
      }
      
      // Re-render to update UI (debounced)
      if (!this.renderTimeout) {
        this.renderTimeout = setTimeout(() => {
          this.render();
          this.renderTimeout = null;
        }, 50);
      }
      
      // Notify HTML renderer if it exists
      this.notifyHtmlRenderer('cssToggled', { href, enabled });
    } else {
      console.warn('[CssFilesPanel] CSS file not found or no element:', href);
    }
  }

  /**
   * View CSS file content
   */
  async viewCssFile(href) {
    const cssFile = this.cssFiles.get(href);
    if (!cssFile) return;
    
    let content = '';
    if (cssFile.type === 'inline') {
      content = cssFile.content || cssFile.element.textContent || cssFile.element.innerHTML;
      if (!content.trim()) {
        content = '/* Empty inline style block */';
      }
    } else {
      try {
        const response = await fetch(href);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        content = await response.text();
      } catch (error) {
        content = `/* Error loading CSS file: ${error.message} */\n\n/* This could be due to:\n - CORS restrictions\n - Network issues\n - File not found\n - Server error */`;
      }
    }
    
    const fileName = this.getFileNameFromPath(href);
    this.showCssModal(content, `CSS File: ${fileName}`, false);
  }

  /**
   * Show CSS content in a modal
   */
  showCssModal(content, title, isHtml = false) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; 
      z-index: 10000; font-family: var(--font-family-sans, system-ui);
    `;
    
    modal.innerHTML = `
      <div style="
        background: var(--color-background, white); 
        border: 1px solid var(--color-border, #e1e5e9);
        padding: 24px; 
        border-radius: 6px; 
        max-width: 90vw; 
        max-height: 90vh; 
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border, #e1e5e9);">
          <h3 style="margin: 0; color: var(--color-foreground); font-size: 16px; font-weight: 600;">${title}</h3>
          <button class="close-modal" style="
            background: var(--color-danger, #dc3545); 
            color: white; 
            border: none; 
            padding: 8px 16px; 
            border-radius: 4px; 
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='var(--color-danger-hover, #c82333)'" onmouseout="this.style.background='var(--color-danger, #dc3545)'">
            Close
          </button>
        </div>
        ${isHtml ? `
          <div style="
            background: var(--color-background-secondary, #f8f9fa); 
            border: 1px solid var(--color-border, #e1e5e9);
            padding: 20px; 
            border-radius: 4px; 
            overflow: auto; 
            flex: 1;
            color: var(--color-foreground);
          ">${content}</div>
        ` : `
          <pre style="
            background: var(--color-background-secondary, #f8f9fa); 
            border: 1px solid var(--color-border, #e1e5e9);
            padding: 20px; 
            border-radius: 4px; 
            overflow: auto; 
            flex: 1;
            margin: 0;
            font-family: var(--font-family-mono, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace); 
            font-size: 12px; 
            line-height: 1.5; 
            white-space: pre-wrap;
            color: var(--color-foreground);
          ">${content}</pre>
        `}
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Simple, bulletproof close function
    const closeModal = () => {
      try {
        if (modal && modal.parentNode) {
          modal.remove();
        }
      } catch (e) {
        console.warn('Modal close error:', e);
      }
    };
    
    // Close button - single click only
    const closeButton = modal.querySelector('.close-modal');
    closeButton.addEventListener('click', closeModal, { once: true });
    
    // Click outside to close - single click only  
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    }, { once: true });
    
    // Escape key to close - single use
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Debug CSS file - shows comprehensive CSS analysis
   */
  async debugCssFile(href) {
    const cssFile = this.cssFiles.get(href);
    if (!cssFile) return;
    
    const analysis = await this.analyzeCssFile(cssFile);
    const fileName = this.getFileNameFromPath(href);
    
    const debugContent = `
      <div style="font-family: var(--font-family-sans, system-ui); line-height: 1.4;">
        <!-- File Info -->
        <div style="margin-bottom: 16px; padding: 12px; background: var(--color-background-secondary, #f8f9fa); border-radius: 4px;">
          <h4 style="margin: 0 0 8px 0; color: var(--color-foreground); font-size: 14px;">File Info</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div><strong>File:</strong> ${fileName}</div>
            <div><strong>Type:</strong> ${cssFile.type}</div>
            <div><strong>Media:</strong> ${cssFile.media}</div>
            <div><strong>Load:</strong> #${cssFile.loadOrder || 'N/A'}</div>
            <div><strong>Status:</strong> ${cssFile.disabled ? 'Disabled' : 'Active'}</div>
            <div><strong>Rules:</strong> ${cssFile.ruleCount === -1 ? 'Not Accessible (CORS)' : (cssFile.ruleCount || 0)}</div>
          </div>
        </div>

        <!-- Analysis -->
        <div style="margin-bottom: 16px; padding: 12px; background: var(--color-background-secondary, #f8f9fa); border-radius: 4px;">
          <h4 style="margin: 0 0 8px 0; color: var(--color-foreground); font-size: 14px;">Analysis</h4>
          ${analysis.corsRestricted ? `
            <div style="padding: 8px; background: var(--color-warning-background, #fff3cd); border-radius: 3px; font-size: 12px;">
              <strong>CORS Policy:</strong> External file - analysis limited by browser security
            </div>
          ` : analysis.rules.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px;">
              <div><strong>Rules:</strong> ${analysis.rules.length}</div>
              <div><strong>Selectors:</strong> ${analysis.selectorCount}</div>
              <div><strong>Properties:</strong> ${analysis.propertyCount}</div>
              <div><strong>!important:</strong> ${analysis.importantCount}</div>
              <div><strong>@media:</strong> ${analysis.mediaQueries.length}</div>
              <div><strong>@keyframes:</strong> ${analysis.keyframes.length}</div>
            </div>
          ` : '<div style="font-size: 12px;">No rules found</div>'}
        </div>

        ${analysis.specificity.length > 0 ? `
          <!-- Top Specificity -->
          <div style="margin-bottom: 16px; padding: 12px; background: var(--color-background-secondary, #f8f9fa); border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; color: var(--color-foreground); font-size: 14px;">Top Specificity</h4>
            <div style="font-size: 11px; font-family: var(--font-family-mono, monospace); max-height: 200px; overflow-y: auto;">
              ${analysis.specificity.slice(0, 8).map(item => `
                <div style="margin-bottom: 6px; padding: 6px; background: var(--color-background, white); border-radius: 3px; border-left: 3px solid var(--color-primary, #0066cc);">
                  <div style="font-weight: 600; color: var(--color-primary, #0066cc); margin-bottom: 2px;">${item.selector}</div>
                  <div style="color: var(--color-foreground-secondary, #666);">Spec: ${item.specificity} • Props: ${item.properties}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${analysis.mediaQueries.length > 0 ? `
          <!-- Media Queries -->
          <div style="margin-bottom: 16px; padding: 12px; background: var(--color-background-secondary, #f8f9fa); border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; color: var(--color-foreground); font-size: 14px;">Media Queries</h4>
            <div style="font-size: 11px; font-family: var(--font-family-mono, monospace); max-height: 150px; overflow-y: auto;">
              ${analysis.mediaQueries.map(mq => `
                <div style="margin-bottom: 4px; padding: 4px 6px; background: var(--color-background, white); border-radius: 3px;">
                  ${mq}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div style="padding: 8px 12px; background: var(--color-info-background, #d1ecf1); border-radius: 4px; font-size: 11px; color: var(--color-info-text, #0c5460);">
          <strong>Tip:</strong> Higher specificity = higher cascade priority 
          Rules with higher specificity override lower ones. Load order matters when specificity is equal.
          ${analysis.corsRestricted ? '<br/><br/><strong>Note:</strong> External stylesheets from different domains cannot be analyzed due to browser CORS security restrictions. This is normal and expected behavior.' : ''}
        </div>
      </div>
    `;
    
    this.showCssModal(debugContent, `CSS Debug Analysis: ${fileName}`, true);
  }

  /**
   * Safely get rule count from a stylesheet, handling CORS restrictions
   */
  safeGetRuleCount(sheet, hrefForLogging = '(unknown sheet)') {
    if (!sheet) {
      return 0;
    }
    
    try {
      // Accessing cssRules can throw a SecurityError for cross-origin stylesheets
      return sheet.cssRules ? sheet.cssRules.length : 0;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'SecurityError') {
        // This is an expected and common condition for cross-origin stylesheets.
        // It's a security feature of the browser, not an application error.
        console.warn(`[CssFilesPanel] CSS rules for ${hrefForLogging} are not accessible due to browser CORS policy. This is expected for external stylesheets.`);
        return -1; // Indicate that rules are inaccessible due to CORS
      }
      // Log other unexpected errors
      console.error(`[CssFilesPanel] Unexpected error getting rule count for ${hrefForLogging}:`, error);
      return -1; // Treat as inaccessible on other errors too
    }
  }

  /**
   * Safely get CSS rules from a stylesheet, handling CORS restrictions
   */
  safeGetCssRules(sheet, hrefForLogging = '(unknown sheet)') {
    if (!sheet) {
      return [];
    }
    
    try {
      // Accessing cssRules can throw a SecurityError for cross-origin stylesheets
      return Array.from(sheet.cssRules || []);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'SecurityError') {
        // Expected condition for cross-origin stylesheets.
        console.warn(`[CssFilesPanel] CSS rules for ${hrefForLogging} are not accessible due to browser CORS policy. This is expected for external stylesheets.`);
        return []; // Return an empty array as rules are inaccessible
      }
      // Log other unexpected errors
      console.error(`[CssFilesPanel] Unexpected error getting CSS rules for ${hrefForLogging}:`, error);
      return []; // Return empty array on other errors too
    }
  }

  /**
   * Analyze CSS file for debugging information
   */
  async analyzeCssFile(cssFile) {
    const analysis = {
      rules: [],
      selectorCount: 0,
      propertyCount: 0,
      importantCount: 0,
      mediaQueries: [],
      keyframes: [],
      specificity: []
    };

    try {
      if (cssFile.element && cssFile.element.sheet) {
        const sheet = cssFile.element.sheet;
        const rules = this.safeGetCssRules(sheet, cssFile.href);
        
        analysis.rules = rules;
        analysis.corsRestricted = rules.length === 0 && cssFile.ruleCount === -1;
        
        rules.forEach(rule => {
          if (rule.type === CSSRule.STYLE_RULE) {
            const selector = rule.selectorText;
            const properties = Array.from(rule.style);
            
            analysis.selectorCount++;
            analysis.propertyCount += properties.length;
            
            // Count !important declarations
            properties.forEach(prop => {
              if (rule.style.getPropertyPriority(prop) === 'important') {
                analysis.importantCount++;
              }
            });
            
            // Calculate specificity
            const specificity = this.calculateSpecificity(selector);
            analysis.specificity.push({
              selector,
              specificity: specificity.toString(),
              properties: properties.length
            });
            
          } else if (rule.type === CSSRule.MEDIA_RULE) {
            analysis.mediaQueries.push(rule.conditionText || rule.media.mediaText);
          } else if (rule.type === CSSRule.KEYFRAMES_RULE) {
            analysis.keyframes.push(rule.name);
          }
        });
        
        // Sort by specificity (descending)
        analysis.specificity.sort((a, b) => {
          const aSpec = this.calculateSpecificity(a.selector);
          const bSpec = this.calculateSpecificity(b.selector);
          return bSpec.total - aSpec.total;
        });
        
      }
    } catch (error) {
      console.warn('CSS analysis failed:', error);
    }

    return analysis;
  }

  /**
   * Calculate CSS selector specificity
   */
  calculateSpecificity(selector) {
    // Simple specificity calculation
    const ids = (selector.match(/#[a-zA-Z][\w-]*/g) || []).length;
    const classes = (selector.match(/\.[a-zA-Z][\w-]*/g) || []).length;
    const attributes = (selector.match(/\[[^\]]*\]/g) || []).length;
    const pseudoClasses = (selector.match(/:(?!:)[a-zA-Z][\w-]*/g) || []).length;
    const elements = (selector.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length;
    const pseudoElements = (selector.match(/::[a-zA-Z][\w-]*/g) || []).length;
    
    const specificity = {
      inline: 0, // We don't handle inline styles here
      ids: ids,
      classes: classes + attributes + pseudoClasses,
      elements: elements + pseudoElements,
      total: (ids * 100) + ((classes + attributes + pseudoClasses) * 10) + (elements + pseudoElements)
    };
    
    specificity.toString = () => `(${specificity.inline},${specificity.ids},${specificity.classes},${specificity.elements})`;
    
    return specificity;
  }

  /**
   * Generate CSS report
   */
  generateReport() {
    const allFiles = Array.from(this.cssFiles.values())
      .sort((a, b) => a.loadOrder - b.loadOrder);

    let report = 'CSS Files Load Order Report\n';
    report += '=============================\n\n';

    allFiles.forEach(file => {
      const fullPath = this.getFullPath(file.href, file);
      report += `${file.loadOrder}. [${file.type.toUpperCase()}] ${fullPath}\n`;

      if (file.type === 'inline') {
        report += `   - Source Document: ${window.location.pathname}\n`;
        report += `   - Location in Document: ${file.location}\n`;
        report += `   - Size: ${file.lineCount} lines, ${file.charCount} characters\n`;
        report += `   - Rules: ${file.ruleCount}\n\n`;
      } else {
        report += `   - Media: ${file.media}\n`;
        report += `   - Status: ${file.disabled ? 'Disabled' : 'Enabled'}\n`;
        report += `   - Rules: ${file.ruleCount === -1 ? 'Rules not accessible (CORS Policy)' : file.ruleCount}\n\n`;
      }
    });

    this.showReportModal(report);
  }

  /**
   * Show report modal
   */
  showReportModal(content) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; 
      z-index: 10000; font-family: var(--font-family-sans, system-ui);
    `;
    
    modal.innerHTML = `
      <div style="
        background: var(--color-background, white); 
        border: 1px solid var(--color-border, #e1e5e9);
        padding: 24px; 
        border-radius: 6px; 
        max-width: 90vw; 
        max-height: 90vh; 
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border, #e1e5e9);">
          <h3 style="margin: 0; color: var(--color-foreground); font-size: 16px; font-weight: 600;">CSS Files Report</h3>
          <div>
            <button class="copy-report-btn" style="
              background: var(--color-primary, #0066cc); 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              border-radius: 4px; 
              cursor: pointer;
              font-size: 13px;
              font-weight: 500;
              margin-right: 8px;
              transition: background-color 0.2s;
            " onmouseover="this.style.background='var(--color-primary-hover, #0052a3)'" onmouseout="this.style.background='var(--color-primary, #0066cc)'">
              Copy
            </button>
            <button class="close-modal" style="
              background: var(--color-danger, #dc3545); 
              color: white; 
              border: none; 
              padding: 8px 16px; 
              border-radius: 4px; 
              cursor: pointer;
              font-size: 13px;
              font-weight: 500;
              transition: background-color 0.2s;
            " onmouseover="this.style.background='var(--color-danger-hover, #c82333)'" onmouseout="this.style.background='var(--color-danger, #dc3545)'">
              Close
            </button>
          </div>
        </div>
        <pre class="report-content" style="
          background: var(--color-background-secondary, #f8f9fa); 
          border: 1px solid var(--color-border, #e1e5e9);
          padding: 20px; 
          border-radius: 4px; 
          overflow: auto; 
          flex: 1;
          margin: 0;
          font-family: var(--font-family-mono, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace); 
          font-size: 12px; 
          line-height: 1.6; 
          white-space: pre-wrap;
          color: var(--color-foreground);
        ">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
      if (modal && modal.parentNode) {
        modal.remove();
      }
    };
    
    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    
    modal.querySelector('.copy-report-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        const copyButton = modal.querySelector('.copy-report-btn');
        copyButton.textContent = 'Copied!';
        copyButton.style.background = 'var(--color-success, #28a745)';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
          copyButton.style.background = 'var(--color-primary, #0066cc)';
        }, 2000);
      }, () => {
        this.showNotification('Failed to copy report', 'error');
      });
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Refresh CSS files
   */
  refreshCssFiles() {
    this.scanCssFiles();
    this.render();
    this.showNotification('CSS files refreshed', 'success');
  }

  /**
   * Categorize a CSS file
   */
  categorizeCssFile(href, cssFile) {
    if (cssFile.type === 'inline') {
      this.categories.inline.set(href, cssFile);
    } else if (this.isThemeCss(href)) {
      this.categories.theme.set(href, cssFile);
    } else if (this.isSystemCss(href)) {
      this.categories.system.set(href, cssFile);
    } else if (this.isAppCss(href)) {
      this.categories.app.set(href, cssFile);
    } else {
      this.categories.other.set(href, cssFile);
    }
  }

  /**
   * Get filename from path
   */
  getFileNameFromPath(href) {
    if (href.startsWith('inline-style-')) {
      return `Inline Style #${href.split('-')[2]}`;
    }
    if (href.startsWith('<style')) {
      return href;
    }
    try {
      const url = new URL(href);
      return url.pathname.split('/').pop() || 'unknown.css';
    } catch (e) {
      return href.split('/').pop() || 'unknown.css';
    }
  }

  /**
   * Get full path for display
   */
  getFullPath(href, cssFile) {
    if (cssFile.type === 'inline') {
      const styleNum = cssFile.index !== undefined ? cssFile.index + 1 : '';
      return `Inline <style> tag #${styleNum}`;
    }
    
    // For external files, show the full href/path
    if (href.startsWith('http')) {
      return href; // Show full URL for external files
    } else if (href.startsWith('/')) {
      return `${window.location.origin}${href}`;
    } else {
      return `${window.location.origin}/${href}`;
    }
  }

  /**
   * Get category info badge for CSS file
   */
  getCategoryInfo(href, cssFile) {
    let category = 'Other';
    let bgColor = 'var(--color-secondary-background, #e2e3e5)';
    let textColor = 'var(--color-secondary-text, #383d41)';
    
    if (cssFile.type === 'inline') {
      category = 'Inline';
      bgColor = 'var(--color-warning-background, #fff3cd)';
      textColor = 'var(--color-warning-text, #856404)';
    } else if (this.isThemeCss(href)) {
      category = 'Theme';
      bgColor = 'var(--color-success-background, #d4edda)';
      textColor = 'var(--color-success-text, #155724)';
    } else if (this.isSystemCss(href)) {
      category = 'System';
      bgColor = 'var(--color-info-background, #d1ecf1)';
      textColor = 'var(--color-info-text, #0c5460)';
    } else if (this.isAppCss(href)) {
      category = 'App';
      bgColor = 'var(--color-primary-background, #cce5ff)';
      textColor = 'var(--color-primary-text, #004085)';
    }
    
    return `
      <span style="
        padding: 2px 6px; 
        background: ${bgColor}; 
        color: ${textColor}; 
        border-radius: 3px; 
        font-size: 10px; 
        font-weight: 500;
        text-transform: uppercase;
      ">
        ${category}
      </span>
    `;
  }

  /**
   * Get extra info for inline styles
   */
  getExtraInfo(cssFile) {
    let extraInfo = '';
    
    if (cssFile.type === 'inline' && cssFile.content) {
      const lines = cssFile.content.split('\n').length;
      const chars = cssFile.content.length;
      extraInfo += `
        <span style="
          padding: 2px 6px; 
          background: var(--color-info-background, #d1ecf1); 
          color: var(--color-info-text, #0c5460); 
          border-radius: 3px; 
          font-size: 10px;
        ">
          ${lines} lines, ${chars} chars
        </span>
        ${cssFile.location ? `
          <span style="
            padding: 2px 6px; 
            background: var(--color-secondary-background, #e2e3e5); 
            color: var(--color-secondary-text, #383d41); 
            border-radius: 3px; 
            font-size: 10px;
          ">
            ${cssFile.location}
          </span>
        ` : ''}
      `;
    }
    
    // Add Z-Index information
    const zIndexInfo = this.zIndexAnalyzer.getZIndexInfo(cssFile);
    if (zIndexInfo) {
      extraInfo += `
        <span style="
          padding: 2px 6px; 
          background: var(--color-warning-background, #fff3cd); 
          color: var(--color-warning-text, #856404); 
          border-radius: 3px; 
          font-size: 10px;
          font-weight: 500;
        ">
          📏 ${zIndexInfo}
        </span>
      `;
    }
    
    return extraInfo;
  }

  /**
   * Analyze Z-Index usage across all CSS files
   */
  analyzeZIndexUsage() {
    // Clear previous analysis
    this.zIndexAnalyzer.clear();
    
    // Analyze each CSS file for z-index usage
    for (const [href, cssFile] of this.cssFiles) {
      this.zIndexAnalyzer.analyzeCssFile(cssFile);
    }
  }

  /**
   * Scan for CSS files and categorize them
   */
  scanCssFiles() {
    this.cssFiles.clear();
    this.categories = { 
      theme: new Map(), 
      system: new Map(), 
      app: new Map(),
      inline: new Map(),
      other: new Map() 
    };

    // Scan <link> tags
    const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
    linkElements.forEach((link, index) => {
      const href = link.href || link.getAttribute('href');
      if (href) {
        try {
          const cssFile = {
            href: href,
            type: 'external',
            media: link.media || 'all',
            disabled: link.disabled,
            element: link,
            index: index,
            loadOrder: index + 1,
            crossOrigin: link.crossOrigin || null,
            integrity: link.integrity || null,
            isLoaded: link.sheet !== null,
            ruleCount: this.safeGetRuleCount(link.sheet, href)
          };
          
          this.cssFiles.set(href, cssFile);
          this.categorizeCssFile(href, cssFile);
        } catch (error) {
          // If any error occurs (like a more aggressive SecurityError), create a fallback entry.
          console.log(`[CssFilesPanel] Could not fully process stylesheet ${href}: ${error.message}`);
          const cssFile = {
            href: href,
            type: 'external',
            media: link.media || 'all',
            disabled: link.disabled,
            element: link,
            index: index,
            loadOrder: index + 1,
            isLoaded: false, // Mark as not loaded if we had an error
            ruleCount: -1 // Mark as inaccessible
          };
          this.cssFiles.set(href, cssFile);
          this.categorizeCssFile(href, cssFile);
        }
      }
    });

    // Scan <style> tags
    const styleElements = document.querySelectorAll('style');
    const linkCount = linkElements.length;
    let inlineIndex = 0;
    
    styleElements.forEach((style, index) => {
      const content = style.textContent || '';
      const trimmedContent = content.trim();
      
      // Skip empty style tags
      if (!trimmedContent) {
        return;
      }
      
      // Get location information
      const parentElement = style.parentElement;
      const location = parentElement ? 
        `in <${parentElement.tagName.toLowerCase()}${parentElement.id ? `#${parentElement.id}` : ''}${parentElement.className && typeof parentElement.className === 'string' ? `.${parentElement.className.split(' ')[0]}` : parentElement.className && parentElement.className.toString ? `.${parentElement.className.toString().split(' ')[0]}` : ''}>` :
        'in document';
      
      const href = `inline-style-${inlineIndex}`;
      const cssFile = {
        href: href,
        type: 'inline',
        media: style.media || 'all',
        disabled: style.hasAttribute('data-disabled') || style.style.display === 'none',
        element: style,
        index: inlineIndex,
        loadOrder: linkCount + inlineIndex + 1,
        content: content,
        lineCount: content.split('\n').length,
        charCount: content.length,
        ruleCount: this.safeGetRuleCount(style.sheet, href),
        isLoaded: true, // Inline styles are always "loaded"
        location: location // Where in the document this style tag is located
      };
      
      this.cssFiles.set(href, cssFile);
      this.categorizeCssFile(href, cssFile);
      inlineIndex++;
    });
  }

  /**
   * Update collapsible sections state
   */
  updateCollapsibleSections() {
    // Stub method - no collapsible sections in simple version
  }

  /**
   * Notify HTML renderer about CSS changes via EventBus
   */
  notifyHtmlRenderer(event, data) {
    // Use EventBus for proper communication
    eventBus.emit('css:changed', {
      event,
      data,
      source: 'css-files-panel'
    });
    
    console.log('[CssFilesPanel] Notified HTML renderer:', event, data);
  }

  /**
   * Show notification to user
   */
  showNotification(message, type = 'info') {
    // Create a simple notification system
    const notification = document.createElement('div');
    notification.className = `css-notification css-notification-${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10002;
      font-family: var(--font-family-sans, system-ui);
      max-width: 300px;
      animation: slideInRight 0.3s ease-out;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  /**
   * Cleanup resources and destroy the panel
   */
  destroy() {
    console.log('[CssFilesPanel] Destroyed');
  }
} 