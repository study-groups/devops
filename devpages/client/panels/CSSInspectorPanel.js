/**
 * CSSInspectorPanel.js - Focused CSS inspection and analysis
 *
 * Features:
 * - Computed styles with filter/search
 * - CSS rules and specificity
 * - Style sources (inline, stylesheet, inherited)
 * - CSS variables and custom properties
 * - Box model visualization
 * - Layout information (flexbox, grid)
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class CSSInspectorPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'css-inspector',
            title: 'CSS Inspector',
            defaultWidth: 700,
            defaultHeight: 600,
            ...config
        });

        this.selectedElement = null;
        this.styleFilter = '';
        this.showInherited = false;
        this.showDefaults = false;
        this.picker = null;
    }

    renderContent() {
        return `
            <div class="devpages-panel-content">
                <div class="devpages-panel-toolbar">
                    <div class="toolbar-left">
                        <button id="pick-element-btn" class="devpages-btn-ghost devpages-btn-primary">
                            <span>Pick Element</span>
                        </button>
                        <button id="clear-btn" class="devpages-btn-ghost" disabled>
                            <span>Clear</span>
                        </button>
                    </div>
                    <div class="toolbar-right">
                        <button id="refresh-btn" class="devpages-btn-icon" title="Refresh">
                            <span>↻</span>
                        </button>
                    </div>
                </div>

                <div class="css-inspector-filters">
                    <input
                        type="text"
                        id="style-filter"
                        placeholder="Filter styles..."
                        class="style-filter-input"
                    />
                    <label class="filter-checkbox">
                        <input type="checkbox" id="show-inherited" />
                        <span>Show Inherited</span>
                    </label>
                    <label class="filter-checkbox">
                        <input type="checkbox" id="show-defaults" />
                        <span>Show Browser Defaults</span>
                    </label>
                </div>

                <div class="devpages-panel-sections">
                    <!-- Element Summary -->
                    <div class="devpages-panel-row" data-section="element-summary">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Element</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="element-summary-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- Box Model -->
                    <div class="devpages-panel-row" data-section="box-model">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Box Model</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="box-model-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- Layout Info -->
                    <div class="devpages-panel-row" data-section="layout">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Layout</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="layout-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- Computed Styles -->
                    <div class="devpages-panel-row" data-section="computed">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Computed Styles</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="computed-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- CSS Rules -->
                    <div class="devpages-panel-row collapsed" data-section="rules">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">CSS Rules</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="rules-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- CSS Variables -->
                    <div class="devpages-panel-row collapsed" data-section="variables">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">CSS Variables</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="variables-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);
        this.initializeUtilities();
        this.attachListeners();
        this.attachCollapseListeners();
    }

    initializeUtilities() {
        this.picker = window.APP?.utils?.elementPicker;

        if (!this.picker) {
            console.warn('[CSSInspectorPanel] Element picker not available yet');
            // Retry after delay
            setTimeout(() => this.initializeUtilities(), 500);
        }
    }

    attachListeners() {
        const container = this.getContainer();
        if (!container) {
            console.warn('[CSSInspectorPanel] No container found for attachListeners');
            return;
        }

        // Buttons
        const pickBtn = container.querySelector('#pick-element-btn');
        console.log('[CSSInspectorPanel] Pick button found:', pickBtn);
        pickBtn?.addEventListener('click', () => {
            console.log('[CSSInspectorPanel] Pick button clicked');
            this.startPicking();
        });
        container.querySelector('#clear-btn')?.addEventListener('click', () => this.clearSelection());
        container.querySelector('#refresh-btn')?.addEventListener('click', () => this.refreshSelection());

        // Filters
        container.querySelector('#style-filter')?.addEventListener('input', (e) => {
            this.styleFilter = e.target.value.toLowerCase();
            this.updateComputedStyles();
        });

        container.querySelector('#show-inherited')?.addEventListener('change', (e) => {
            this.showInherited = e.target.checked;
            this.updateComputedStyles();
        });

        container.querySelector('#show-defaults')?.addEventListener('change', (e) => {
            this.showDefaults = e.target.checked;
            this.updateComputedStyles();
        });
    }

    attachCollapseListeners() {
        const container = this.getContainer();
        if (!container) return;

        container.addEventListener('click', (e) => {
            const header = e.target.closest('.devpages-panel-row-header');
            if (header) {
                const row = header.closest('.devpages-panel-row');
                const caret = header.querySelector('.devpages-panel-row-caret');

                row.classList.toggle('collapsed');
                if (caret) {
                    caret.textContent = row.classList.contains('collapsed') ? '›' : '⌄';
                }
            }
        });
    }

    startPicking() {
        console.log('[CSSInspectorPanel] startPicking called, picker:', this.picker);
        console.log('[CSSInspectorPanel] window.APP:', window.APP);
        console.log('[CSSInspectorPanel] window.APP.utils:', window.APP?.utils);
        console.log('[CSSInspectorPanel] elementPicker:', window.APP?.utils?.elementPicker);

        if (!this.picker) {
            console.error('[CSSInspectorPanel] Element picker not available');
            // Retry initialization
            this.initializeUtilities();

            // Try again after a brief delay
            setTimeout(() => {
                if (this.picker) {
                    console.log('[CSSInspectorPanel] Picker now available after retry');
                    this._startPickingImpl();
                } else {
                    console.error('[CSSInspectorPanel] Picker still not available');
                    alert('Element picker is not yet initialized. Please try again.');
                }
            }, 100);
            return;
        }

        this._startPickingImpl();
    }

    _startPickingImpl() {
        console.log('[CSSInspectorPanel] Starting element picker...');

        // Update button state
        const container = this.getContainer();
        const pickBtn = container?.querySelector('#pick-element-btn');
        if (pickBtn) {
            pickBtn.textContent = 'Picking...';
            pickBtn.classList.add('active');
        }

        this.picker.start({
            onSelect: (element) => {
                // Reset button state
                if (pickBtn) {
                    pickBtn.textContent = 'Pick Element';
                    pickBtn.classList.remove('active');
                }
                this.selectElement(element);
            },
            ignoreDevPanels: true
        });
    }

    selectElement(element) {
        if (!element) return;

        this.selectedElement = element;

        // Enable clear button
        const clearBtn = this.getContainer()?.querySelector('#clear-btn');
        if (clearBtn) clearBtn.removeAttribute('disabled');

        // Update all sections
        this.displayElementSummary(element);
        this.displayBoxModel(element);
        this.displayLayout(element);
        this.displayComputedStyles(element);
        this.displayCSSRules(element);
        this.displayCSSVariables(element);

        // Expand key sections
        this.expandSection('element-summary');
        this.expandSection('box-model');
        this.expandSection('computed');
    }

    displayElementSummary(element) {
        const content = this.getContainer()?.querySelector('#element-summary-content');
        if (!content) return;

        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
        const selector = `${tag}${id}${classes}`;

        content.innerHTML = `
            <div class="element-summary">
                <div class="selector-display">${this.escapeHtml(selector)}</div>
                <table class="inspector-table compact">
                    <tr>
                        <td>Tag</td>
                        <td><code>${tag}</code></td>
                    </tr>
                    ${id ? `<tr><td>ID</td><td><code>${id}</code></td></tr>` : ''}
                    ${classes ? `<tr><td>Classes</td><td><code>${classes}</code></td></tr>` : ''}
                </table>
            </div>
        `;
    }

    displayBoxModel(element) {
        const content = this.getContainer()?.querySelector('#box-model-content');
        if (!content) return;

        const computed = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        const margin = {
            top: parseFloat(computed.marginTop) || 0,
            right: parseFloat(computed.marginRight) || 0,
            bottom: parseFloat(computed.marginBottom) || 0,
            left: parseFloat(computed.marginLeft) || 0
        };

        const border = {
            top: parseFloat(computed.borderTopWidth) || 0,
            right: parseFloat(computed.borderRightWidth) || 0,
            bottom: parseFloat(computed.borderBottomWidth) || 0,
            left: parseFloat(computed.borderLeftWidth) || 0
        };

        const padding = {
            top: parseFloat(computed.paddingTop) || 0,
            right: parseFloat(computed.paddingRight) || 0,
            bottom: parseFloat(computed.paddingBottom) || 0,
            left: parseFloat(computed.paddingLeft) || 0
        };

        const contentWidth = rect.width - border.left - border.right - padding.left - padding.right;
        const contentHeight = rect.height - border.top - border.bottom - padding.top - padding.bottom;

        content.innerHTML = `
            <div class="box-model-compact">
                <div class="box-layer margin-layer">
                    <span class="layer-label">margin</span>
                    <span class="layer-values">${Math.round(margin.top)} ${Math.round(margin.right)} ${Math.round(margin.bottom)} ${Math.round(margin.left)}</span>
                </div>
                <div class="box-layer border-layer">
                    <span class="layer-label">border</span>
                    <span class="layer-values">${Math.round(border.top)} ${Math.round(border.right)} ${Math.round(border.bottom)} ${Math.round(border.left)}</span>
                </div>
                <div class="box-layer padding-layer">
                    <span class="layer-label">padding</span>
                    <span class="layer-values">${Math.round(padding.top)} ${Math.round(padding.right)} ${Math.round(padding.bottom)} ${Math.round(padding.left)}</span>
                </div>
                <div class="box-layer content-layer">
                    <span class="layer-label">content</span>
                    <span class="layer-values">${Math.round(contentWidth)} × ${Math.round(contentHeight)}</span>
                </div>
            </div>
        `;
    }

    displayLayout(element) {
        const content = this.getContainer()?.querySelector('#layout-content');
        if (!content) return;

        const computed = window.getComputedStyle(element);
        const display = computed.display;
        const position = computed.position;
        const float = computed.float;
        const overflow = computed.overflow;

        const isFlexContainer = display.includes('flex');
        const isGridContainer = display.includes('grid');

        let layoutInfo = `
            <table class="inspector-table compact">
                <tr><td>Display</td><td><code>${display}</code></td></tr>
                <tr><td>Position</td><td><code>${position}</code></td></tr>
                ${float !== 'none' ? `<tr><td>Float</td><td><code>${float}</code></td></tr>` : ''}
                ${overflow !== 'visible' ? `<tr><td>Overflow</td><td><code>${overflow}</code></td></tr>` : ''}
        `;

        if (isFlexContainer) {
            layoutInfo += `
                <tr><td colspan="2" class="section-header">Flexbox</td></tr>
                <tr><td>Direction</td><td><code>${computed.flexDirection}</code></td></tr>
                <tr><td>Wrap</td><td><code>${computed.flexWrap}</code></td></tr>
                <tr><td>Justify</td><td><code>${computed.justifyContent}</code></td></tr>
                <tr><td>Align Items</td><td><code>${computed.alignItems}</code></td></tr>
            `;
        }

        if (isGridContainer) {
            layoutInfo += `
                <tr><td colspan="2" class="section-header">Grid</td></tr>
                <tr><td>Template Columns</td><td><code class="truncate">${computed.gridTemplateColumns}</code></td></tr>
                <tr><td>Template Rows</td><td><code class="truncate">${computed.gridTemplateRows}</code></td></tr>
                <tr><td>Gap</td><td><code>${computed.gap}</code></td></tr>
            `;
        }

        layoutInfo += `</table>`;
        content.innerHTML = layoutInfo;
    }

    displayComputedStyles(element) {
        const content = this.getContainer()?.querySelector('#computed-content');
        if (!content) return;

        const computed = window.getComputedStyle(element);
        const styles = [];

        // Get all computed styles
        for (let i = 0; i < computed.length; i++) {
            const prop = computed[i];
            const value = computed.getPropertyValue(prop);

            // Filter
            if (this.styleFilter && !prop.includes(this.styleFilter) && !value.includes(this.styleFilter)) {
                continue;
            }

            // Skip defaults if not showing
            if (!this.showDefaults && this.isDefaultValue(prop, value)) {
                continue;
            }

            styles.push({ prop, value });
        }

        if (styles.length === 0) {
            content.innerHTML = '<div class="devpages-panel-placeholder">No styles match filter</div>';
            return;
        }

        const html = `
            <div class="styles-count">${styles.length} properties</div>
            <table class="inspector-table compact styles-table">
                ${styles.map(({ prop, value }) => `
                    <tr>
                        <td class="style-prop">${this.escapeHtml(prop)}</td>
                        <td class="style-value">${this.renderStyleValue(value)}</td>
                    </tr>
                `).join('')}
            </table>
        `;

        content.innerHTML = html;
    }

    displayCSSRules(element) {
        const content = this.getContainer()?.querySelector('#rules-content');
        if (!content) return;

        const rules = this.getMatchingCSSRules(element);

        if (rules.length === 0) {
            content.innerHTML = '<div class="devpages-panel-placeholder">No CSS rules found</div>';
            return;
        }

        const html = rules.map(rule => `
            <div class="css-rule">
                <div class="rule-selector">${this.escapeHtml(rule.selectorText)}</div>
                <div class="rule-source">${rule.source}</div>
                <div class="rule-properties">
                    ${Array.from(rule.style).map(prop => `
                        <div class="rule-property">
                            <span class="prop-name">${prop}</span>:
                            <span class="prop-value">${rule.style.getPropertyValue(prop)}</span>;
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        content.innerHTML = html;
    }

    displayCSSVariables(element) {
        const content = this.getContainer()?.querySelector('#variables-content');
        if (!content) return;

        const computed = window.getComputedStyle(element);
        const variables = [];

        // Get all CSS custom properties
        for (let i = 0; i < computed.length; i++) {
            const prop = computed[i];
            if (prop.startsWith('--')) {
                const value = computed.getPropertyValue(prop);
                variables.push({ prop, value });
            }
        }

        if (variables.length === 0) {
            content.innerHTML = '<div class="devpages-panel-placeholder">No CSS variables on this element</div>';
            return;
        }

        const html = `
            <table class="inspector-table compact">
                ${variables.map(({ prop, value }) => `
                    <tr>
                        <td><code>${this.escapeHtml(prop)}</code></td>
                        <td>${this.renderStyleValue(value)}</td>
                    </tr>
                `).join('')}
            </table>
        `;

        content.innerHTML = html;
    }

    getMatchingCSSRules(element) {
        const rules = [];
        const sheets = document.styleSheets;

        for (const sheet of sheets) {
            try {
                const cssRules = sheet.cssRules || sheet.rules;
                if (!cssRules) continue;

                for (const rule of cssRules) {
                    if (rule.type === CSSRule.STYLE_RULE) {
                        if (element.matches(rule.selectorText)) {
                            rules.push({
                                ...rule,
                                source: sheet.href || 'inline'
                            });
                        }
                    }
                }
            } catch (e) {
                // CORS or other access issues
                console.warn('Cannot access stylesheet:', e);
            }
        }

        return rules;
    }

    renderStyleValue(value) {
        // Check if it's a color
        if (value.match(/^(#|rgb|hsl)/)) {
            return `<span class="color-swatch" style="background: ${value}"></span><code>${this.escapeHtml(value)}</code>`;
        }
        return `<code>${this.escapeHtml(value)}</code>`;
    }

    isDefaultValue(prop, value) {
        // Common default values to filter out
        const defaults = {
            'margin': '0px',
            'padding': '0px',
            'border-width': '0px',
            'background-color': 'rgba(0, 0, 0, 0)',
            'color': 'rgb(0, 0, 0)'
        };
        return defaults[prop] === value;
    }

    refreshSelection() {
        if (this.selectedElement) {
            this.selectElement(this.selectedElement);
        }
    }

    clearSelection() {
        this.selectedElement = null;

        const container = this.getContainer();
        if (!container) return;

        container.querySelector('#clear-btn')?.setAttribute('disabled', '');
        container.querySelector('#element-summary-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
        container.querySelector('#box-model-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
        container.querySelector('#layout-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
        container.querySelector('#computed-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
        container.querySelector('#rules-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
        container.querySelector('#variables-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
    }

    expandSection(sectionName) {
        const container = this.getContainer();
        const row = container?.querySelector(`[data-section="${sectionName}"]`);
        if (row) {
            row.classList.remove('collapsed');
            const caret = row.querySelector('.devpages-panel-row-caret');
            if (caret) caret.textContent = '⌄';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getContainer() {
        // Return the panel body (where our content is rendered)
        return this.element?.querySelector('.panel-body') || this.element || this.container;
    }

    onDestroy() {
        if (this.picker) {
            this.picker.stop();
        }
        super.onDestroy();
    }
}

// Register panel
panelRegistry.registerType('css-inspector', CSSInspectorPanel);

export default CSSInspectorPanel;
