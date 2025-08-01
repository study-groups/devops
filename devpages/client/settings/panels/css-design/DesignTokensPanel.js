/**
 * DesignTokensPanel.js - Design Tokens Viewer (Settings Integration)
 * Provides full-featured design tokens browser for settings
 */

import { panelRegistry } from '/client/panels/panelRegistry.js';

export class DesignTokensPanel {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.tokens = [];
    this.filteredTokens = [];
    this.currentFilter = 'all';
    this.filterButtons = [];
    this.availableFilterTypes = [];
    this.viewMode = 'list';
    this.colorGridMode = false;
    
    this.init();
  }

  async init() {
    // Load component CSS
    this.loadComponentCSS();
    
    // Create the panel UI
    this.createPanelUI();
    
    // Load and parse design tokens
    await this.loadDesignTokens();
    
    // Setup filter event listeners
    this.setupFilterEventListeners();
    
    console.log('[DesignTokensPanel] Settings panel initialized');
  }

  /**
   * Load component CSS file
   */
  loadComponentCSS() {
    const cssPath = '/client/settings/panels/css-design/DesignTokensPanel.css';
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssPath;
      document.head.appendChild(link);
    }
  }

  /**
   * Create the panel UI structure
   */
  createPanelUI() {
    this.containerElement.innerHTML = `
      <div class="theme-editor-panel">
        <div class="theme-editor-header">
          <h3>Design Tokens</h3>
          <p>Browse and inspect CSS design tokens and variables used throughout the system.</p>
          <div class="token-stats">
            <div class="stat" id="token-count">Loading...</div>
            <div class="stat" id="color-count">Colors: 0</div>
            <div class="stat" id="typography-count">Typography: 0</div>
            <div class="stat" id="spacing-count">Spacing: 0</div>
            <button class="btn btn-secondary btn-sm refresh-btn" id="refresh-tokens">Refresh</button>
          </div>
        </div>
        
        <div class="token-controls">
            <div class="token-filters" id="token-filters">
              <button class="token-filter-badge active" data-filter="all">All</button>
            </div>
            <div class="token-view-modes">
                <button class="view-mode-btn active" data-view="list">List</button>
                <button class="view-mode-btn" data-view="grid">Grid</button>
            </div>
        </div>
        
        <div class="token-categories" id="token-categories">
          <div class="theme-editor-empty">
            <div class="empty-icon">🎨</div>
            <h3>Loading Design Tokens</h3>
            <p>Scanning CSS files for design tokens...</p>
          </div>
        </div>
      </div>
    `;

    // Add event listeners - use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const refreshButton = document.getElementById('refresh-tokens');
      if (refreshButton) {
        refreshButton.addEventListener('click', () => {
          this.refreshTokens();
        });
      } else {
        console.warn('[DesignTokensPanel] refresh-tokens button not found');
      }

      // New view mode buttons
      const viewModeButtons = this.containerElement.querySelectorAll('.view-mode-btn');
      viewModeButtons.forEach(btn => {
          btn.addEventListener('click', () => {
              this.setViewMode(btn.dataset.view);
          });
      });
    }, 0);
  }

  /**
   * Load and parse design tokens from CSS files
   */
  async loadDesignTokens() {
    try {
      this.tokens = [];
      
      // Files to scan for design tokens - include all design system files
      const cssFiles = [
        '/client/styles/typography.css',
        '/client/styles/design-system.css',
        '/client/styles/utilities.css',
        '/client/styles/icons.css'
      ];

      for (const file of cssFiles) {
        try {
          const response = await fetch(file);
          if (response.ok) {
            const cssText = await response.text();
            const fileTokens = this.parseTokensFromCSS(cssText, file);
            this.tokens.push(...fileTokens);
          }
        } catch (error) {
          console.warn(`Could not load ${file}:`, error);
        }
      }

      // Also scan computed styles from document
      this.scanComputedTokens();

      // Update UI
      this.updateTokensDisplay();
      this.updateStats();

      // New: Populate available filter types and render filter badges
      this.availableFilterTypes = [
        'all',
        ...new Set(this.tokens.map(token => token.category))
      ];
      this.renderFilterBadges();
      this.updateFilterBadges(); // Set initial active state

    } catch (error) {
      console.error('Error loading design tokens:', error);
      this.showError(error);
    }
  }

  /**
   * Determines if a color is light or dark.
   * @param {string} color - The color string (hex, rgb, etc.).
   * @returns {boolean} True if the color is dark, false otherwise.
   */
  isColorDark(color) {
    // This is a simplified check. For a real implementation, a more robust
    // color parsing and luminance calculation library would be better.
    let r, g, b;
    if (color.match(/^#([0-9a-f]{3}){1,2}$/i)) {
      let hex = color.substring(1);
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (color.match(/^rgb/)) {
      const parts = color.match(/(\d+)/g);
      [r, g, b] = parts.map(Number);
    } else {
      // Default to assuming not dark for unknown formats
      return false;
    }

    // Luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  /**
   * Parse CSS custom properties from CSS text
   */
  parseTokensFromCSS(cssText, source) {
    const tokens = [];
    
    // Regex to match CSS custom properties
    const tokenRegex = /--([a-zA-Z0-9-_]+):\s*([^;]+);/g;
    let match;
    
    while ((match = tokenRegex.exec(cssText)) !== null) {
      const variable = `--${match[1]}`;
      const value = match[2].trim();
      
      tokens.push({
        variable,
        value,
        type: this.inferTokenType(variable, value),
        source: source.split('/').pop(),
        category: this.categorizeToken(variable)
      });
    }

    return tokens;
  }

  /**
   * Scan computed styles for active CSS variables
   */
  scanComputedTokens() {
    const computedStyle = getComputedStyle(document.documentElement);
    
    // Get all CSS custom properties from computed styles
    for (let i = 0; i < computedStyle.length; i++) {
      const property = computedStyle[i];
      if (property.startsWith('--')) {
        const value = computedStyle.getPropertyValue(property).trim();
        
        // Only add if not already found in files
        if (!this.tokens.find(t => t.variable === property)) {
          this.tokens.push({
            variable: property,
            value,
            type: this.inferTokenType(property, value),
            source: 'computed',
            category: this.categorizeToken(property)
          });
        }
      }
    }
  }

  /**
   * Infer token type from variable name and value
   */
  inferTokenType(variable, value) {
    // Color tokens
    if (variable.includes('color') || variable.includes('bg') || 
        value.match(/^#[0-9a-fA-F]{3,8}$/) || 
        value.match(/^rgb/) || value.match(/^hsl/)) {
      return 'color';
    }
    
    // Spacing tokens
    if (variable.includes('space') || variable.includes('margin') || 
        variable.includes('padding') || variable.includes('gap')) {
      return 'spacing';
    }
    
    // Typography tokens
    if (variable.includes('font') || variable.includes('text') || 
        variable.includes('line-height') || variable.includes('letter-spacing') ||
        variable.includes('typography')) {
      return 'typography';
    }
    
    // Shadow tokens
    if (variable.includes('shadow') || variable.includes('elevation')) {
      return 'shadow';
    }
    
    // Border radius tokens
    if (variable.includes('radius') || variable.includes('border-radius')) {
      return 'radius';
    }
    
    // Transition/animation tokens
    if (variable.includes('transition') || variable.includes('duration') || 
        variable.includes('ease')) {
      return 'animation';
    }
    
    // Icon tokens
    if (variable.includes('icon')) {
      return 'icon';
    }
    
    return 'other';
  }

  /**
   * Categorize token by prefix
   */
  categorizeToken(variable) {
    if (variable.startsWith('--color-')) return 'Colors';
    if (variable.startsWith('--font-family-')) return 'Typography';
    if (variable.startsWith('--font-size-')) return 'Typography';
    if (variable.startsWith('--font-weight-')) return 'Typography';
    if (variable.startsWith('--line-height-')) return 'Typography';
    if (variable.startsWith('--letter-spacing-')) return 'Typography';
    if (variable.startsWith('--typography-')) return 'Typography';
    if (variable.startsWith('--space-')) return 'Spacing';
    if (variable.startsWith('--radius-')) return 'Border Radius';
    if (variable.startsWith('--shadow-')) return 'Shadows';
    if (variable.startsWith('--transition-')) return 'Transitions';
    if (variable.startsWith('--z-')) return 'Z-Index';
    if (variable.startsWith('--density-')) return 'Density';
    if (variable.startsWith('--icon-')) return 'Icons';
    return 'Other';
  }

  /**
   * Update the tokens display
   */
  updateTokensDisplay() {
    if (this.viewMode === 'grid') {
      this.renderColorGrid();
      this.updateStats();
      return;
    }

    const container = document.getElementById('token-categories');
    
    // Filter tokens based on currentFilter
    this.filteredTokens = this.tokens.filter(token => {
      return this.currentFilter === 'all' || token.category === this.currentFilter;
    });

    if (this.filteredTokens.length === 0) {
      container.innerHTML = `
        <div class="theme-editor-empty">
          <div class="empty-icon">❌</div>
          <h3>No Design Tokens Found</h3>
          <p>Could not find any CSS custom properties in the scanned files.</p>
        </div>
      `;
      return;
    }

    // Group filtered tokens by category
    const grouped = this.filteredTokens.reduce((acc, token) => {
      const category = token.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(token);
      return acc;
    }, {});

    // Sort categories with Colors first
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      if (a === 'Colors') return -1;
      if (b === 'Colors') return 1;
      return a.localeCompare(b);
    });

    let html = '';
    
    sortedCategories.forEach(category => {
      const categoryTokens = grouped[category];
      const isColorCategory = category === 'Colors';
      
      // Add toggle only for color category
      const toggleBtn = isColorCategory ? `<button class="color-grid-toggle" title="Toggle color grid view">🔳</button>` : '';
      
      html += `
        <div class="token-category">
          <div class="token-category-title">${category} (${categoryTokens.length}) ${toggleBtn}</div>
          <div class="token-list ${isColorCategory ? (this.colorGridMode ? 'color-grid-view' : 'color-palette') : ''}">
      `;
      
      if (isColorCategory && this.colorGridMode) {
        html += this.renderColorGridSection(categoryTokens);
      } else {
        // Group typography tokens by type for better organization
        if (category === 'Typography') {
          html += this.renderTypographySection(categoryTokens);
        } else {
          categoryTokens.forEach(token => {
            if (isColorCategory) {
              html += this.renderColorToken(token);
            } else if (token.type === 'typography') {
              html += this.renderTypographyToken(token);
            } else {
              html += this.renderGenericToken(token);
            }
          });
        }
      }
      
      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Event delegation for copy, and color grid toggle
    container.addEventListener('click', (e) => {
      if (e.target.closest('.color-grid-toggle')) {
        this.colorGridMode = !this.colorGridMode;
        this.updateTokensDisplay();
        return;
      }
      if (e.target.classList.contains('token-var') || e.target.classList.contains('color-swatch')) {
        const tokenVar = e.target.closest('.token-row').querySelector('.token-var').textContent;
        this.copyToClipboard(tokenVar);
        this.showCopyFeedback(e.target);
      } else if (e.target.classList.contains('token-value')) {
        const tokenValue = e.target.textContent;
        this.copyToClipboard(tokenValue);
        this.showCopyFeedback(e.target);
      } else if (e.target.classList.contains('typography-table-token')) {
        const tokenVar = e.target.textContent;
        this.copyToClipboard(tokenVar);
        this.showCopyFeedback(e.target);
      } else if (e.target.classList.contains('typography-table-value')) {
        const tokenValue = e.target.textContent;
        this.copyToClipboard(tokenValue);
        this.showCopyFeedback(e.target);
      }
    });

    this.updateStats();
  }

  /**
   * Render a color token with swatch
   */
  renderColorToken(token) {
    const resolvedValue = this.resolveTokenValue(token.value);
    const isDark = this.isColorDark(resolvedValue);
    const textColorClass = isDark ? 'text-light' : '';

    return `
      <div class="token-row" data-token-type="color">
        <div class="color-token-display">
          <div class="color-swatch" style="background-color: ${resolvedValue};" title="Click to copy ${token.variable}"></div>
          <div class="color-details">
            <div class="token-var">${token.variable}</div>
            <div class="color-value-display">
              <span class="token-value ${textColorClass}">${token.value}</span>
            </div>
            <div class="color-name-display">${token.source}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render typography section with grouped tokens
   */
  renderTypographySection(tokens) {
    // Group tokens by type
    const grouped = {
      'font-family': [],
      'font-size': [],
      'font-weight': [],
      'line-height': [],
      'letter-spacing': [],
      'other': []
    };

    tokens.forEach(token => {
      if (token.variable.includes('font-family')) {
        grouped['font-family'].push(token);
      } else if (token.variable.includes('font-size')) {
        grouped['font-size'].push(token);
      } else if (token.variable.includes('font-weight')) {
        grouped['font-weight'].push(token);
      } else if (token.variable.includes('line-height')) {
        grouped['line-height'].push(token);
      } else if (token.variable.includes('letter-spacing')) {
        grouped['letter-spacing'].push(token);
      } else {
        grouped['other'].push(token);
      }
    });

    let html = '';

    // Render font-family tokens normally
    grouped['font-family'].forEach(token => {
      html += this.renderTypographyToken(token);
    });

    // Render font-size tokens in a compact table
    if (grouped['font-size'].length > 0) {
      html += this.renderFontSizeTable(grouped['font-size']);
    }

    // Render font-weight tokens in a compact table
    if (grouped['font-weight'].length > 0) {
      html += this.renderFontWeightTable(grouped['font-weight']);
    }

    // Render other typography tokens normally
    grouped['line-height'].forEach(token => {
      html += this.renderTypographyToken(token);
    });
    grouped['letter-spacing'].forEach(token => {
      html += this.renderTypographyToken(token);
    });
    grouped['other'].forEach(token => {
      html += this.renderTypographyToken(token);
    });

    return html;
  }

  /**
   * Render font-size tokens in a compact table format
   */
  renderFontSizeTable(tokens) {
    let html = `
      <div class="typography-table-container">
        <div class="typography-table-header">Font Sizes</div>
        <div class="typography-table">
    `;

    tokens.forEach(token => {
      const resolvedValue = this.resolveTokenValue(token.value);
      html += `
        <div class="typography-table-row">
          <div class="typography-table-token">${token.variable}</div>
          <div class="typography-table-value">${token.value}</div>
          <div class="typography-table-sample" style="font-size: ${resolvedValue};">Sample</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Render font-weight tokens in a compact table format
   */
  renderFontWeightTable(tokens) {
    let html = `
      <div class="typography-table-container">
        <div class="typography-table-header">Font Weights</div>
        <div class="typography-table">
    `;

    tokens.forEach(token => {
      const resolvedValue = this.resolveTokenValue(token.value);
      html += `
        <div class="typography-table-row">
          <div class="typography-table-token">${token.variable}</div>
          <div class="typography-table-value">${token.value}</div>
          <div class="typography-table-sample" style="font-weight: ${resolvedValue};">Sample</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Render a typography token with font sample
   */
  renderTypographyToken(token) {
    const resolvedValue = this.resolveTokenValue(token.value);
    const sampleText = this.getTypographySampleText(token.variable);
    const isFont = token.variable.includes('font');
    
    return `
      <div class="token-row" data-token-type="typography">
        <div class="typography-token-display">
          ${isFont ? `<div class="typography-sample" style="font-family: ${resolvedValue};">${sampleText}</div>` : ''}
          <div class="typography-details">
            <div class="token-var">${token.variable}</div>
            <div class="typography-value-display">
              <span class="token-value">${token.value}</span>
            </div>
            <div class="typography-resolved-display">
              <span class="resolved-value">${resolvedValue}</span>
            </div>
            <div class="typography-source-display">${token.source}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get sample text for typography tokens
   */
  getTypographySampleText(variable) {
    if (variable.includes('header')) return 'Header Text';
    if (variable.includes('text')) return 'Body Text';
    if (variable.includes('code')) return 'Code Text';
    if (variable.includes('alt')) return 'Alternative Text';
    return 'Sample Text';
  }

  /**
   * Render a generic token
   */
  renderGenericToken(token) {
    return `
      <div class="token-row" data-token-type="${token.type}">
        <div class="token-info">
          <span class="token-var">${token.variable}</span>
          <span class="token-value">${token.value}</span>
        </div>
        <span class="token-type-badge">${token.type}</span>
      </div>
    `;
  }

  /**
   * Resolve CSS variable references in token values
   */
  resolveTokenValue(value) {
    // If it's a var() reference, try to resolve it
    if (value.includes('var(')) {
      const varMatch = value.match(/var\((--[^,)]+)/);
      if (varMatch) {
        const varName = varMatch[1];
        const computedStyle = getComputedStyle(document.documentElement);
        const resolvedValue = computedStyle.getPropertyValue(varName).trim();
        if (resolvedValue) {
          return resolvedValue;
        }
      }
    }
    return value;
  }

  /**
   * Update statistics
   */
  updateStats() {
    const totalCount = this.filteredTokens.length;
    const colorCount = this.filteredTokens.filter(t => t.type === 'color').length;
    const typographyCount = this.filteredTokens.filter(t => t.type === 'typography').length;
    const spacingCount = this.filteredTokens.filter(t => t.type === 'spacing').length;

    const tokenCountEl = document.getElementById('token-count');
    const colorCountEl = document.getElementById('color-count');
    const typographyCountEl = document.getElementById('typography-count');
    const spacingCountEl = document.getElementById('spacing-count');

    if (tokenCountEl) tokenCountEl.textContent = `Total: ${totalCount}`;
    if (colorCountEl) colorCountEl.textContent = `Colors: ${colorCount}`;
    if (typographyCountEl) typographyCountEl.textContent = `Typography: ${typographyCount}`;
    if (spacingCountEl) spacingCountEl.textContent = `Spacing: ${spacingCount}`;
  }

  /**
   * Copy text to clipboard and show feedback
   */
  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      console.log(`Copied: ${text}`);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  /**
   * Show copy feedback animation
   */
  showCopyFeedback(element) {
    const feedback = document.createElement('div');
    feedback.className = 'copy-feedback';
    feedback.textContent = 'Copied!';
    
    const rect = element.getBoundingClientRect();
    feedback.style.position = 'fixed';
    feedback.style.left = rect.left + 'px';
    feedback.style.top = (rect.top - 30) + 'px';
    feedback.style.zIndex = '10000';
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 2000);
  }

  /**
   * Show error state
   */
  showError(error) {
    const container = document.getElementById('token-categories');
    if (!container) {
      console.error('[DesignTokensPanel] token-categories container not found');
      return;
    }
    
    container.innerHTML = `
      <div class="theme-editor-error">
        <div class="error-icon">⚠️</div>
        <h3>Error Loading Design Tokens</h3>
        <p>There was an error scanning for design tokens.</p>
        <div class="error-details">
          <code>${error.message}</code>
        </div>
        <button class="btn btn-primary retry-button" onclick="this.closest('.theme-editor-panel').dispatchEvent(new CustomEvent('retry'))">
          Try Again
        </button>
      </div>
    `;
  }

  /**
   * Refresh tokens (delegate to reusable panel)
   */
  async refreshTokens() {
    const refreshBtn = document.getElementById('refresh-tokens');
    if (!refreshBtn) {
      console.warn('[DesignTokensPanel] refresh-tokens button not found during refresh');
      await this.loadDesignTokens();
      return;
    }
    
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
    
    try {
      await this.loadDesignTokens();
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh';
    }
  }

  /**
   * Export tokens as JSON
   */
  exportTokensAsJSON() {
    const tokensObject = {};
    
    this.tokens.forEach(token => {
      tokensObject[token.variable] = {
        variable: token.variable,
        value: token.value,
        type: token.type,
        source: token.source,
        category: token.category
      };
    });
    
    const dataStr = JSON.stringify(tokensObject, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'design-tokens.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Destroy the panel
   */
  destroy() {
    this.containerElement.innerHTML = '';
    this.tokens = [];
  }

  /**
   * Setup event listeners for filter buttons.
   */
  setupFilterEventListeners() {
    const filterContainer = document.getElementById('token-filters');
    if (!filterContainer) {
      console.warn('[DesignTokensPanel] token-filters container not found');
      return;
    }
    
    filterContainer.addEventListener('click', (event) => {
      const target = event.target;
      if (target.classList.contains('token-filter-badge')) {
        const filter = target.dataset.filter;
        this.applyFilter(filter);
      }
    });
  }

  /**
   * Apply a new filter to the tokens.
   */
  applyFilter(filter) {
    this.currentFilter = filter;
    this.updateTokensDisplay();
    this.updateFilterBadges(); // New: Update active state of badges
  }

  /**
   * Update the active state of filter badges.
   */
  updateFilterBadges() {
    const filterButtons = document.querySelectorAll('.token-filter-badge');
    filterButtons.forEach(button => {
      if (button.dataset.filter === this.currentFilter) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Render filter badges based on available token categories.
   */
  renderFilterBadges() {
    const filterContainer = document.getElementById('token-filters');
    if (!filterContainer) return;

    let badgesHtml = '';
    this.availableFilterTypes.forEach(type => {
      const displayName = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize first letter
      badgesHtml += `<button class="token-filter-badge" data-filter="${type}">${displayName}</button>`;
    });
    filterContainer.innerHTML = badgesHtml;
  }

  setViewMode(view) {
    this.viewMode = view;
    this.updateTokensDisplay();

    const viewModeButtons = this.containerElement.querySelectorAll('.view-mode-btn');
    viewModeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === this.viewMode);
    });
  }

  /**
   * Toggle between list and grid view modes.
   */
  toggleViewMode() {
    this.setViewMode(this.viewMode === 'list' ? 'grid' : 'list');
  }

  /**
   * Render the color tokens in a hue x intensity grid without labels.
   */
  renderColorGrid() {
    const container = document.getElementById('token-categories');
    if (!container) return;

    // Filter only color tokens
    const colorTokens = this.tokens.filter(t => t.type === 'color');

    // Organize tokens by hue and intensity
    const hueMap = {};
    const intensitySet = new Set();

    const hueRegex = /--color-([^\-]+)-(\d+)/;
    colorTokens.forEach(token => {
      const m = token.variable.match(hueRegex);
      if (!m) return;
      const hue = m[1];
      const intensity = parseInt(m[2], 10);
      if (!hueMap[hue]) hueMap[hue] = {};
      hueMap[hue][intensity] = token;
      intensitySet.add(intensity);
    });

    const intensities = Array.from(intensitySet).sort((a, b) => a - b);
    const hues = Object.keys(hueMap).sort();

    let html = '<div class="color-grid" style="display:flex; flex-direction:column; gap:4px;">';
    hues.forEach(hue => {
      html += '<div class="color-grid-row" style="display:flex; gap:4px;">';
      intensities.forEach(intensity => {
        const token = hueMap[hue][intensity];
        const value = token ? this.resolveTokenValue(token.value) : 'transparent';
        html += `<div class="grid-swatch" style="width:24px; height:24px; border-radius:4px; background:${value}; border:1px solid var(--color-border);"></div>`;
      });
      html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  }

  /**
   * Render small grid section for colors (hue x intensity) used inside normal list.
   */
  renderColorGridSection(colorTokens) {
    // Organize tokens by hue/intensity
    const hueMap = {};
    const intensitySet = new Set();
    const hueRegex = /--color-([^\-]+)-(\d+)/;
    colorTokens.forEach(token => {
      const m = token.variable.match(hueRegex);
      if (!m) return;
      const hue = m[1];
      const intensity = parseInt(m[2], 10);
      if (!hueMap[hue]) hueMap[hue] = {};
      hueMap[hue][intensity] = token;
      intensitySet.add(intensity);
    });
    const intensities = Array.from(intensitySet).sort((a,b)=>a-b);
    const hues = Object.keys(hueMap).sort();

    let gridHtml = '<div class="color-mini-grid" style="display:flex; flex-direction:column; gap:2px;">';
    hues.forEach(hue => {
      gridHtml += '<div class="color-grid-row" style="display:flex; gap:2px;">';
      intensities.forEach(intensity => {
        const token = hueMap[hue][intensity];
        const value = token ? this.resolveTokenValue(token.value) : 'transparent';
        gridHtml += `<div class="grid-swatch" style="width:18px; height:18px; border-radius:3px; background:${value}; border:1px solid var(--color-border);"></div>`;
      });
      gridHtml += '</div>';
    });
    gridHtml += '</div>';
    return gridHtml;
  }
} 