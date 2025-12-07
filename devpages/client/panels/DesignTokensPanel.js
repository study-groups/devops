import { BasePanel, panelRegistry } from '/client/panels/BasePanel.js';
import { createIcon } from '/client/config/icon-system.js';
import { appStore } from '../appState.js';
import { uiActions } from '../store/uiSlice.js';
import { colorTokenService } from '../services/ColorTokenService.js';
import { ColorThemes } from '../styles/tokens/color-themes.js';

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
        this.colorView = 'grid'; // 'grid' or 'list' for color display
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.currentTheme = colorTokenService.getTheme();
        
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
                <div class="dt-toolbar">
                    <div class="dt-filter-group" id="token-category-filters">
                        ${this.renderCategoryFilters()}
                    </div>
                    ${this.currentFilter === 'Colors' ? `
                        <div class="dt-controls">
                            <button class="dt-view-toggle ${this.colorView === 'grid' ? 'active' : ''}"
                                    data-view="grid" id="view-toggle-grid">Grid</button>
                            <button class="dt-view-toggle ${this.colorView === 'list' ? 'active' : ''}"
                                    data-view="list" id="view-toggle-list">List</button>
                            <select class="dt-theme-select" id="theme-selector">
                                ${this.renderThemeOptions()}
                            </select>
                        </div>
                    ` : ''}
                </div>
                <div class="dt-content" id="design-tokens-container">
                    ${this.renderTokens()}
                </div>
                <div class="dt-stats">
                    <span id="tokens-count">${this.getTokenCountDisplay()}</span>
                </div>
            </div>
        `;
    }

    renderThemeOptions() {
        const themes = ColorThemes.getAllThemes();
        return themes.map(theme => `
            <option value="${theme.id}" ${theme.id === this.currentTheme ? 'selected' : ''}>
                ${theme.name} (${theme.temperature})
            </option>
        `).join('');
    }

    renderCategoryFilters() {
        const categories = [...Array.from(this.categories), 'all'];
        return categories.map(category => `
            <button class="dt-filter-btn ${category === this.currentFilter ? 'active' : ''}" 
                    data-category="${category}">
                ${category}
            </button>
        `).join('');
    }

    renderTokens() {
        if (this.currentFilter === 'Colors') {
            return this.renderColorMatrix();
        } else {
            return this.renderTokenList();
        }
    }

    renderTokenList() {
        if (this.currentFilter === 'Typography') {
            return this.renderTypographyGrid();
        } else if (this.currentFilter === 'Spacing') {
            return this.renderSpacingGrid();
        } else if (this.currentFilter === 'Z-Index') {
            return this.renderZIndexGrid();
        } else {
            return this.renderGenericTokenGrid();
        }
    }

    renderGenericTokenGrid() {
        return `
            <div class="token-grid-container">
                <div class="token-grid-header">
                    <div class="tg-cell header type">T</div>
                    <div class="tg-cell header name">Token</div>
                    <div class="tg-cell header value">Value</div>
                </div>
                ${this.filteredTokens.map(token => `
                    <div class="token-grid-row">
                        <div class="tg-cell type">
                            <span class="tg-type-badge ${token.type}">${token.type.charAt(0).toUpperCase()}</span>
                        </div>
                        <div class="tg-cell name">
                            <span class="tg-token-name">${token.name}</span>
                        </div>
                        <div class="tg-cell value">
                            <span class="tg-token-value">${token.value}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderTypographyGrid() {
        return `
            <div class="typography-grid">
                <div class="typo-grid-header">
                    <div class="tg-cell header name">Token</div>
                    <div class="tg-cell header size">Size</div>
                    <div class="tg-cell header weight">Wt</div>
                    <div class="tg-cell header lh">LH</div>
                    <div class="tg-cell header preview">Aa</div>
                </div>
                ${this.filteredTokens.map(token => {
                    const props = this.parseTypographyToken(token);
                    return `
                        <div class="typo-grid-row">
                            <div class="tg-cell name">
                                <span class="tg-token-name">${token.name}</span>
                            </div>
                            <div class="tg-cell size">
                                <span class="tg-size-value">${props.size || '—'}</span>
                            </div>
                            <div class="tg-cell weight">
                                <span class="tg-weight-value">${props.weight || '—'}</span>
                            </div>
                            <div class="tg-cell lh">
                                <span class="tg-lh-value">${props.lineHeight || '—'}</span>
                            </div>
                            <div class="tg-cell preview">
                                <div class="tg-typo-preview" style="${this.getTypographyStyle(props)}">Aa</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderSpacingGrid() {
        return `
            <div class="spacing-grid">
                <div class="spacing-grid-header">
                    <div class="tg-cell header name">Token</div>
                    <div class="tg-cell header value">Value</div>
                    <div class="tg-cell header visual">Visual</div>
                </div>
                ${this.filteredTokens.map(token => `
                    <div class="spacing-grid-row">
                        <div class="tg-cell name">
                            <span class="tg-token-name">${token.name}</span>
                        </div>
                        <div class="tg-cell value">
                            <span class="tg-spacing-value">${token.value}</span>
                        </div>
                        <div class="tg-cell visual">
                            <div class="tg-spacing-bar" style="width: ${this.getSpacingWidth(token.value)}"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderZIndexGrid() {
        // Sort z-index tokens by numeric value
        const sortedTokens = [...this.filteredTokens].sort((a, b) => {
            const valueA = parseInt(a.value) || 0;
            const valueB = parseInt(b.value) || 0;
            return valueA - valueB;
        });

        return `
            <div class="zindex-grid">
                <div class="zindex-grid-header">
                    <div class="tg-cell header level">Lvl</div>
                    <div class="tg-cell header name">Token</div>
                    <div class="tg-cell header value">Value</div>
                    <div class="tg-cell header stack">Stack</div>
                </div>
                ${sortedTokens.map((token, index) => `
                    <div class="zindex-grid-row">
                        <div class="tg-cell level">
                            <span class="tg-level-indicator">${index + 1}</span>
                        </div>
                        <div class="tg-cell name">
                            <span class="tg-token-name">${token.name}</span>
                        </div>
                        <div class="tg-cell value">
                            <span class="tg-zindex-value">${token.value}</span>
                        </div>
                        <div class="tg-cell stack">
                            <div class="tg-stack-visual" style="height: ${Math.min(20, (index + 1) * 2)}px"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getSpacingWidth(value) {
        // Convert spacing values to visual width (max 60px)
        const numValue = parseFloat(value);
        if (value.includes('rem')) {
            return Math.min(numValue * 16, 60) + 'px';
        } else if (value.includes('px')) {
            return Math.min(numValue, 60) + 'px';
        }
        return '20px';
    }

    parseTypographyToken(token) {
        const name = token.name.toLowerCase();
        const value = token.value;
        
        // Parse different typography token types
        if (name.includes('size')) {
            return { size: value, type: 'size' };
        } else if (name.includes('weight')) {
            return { weight: value, type: 'weight' };
        } else if (name.includes('family')) {
            return { family: value, type: 'family' };
        } else if (name.includes('line-height')) {
            return { lineHeight: value, type: 'lineHeight' };
        } else {
            // Try to parse composite values
            return this.parseCompositeTypography(value);
        }
    }

    parseCompositeTypography(value) {
        // For composite values like "16px/1.5 'Inter', sans-serif"
        const parts = value.split(' ');
        const result = {};
        
        parts.forEach(part => {
            if (part.includes('px') || part.includes('rem') || part.includes('em')) {
                result.size = part;
            } else if (!isNaN(part) && parseFloat(part) > 0 && parseFloat(part) < 10) {
                result.lineHeight = part;
            } else if (!isNaN(part) && parseInt(part) >= 100 && parseInt(part) <= 900) {
                result.weight = part;
            } else if (part.includes("'") || part.includes('"')) {
                result.family = part.replace(/['"]/g, '');
            }
        });
        
        return result;
    }

    getTypographyStyle(props) {
        const styles = [];
        if (props.size) styles.push(`font-size: ${props.size}`);
        if (props.weight) styles.push(`font-weight: ${props.weight}`);
        if (props.lineHeight) styles.push(`line-height: ${props.lineHeight}`);
        if (props.family) styles.push(`font-family: ${props.family}`);
        return styles.join('; ');
    }

    renderColorMatrix() {
        if (this.colorView === 'grid') {
            return this.renderColorGrid();
        } else {
            return this.renderColorList();
        }
    }

    renderColorGrid() {
        const clusterStructure = colorTokenService.getClusterStructure();

        // Clusters with 4 roles each
        const clusters = ['success', 'warning', 'error', 'info', 'code'];
        const roles = ['fg', 'bg', 'border', 'subtle'];

        // Flat lists
        const flatLists = ['surface', 'text'];

        const clusterInfo = {
            success: { name: 'SUCCESS', desc: 'Positive states', use: 'Success messages, completion, positive feedback' },
            warning: { name: 'WARNING', desc: 'Caution states', use: 'Warnings, pending actions, attention needed' },
            error: { name: 'ERROR', desc: 'Problem states', use: 'Errors, failures, destructive actions' },
            info: { name: 'INFO', desc: 'Information states', use: 'Info messages, helper text, guidance' },
            code: { name: 'CODE', desc: 'Technical content', use: 'Code syntax, technical elements, data' }
        };

        const roleInfo = {
            fg: { name: 'FG', desc: 'Foreground/text color' },
            bg: { name: 'BG', desc: 'Background/fill color' },
            border: { name: 'BORDER', desc: 'Border/outline color' },
            subtle: { name: 'SUBTLE', desc: 'Muted variant' }
        };

        return `
            <!-- TEXT: First -->
            <div class="color-section flat-grid-section">
                <div class="color-section-title">Text</div>
                <div class="flat-grid-expanded">
                    ${Object.entries(clusterStructure['text']?.colors || {}).map(([key, color]) => `
                        <div class="expanded-item" title="text.${key} = ${color}">
                            <div class="expanded-swatch" style="background: ${color};"></div>
                            <div class="expanded-label">${key}</div>
                            <div class="expanded-hex">${color}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- SURFACE: Second -->
            <div class="color-section flat-grid-section">
                <div class="color-section-title">Surface</div>
                <div class="flat-grid-expanded">
                    ${(() => {
                        const surfaceColors = clusterStructure['surface']?.colors || {};
                        const surfaceOrder = ['bg', 'bg-alt', 'bg-elevated', 'surface', 'border', 'divider'];

                        return surfaceOrder.map(key => {
                            const color = surfaceColors[key];
                            return `
                                <div class="expanded-item" title="surface.${key} = ${color}">
                                    <div class="expanded-swatch" style="background: ${color};"></div>
                                    <div class="expanded-label">${key}</div>
                                    <div class="expanded-hex">${color}</div>
                                </div>
                            `;
                        }).join('');
                    })()}
                    ${(() => {
                        const successBg = clusterStructure['success']?.colors?.bg;
                        const warningBg = clusterStructure['warning']?.colors?.bg;
                        const errorBg = clusterStructure['error']?.colors?.bg;
                        const infoBg = clusterStructure['info']?.colors?.bg;

                        return `
                            <div class="expanded-item" title="success.bg = ${successBg}">
                                <div class="expanded-swatch" style="background: ${successBg};"></div>
                                <div class="expanded-label">bg-success</div>
                                <div class="expanded-hex">${successBg}</div>
                            </div>
                            <div class="expanded-item" title="warning.bg = ${warningBg}">
                                <div class="expanded-swatch" style="background: ${warningBg};"></div>
                                <div class="expanded-label">bg-warning</div>
                                <div class="expanded-hex">${warningBg}</div>
                            </div>
                            <div class="expanded-item" title="error.bg = ${errorBg}">
                                <div class="expanded-swatch" style="background: ${errorBg};"></div>
                                <div class="expanded-label">bg-error</div>
                                <div class="expanded-hex">${errorBg}</div>
                            </div>
                            <div class="expanded-item" title="info.bg = ${infoBg}">
                                <div class="expanded-swatch" style="background: ${infoBg};"></div>
                                <div class="expanded-label">bg-info</div>
                                <div class="expanded-hex">${infoBg}</div>
                            </div>
                        `;
                    })()}
                </div>
            </div>

            <!-- OTHER: Third -->
            <div class="color-section flat-grid-section">
                <div class="color-section-title">Other</div>
                <div class="flat-grid-expanded">
                    ${(() => {
                        const surfaceColors = clusterStructure['surface']?.colors || {};
                        const codeColors = clusterStructure['code']?.colors || {};

                        return `
                            <div class="expanded-item" title="code.bg = ${codeColors.bg}">
                                <div class="expanded-swatch" style="background: ${codeColors.bg};"></div>
                                <div class="expanded-label">code-bg</div>
                                <div class="expanded-hex">${codeColors.bg}</div>
                            </div>
                            <div class="expanded-item" title="code.border = ${codeColors.border}">
                                <div class="expanded-swatch" style="background: ${codeColors.border};"></div>
                                <div class="expanded-label">code-border</div>
                                <div class="expanded-hex">${codeColors.border}</div>
                            </div>
                            <div class="expanded-item" title="surface.selection = ${surfaceColors.selection}">
                                <div class="expanded-swatch" style="background: ${surfaceColors.selection};"></div>
                                <div class="expanded-label">selection</div>
                                <div class="expanded-hex">${surfaceColors.selection}</div>
                            </div>
                            <div class="expanded-item" title="surface.highlight = ${surfaceColors.highlight}">
                                <div class="expanded-swatch" style="background: ${surfaceColors.highlight};"></div>
                                <div class="expanded-label">highlight</div>
                                <div class="expanded-hex">${surfaceColors.highlight}</div>
                            </div>
                        `;
                    })()}
                </div>
            </div>

            <!-- SEMANTIC: Last (5x4 grid) -->
            <div class="color-section clusters-section">
                <div class="color-section-title">Semantic</div>
                <div class="cluster-grid-container">
                    <div class="tds-color-grid cluster-grid">
                        <div class="grid-header">
                            <div class="grid-corner">Role</div>
                            ${roles.map(role => `
                                <div class="grid-col-header" title="${roleInfo[role].desc}">${roleInfo[role].name}</div>
                            `).join('')}
                        </div>
                        ${clusters.map(cluster => {
                            const colors = clusterStructure[cluster]?.colors || {};
                            return `
                                <div class="grid-row">
                                    <div class="grid-row-label">${clusterInfo[cluster].name}</div>
                                    ${roles.map(role => {
                                        const color = colors[role];
                                        return `
                                            <div class="grid-cell"
                                                 style="background: ${color};"
                                                 title="${cluster}.${role} = ${color}"
                                                 data-cluster="${cluster}"
                                                 data-role="${role}"
                                                 data-color="${color}">
                                                <span class="cell-label">${role}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderColorList() {
        const tokens = colorTokenService.getAllTokens();
        const grouped = this.groupTokens(tokens);

        const categoryDescriptions = {
            components: 'UI component color mappings (buttons, badges, panels)',
            status: 'Status indicator colors (success, warning, error, info)',
            inline: 'Inline element colors (text, links, code)',
            layout: 'Surface and layout colors (backgrounds, borders)',
            typography: 'Text hierarchy colors'
        };

        return `
            <div class="tds-explanation">
                <div class="tds-concept">
                    <strong>Semantic Tokens:</strong> High-level color names that map to cluster references.
                    Use these in your code for meaningful, theme-independent color choices.
                </div>
            </div>

            <div class="tds-color-list">
                ${Object.entries(grouped).map(([category, categoryTokens]) => `
                    <div class="token-category">
                        <div class="category-header">
                            ${category}
                            ${categoryDescriptions[category] ? `<span class="category-desc">${categoryDescriptions[category]}</span>` : ''}
                        </div>
                        <div class="category-tokens">
                            ${Object.entries(categoryTokens).map(([name, data]) => `
                                <div class="token-item">
                                    <div class="token-swatch" style="background: ${data.hexValue};"></div>
                                    <div class="token-info">
                                        <div class="token-name">${name}</div>
                                        <div class="token-ref">${data.clusterRef} → ${data.hexValue}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    groupTokens(tokens) {
        const grouped = {};

        for (const [tokenName, data] of Object.entries(tokens)) {
            const category = tokenName.split('.')[0];

            if (!grouped[category]) {
                grouped[category] = {};
            }

            grouped[category][tokenName] = data;
        }

        return grouped;
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
        const container = this.getContainer();
        if (!container) return;

        // Category filters
        const filtersContainer = container.querySelector('#token-category-filters');
        if (filtersContainer) {
            filtersContainer.addEventListener('click', (e) => {
                const button = e.target.closest('.dt-filter-btn');
                if (button) {
                    this.currentFilter = button.dataset.category;
                    this.updateTokensDisplay();
                }
            });
        }

        // View toggle buttons
        const viewToggles = container.querySelectorAll('.dt-view-toggle');
        viewToggles.forEach(button => {
            button.addEventListener('click', (e) => {
                this.colorView = e.target.dataset.view;
                this.updateTokensDisplay();
            });
        });

        // Theme selector
        const themeSelector = container.querySelector('#theme-selector');
        if (themeSelector) {
            themeSelector.addEventListener('change', (e) => {
                this.currentTheme = e.target.value;
                colorTokenService.setTheme(this.currentTheme);
                this.updateTokensDisplay();
            });
        }
    }

    async loadDesignTokens() {
        this.tokens = [];

        // Load semantic color tokens (32 colors)
        const colorTokens = colorTokenService.getAllTokens();
        for (const [name, data] of Object.entries(colorTokens)) {
            this.tokens.push({
                variable: `--color-${name.replace(/\./g, '-')}`,
                value: data.hexValue,
                name: name,
                category: 'Colors',
                type: 'color',
                clusterRef: data.clusterRef
            });
        }

        // Load typography tokens from theme (21 tokens)
        const theme = colorTokenService.getThemeMetadata();
        if (theme && theme.palettes) {
            // Typography is in constants/themes.js, need to load from there
            const { DEVPAGES_DARK } = await import('../constants/themes.js');
            const currentTheme = this.currentTheme === 'default' ? DEVPAGES_DARK : DEVPAGES_DARK;

            if (currentTheme.typography) {
                Object.entries(currentTheme.typography).forEach(([name, value]) => {
                    this.tokens.push({
                        variable: `--${name}`,
                        value: value,
                        name: name,
                        category: 'Typography',
                        type: this.getTypographyType(name)
                    });
                });
            }

            // Load spacing tokens from theme (12 tokens)
            if (currentTheme.spacing) {
                Object.entries(currentTheme.spacing).forEach(([name, value]) => {
                    this.tokens.push({
                        variable: `--space-${name}`,
                        value: value,
                        name: `space-${name}`,
                        category: 'Spacing',
                        type: 'spacing'
                    });
                });
            }
        }

        this.categories = new Set(this.tokens.map(t => t.category));
    }

    getTypographyType(name) {
        if (name.includes('font-') || name.includes('family')) return 'font-family';
        if (name.includes('size')) return 'font-size';
        if (name.includes('weight')) return 'font-weight';
        if (name.includes('leading') || name.includes('line')) return 'line-height';
        return 'typography';
    }

    getTokenCountDisplay() {
        // Count tokens by category
        const colorCount = this.tokens.filter(t => t.category === 'Colors').length;
        const typographyCount = this.tokens.filter(t => t.category === 'Typography').length;
        const spacingCount = this.tokens.filter(t => t.category === 'Spacing').length;
        const totalCount = colorCount + typographyCount + spacingCount;

        if (this.currentFilter === 'all') {
            return `${totalCount} tokens`;
        } else if (this.currentFilter === 'Colors') {
            return `${colorCount} colors`;
        } else if (this.currentFilter === 'Typography') {
            return `${typographyCount} tokens`;
        } else if (this.currentFilter === 'Spacing') {
            return `${spacingCount} tokens`;
        } else {
            return `${this.filteredTokens.length} tokens`;
        }
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
        const panelContainer = this.getContainer();
        if (!panelContainer) return;

        const container = panelContainer.querySelector('#design-tokens-container');
        const statsContainer = panelContainer.querySelector('#tokens-count');
        const filtersContainer = panelContainer.querySelector('#token-category-filters');

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

    /**
     * Get the container element where our content lives
     * STANDARD PATTERN - queries .panel-body first
     */
    getContainer() {
        return this.element?.querySelector('.panel-body') || this.element || this.container;
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
