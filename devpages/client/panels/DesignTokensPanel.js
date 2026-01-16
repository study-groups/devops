import { BasePanel, panelRegistry } from '/client/panels/BasePanel.js';
import { themeService } from '../services/ThemeService.js';

/**
 * Design Tokens Panel - Displays CSS variables from theme files
 * Dynamically discovers all CSS custom properties from computed styles
 * Categorizes tokens by name patterns (colors, spacing, typography, etc.)
 */
export class DesignTokensPanel extends BasePanel {
  constructor(options = {}) {
    super({
      type: 'design-tokens',
      title: 'Design Tokens',
      description: 'Explore design system tokens',
      ...options
    });

    this.tokens = [];
    this.filteredTokens = [];
    this.categories = new Set();
    this.currentFilter = 'all';
    this.colorView = 'grid';
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'design-tokens-panel';
    this.element.innerHTML = this.renderContent();
    return this.element;
  }

  renderContent() {
    return `
      <div class="design-tokens-panel">
        <div class="dt-toolbar">
          <div class="dt-filter-group" id="token-category-filters">
            ${this.renderCategoryFilters()}
          </div>
          ${this.currentFilter === 'Colors' ? `
            <div class="dt-controls">
              <button class="dt-view-toggle ${this.colorView === 'grid' ? 'active' : ''}" data-view="grid">Grid</button>
              <button class="dt-view-toggle ${this.colorView === 'list' ? 'active' : ''}" data-view="list">List</button>
            </div>
          ` : ''}
        </div>
        <div class="dt-content" id="design-tokens-container">
          ${this.renderTokens()}
        </div>
        <div class="dt-stats">
          <span id="tokens-count">${this.filteredTokens.length} tokens</span>
        </div>
      </div>
    `;
  }

  renderCategoryFilters() {
    const categories = ['all', ...Array.from(this.categories)];
    return categories.map(category => `
      <button class="dt-filter-btn ${category === this.currentFilter ? 'active' : ''}"
              data-category="${category}">
        ${category}
      </button>
    `).join('');
  }

  renderTokens() {
    if (this.currentFilter === 'Colors') {
      return this.colorView === 'grid' ? this.renderColorGrid() : this.renderColorList();
    } else if (this.currentFilter === 'Typography') {
      return this.renderTypographyGrid();
    } else if (this.currentFilter === 'Spacing') {
      return this.renderSpacingGrid();
    } else {
      return this.renderGenericGrid();
    }
  }

  renderColorGrid() {
    const colors = this.tokens.filter(t => t.category === 'Colors');

    // Group colors by type
    const groups = {
      primary: colors.filter(t => t.name.includes('primary')),
      neutral: colors.filter(t => t.name.includes('neutral')),
      success: colors.filter(t => t.name.includes('success')),
      warning: colors.filter(t => t.name.includes('warning')),
      error: colors.filter(t => t.name.includes('error')),
      info: colors.filter(t => t.name.includes('info')),
      surface: colors.filter(t => t.name.includes('bg') || t.name.includes('surface') || t.name.includes('border') || t.name.includes('divider')),
      text: colors.filter(t => t.name.includes('text'))
    };

    return `
      <div class="color-grid-container">
        ${Object.entries(groups).filter(([_, tokens]) => tokens.length > 0).map(([group, tokens]) => `
          <div class="color-section">
            <div class="color-section-title">${group.charAt(0).toUpperCase() + group.slice(1)}</div>
            <div class="color-swatches">
              ${tokens.map(token => `
                <div class="color-swatch-item" title="${token.variable}: ${token.value}">
                  <div class="color-swatch" style="background: ${token.value};"></div>
                  <div class="color-label">${token.name.replace('color-', '')}</div>
                  <div class="color-hex">${token.value}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderColorList() {
    const colors = this.tokens.filter(t => t.category === 'Colors');
    return `
      <div class="token-list">
        ${colors.map(token => `
          <div class="token-row">
            <div class="token-swatch" style="background: ${token.value};"></div>
            <div class="token-name">${token.variable}</div>
            <div class="token-value">${token.value}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderTypographyGrid() {
    const tokens = this.filteredTokens.filter(t => t.category === 'Typography');
    return `
      <div class="typography-grid">
        ${tokens.map(token => `
          <div class="typo-row">
            <div class="typo-name">${token.name}</div>
            <div class="typo-value">${token.value}</div>
            <div class="typo-preview" style="${this.getTypoStyle(token)}">Aa</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderSpacingGrid() {
    const tokens = this.filteredTokens.filter(t => t.category === 'Spacing');
    return `
      <div class="spacing-grid">
        ${tokens.map(token => `
          <div class="spacing-row">
            <div class="spacing-name">${token.name}</div>
            <div class="spacing-value">${token.value}</div>
            <div class="spacing-visual">
              <div class="spacing-bar" style="width: ${this.getSpacingWidth(token.value)}"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderGenericGrid() {
    return `
      <div class="token-grid">
        ${this.filteredTokens.map(token => `
          <div class="token-row">
            <div class="token-category-badge ${token.category.toLowerCase()}">${token.category.charAt(0)}</div>
            <div class="token-name">${token.variable}</div>
            <div class="token-value">${token.value}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  getTypoStyle(token) {
    if (token.name.includes('size')) return `font-size: ${token.value}`;
    if (token.name.includes('weight')) return `font-weight: ${token.value}`;
    if (token.name.includes('family')) return `font-family: ${token.value}`;
    return '';
  }

  getSpacingWidth(value) {
    const num = parseFloat(value);
    if (value.includes('rem')) return Math.min(num * 16, 100) + 'px';
    if (value.includes('px')) return Math.min(num, 100) + 'px';
    return '20px';
  }

  async onMount(container) {
    super.onMount(container);
    await this.loadTokensFromCSS();
    this.updateDisplay();
    this.attachEventListeners();

    // Subscribe to theme changes
    this._unsubscribe = themeService.subscribe(() => {
      this.loadTokensFromCSS();
      this.updateDisplay();
    });
  }

  onUnmount() {
    if (this._unsubscribe) this._unsubscribe();
    super.onUnmount();
  }

  attachEventListeners() {
    const container = this.getContainer();
    if (!container) return;

    container.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('.dt-filter-btn');
      if (filterBtn) {
        this.currentFilter = filterBtn.dataset.category;
        this.updateDisplay();
      }

      const viewToggle = e.target.closest('.dt-view-toggle');
      if (viewToggle) {
        this.colorView = viewToggle.dataset.view;
        this.updateDisplay();
      }
    });
  }

  async loadTokensFromCSS() {
    this.tokens = [];
    const styles = getComputedStyle(document.documentElement);

    // Dynamically discover all CSS custom properties
    for (let i = 0; i < styles.length; i++) {
      const prop = styles[i];
      if (prop.startsWith('--')) {
        const value = styles.getPropertyValue(prop).trim();
        if (value) {
          const name = prop.slice(2); // Remove '--' prefix
          const { category, type } = this.categorizeToken(name, value);
          this.tokens.push({
            variable: prop,
            name,
            value,
            category,
            type
          });
        }
      }
    }

    // Sort tokens by category, then by name
    this.tokens.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });

    this.categories = new Set(this.tokens.map(t => t.category));
  }

  /**
   * Categorize a token based on its name and value
   */
  categorizeToken(name, value) {
    const lower = name.toLowerCase();

    // Colors - check name patterns and value format
    if (lower.includes('color') || lower.startsWith('devpages-type-') ||
        lower.includes('-bg') || lower.includes('-fg') ||
        /^#[0-9a-f]{3,8}$/i.test(value) || value.startsWith('rgb') || value.startsWith('hsl')) {
      return { category: 'Colors', type: 'color' };
    }

    // Spacing
    if (lower.includes('spacing') || lower.includes('space-') || lower.includes('gap') ||
        lower.includes('padding') || lower.includes('margin')) {
      return { category: 'Spacing', type: 'spacing' };
    }

    // Typography
    if (lower.includes('font') || lower.includes('text') || lower.includes('line-height') ||
        lower.includes('heading')) {
      return { category: 'Typography', type: 'typography' };
    }

    // Effects (shadows, radius, transitions)
    if (lower.includes('shadow') || lower.includes('radius') || lower.includes('transition')) {
      return { category: 'Effects', type: lower.includes('shadow') ? 'shadow' : lower.includes('radius') ? 'radius' : 'transition' };
    }

    // Layout (z-index, dimensions)
    if (lower.includes('z-') || lower.includes('width') || lower.includes('height')) {
      return { category: 'Layout', type: 'layout' };
    }

    // Component tokens
    if (lower.includes('panel') || lower.includes('button') || lower.includes('input') ||
        lower.includes('card') || lower.includes('nav') || lower.includes('modal') ||
        lower.includes('badge') || lower.includes('tooltip') || lower.includes('dropdown') ||
        lower.includes('sidebar') || lower.includes('table') || lower.includes('form')) {
      return { category: 'Components', type: 'component' };
    }

    return { category: 'Other', type: 'other' };
  }

  updateDisplay() {
    const container = this.getContainer();
    if (!container) return;

    this.filteredTokens = this.currentFilter === 'all'
      ? this.tokens
      : this.tokens.filter(t => t.category === this.currentFilter);

    const tokensContainer = container.querySelector('#design-tokens-container');
    const statsContainer = container.querySelector('#tokens-count');
    const filtersContainer = container.querySelector('#token-category-filters');

    if (filtersContainer) filtersContainer.innerHTML = this.renderCategoryFilters();
    if (tokensContainer) tokensContainer.innerHTML = this.renderTokens();
    if (statsContainer) statsContainer.textContent = `${this.filteredTokens.length} tokens`;
  }
}

panelRegistry.registerType('design-tokens', DesignTokensPanel);

export function createDesignTokensPanel(config = {}) {
  return new DesignTokensPanel(config);
}
