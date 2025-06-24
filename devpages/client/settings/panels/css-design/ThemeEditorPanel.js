/**
 * ThemeEditorPanel.js - Design Tokens Viewer
 * Reads design tokens from design-system.css (single source of truth)
 * Displays tokens in a clean tabular interface for viewing and harmonization
 */

import { settingsSectionRegistry } from '../../core/settingsSectionRegistry.js';

class ThemeEditorPanel {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.designTokens = new Map(); // Parsed tokens from CSS
    this.categories = new Map(); // Token categories
  
    this.init();
  }

  async init() {
    // Load and parse design-tokens.css
    await this.loadDesignTokensCSS();
    
    // Render the panel
    this.render();
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
        <div class="error-icon">⚠️</div>
        <h3>Failed to Load Design Tokens</h3>
        <p>Could not load design-tokens.css</p>
        <div class="error-details">
          <code>${message}</code>
        </div>
        <button onclick="location.reload()" class="retry-button">
          🔄 Retry
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
          <div class="empty-icon">📄</div>
          <h3>No Design Tokens Found</h3>
          <p>No tokens were found in design-tokens.css</p>
        </div>
      `;
      return;
    }

    this.containerElement.innerHTML = `
      <div class="theme-editor-panel">
        <div class="theme-editor-header">
          <h3>Design Tokens Viewer</h3>
          <p>Design tokens parsed from <code>design-tokens.css</code> (single source of truth)</p>
          <div class="token-stats">
            <span class="stat">📊 ${this.designTokens.size} tokens</span>
            <span class="stat">🏷️ ${this.categories.size} categories</span>
            <button onclick="this.closest('.theme-editor-panel').themeEditor.refreshTokens()" class="refresh-btn">
              🔄 Refresh
            </button>
          </div>
        </div>

        <div class="token-categories">
          ${this.renderTokenCategories()}
        </div>
      </div>
    `;
    
    // Store reference for button onclick
    this.containerElement.querySelector('.theme-editor-panel').themeEditor = this;
  }

  /**
   * Render token categories
   */
  renderTokenCategories() {
    return Array.from(this.categories.entries()).map(([category, tokens]) => `
      <div class="token-category">
        <div class="category-header">
          <h4 class="category-title">
            ${this.getCategoryIcon(category)} ${category}
            <span class="category-count">(${tokens.length})</span>
          </h4>
          <button class="category-toggle" onclick="this.closest('.token-category').classList.toggle('collapsed')">
            <span class="toggle-icon">▼</span>
          </button>
        </div>
        
        <div class="category-content">
          <div class="token-table">
            <div class="token-table-header">
              <div class="table-col-name">Token Name</div>
              <div class="table-col-variable">CSS Variable</div>
              <div class="table-col-value">Value</div>
              <div class="table-col-preview">Preview</div>
            </div>
            <div class="token-table-body">
              ${tokens.map(token => this.renderTokenRow(token)).join('')}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category) {
    const icons = {
      'Colors': '🎨',
      'Typography': '📝',
      'Spacing': '📏',
      'Border Radius': '🔄',
      'Shadows': '🌑',
      'Transitions': '⚡',
      'Other': '⚙️'
    };
    return icons[category] || '📋';
  }

  /**
   * Render individual token row
   */
  renderTokenRow(token) {
    return `
      <div class="token-row" data-token-type="${token.type}">
        <div class="token-name">
          <span class="name-text">${token.name}</span>
          <span class="token-type">${token.type}</span>
        </div>
        <div class="token-variable">
          <code class="css-var">${token.variable}</code>
          <button class="copy-var" onclick="navigator.clipboard.writeText('${token.variable}')" title="Copy variable">
            📋
          </button>
        </div>
        <div class="token-value">
          <code class="value-text">${token.value}</code>
          <button class="copy-value" onclick="navigator.clipboard.writeText('${token.value}')" title="Copy value">
            📋
          </button>
        </div>
        <div class="token-preview">
          ${this.renderTokenPreview(token)}
        </div>
      </div>
    `;
  }

  /**
   * Render token preview based on type
   */
  renderTokenPreview(token) {
    switch (token.type) {
      case 'color':
        return `<div class="color-preview" style="background-color: ${token.value};" title="${token.value}"></div>`;
      
      case 'font-size':
        return `<div class="text-preview" style="font-size: ${token.value};">Aa</div>`;
      
      case 'font-weight':
        return `<div class="text-preview" style="font-weight: ${token.value};">Text</div>`;
      
      case 'font-family':
        return `<div class="text-preview" style="font-family: ${token.value};">Typeface</div>`;
      
      case 'spacing':
        return `<div class="spacing-preview">
                  <div class="spacing-box" style="width: ${token.value}; height: 16px;"></div>
                  <span class="spacing-label">${token.value}</span>
                </div>`;
      
      case 'border-radius':
        return `<div class="radius-preview" style="border-radius: ${token.value};"></div>`;
      
      case 'shadow':
        return `<div class="shadow-preview" style="box-shadow: ${token.value};"></div>`;
      
      case 'transition':
        return `<div class="transition-preview" style="transition: all ${token.value};">${token.value}</div>`;
      
      default:
        return `<span class="generic-preview">${token.value}</span>`;
    }
  }

  /**
   * Refresh tokens from CSS
   */
  async refreshTokens() {
    const refreshBtn = this.containerElement.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.innerHTML = '⏳ Loading...';
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
  component: ThemeEditorPanel
});

export default ThemeEditorPanel; 