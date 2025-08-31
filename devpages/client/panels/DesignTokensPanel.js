import { BasePanel, panelRegistry } from '/client/panels/BasePanel.js';
import { createIcon } from '/client/config/icon-system.js';
import { appStore } from '../appState.js';
import { uiActions } from '../store/uiSlice.js';

/**
 * Design Tokens Panel for exploring and managing design system tokens
 * @category Settings
 * @title Design Tokens
 * @description Explore and manage design system tokens, color palettes, and design variables
 */
export class DesignTokensPanel extends BasePanel {
    constructor(options = {}) {
        // Ensure type is set to 'design-tokens' for consistency
        const config = {
            type: 'design-tokens',
            title: 'Design Tokens',
            description: 'Explore and manage design system tokens',
            ...options
        };

        super(config);

        // State management
        this.tokens = [];
        this.filteredTokens = [];
        this.categories = new Set();
        this.currentView = 'list';
        this.currentFilter = 'all';
        this.searchQuery = '';
        
    }

    render() {
        try {
            this.element = document.createElement('div');
            this.element.className = 'design-tokens-panel';
            this.element.innerHTML = this.renderContent();
            return this.element;
        } catch (error) {
            console.error('[DesignTokensPanel] Rendering failed:', error);
            return null;
        }
    }

    /**
     * Renders panel content as HTML string (for SidebarManager compatibility)
     * @returns {string} HTML content
     */
    renderContent() {
        return `
            <div class="design-tokens-panel">
                <div class="dt-filters">
                    <div id="token-category-filters" class="category-filters">
                        ${this.renderCategoryFilters()}
                    </div>
                </div>
                <div class="dt-content">
                    <div class="tokens-wrapper">
                        <div id="design-tokens-container" class="tokens-container">
                            ${this.renderTokens()}
                        </div>
                    </div>
                    <div class="tokens-footer">
                        <span id="tokens-count">${this.filteredTokens.length} Tokens</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderCategoryFilters() {
        const categories = ['all', ...Array.from(this.categories)];
        return categories.map(category => `
            <button class="category-filter ${category === this.currentFilter ? 'active' : ''}" 
                    data-category="${category}">
                ${category}
            </button>
        `).join('');
    }

    renderTokens() {
        const isColorGrid = this.currentFilter === 'Colors';
        const isNameValueGrid = ['Spacing', 'Other', 'Z-Index'].includes(this.currentFilter);

        if (isColorGrid) {
            return this.renderColorMatrix();
        } else if (isNameValueGrid) {
            return this.filteredTokens.map(token => `
                <div class="token-name">${token.name}</div>
                <div class="token-value">${token.value}</div>
            `).join('');
        } else {
            return this.filteredTokens.map(token => `
                <div class="token-row">
                    ${token.type === 'color' ? `<div class="token-color-swatch" style="background: ${token.value};"></div>` : ''}
                    <div class="token-info">
                        <div class="token-name">${token.name}</div>
                        <div class="token-value">${token.value}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    renderColorMatrix() {
        // Group ALL colors by family
        const colorFamilies = {};
        const allShades = new Set();
        
        this.filteredTokens.forEach(token => {
            const parts = token.name.split('-');
            
            if (parts.length >= 2 && !isNaN(parts[1])) {
                // Numbered shade like primary-500
                const family = parts[0];
                const shade = parts[1];
                
                if (!colorFamilies[family]) {
                    colorFamilies[family] = {};
                }
                colorFamilies[family][shade] = token;
                allShades.add(shade);
            } else if (parts[0] === 'accent' && parts.length >= 2) {
                // Accent colors like accent-red
                const family = `accent-${parts[1]}`;
                const shade = 'base';
                
                if (!colorFamilies[family]) {
                    colorFamilies[family] = {};
                }
                colorFamilies[family][shade] = token;
                allShades.add(shade);
            } else {
                // Other colors like success, warning, error, info, text-*, background-*
                const family = token.name;
                const shade = 'base';
                
                if (!colorFamilies[family]) {
                    colorFamilies[family] = {};
                }
                colorFamilies[family][shade] = token;
                allShades.add(shade);
            }
        });

        const families = Object.keys(colorFamilies).sort();
        const numberedShades = Array.from(allShades).filter(s => !isNaN(s)).sort((a, b) => parseInt(b) - parseInt(a));
        const otherShades = Array.from(allShades).filter(s => isNaN(s)).sort();
        const shades = [...numberedShades, ...otherShades];

        const gridCols = `80px repeat(${families.length}, 24px)`;
        
        return `
            <div class="color-matrix" style="grid-template-columns: ${gridCols};">
                <div class="matrix-corner"></div>
                ${families.map(family => `<div class="matrix-col-label">${family}</div>`).join('')}
                ${shades.map(shade => `
                    <div class="matrix-row-label">${shade}</div>
                    ${families.map(family => {
                        const token = colorFamilies[family] && colorFamilies[family][shade];
                        return token ? 
                            `<div class="color-cell" style="background: ${token.value};" title="${token.name}: ${token.value}"></div>` :
                            `<div class="color-cell empty"></div>`;
                    }).join('')}
                `).join('')}
            </div>
        `;
    }

    // Modify onMount to ensure element is created
    async onMount(container) {
        try {
            super.onMount(container);
            this.container = container;
            if (this.tokens.length === 0) {
                await this.loadDesignTokens();
            }
            
            this.updateTokensDisplay();
            this.attachEventListeners();
        } catch (error) {
            console.error('[DesignTokensPanel] Mounting failed:', error);
        }
    }

    attachEventListeners() {
        if (!this.container) return;
        
        const filtersContainer = this.container.querySelector('#token-category-filters');
        if (filtersContainer) {
            filtersContainer.addEventListener('click', (e) => {
                const button = e.target.closest('.category-filter');
                if (button) {
                    this.currentFilter = button.dataset.category;
                    this.updateTokensDisplay();
                }
            });
        }
    }

    async loadDesignTokens() {
        const tokenFiles = [
            '/client/styles/design-tokens-colors.css',
            '/client/styles/design-tokens-typography.css',
            '/client/styles/design-tokens-spacing.css',
            '/client/styles/design-tokens-z-index.css'
        ];

        this.tokens = [];
        for (const file of tokenFiles) {
            try {
                const response = await fetch(`${file}?v=${Date.now()}`);
                if (response.ok) {
                    const cssText = await response.text();
                    this.tokens.push(...this.parseTokensFromCSS(cssText));
                }
            } catch (error) {
                console.warn(`Could not load ${file}:`, error);
            }
        }

        this.categories = new Set(this.tokens.map(t => t.category));
    }

    parseTokensFromCSS(cssText) {
        const tokens = [];
        const tokenRegex = /--([a-zA-Z0-9-_]+):\s*([^;]+);/g;
        let match;

        while ((match = tokenRegex.exec(cssText)) !== null) {
            const variable = `--${match[1]}`;
            const value = match[2].trim();
            tokens.push({
                variable, 
                value, 
                name: match[1],
                category: this.categorizeToken(variable),
                type: this.determineTokenType(value)
            });
        }

        return tokens;
    }

    categorizeToken(variable) {
        if (variable.startsWith('--color-')) return 'Colors';
        if (variable.startsWith('--font-')) return 'Typography';
        if (variable.startsWith('--spacing-')) return 'Spacing';
        if (variable.startsWith('--shadow-')) return 'Shadows';
        if (variable.startsWith('--z-index-')) return 'Z-Index';
        return 'Other';
    }

    determineTokenType(value) {
        if (value.startsWith('#') || value.startsWith('rgb')) return 'color';
        if (value.includes('rem') || value.includes('px')) return 'size';
        if (value.includes(',')) return 'composite';
        return 'text';
    }

    updateTokensDisplay() {
        if (!this.container) return;
        
        const container = this.container.querySelector('#design-tokens-container');
        const statsContainer = this.container.querySelector('#tokens-count');
        const filtersContainer = this.container.querySelector('#token-category-filters');

        this.filteredTokens = this.tokens.filter(token => 
            (this.currentFilter === 'all' || token.category === this.currentFilter) &&
            (this.searchQuery === '' || 
             token.variable.toLowerCase().includes(this.searchQuery) || 
             token.value.toLowerCase().includes(this.searchQuery))
        );

        if (statsContainer) {
            statsContainer.textContent = `${this.filteredTokens.length} Tokens`;
        }

        if (filtersContainer) {
            filtersContainer.innerHTML = this.renderCategoryFilters();
        }

        if (container) {
            const isColorGrid = this.currentFilter === 'Colors';
            const isNameValueGrid = ['Spacing', 'Other', 'Z-Index'].includes(this.currentFilter);
            
            container.classList.toggle('color-grid-view', isColorGrid);
            container.classList.toggle('grid-view', isNameValueGrid);
            container.classList.toggle('list-view', !isColorGrid && !isNameValueGrid);
            container.innerHTML = this.renderTokens();
        }
    }

    renderColorGrid() {
        return `
            <div class="color-grid">
                ${this.filteredTokens.map(token => `
                    <div 
                        class="color-swatch" 
                        style="background-color: ${token.value};" 
                        title="${token.variable}: ${token.value}"
                    ></div>
                `).join('')}
            </div>
        `;
    }

    renderTokenList() {
        return this.filteredTokens.map(token => `
            <div class="token-row ${token.type}">
                ${token.type === 'color' ? 
                    `<div class="color-preview" style="background-color: ${token.value};"></div>` : 
                    ''
                }
                <span class="token-variable">${token.variable}</span>
                <span class="token-value">${token.value}</span>
                <span class="token-category">${token.category}</span>
            </div>
        `).join('');
    }

    // Add a method to get debug info for panel registry
    getDebugInfo() {
        return {
            id: this.id,
            type: this.type,
            title: this.title,
            mounted: this.mounted
        };
    }
}

panelRegistry.registerType('design-tokens', DesignTokensPanel);

// Optional: Create a factory function for consistent panel creation
export function createDesignTokensPanel(config = {}) {
    return new DesignTokensPanel(config);
}

// Ensure the panel is available globally for debugging
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.panels = window.APP.panels || {};
    window.APP.panels.DesignTokensPanel = DesignTokensPanel;
}
