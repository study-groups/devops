/**
 * DesignTokensPanel.js - Design Tokens Viewer
 * Reads design tokens from design-tokens.css (single source of truth)
 * Displays tokens in a clean tabular interface for viewing and harmonization
 */

import { settingsSectionRegistry } from '../../core/settingsSectionRegistry.js';

class DesignTokensPanel {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.designTokens = new Map(); // Parsed tokens from CSS
    this.categories = new Map(); // Token categories
  
    this.init();
  }

  async init() {
    // Load component CSS
    this.loadComponentCSS();
    
    // Load and parse design-tokens.css
    await this.loadDesignTokensCSS();
    
    // Render the panel
    this.render();
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
   * Load and parse design-system.css file
   */
  async loadDesignTokensCSS() {
    try {
      const response = await fetch('/client/styles/design-tokens.css');
      if (!response.ok) {
        throw new Error(`Failed to load design-tokens.css: ${response.status}`);
      }
      
      const cssContent = await response.text();
      this.parseDesignTokens(cssContent);
      
      console.log(`[ThemeEditor] Loaded ${this.designTokens.size} design tokens from design-tokens.css`);
    } catch (error) {
      console.error('[ThemeEditor] Error loading design-tokens.css:', error);
      this.showLoadingError(error.message);
    }
  }

  /**
   * Parse CSS content to extract design tokens
   */
  parseDesignTokens(cssContent) {
    this.designTokens.clear();
    this.categories.clear();

    // Find :root blocks
    const rootBlocks = cssContent.match(/:root\s*\{[^}]*\}/g) || [];
    
    rootBlocks.forEach(block => {
      // Extract CSS custom properties
      const propertyRegex = /--([^:]+):\s*([^;]+);/g;
      let match;
      
      while ((match = propertyRegex.exec(block)) !== null) {
        const [, name, value] = match;
        const cleanName = name.trim();
        const cleanValue = value.trim();
        
        // Create token object
        const token = {
          name: cleanName,
          variable: `--${cleanName}`,
          value: cleanValue,
          type: this.inferTokenType(cleanName, cleanValue),
          category: this.inferTokenCategory(cleanName)
        };
        
        this.designTokens.set(cleanName, token);
        
        // Group by category
        if (!this.categories.has(token.category)) {
          this.categories.set(token.category, []);
        }
        this.categories.get(token.category).push(token);
      }
    });

    // Sort categories and tokens
    this.sortTokens();
  }

  /**
   * Infer token type from name and value
   */
  inferTokenType(name, value) {
    // Color tokens
    if (name.includes('color') || name.includes('bg') || name.includes('text') || 
        value.match(/^#[0-9a-fA-F]{3,8}$/) || value.includes('rgb') || value.includes('hsl')) {
      return 'color';
    }
    
    // Font family tokens
    if (name.includes('font-family') || name.includes('family')) {
      return 'font-family';
    }
    
    // Font size tokens
    if (name.includes('font-size') || name.includes('text-') && value.includes('rem')) {
      return 'font-size';
    }
    
    // Font weight tokens
    if (name.includes('font-weight') || name.includes('weight')) {
      return 'font-weight';
    }
    
    // Line height tokens
    if (name.includes('line-height') || name.includes('leading')) {
      return 'line-height';
    }
    
    // Spacing tokens
    if (name.includes('space') || name.includes('gap') || name.includes('margin') || name.includes('padding')) {
      return 'spacing';
    }
    
    // Border radius tokens
    if (name.includes('radius') || name.includes('rounded')) {
      return 'border-radius';
    }
    
    // Shadow tokens
    if (name.includes('shadow') || value.includes('rgb') && value.includes('px')) {
      return 'shadow';
    }
    
    // Transition tokens
    if (name.includes('transition') || value.includes('ease') || value.includes('ms')) {
      return 'transition';
    }
    
    return 'other';
  }

  /**
   * Infer token category from name
   */
  inferTokenCategory(name) {
    if (name.includes('color') || name.includes('bg') || name.includes('text')) {
      return 'Colors';
    }
    
    if (name.includes('font') || name.includes('text-') || name.includes('line-height')) {
      return 'Typography';
    }
    
    if (name.includes('space') || name.includes('gap') || name.includes('margin') || name.includes('padding')) {
      return 'Spacing';
    }
    
    if (name.includes('radius') || name.includes('rounded')) {
      return 'Border Radius';
    }
    
    if (name.includes('shadow')) {
      return 'Shadows';
    }
    
    if (name.includes('transition')) {
      return 'Transitions';
    }
    
    return 'Other';
  }

  /**
   * Sort tokens within categories
   */
  sortTokens() {
    this.categories.forEach((tokens, category) => {
      tokens.sort((a, b) => a.name.localeCompare(b.name));
    });
    
    // Sort categories by priority
    const sortedCategories = new Map();
    const categoryOrder = ['Colors', 'Typography', 'Spacing', 'Border Radius', 'Shadows', 'Transitions', 'Other'];
    
    categoryOrder.forEach(cat => {
      if (this.categories.has(cat)) {
        sortedCategories.set(cat, this.categories.get(cat));
      }
    });
    
    // Add any remaining categories
    this.categories.forEach((tokens, cat) => {
      if (!sortedCategories.has(cat)) {
        sortedCategories.set(cat, tokens);
      }
    });
    
    this.categories = sortedCategories;
  }

  /**
   * Show loading error
   */
  showLoadingError(message) {
    this.containerElement.innerHTML = `
      <div class="theme-editor-error">
        <div class="error-icon">Warning</div>
        <h3>Failed to Load Design Tokens</h3>
        <p>Could not load design-tokens.css</p>
        <div class="error-details">
          <code>${message}</code>
        </div>
        <button onclick="location.reload()" class="retry-button">
          Retry
        </button>
      </div>
    `;
  }

  /**
   * Render the main panel
   */
  render() {
    if (this.designTokens.size === 0) {
      this.containerElement.innerHTML = `
        <div class="theme-editor-empty">
          <div class="empty-icon">No Data</div>
          <h3>No Design Tokens Found</h3>
          <p>No tokens were found in design-tokens.css</p>
        </div>
      `;
      return;
    }

    this.containerElement.innerHTML = `
      <div class="theme-editor-panel">
        <div class="theme-editor-header">
          <p>Tokens parsed from <code>design-tokens.css</code></p>
          <div class="token-stats">
            <span class="stat">${this.designTokens.size} Tokens</span>
            <span class="stat">${this.categories.size} Categories</span>
            <button class="btn btn--secondary refresh-btn">Refresh</button>
          </div>
        </div>
        <div class="token-categories">
          ${this.renderTokenCategories()}
        </div>
      </div>
    `;

    this.containerElement.querySelector('.refresh-btn').onclick = () => this.refreshTokens();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.containerElement.querySelectorAll('.settings-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const container = header.closest('.settings-section-container');
            container.classList.toggle('collapsed');
            const indicator = header.querySelector('.collapse-indicator');
            if (indicator) {
                indicator.textContent = container.classList.contains('collapsed') ? '►' : '▼';
            }
        });
    });

    this.containerElement.addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (swatch) {
        const colorValue = swatch.dataset.colorValue;
        if (colorValue) {
          navigator.clipboard.writeText(colorValue);
          // Add simple feedback later if needed
        }
      }
    });
  }

  /**
   * Render token categories
   */
  renderTokenCategories() {
    return Array.from(this.categories.entries()).map(([category, tokens]) => `
      <div class="settings-section-container collapsed">
        <h2 class="settings-section-header" tabindex="0">
          <span class="collapse-indicator">►</span>
          ${category} (${tokens.length})
        </h2>
        <div class="settings-section-content">
          <div class="token-list">
            ${tokens.map(token => this.renderTokenRow(token)).join('')}
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render individual token row
   */
  renderTokenRow(token) {
    if (token.type === 'color') {
      return `
        <div class="token-row" data-token-type="color">
          <div class="color-swatch" 
               style="background-color: ${token.value};" 
               data-color-value="${token.value}">
          </div>
          <span class="token-var">${token.variable}</span>
          <code class="token-value">${token.value}</code>
        </div>
      `;
    }

    const showTypeBadge = token.type !== 'other';
    return `
      <div class="token-row">
        <div class="token-info">
            <span class="token-var">${token.variable}</span>
            ${showTypeBadge ? `<span class="token-type-badge">${token.type}</span>` : ''}
        </div>
        <code class="token-value">${token.value}</code>
      </div>
    `;
  }

  /**
   * Render token display based on type
   */
  renderTokenDisplay(token) {
    // This method is now simplified and integrated into renderTokenRow
    return `<code class="token-value">${token.value}</code>`;
  }

  /**
   * Refresh tokens from CSS
   */
  async refreshTokens() {
    const refreshBtn = this.containerElement.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.innerHTML = 'Loading...';
      refreshBtn.disabled = true;
    }
    
    await this.loadDesignTokensCSS();
    this.render();
  }

  /**
   * Export tokens as JSON
   */
  exportTokensAsJSON() {
    const tokensObj = {};
    
    this.categories.forEach((tokens, category) => {
      tokensObj[category.toLowerCase().replace(/\s+/g, '_')] = tokens.reduce((acc, token) => {
        acc[token.name] = {
          variable: token.variable,
          value: token.value,
          type: token.type
        };
        return acc;
      }, {});
    });

    const jsonStr = JSON.stringify(tokensObj, null, 2);
    
    // Create download
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-tokens.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Cleanup
   */
  destroy() {
    // Clean up any resources if needed
  }
}

// Register the panel
settingsSectionRegistry.register({
  id: 'design-tokens',
  title: 'Design Tokens',
  icon: '🎨',
  order: 3,
  component: DesignTokensPanel
});

export default DesignTokensPanel; 