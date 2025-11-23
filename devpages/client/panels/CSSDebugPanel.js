/**
 * CSSDebugPanel.js - Comprehensive CSS debugging and analysis
 *
 * Features:
 * - Z-Index visualization with stacking context hierarchy
 * - CSS file tracking and stylesheet analysis
 * - DOM CSS knowledge (what the browser actually knows)
 * - Cascade analysis and specificity insights
 * - Real-time CSS rule inspection
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class CSSDebugPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'css-debug',
            title: 'CSS Debug',
            defaultWidth: 800,
            defaultHeight: 700,
            ...config
        });

        this.selectedElement = null;
        this.stylesheets = [];
        this.zIndexMap = new Map();
    }

    renderContent() {
        return `
            <div class="devpages-panel-content">
                <div class="devpages-panel-toolbar">
                    <div class="toolbar-left">
                        <button id="pick-element-btn" class="devpages-btn-ghost devpages-btn-primary">
                            Pick Element
                        </button>
                        <button id="analyze-all-btn" class="devpages-btn-ghost">
                            Analyze All Stylesheets
                        </button>
                    </div>
                    <div class="toolbar-right">
                        <button id="refresh-debug-btn" class="devpages-btn-icon" title="Refresh">↻</button>
                    </div>
                </div>

                <div class="devpages-panel-sections">
                    <!-- Selected Element Info -->
                    <div class="devpages-panel-row" data-section="element-info">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Selected Element</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="element-info-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- Z-Index Analysis -->
                    <div class="devpages-panel-row" data-section="zindex">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Z-Index & Stacking Context</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="zindex-content">
                            <div class="devpages-panel-placeholder">Select an element to analyze z-index</div>
                        </div>
                    </div>

                    <!-- CSS Files & Stylesheets -->
                    <div class="devpages-panel-row" data-section="stylesheets">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">CSS Files & Stylesheets</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="stylesheets-content">
                            <div class="devpages-panel-placeholder">Click "Analyze All Stylesheets" to load</div>
                        </div>
                    </div>

                    <!-- DOM CSS Knowledge -->
                    <div class="devpages-panel-row collapsed" data-section="dom-css">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">DOM CSS Knowledge</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="dom-css-content">
                            <div class="devpages-panel-placeholder">Select an element to view DOM CSS data</div>
                        </div>
                    </div>

                    <!-- CSS Variables (Custom Properties) -->
                    <div class="devpages-panel-row collapsed" data-section="css-vars">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">CSS Variables</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="css-vars-content">
                            <div class="devpages-panel-placeholder">Select an element to view CSS variables</div>
                        </div>
                    </div>

                    <!-- Cascade Analysis -->
                    <div class="devpages-panel-row collapsed" data-section="cascade">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Cascade & Specificity</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="cascade-content">
                            <div class="devpages-panel-placeholder">Select an element to analyze cascade</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount(container) {
        super.onMount();
        console.log('[CSSDebugPanel] onMount called with container:', container);
        console.log('[CSSDebugPanel] this.element:', this.element);

        // Store the container for sidebar panels (they don't use this.element)
        if (container && !this.element) {
            this.container = container;
            console.log('[CSSDebugPanel] Stored container:', this.container);
        }

        // Small delay to ensure DOM is ready
        setTimeout(() => {
            console.log('[CSSDebugPanel] Delayed initialization...');
            this.attachListeners();
            this.attachCollapseListeners();
        }, 100);
    }

    attachListeners() {
        const container = this.getContainer();
        console.log('[CSSDebugPanel] attachListeners - container:', container);

        if (!container) {
            console.error('[CSSDebugPanel] No container found in attachListeners');
            return;
        }

        // Pick element button
        const pickBtn = container.querySelector('#pick-element-btn');
        console.log('[CSSDebugPanel] Pick button found:', pickBtn);

        if (pickBtn) {
            pickBtn.addEventListener('click', (e) => {
                console.log('[CSSDebugPanel] Pick button clicked!', e);
                this.startPicking();
            });
            console.log('[CSSDebugPanel] Pick button listener attached');
        } else {
            console.error('[CSSDebugPanel] Pick button not found!');
        }

        // Analyze all stylesheets button
        const analyzeBtn = container.querySelector('#analyze-all-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                console.log('[CSSDebugPanel] Analyze button clicked');
                this.analyzeAllStylesheets();
            });
        }

        // Refresh button
        const refreshBtn = container.querySelector('#refresh-debug-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('[CSSDebugPanel] Refresh button clicked');
                this.refreshAnalysis();
            });
        }

        console.log('[CSSDebugPanel] All listeners attached');
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
        console.log('[CSSDebugPanel] startPicking called');
        console.log('[CSSDebugPanel] window.APP:', window.APP);
        console.log('[CSSDebugPanel] window.APP.utils:', window.APP?.utils);
        console.log('[CSSDebugPanel] elementPicker:', window.APP?.utils?.elementPicker);

        const picker = window.APP?.utils?.elementPicker;

        if (!picker) {
            console.error('[CSSDebugPanel] Element picker not available');
            console.error('[CSSDebugPanel] Available utils:', Object.keys(window.APP?.utils || {}));
            alert('Element picker not initialized. Please refresh the page.');
            return;
        }

        const container = this.getContainer();
        const pickBtn = container?.querySelector('#pick-element-btn');

        if (pickBtn) {
            pickBtn.textContent = 'Picking...';
            pickBtn.classList.add('active');
        }

        console.log('[CSSDebugPanel] Starting picker with onSelect callback');

        picker.start({
            onSelect: (element) => {
                console.log('[CSSDebugPanel] Element selected:', element);
                if (pickBtn) {
                    pickBtn.textContent = 'Pick Element';
                    pickBtn.classList.remove('active');
                }
                this.selectElement(element);
            },
            ignoreDevPanels: true
        });

        console.log('[CSSDebugPanel] Picker started, isActive:', picker.isActive());
    }

    selectElement(element) {
        console.log('[CSSDebugPanel] selectElement called with:', element);

        if (!element) {
            console.warn('[CSSDebugPanel] No element provided to selectElement');
            return;
        }

        this.selectedElement = element;
        console.log('[CSSDebugPanel] Set selectedElement to:', this.selectedElement);

        // Update all sections
        console.log('[CSSDebugPanel] Updating all sections...');
        this.displayElementInfo(element);
        this.displayZIndexAnalysis(element);
        this.displayDOMCSSKnowledge(element);
        this.displayCSSVariables(element);
        this.displayCascadeAnalysis(element);

        // Expand key sections
        console.log('[CSSDebugPanel] Expanding key sections...');
        this.expandSection('element-info');
        this.expandSection('zindex');

        console.log('[CSSDebugPanel] Element selection complete!');
    }

    displayElementInfo(element) {
        const content = this.getContainer()?.querySelector('#element-info-content');
        if (!content) return;

        const selector = this.getElementSelector(element);
        const computed = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        content.innerHTML = `
            <div class="css-debug-element-info">
                <div class="element-selector">${this.escapeHtml(selector)}</div>
                <table class="css-debug-table">
                    <tr>
                        <td>Tag</td>
                        <td><code>${element.tagName.toLowerCase()}</code></td>
                    </tr>
                    ${element.id ? `<tr><td>ID</td><td><code>#${element.id}</code></td></tr>` : ''}
                    ${element.className ? `<tr><td>Classes</td><td><code>${Array.from(element.classList).join(', ')}</code></td></tr>` : ''}
                    <tr>
                        <td>Position</td>
                        <td><code>${computed.position}</code></td>
                    </tr>
                    <tr>
                        <td>Display</td>
                        <td><code>${computed.display}</code></td>
                    </tr>
                    <tr>
                        <td>Size</td>
                        <td><code>${Math.round(rect.width)}×${Math.round(rect.height)}px</code></td>
                    </tr>
                </table>
            </div>
        `;
    }

    displayZIndexAnalysis(element) {
        const content = this.getContainer()?.querySelector('#zindex-content');
        if (!content) return;

        const analysis = this.analyzeZIndex(element);

        let html = `
            <div class="zindex-analysis">
                <div class="zindex-current">
                    <div class="zindex-value-display ${analysis.isAuto ? 'auto' : ''}">${analysis.zIndex}</div>
                    ${analysis.stackingContext ? `<div class="zindex-label">Creates Stacking Context: ${analysis.stackingReason}</div>` : ''}
                </div>
        `;

        // Z-Index hierarchy (parent chain)
        html += `<div class="zindex-hierarchy">
            <h4>Z-Index Hierarchy (Parent Chain)</h4>
            <div class="hierarchy-tree">
        `;

        let currentEl = element;
        let level = 0;
        const maxLevels = 10;

        while (currentEl && currentEl !== document.documentElement && level < maxLevels) {
            const computed = window.getComputedStyle(currentEl);
            const zIndex = computed.zIndex;
            const position = computed.position;
            const selector = this.getElementSelector(currentEl);
            const isStacking = this.createsStackingContext(currentEl);

            const indent = '  '.repeat(level);
            html += `
                <div class="hierarchy-item ${isStacking ? 'stacking' : ''}" style="margin-left: ${level * 20}px;">
                    <span class="hierarchy-selector">${this.escapeHtml(selector)}</span>
                    <span class="hierarchy-zindex">${zIndex}</span>
                    <span class="hierarchy-position">${position}</span>
                    ${isStacking ? '<span class="hierarchy-badge">Stacking Context</span>' : ''}
                </div>
            `;

            currentEl = currentEl.parentElement;
            level++;
        }

        html += `
            </div>
        </div>`;

        // Siblings comparison
        if (element.parentElement) {
            const siblings = Array.from(element.parentElement.children);
            const siblingData = siblings.map(sibling => {
                const computed = window.getComputedStyle(sibling);
                return {
                    element: sibling,
                    zIndex: computed.zIndex,
                    position: computed.position,
                    selector: this.getElementSelector(sibling),
                    isCurrent: sibling === element
                };
            }).filter(s => s.position !== 'static' || s.zIndex !== 'auto');

            if (siblingData.length > 1) {
                html += `
                    <div class="zindex-siblings">
                        <h4>Siblings Z-Index Comparison</h4>
                        <table class="css-debug-table">
                            <thead>
                                <tr>
                                    <th>Element</th>
                                    <th>Z-Index</th>
                                    <th>Position</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                siblingData.forEach(s => {
                    html += `
                        <tr class="${s.isCurrent ? 'current-element' : ''}">
                            <td><code>${this.escapeHtml(s.selector)}</code></td>
                            <td><code>${s.zIndex}</code></td>
                            <td><code>${s.position}</code></td>
                        </tr>
                    `;
                });

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }

        html += `</div>`;
        content.innerHTML = html;
    }

    analyzeZIndex(element) {
        const computed = window.getComputedStyle(element);
        const zIndex = computed.zIndex;
        const position = computed.position;
        const opacity = computed.opacity;
        const transform = computed.transform;
        const filter = computed.filter;
        const willChange = computed.willChange;

        const isAuto = zIndex === 'auto';
        const stackingContext = this.createsStackingContext(element);

        let stackingReason = '';
        if (stackingContext) {
            if (position !== 'static' && !isAuto) {
                stackingReason = `Positioned element (${position}) with z-index: ${zIndex}`;
            } else if (opacity !== '1') {
                stackingReason = `Opacity less than 1 (${opacity})`;
            } else if (transform !== 'none') {
                stackingReason = 'Transform applied';
            } else if (filter !== 'none') {
                stackingReason = 'Filter applied';
            } else if (willChange !== 'auto') {
                stackingReason = `will-change: ${willChange}`;
            } else {
                stackingReason = 'Other CSS property creates stacking context';
            }
        }

        return {
            zIndex: isAuto ? 'auto' : zIndex,
            isAuto,
            position,
            stackingContext,
            stackingReason
        };
    }

    createsStackingContext(element) {
        const computed = window.getComputedStyle(element);

        // Check all conditions that create a stacking context
        return (
            // Root element
            element === document.documentElement ||
            // Position + z-index
            (computed.position !== 'static' && computed.zIndex !== 'auto') ||
            // Position fixed/sticky
            computed.position === 'fixed' ||
            computed.position === 'sticky' ||
            // Opacity
            parseFloat(computed.opacity) < 1 ||
            // Transform
            computed.transform !== 'none' ||
            // Filter
            computed.filter !== 'none' ||
            // Will-change
            computed.willChange === 'transform' ||
            computed.willChange === 'opacity' ||
            // Flex/grid with z-index
            ((computed.display === 'flex' || computed.display === 'inline-flex' ||
              computed.display === 'grid' || computed.display === 'inline-grid') &&
             computed.zIndex !== 'auto') ||
            // Isolation
            computed.isolation === 'isolate' ||
            // Mix-blend-mode
            computed.mixBlendMode !== 'normal' ||
            // Contain
            computed.contain === 'layout' ||
            computed.contain === 'paint' ||
            computed.contain.includes('layout') ||
            computed.contain.includes('paint')
        );
    }

    displayDOMCSSKnowledge(element) {
        const content = this.getContainer()?.querySelector('#dom-css-content');
        if (!content) return;

        const computed = window.getComputedStyle(element);
        const inline = element.style;

        let html = `<div class="dom-css-knowledge">`;

        // Inline styles
        html += `<div class="css-knowledge-section">
            <h4>Inline Styles (element.style)</h4>
        `;

        if (inline.length > 0) {
            html += `<table class="css-debug-table">`;
            for (let i = 0; i < inline.length; i++) {
                const prop = inline[i];
                const value = inline.getPropertyValue(prop);
                const priority = inline.getPropertyPriority(prop);
                html += `
                    <tr>
                        <td><code>${prop}</code></td>
                        <td><code>${this.escapeHtml(value)}</code></td>
                        ${priority ? `<td><span class="priority-badge">!important</span></td>` : '<td></td>'}
                    </tr>
                `;
            }
            html += `</table>`;
        } else {
            html += `<p class="css-debug-muted">No inline styles</p>`;
        }

        html += `</div>`;

        // Class list
        html += `<div class="css-knowledge-section">
            <h4>Class List (element.classList)</h4>
        `;

        if (element.classList.length > 0) {
            html += `<div class="class-list">`;
            element.classList.forEach(cls => {
                html += `<span class="class-badge">${this.escapeHtml(cls)}</span>`;
            });
            html += `</div>`;
        } else {
            html += `<p class="css-debug-muted">No classes</p>`;
        }

        html += `</div>`;

        // Dataset attributes
        const dataset = element.dataset;
        const dataAttrs = Object.keys(dataset);

        if (dataAttrs.length > 0) {
            html += `<div class="css-knowledge-section">
                <h4>Data Attributes (element.dataset)</h4>
                <table class="css-debug-table">
            `;
            dataAttrs.forEach(key => {
                html += `
                    <tr>
                        <td><code>data-${key}</code></td>
                        <td><code>${this.escapeHtml(dataset[key])}</code></td>
                    </tr>
                `;
            });
            html += `</table></div>`;
        }

        html += `</div>`;
        content.innerHTML = html;
    }

    displayCSSVariables(element) {
        const content = this.getContainer()?.querySelector('#css-vars-content');
        if (!content) return;

        const computed = window.getComputedStyle(element);
        const variables = [];

        // Get all CSS custom properties
        for (let i = 0; i < computed.length; i++) {
            const prop = computed[i];
            if (prop.startsWith('--')) {
                const value = computed.getPropertyValue(prop).trim();
                variables.push({ prop, value });
            }
        }

        if (variables.length === 0) {
            content.innerHTML = '<div class="devpages-panel-placeholder">No CSS variables on this element</div>';
            return;
        }

        // Group variables by prefix
        const grouped = this.groupVariablesByPrefix(variables);

        let html = `<div class="css-variables">`;

        Object.entries(grouped).forEach(([prefix, vars]) => {
            html += `
                <div class="css-var-group">
                    <h4>${prefix || 'Other'}</h4>
                    <table class="css-debug-table">
            `;
            vars.forEach(({ prop, value }) => {
                const isColor = this.isColorValue(value);
                html += `
                    <tr>
                        <td><code>${this.escapeHtml(prop)}</code></td>
                        <td>
                            ${isColor ? `<span class="color-swatch" style="background: ${value}"></span>` : ''}
                            <code>${this.escapeHtml(value)}</code>
                        </td>
                    </tr>
                `;
            });
            html += `</table></div>`;
        });

        html += `</div>`;
        content.innerHTML = html;
    }

    groupVariablesByPrefix(variables) {
        const groups = {};

        variables.forEach(({ prop, value }) => {
            // Extract prefix (e.g., --color-, --font-, etc.)
            const match = prop.match(/^--([\w-]+?)-/);
            const prefix = match ? `--${match[1]}-*` : 'Other';

            if (!groups[prefix]) {
                groups[prefix] = [];
            }
            groups[prefix].push({ prop, value });
        });

        return groups;
    }

    displayCascadeAnalysis(element) {
        const content = this.getContainer()?.querySelector('#cascade-content');
        if (!content) return;

        const rules = this.getMatchingCSSRules(element);

        if (rules.length === 0) {
            content.innerHTML = '<div class="devpages-panel-placeholder">No matching CSS rules found</div>';
            return;
        }

        let html = `<div class="cascade-analysis">
            <p class="cascade-summary">Found ${rules.length} matching CSS rules</p>
        `;

        rules.forEach(rule => {
            const specificity = this.calculateSpecificity(rule.selectorText);
            html += `
                <div class="cascade-rule">
                    <div class="cascade-rule-header">
                        <span class="cascade-selector">${this.escapeHtml(rule.selectorText)}</span>
                        <span class="cascade-specificity" title="Specificity">${specificity.display}</span>
                    </div>
                    <div class="cascade-source">${this.escapeHtml(rule.source)}</div>
                    <div class="cascade-properties">
            `;

            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
                const prop = style[i];
                const value = style.getPropertyValue(prop);
                const priority = style.getPropertyPriority(prop);

                html += `
                    <div class="cascade-property">
                        <span class="cascade-prop-name">${prop}</span>:
                        <span class="cascade-prop-value">${this.escapeHtml(value)}</span>${priority ? ' <span class="important-badge">!important</span>' : ''};
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        content.innerHTML = html;
    }

    calculateSpecificity(selector) {
        // Simple specificity calculation (ID, class, element)
        const ids = (selector.match(/#/g) || []).length;
        const classes = (selector.match(/\./g) || []).length + (selector.match(/\[/g) || []).length;
        const elements = (selector.match(/(?:^|[\s>+~])(?!#|\.)[\w-]+/g) || []).length;

        return {
            ids,
            classes,
            elements,
            display: `(${ids},${classes},${elements})`
        };
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
                        try {
                            if (element.matches(rule.selectorText)) {
                                rules.push({
                                    ...rule,
                                    source: this.getStylesheetSource(sheet),
                                    selectorText: rule.selectorText,
                                    style: rule.style
                                });
                            }
                        } catch (e) {
                            // Invalid selector
                        }
                    }
                }
            } catch (e) {
                // CORS or access issues
                console.warn('[CSSDebugPanel] Cannot access stylesheet:', sheet.href, e);
            }
        }

        return rules;
    }

    analyzeAllStylesheets() {
        const content = this.getContainer()?.querySelector('#stylesheets-content');
        if (!content) return;

        const sheets = document.styleSheets;
        this.stylesheets = [];

        let html = `<div class="stylesheet-analysis">
            <p class="stylesheet-summary">Found ${sheets.length} stylesheets</p>
        `;

        for (let i = 0; i < sheets.length; i++) {
            const sheet = sheets[i];
            const source = this.getStylesheetSource(sheet);

            let ruleCount = 0;
            let accessible = true;

            try {
                const cssRules = sheet.cssRules || sheet.rules;
                ruleCount = cssRules ? cssRules.length : 0;
            } catch (e) {
                accessible = false;
            }

            this.stylesheets.push({
                index: i,
                source,
                ruleCount,
                accessible,
                sheet
            });

            html += `
                <div class="stylesheet-item ${!accessible ? 'cors-blocked' : ''}">
                    <span class="stylesheet-index">#${i}</span>
                    <span class="stylesheet-source">${this.escapeHtml(source)}</span>
                    <span class="stylesheet-rules">${ruleCount} rules</span>
                    ${!accessible ? '<span class="cors-badge">CORS</span>' : ''}
                    ${sheet.disabled ? '<span class="disabled-badge">Disabled</span>' : ''}
                    ${sheet.media.length > 0 ? `<span class="media-badge">${sheet.media.mediaText}</span>` : ''}
                </div>
            `;
        }

        html += `</div>`;
        content.innerHTML = html;

        // Expand the section
        this.expandSection('stylesheets');
    }

    getStylesheetSource(sheet) {
        if (sheet.href) {
            // External stylesheet
            try {
                const url = new URL(sheet.href);
                return url.pathname.split('/').pop() || sheet.href;
            } catch (e) {
                return sheet.href;
            }
        } else if (sheet.ownerNode) {
            // Inline <style> tag
            if (sheet.ownerNode.id) {
                return `<style id="${sheet.ownerNode.id}">`;
            }
            const location = sheet.ownerNode.getAttribute('data-source') || 'inline';
            return `<style> (${location})`;
        } else {
            return 'Unknown source';
        }
    }

    getElementSelector(element) {
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className ? `.${Array.from(element.classList).join('.')}` : '';
        return `${tag}${id}${classes}`;
    }

    isColorValue(value) {
        return /^(#|rgb|hsl|color\()/i.test(value);
    }

    refreshAnalysis() {
        if (this.selectedElement) {
            this.selectElement(this.selectedElement);
        }
        this.analyzeAllStylesheets();
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
        return this.element?.querySelector('.panel-body') || this.element || this.container;
    }

    onDestroy() {
        const picker = window.APP?.utils?.elementPicker;
        if (picker?.isActive()) {
            picker.stop();
        }
        super.onDestroy();
    }
}

// Register panel
panelRegistry.registerType('css-debug', CSSDebugPanel);

export default CSSDebugPanel;
