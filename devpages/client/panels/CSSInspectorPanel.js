/**
 * CSSInspectorPanel.js - Comprehensive CSS debugging and analysis
 *
 * Features:
 * - Z-Index visualization with stacking context hierarchy
 * - CSS file tracking and stylesheet analysis
 * - DOM CSS knowledge (what the browser actually knows)
 * - Cascade analysis and specificity insights
 * - Real-time CSS rule inspection
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class CSSInspectorPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'css-inspector',
            title: 'CSS Inspector',
            defaultWidth: 800,
            defaultHeight: 700,
            ...config
        });

        this.selectedElement = null;
        this.stylesheets = [];
        this.zIndexMap = new Map();
        this.stylesheetsAnalyzed = false;
        this._listenersAttached = false;
        this.overlayActive = false;
        this.overlayElements = [];
        this.styleObserver = null;
        this.observedElements = new Set();
        this.jsInjectedStyles = [];
    }

    renderContent() {
        return `
            <div class="devpages-panel-content">
                <!-- Theme Export Toolbar -->
                <div style="padding: 12px; background: var(--color-bg-alt); border-bottom: 1px solid var(--color-border); display: flex; gap: 8px; align-items: center;">
                    <button id="copy-all-theme-btn" class="devpages-btn-ghost devpages-btn-primary" style="font-size: 12px;">
                        🎨 Copy All CSS for Theme
                    </button>
                    <span style="font-size: 11px; color: var(--color-text-secondary);">
                        Captures all CSS data for theme sharing
                    </span>
                </div>

                <div class="devpages-panel-sections">
                    <!-- Selected Element Info -->
                    <div class="devpages-panel-row" data-section="element-info">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Selected Element</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="element-info-content">
                            <div class="devpages-panel-placeholder" style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
                                <p style="margin: 0;">No element selected</p>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button id="pick-element-btn" class="devpages-btn-ghost devpages-btn-primary">
                                        Pick Element
                                    </button>
                                    <button id="toggle-overlay-btn" class="devpages-btn-ghost" style="font-size: 12px;">
                                        Visual Overlay
                                    </button>
                                    <button id="copy-report-btn" class="devpages-btn-ghost" style="font-size: 12px;">
                                        📋 Copy Report
                                    </button>
                                </div>
                                <div style="background: var(--color-bg-alt); padding: 8px 12px; border-radius: 4px; font-size: 11px; color: var(--color-text-secondary); line-height: 1.5;">
                                    <strong>Note:</strong> Visual Overlay only works when panel is <strong>docked in sidebar</strong>, not floating. This ensures the overlay appears in the correct position relative to the page content.
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Hardcoded Color Scanner -->
                    <div class="devpages-panel-row collapsed" data-section="hardcoded-colors">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Hardcoded Colors</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="hardcoded-colors-content">
                            <div class="devpages-panel-placeholder" style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
                                <p style="margin: 0;">Find colors not using CSS variables</p>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button id="scan-colors-btn" class="devpages-btn-ghost devpages-btn-primary">
                                        Scan Hardcoded Colors
                                    </button>
                                    <button id="copy-hardcoded-colors-btn" class="devpages-btn-ghost" style="font-size: 12px;">
                                        📋 Copy All
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Design Token Usage Scanner -->
                    <div class="devpages-panel-row collapsed" data-section="design-token-usage">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Design Token Usage</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="design-token-usage-content">
                            <div class="devpages-panel-placeholder" style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
                                <p style="margin: 0;">Track CSS variable usage across stylesheets</p>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button id="scan-tokens-btn" class="devpages-btn-ghost devpages-btn-primary">
                                        Scan Token Usage
                                    </button>
                                    <button id="copy-token-usage-btn" class="devpages-btn-ghost" style="font-size: 12px;">
                                        📋 Copy All
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- JS-Injected Styles Monitor -->
                    <div class="devpages-panel-row collapsed" data-section="js-styles">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">JS-Injected Styles</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="js-styles-content">
                            <div class="devpages-panel-placeholder" style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
                                <p style="margin: 0;">Track styles set via JavaScript</p>
                                <button id="toggle-monitor-btn" class="devpages-btn-ghost">
                                    Start Monitoring
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Z-Index Analysis -->
                    <div class="devpages-panel-row collapsed" data-section="zindex">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Z-Index & Stacking Context</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="zindex-content">
                            <div class="devpages-panel-placeholder">Select an element to analyze z-index</div>
                        </div>
                    </div>

                    <!-- CSS Files & Stylesheets -->
                    <div class="devpages-panel-row collapsed" data-section="stylesheets">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">CSS Files & Stylesheets</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="stylesheets-content">
                            <div class="devpages-panel-placeholder" style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
                                <p style="margin: 0;">Load and analyze all stylesheets</p>
                                <button id="analyze-all-btn" class="devpages-btn-ghost">
                                    Analyze All Stylesheets
                                </button>
                            </div>
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
        super.onMount(container);
        this.attachListeners();
        this.attachCollapseListeners();
    }

    attachListeners() {
        const container = this.getContainer();
        console.log('[CSSInspectorPanel] attachListeners - container:', container);

        if (!container) {
            console.error('[CSSInspectorPanel] No container found in attachListeners');
            return;
        }

        // Pick element button
        const pickBtn = container.querySelector('#pick-element-btn');
        console.log('[CSSInspectorPanel] Pick button found:', pickBtn);

        if (pickBtn) {
            pickBtn.addEventListener('click', (e) => {
                console.log('[CSSInspectorPanel] Pick button clicked!', e);
                this.setButtonState(pickBtn, 'loading', 'Picking...');
                this.startPicking();
            });
            console.log('[CSSInspectorPanel] Pick button listener attached');
        } else {
            console.error('[CSSInspectorPanel] Pick button not found!');
        }

        // Scan hardcoded colors button
        const scanColorsBtn = container.querySelector('#scan-colors-btn');
        console.log('[CSSInspectorPanel] Scan colors button found:', scanColorsBtn);
        if (scanColorsBtn) {
            scanColorsBtn.addEventListener('click', () => {
                console.log('[CSSInspectorPanel] Scan colors button clicked');
                this.setButtonState(scanColorsBtn, 'loading', 'Scanning...');
                setTimeout(() => {
                    this.scanHardcodedColors();
                    this.setButtonState(scanColorsBtn, 'ready');
                }, 10);
            });
            console.log('[CSSInspectorPanel] Scan colors button listener attached');
        } else {
            console.error('[CSSInspectorPanel] Scan colors button not found!');
        }

        // Toggle visual overlay button
        const toggleOverlayBtn = container.querySelector('#toggle-overlay-btn');
        if (toggleOverlayBtn) {
            toggleOverlayBtn.addEventListener('click', () => {
                console.log('[CSSInspectorPanel] Toggle overlay button clicked');
                this.setButtonState(toggleOverlayBtn, 'loading');
                setTimeout(() => {
                    this.toggleVisualOverlay();
                    this.setButtonState(toggleOverlayBtn, 'ready');
                }, 10);
            });
        }

        // Toggle JS style monitor button
        const toggleMonitorBtn = container.querySelector('#toggle-monitor-btn');
        if (toggleMonitorBtn) {
            toggleMonitorBtn.addEventListener('click', () => {
                console.log('[CSSInspectorPanel] Toggle monitor button clicked');
                this.setButtonState(toggleMonitorBtn, 'loading');
                setTimeout(() => {
                    this.toggleStyleMonitoring();
                    this.setButtonState(toggleMonitorBtn, 'ready');
                }, 10);
            });
        }

        // Analyze all stylesheets button
        const analyzeBtn = container.querySelector('#analyze-all-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                console.log('[CSSInspectorPanel] Analyze button clicked');
                this.setButtonState(analyzeBtn, 'loading', 'Analyzing...');
                setTimeout(() => {
                    this.analyzeAllStylesheets();
                    this.setButtonState(analyzeBtn, 'ready');
                }, 10);
            });
        }

        // Copy Report button (for current element)
        const copyReportBtn = container.querySelector('#copy-report-btn');
        if (copyReportBtn) {
            copyReportBtn.addEventListener('click', () => {
                console.log('[CSSInspectorPanel] Copy Report button clicked');
                this.setButtonState(copyReportBtn, 'loading', 'Copying...');
                setTimeout(() => {
                    this.copyElementReport();
                    this.setButtonState(copyReportBtn, 'ready');
                }, 10);
            });
        }

        // Copy All Theme button
        const copyAllThemeBtn = container.querySelector('#copy-all-theme-btn');
        if (copyAllThemeBtn) {
            copyAllThemeBtn.addEventListener('click', () => {
                console.log('[CSSInspectorPanel] Copy All Theme button clicked');
                this.setButtonState(copyAllThemeBtn, 'loading', 'Capturing...');
                setTimeout(() => {
                    this.copyAllThemeData();
                    this.setButtonState(copyAllThemeBtn, 'ready');
                }, 10);
            });
        }

        // Copy Hardcoded Colors button
        const copyHardcodedColorsBtn = container.querySelector('#copy-hardcoded-colors-btn');
        if (copyHardcodedColorsBtn) {
            copyHardcodedColorsBtn.addEventListener('click', () => {
                console.log('[CSSInspectorPanel] Copy Hardcoded Colors button clicked');
                this.setButtonState(copyHardcodedColorsBtn, 'loading', 'Copying...');
                setTimeout(() => {
                    this.copyHardcodedColorsReport();
                    this.setButtonState(copyHardcodedColorsBtn, 'ready');
                }, 10);
            });
        }

        // Scan Design Tokens button
        const scanTokensBtn = container.querySelector('#scan-tokens-btn');
        if (scanTokensBtn) {
            scanTokensBtn.addEventListener('click', () => {
                console.log('[CSSInspectorPanel] Scan tokens button clicked');
                this.setButtonState(scanTokensBtn, 'loading', 'Scanning...');
                setTimeout(() => {
                    this.scanDesignTokenUsage();
                    this.setButtonState(scanTokensBtn, 'ready');
                }, 10);
            });
        }

        // Copy Token Usage button
        const copyTokenUsageBtn = container.querySelector('#copy-token-usage-btn');
        if (copyTokenUsageBtn) {
            copyTokenUsageBtn.addEventListener('click', () => {
                console.log('[CSSInspectorPanel] Copy Token Usage button clicked');
                this.setButtonState(copyTokenUsageBtn, 'loading', 'Copying...');
                setTimeout(() => {
                    this.copyTokenUsageReport();
                    this.setButtonState(copyTokenUsageBtn, 'ready');
                }, 10);
            });
        }

        console.log('[CSSInspectorPanel] All listeners attached');
    }

    attachCollapseListeners() {
        const container = this.getContainer();
        console.log('[CSSInspectorPanel] attachCollapseListeners - container:', container);

        if (!container) {
            console.error('[CSSInspectorPanel] No container for collapse listeners');
            return;
        }

        // Store the handler so we can potentially remove it later
        this._collapseHandler = (e) => {
            console.log('[CSSInspectorPanel] Click detected:', e.target);
            const header = e.target.closest('.devpages-panel-row-header');
            console.log('[CSSInspectorPanel] Header found:', header);

            if (header) {
                // Prevent event from triggering multiple times
                e.preventDefault();
                e.stopImmediatePropagation();

                const row = header.closest('.devpages-panel-row');
                const caret = header.querySelector('.devpages-panel-row-caret');

                console.log('[CSSInspectorPanel] Toggling collapse on row:', row);
                row.classList.toggle('collapsed');
                if (caret) {
                    caret.textContent = row.classList.contains('collapsed') ? '›' : '⌄';
                }
                console.log('[CSSInspectorPanel] Row is now collapsed:', row.classList.contains('collapsed'));
            }
        };

        container.addEventListener('click', this._collapseHandler);
        console.log('[CSSInspectorPanel] Collapse listeners attached');
    }

    /**
     * Set visual feedback state for buttons
     * @param {HTMLElement} button - The button element
     * @param {string} state - 'loading' or 'ready'
     * @param {string} text - Optional text to display during loading
     */
    setButtonState(button, state, text) {
        if (!button) return;

        if (state === 'loading') {
            button.disabled = true;
            button.classList.add('loading');
            if (text) {
                button._originalText = button.textContent;
                button.textContent = text;
            }
            button.style.opacity = '0.6';
            button.style.cursor = 'wait';
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            if (button._originalText) {
                button.textContent = button._originalText;
                delete button._originalText;
            }
            button.style.opacity = '';
            button.style.cursor = '';
        }
    }

    startPicking() {
        console.log('[CSSInspectorPanel] startPicking called');
        console.log('[CSSInspectorPanel] window.APP:', window.APP);
        console.log('[CSSInspectorPanel] window.APP.utils:', window.APP?.utils);
        console.log('[CSSInspectorPanel] elementPicker:', window.APP?.utils?.elementPicker);

        const picker = window.APP?.utils?.elementPicker;

        if (!picker) {
            console.error('[CSSInspectorPanel] Element picker not available');
            console.error('[CSSInspectorPanel] Available utils:', Object.keys(window.APP?.utils || {}));
            alert('Element picker not initialized. Please refresh the page.');
            return;
        }

        const container = this.getContainer();
        const pickBtn = container?.querySelector('#pick-element-btn');

        console.log('[CSSInspectorPanel] Starting picker with onSelect callback');

        picker.start({
            onSelect: (element) => {
                console.log('[CSSInspectorPanel] Element selected:', element);
                this.setButtonState(pickBtn, 'ready');
                this.selectElement(element);
            },
            ignoreDevPanels: true
        });

        console.log('[CSSInspectorPanel] Picker started, isActive:', picker.isActive());
    }

    selectElement(element) {
        console.log('[CSSInspectorPanel] selectElement called with:', element);

        if (!element) {
            console.warn('[CSSInspectorPanel] No element provided to selectElement');
            return;
        }

        this.selectedElement = element;
        console.log('[CSSInspectorPanel] Set selectedElement to:', this.selectedElement);

        // Update all sections
        console.log('[CSSInspectorPanel] Updating all sections...');
        this.displayElementInfo(element);
        this.displayZIndexAnalysis(element);
        this.displayDOMCSSKnowledge(element);
        this.displayCSSVariables(element);
        this.displayCascadeAnalysis(element);

        // Auto-analyze stylesheets on first element selection
        if (!this.stylesheetsAnalyzed) {
            this.analyzeAllStylesheets();
            this.stylesheetsAnalyzed = true;
        }

        // Expand key sections (use setTimeout to ensure content is rendered)
        console.log('[CSSInspectorPanel] Expanding key sections...');
        setTimeout(() => {
            this.expandSection('element-info');
            this.expandSection('zindex');
            this.expandSection('dom-css');
            this.expandSection('css-vars');
            this.expandSection('stylesheets');
        }, 50);

        console.log('[CSSInspectorPanel] Element selection complete!');
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
                    <div class="css-var-list">
            `;
            vars.forEach(({ prop, value }) => {
                const isColor = this.isColorValue(value);

                // Format: name, value, color swatch at end
                html += `
                    <div class="css-var-line">
                        <span class="css-var-name">${this.escapeHtml(prop)}</span>
                        <span class="css-var-value">${this.escapeHtml(value)}</span>
                        ${isColor ? `<span class="color-swatch" style="background: ${value}"></span>` : '<span class="color-swatch-placeholder"></span>'}
                    </div>
                `;
            });
            html += `</div></div>`;
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

            <!-- Info section -->
            <div class="cascade-info-row collapsed">
                <div class="cascade-info-header">
                    <span class="cascade-info-title">Understanding Specificity</span>
                    <span class="cascade-info-caret">›</span>
                </div>
                <div class="cascade-info-content">
                    <p><strong>Specificity</strong> is shown as</p>
                    <div class="example-explanation"><code>(IDs, Classes/Attributes, Elements)</code></div>
                    <ul>
                        <li><strong>IDs</strong>: Selectors like
                            <div class="example-explanation"><code>#header</code></div>
                        </li>
                        <li><strong>Classes/Attributes</strong>: Selectors like
                            <div class="example-explanation"><code>.button</code>, <code>[type="text"]</code>, <code>:hover</code></div>
                        </li>
                        <li><strong>Elements</strong>: Selectors like
                            <div class="example-explanation"><code>div</code>, <code>span</code>, <code>::before</code></div>
                        </li>
                    </ul>
                    <p><strong>How it works:</strong> Higher numbers win, compared left to right.</p>
                    <p><strong>Examples:</strong></p>
                    <ul>
                        <li><code>(1,0,0)</code> beats <code>(0,99,99)</code> - ID wins over everything</li>
                        <li><code>(0,2,1)</code> beats <code>(0,1,5)</code> - More classes win</li>
                        <li><code>(0,1,0)</code> = one class like <code>.button</code></li>
                    </ul>
                    <p><code>!important</code> overrides all specificity (use sparingly!)</p>
                </div>
            </div>
        `;

        rules.forEach(rule => {
            const specificity = this.calculateSpecificity(rule.selectorText);
            const specificityTitle = `Specificity: ${specificity.display}\n(IDs, Classes/Attributes, Elements)\n\nIDs: ${specificity.ids}\nClasses/Attributes/Pseudo-classes: ${specificity.classes}\nElements/Pseudo-elements: ${specificity.elements}\n\nHigher numbers win (compared left to right)`;
            html += `
                <div class="cascade-rule">
                    <div class="cascade-rule-header">
                        <span class="cascade-selector">${this.escapeHtml(rule.selectorText)}</span>
                        <span class="cascade-specificity" title="${specificityTitle}">${specificity.display}</span>
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

        // Attach click handler for info section
        setTimeout(() => {
            const infoHeader = content.querySelector('.cascade-info-header');
            if (infoHeader) {
                infoHeader.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const infoRow = infoHeader.closest('.cascade-info-row');
                    const caret = infoHeader.querySelector('.cascade-info-caret');
                    infoRow.classList.toggle('collapsed');
                    if (caret) {
                        caret.textContent = infoRow.classList.contains('collapsed') ? '›' : '⌄';
                    }
                });
            }
        }, 0);
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
                console.warn('[CSSInspectorPanel] Cannot access stylesheet:', sheet.href, e);
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
            const node = sheet.ownerNode;

            if (node.id) {
                return `<style id="${node.id}">`;
            }

            // Check for data-source attribute (custom source identifier)
            const dataSource = node.getAttribute('data-source');
            if (dataSource) {
                return `<style> (${dataSource})`;
            }

            // Try to determine origin from parent or sibling elements
            let origin = 'inline';

            // Check if it's in <head> or <body>
            const inHead = node.closest('head');
            const inBody = node.closest('body');

            if (inHead) {
                origin = 'inline in <head>';
            } else if (inBody) {
                origin = 'inline in <body>';
            }

            // Check for nearby identifying elements or comments
            const prevSibling = node.previousSibling;
            if (prevSibling && prevSibling.nodeType === Node.COMMENT_NODE) {
                const comment = prevSibling.textContent.trim();
                if (comment.length < 50) {
                    origin = `inline (${comment})`;
                }
            }

            // Check parent element context
            const parent = node.parentElement;
            if (parent && parent.id) {
                origin = `inline in #${parent.id}`;
            }

            return `<style> (${origin})`;
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

    /**
     * Scan all stylesheets for hardcoded colors (not using CSS variables)
     * Now includes: stylesheets, inline styles, and computed styles
     */
    scanHardcodedColors() {
        console.log('[CSSInspectorPanel] scanHardcodedColors called');
        const container = this.getContainer();
        console.log('[CSSInspectorPanel] Container:', container);

        const content = container?.querySelector('#hardcoded-colors-content');
        console.log('[CSSInspectorPanel] Content element:', content);

        if (!content) {
            console.error('[CSSInspectorPanel] hardcoded-colors-content not found!');
            alert('Error: Could not find hardcoded-colors-content element. Check console for details.');
            return;
        }

        console.log('[CSSInspectorPanel] Starting comprehensive hardcoded color scan...');

        const colorProperties = [
            'color', 'background-color', 'background', 'border-color',
            'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
            'outline-color', 'text-decoration-color', 'box-shadow', 'text-shadow',
            'fill', 'stroke'
        ];

        const hardcodedColors = [];
        const inlineStyleColors = [];
        const sheets = document.styleSheets;

        for (let i = 0; i < sheets.length; i++) {
            const sheet = sheets[i];
            const source = this.getStylesheetSource(sheet);

            try {
                const cssRules = sheet.cssRules || sheet.rules;
                if (!cssRules) continue;

                for (let j = 0; j < cssRules.length; j++) {
                    const rule = cssRules[j];

                    // Skip non-style rules
                    if (!rule.style) continue;

                    const selector = rule.selectorText;

                    // Skip :root and other CSS variable definition selectors
                    // We only want to find hardcoded color USAGE, not token definitions
                    if (/^:root\b|^\[data-theme|^html\b|^\*\b/.test(selector)) {
                        continue;
                    }

                    for (const prop of colorProperties) {
                        const value = rule.style.getPropertyValue(prop);
                        if (!value) continue;

                        // Check if it's a hardcoded color (hex, rgb, rgba, hsl, named colors)
                        const isHex = /#[0-9a-fA-F]{3,8}/.test(value);
                        const isRgb = /rgba?\(/.test(value);
                        const isHsl = /hsla?\(/.test(value);
                        const usesVar = /var\(--/.test(value);

                        if ((isHex || isRgb || isHsl) && !usesVar) {
                            hardcodedColors.push({
                                stylesheet: source,
                                selector,
                                property: prop,
                                value,
                                type: isHex ? 'hex' : isRgb ? 'rgb' : 'hsl'
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn(`[CSSInspectorPanel] Cannot scan stylesheet: ${source}`, e);
            }
        }

        console.log(`[CSSInspectorPanel] Found ${hardcodedColors.length} hardcoded colors in stylesheets`);

        // Scan all elements for inline styles with hardcoded colors
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            const inlineStyle = element.style;
            if (inlineStyle.length > 0) {
                for (const prop of colorProperties) {
                    const value = inlineStyle.getPropertyValue(prop);
                    if (!value) continue;

                    const isHex = /#[0-9a-fA-F]{3,8}/.test(value);
                    const isRgb = /rgba?\(/.test(value);
                    const isHsl = /hsla?\(/.test(value);
                    const usesVar = /var\(--/.test(value);

                    if ((isHex || isRgb || isHsl) && !usesVar) {
                        inlineStyleColors.push({
                            element: this.getElementSelector(element),
                            property: prop,
                            value,
                            type: isHex ? 'hex' : isRgb ? 'rgb' : 'hsl',
                            domElement: element
                        });
                    }
                }
            }
        });

        console.log(`[CSSInspectorPanel] Found ${inlineStyleColors.length} inline style colors`);

        // Store results for copy functionality
        this.lastHardcodedColorsScan = {
            timestamp: new Date().toISOString(),
            stylesheetColors: hardcodedColors,
            inlineStyleColors: inlineStyleColors,
            totalCount: hardcodedColors.length + inlineStyleColors.length
        };

        // Group by stylesheet
        const grouped = {};
        hardcodedColors.forEach(item => {
            if (!grouped[item.stylesheet]) {
                grouped[item.stylesheet] = [];
            }
            grouped[item.stylesheet].push(item);
        });

        // Render results
        const totalColors = hardcodedColors.length + inlineStyleColors.length;
        let html = `
            <div class="hardcoded-colors-scan">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <p class="scan-summary" style="margin: 0;">Found <strong>${totalColors}</strong> total hardcoded color${totalColors !== 1 ? 's' : ''}</p>
                    <button id="copy-hardcoded-colors-btn" class="devpages-btn-ghost" style="font-size: 11px; padding: 4px 8px;">
                        📋 Copy All
                    </button>
                </div>
                <div class="scan-breakdown">
                    <span class="scan-stat">📄 Stylesheets: ${hardcodedColors.length}</span>
                    <span class="scan-stat">✏️ Inline styles: ${inlineStyleColors.length}</span>
                </div>
                <p style="font-size: 11px; color: var(--color-text-secondary); margin-top: 8px;">
                    <strong>Note:</strong> Scanning stylesheets and inline styles only. Colors defined via CSS variables are not flagged.
                </p>
        `;

        if (totalColors === 0) {
            html += `<p class="scan-success">✅ No hardcoded colors found! All colors use CSS variables.</p>`;
        } else {
            // Show inline styles first (most concerning)
            if (inlineStyleColors.length > 0) {
                html += `
                    <div class="stylesheet-colors inline-styles-section" style="margin-bottom: 32px;">
                        <h3 style="font-size: 14px; font-weight: 700; margin: 16px 0 8px 0; padding: 8px 12px; background: var(--color-warning-bg, rgba(245, 158, 11, 0.1)); border-left: 4px solid var(--color-warning, #f59e0b); color: var(--color-text);">
                            ✏️ Inline Styles <span style="color: var(--color-text-secondary); font-weight: 500;">(${inlineStyleColors.length})</span>
                        </h3>
                        <p style="font-size: 11px; color: var(--color-warning, #f59e0b); margin: 4px 0 12px 12px; font-weight: 500;">⚠️ Inline styles have highest specificity and are hard to override</p>
                        <table class="css-debug-table hardcoded-colors-table">
                            <thead>
                                <tr>
                                    <th>Element</th>
                                    <th>Property</th>
                                    <th>Value</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                inlineStyleColors.forEach(item => {
                    html += `
                        <tr class="inline-style-row">
                            <td><code>${this.escapeHtml(item.element)}</code></td>
                            <td><code>${item.property}</code></td>
                            <td>
                                <span class="color-preview" style="background-color: ${item.value}; border: 1px solid var(--color-border); display: inline-block; width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"></span>
                                <code>${this.escapeHtml(item.value)}</code>
                            </td>
                            <td><span class="type-badge inline-badge">${item.type}</span></td>
                        </tr>
                    `;
                });

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            }

            // Show stylesheet colors
            if (hardcodedColors.length > 0) {
                html += `<h3 style="margin-top: 24px; margin-bottom: 16px; font-size: 15px; font-weight: 600; color: var(--color-text); border-bottom: 2px solid var(--color-border); padding-bottom: 8px;">📄 Stylesheet Colors (${hardcodedColors.length})</h3>`;
            }
            for (const [stylesheet, colors] of Object.entries(grouped)) {
                html += `
                    <div class="stylesheet-colors" style="margin-bottom: 32px;">
                        <h4 style="font-size: 14px; font-weight: 700; margin: 16px 0 12px 0; padding: 8px 12px; background: var(--color-bg-alt); border-left: 4px solid var(--color-primary); color: var(--color-text);">
                            ${this.escapeHtml(stylesheet)} <span style="color: var(--color-text-secondary); font-weight: 500;">(${colors.length})</span>
                        </h4>
                        <table class="css-debug-table hardcoded-colors-table">
                            <thead>
                                <tr>
                                    <th>Selector</th>
                                    <th>Property</th>
                                    <th>Value</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                colors.forEach(item => {
                    html += `
                        <tr>
                            <td><code>${this.escapeHtml(item.selector)}</code></td>
                            <td><code>${item.property}</code></td>
                            <td>
                                <span class="color-preview" style="background-color: ${item.value}; border: 1px solid var(--color-border); display: inline-block; width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"></span>
                                <code>${this.escapeHtml(item.value)}</code>
                            </td>
                            <td><span class="type-badge">${item.type}</span></td>
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

        // Re-attach the Copy All button listener
        setTimeout(() => {
            const copyBtn = content.querySelector('#copy-hardcoded-colors-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    console.log('[CSSInspectorPanel] Copy Hardcoded Colors (from results) clicked');
                    this.setButtonState(copyBtn, 'loading', 'Copying...');
                    setTimeout(() => {
                        this.copyHardcodedColorsReport();
                        this.setButtonState(copyBtn, 'ready');
                    }, 10);
                });
            }
        }, 10);

        // Expand the section
        this.expandSection('hardcoded-colors');
    }

    /**
     * Toggle JS style monitoring with MutationObserver
     */
    toggleStyleMonitoring() {
        const btn = this.getContainer()?.querySelector('#toggle-monitor-btn');
        const content = this.getContainer()?.querySelector('#js-styles-content');

        if (this.styleObserver) {
            // Stop monitoring
            this.styleObserver.disconnect();
            this.styleObserver = null;
            this.observedElements.clear();

            if (btn) {
                btn.textContent = 'Monitor JS Styles';
                btn.classList.remove('active');
            }
            console.log('[CSSInspectorPanel] Stopped style monitoring');
        } else {
            // Start monitoring
            this.jsInjectedStyles = [];
            this.observedElements.clear();

            this.styleObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        const element = mutation.target;
                        const elementId = this.getElementSelector(element);

                        // Skip devpages panels
                        if (element.closest('[data-css-overlay]') ||
                            element.closest('.devpages-panel') ||
                            element.closest('.devpages-workspace')) {
                            return;
                        }

                        const timestamp = new Date().toLocaleTimeString();
                        const inlineStyle = element.style;
                        const styleChanges = [];

                        // Capture all inline style properties
                        for (let i = 0; i < inlineStyle.length; i++) {
                            const prop = inlineStyle[i];
                            const value = inlineStyle.getPropertyValue(prop);
                            const priority = inlineStyle.getPropertyPriority(prop);
                            styleChanges.push({ prop, value, priority });
                        }

                        if (styleChanges.length > 0) {
                            const entry = {
                                timestamp,
                                element: elementId,
                                domElement: element,
                                changes: styleChanges,
                                stackTrace: this.getStackTrace()
                            };

                            this.jsInjectedStyles.push(entry);
                            this.observedElements.add(element);

                            // Update display
                            this.displayJSInjectedStyles();

                            console.log('[CSSInspectorPanel] Style change detected:', entry);
                        }
                    }
                });
            });

            // Observe the entire document
            this.styleObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['style'],
                subtree: true
            });

            if (btn) {
                btn.textContent = 'Stop Monitoring';
                btn.classList.add('active');
            }

            if (content) {
                content.innerHTML = `
                    <div class="js-styles-monitor">
                        <p class="monitor-active">🟢 Monitoring active - capturing all style attribute changes</p>
                        <p class="monitor-instructions">Interact with your page to capture JS-injected styles</p>
                    </div>
                `;
            }

            this.expandSection('js-styles');
            console.log('[CSSInspectorPanel] Started style monitoring');
        }
    }

    /**
     * Get a simplified stack trace for debugging
     */
    getStackTrace() {
        const stack = new Error().stack;
        if (!stack) return 'N/A';

        const lines = stack.split('\n').slice(3, 6); // Skip first 3 lines, get next 3
        return lines.map(line => line.trim()).join(' → ');
    }

    /**
     * Display JS-injected style changes
     */
    displayJSInjectedStyles() {
        const content = this.getContainer()?.querySelector('#js-styles-content');
        if (!content) return;

        if (this.jsInjectedStyles.length === 0) {
            content.innerHTML = `
                <div class="js-styles-monitor">
                    <p class="monitor-active">🟢 Monitoring active - No changes detected yet</p>
                    <p class="monitor-instructions">Interact with your page to capture JS-injected styles</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="js-styles-monitor">
                <p class="monitor-active">🟢 Monitoring active</p>
                <p class="monitor-summary">Captured <strong>${this.jsInjectedStyles.length}</strong> style change${this.jsInjectedStyles.length !== 1 ? 's' : ''} on <strong>${this.observedElements.size}</strong> element${this.observedElements.size !== 1 ? 's' : ''}</p>

                <div class="js-styles-list">
        `;

        // Show most recent first
        const recentChanges = [...this.jsInjectedStyles].reverse().slice(0, 50);

        recentChanges.forEach((entry, index) => {
            html += `
                <div class="js-style-entry">
                    <div class="js-style-header">
                        <span class="js-style-timestamp">${entry.timestamp}</span>
                        <code class="js-style-element">${this.escapeHtml(entry.element)}</code>
                    </div>
                    <div class="js-style-changes">
            `;

            entry.changes.forEach(change => {
                html += `
                    <div class="js-style-property">
                        <span class="js-style-prop-name">${change.prop}</span>:
                        <span class="js-style-prop-value">${this.escapeHtml(change.value)}</span>${change.priority ? ' !important' : ''};
                    </div>
                `;
            });

            html += `
                    </div>
                    <details class="js-style-stack">
                        <summary>Stack trace</summary>
                        <pre class="js-style-stack-trace">${this.escapeHtml(entry.stackTrace)}</pre>
                    </details>
                </div>
            `;
        });

        if (this.jsInjectedStyles.length > 50) {
            html += `<p class="monitor-note">Showing most recent 50 of ${this.jsInjectedStyles.length} changes</p>`;
        }

        html += `
                </div>
            </div>
        `;

        content.innerHTML = html;
    }

    /**
     * Toggle visual overlay showing z-index and nesting
     */
    toggleVisualOverlay() {
        const btn = this.getContainer()?.querySelector('#toggle-overlay-btn');

        if (this.overlayActive) {
            // Remove overlay
            this.clearVisualOverlay();
            if (btn) {
                btn.textContent = 'Visual Overlay';
                btn.classList.remove('active');
            }
        } else {
            // Add overlay
            this.showVisualOverlay();
            if (btn) {
                btn.textContent = 'Hide Overlay';
                btn.classList.add('active');
            }
        }

        this.overlayActive = !this.overlayActive;
    }

    showVisualOverlay() {
        console.log('[CSSInspectorPanel] Showing visual overlay');

        // Clear any existing overlays
        this.clearVisualOverlay();

        // Add legend
        const legend = document.createElement('div');
        legend.setAttribute('data-css-overlay', 'true');
        legend.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 999998;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        legend.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 6px;">
                CSS Inspector Overlay Legend
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
                <div style="width: 16px; height: 16px; border: 2px solid #ff6b6b; background: rgba(255, 107, 107, 0.1); margin-right: 8px;"></div>
                <span><span style="color: #ff6b6b;">Red</span> = Creates Stacking Context</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="width: 16px; height: 16px; border: 2px solid #51cf66; background: rgba(81, 207, 102, 0.05); margin-right: 8px;"></div>
                <span><span style="color: #51cf66;">Green</span> = Has z-index only</span>
            </div>
            <div style="font-size: 11px; opacity: 0.7; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.2);">
                Labels show: z:value [SC] position<br>
                [SC] = Stacking Context
            </div>
        `;
        document.body.appendChild(legend);
        this.overlayElements.push(legend);

        // Find all elements with z-index or that create stacking contexts
        const allElements = document.querySelectorAll('*');

        allElements.forEach(element => {
            const computed = window.getComputedStyle(element);
            const zIndex = computed.zIndex;
            const position = computed.position;
            const createsContext = this.createsStackingContext(element);

            // Skip elements we don't care about
            if (zIndex === 'auto' && !createsContext) return;
            if (element.closest('[data-css-overlay]')) return; // Don't overlay our own overlays

            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            // Create overlay element
            const overlay = document.createElement('div');
            overlay.setAttribute('data-css-overlay', 'true');
            overlay.style.cssText = `
                position: fixed;
                top: ${rect.top}px;
                left: ${rect.left}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                pointer-events: none;
                border: 2px solid ${createsContext ? '#ff6b6b' : '#51cf66'};
                background: ${createsContext ? 'rgba(255, 107, 107, 0.1)' : 'rgba(81, 207, 102, 0.05)'};
                z-index: 999999;
                font-family: monospace;
                font-size: 11px;
                font-weight: bold;
                color: white;
                text-shadow: 0 0 2px black, 0 0 4px black;
                padding: 2px 4px;
            `;

            // Add label
            let label = '';
            if (zIndex !== 'auto') {
                label += `z:${zIndex}`;
            }
            if (createsContext) {
                label += ` [SC]`;
            }
            if (position !== 'static') {
                label += ` ${position}`;
            }

            overlay.textContent = label;

            document.body.appendChild(overlay);
            this.overlayElements.push(overlay);
        });

        console.log(`[CSSInspectorPanel] Created ${this.overlayElements.length} overlay elements`);
    }

    clearVisualOverlay() {
        console.log(`[CSSInspectorPanel] Clearing ${this.overlayElements.length} overlay elements`);
        this.overlayElements.forEach(el => el.remove());
        this.overlayElements = [];
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

    /**
     * Copy hardcoded colors report to clipboard
     */
    async copyHardcodedColorsReport() {
        if (!this.lastHardcodedColorsScan) {
            alert('No scan results available. Please run "Scan Hardcoded Colors" first.');
            return;
        }

        const scan = this.lastHardcodedColorsScan;
        const report = {
            timestamp: scan.timestamp,
            pageUrl: window.location.href,
            summary: {
                totalColors: scan.totalCount,
                stylesheetColors: scan.stylesheetColors.length,
                inlineStyleColors: scan.inlineStyleColors.length
            },

            // Group stylesheet colors by file
            stylesheets: {},

            // Inline styles
            inlineStyles: scan.inlineStyleColors.map(item => ({
                element: item.element,
                property: item.property,
                value: item.value,
                type: item.type
            })),

            // Extract unique colors for palette
            uniqueColors: []
        };

        // Group by stylesheet
        scan.stylesheetColors.forEach(item => {
            if (!report.stylesheets[item.stylesheet]) {
                report.stylesheets[item.stylesheet] = [];
            }
            report.stylesheets[item.stylesheet].push({
                selector: item.selector,
                property: item.property,
                value: item.value,
                type: item.type
            });
        });

        // Extract unique color values
        const colorSet = new Set();
        scan.stylesheetColors.forEach(item => colorSet.add(item.value));
        scan.inlineStyleColors.forEach(item => colorSet.add(item.value));
        report.uniqueColors = Array.from(colorSet).sort();

        // Convert to formatted JSON
        const json = JSON.stringify(report, null, 2);

        try {
            await navigator.clipboard.writeText(json);
            console.log('[CSSInspectorPanel] Hardcoded colors report copied');
            alert(`✅ Hardcoded colors report copied!\n\n` +
                  `📊 Summary:\n` +
                  `- ${scan.totalCount} total hardcoded colors\n` +
                  `- ${scan.stylesheetColors.length} in stylesheets\n` +
                  `- ${scan.inlineStyleColors.length} inline styles\n` +
                  `- ${report.uniqueColors.length} unique colors\n\n` +
                  `Ready to paste for refactoring!`);
        } catch (err) {
            console.error('[CSSInspectorPanel] Failed to copy:', err);
            alert('❌ Failed to copy to clipboard');
        }
    }

    onDestroy() {
        const picker = window.APP?.utils?.elementPicker;
        if (picker?.isActive()) {
            picker.stop();
        }

        // Clean up visual overlay
        this.clearVisualOverlay();

        // Clean up mutation observer
        if (this.styleObserver) {
            this.styleObserver.disconnect();
            this.styleObserver = null;
        }

        // Clean up event listeners
        if (this._collapseHandler) {
            const container = this.getContainer();
            if (container) {
                container.removeEventListener('click', this._collapseHandler);
            }
        }
        this._listenersAttached = false;

        super.onDestroy();
    }

    scanDesignTokenUsage() {
        console.log('[CSSInspectorPanel] scanDesignTokenUsage called');
        const container = this.getContainer();
        const content = container?.querySelector('#design-token-usage-content');

        if (!content) {
            console.error('[CSSInspectorPanel] design-token-usage-content not found!');
            return;
        }

        console.log('[CSSInspectorPanel] Starting design token usage scan...');

        const colorProperties = [
            'color', 'background-color', 'background', 'border-color',
            'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
            'outline-color', 'text-decoration-color', 'box-shadow', 'text-shadow',
            'fill', 'stroke'
        ];

        const tokenUsage = new Map(); // Map of token name -> array of usage locations
        const sheets = document.styleSheets;

        // Scan all stylesheets
        for (let i = 0; i < sheets.length; i++) {
            const sheet = sheets[i];
            const source = this.getStylesheetSource(sheet);

            try {
                const cssRules = sheet.cssRules || sheet.rules;
                if (!cssRules) continue;

                for (let j = 0; j < cssRules.length; j++) {
                    const rule = cssRules[j];
                    if (!rule.style) continue;

                    const selector = rule.selectorText;

                    // Skip :root and token definition selectors
                    if (/^:root\b|^\[data-theme|^html\b|^\*\b/.test(selector)) {
                        continue;
                    }

                    for (const prop of colorProperties) {
                        const value = rule.style.getPropertyValue(prop);
                        if (!value) continue;

                        // Look for CSS variable usage: var(--something)
                        const varMatches = value.matchAll(/var\((--[a-zA-Z0-9-]+)/g);
                        for (const match of varMatches) {
                            const tokenName = match[1]; // e.g., "--color-primary"

                            if (!tokenUsage.has(tokenName)) {
                                tokenUsage.set(tokenName, []);
                            }

                            // Get the computed value
                            const computedValue = getComputedStyle(document.documentElement).getPropertyValue(tokenName);

                            tokenUsage.get(tokenName).push({
                                stylesheet: source,
                                selector,
                                property: prop,
                                rawValue: value,
                                computedValue: computedValue.trim()
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn(`[CSSInspectorPanel] Cannot scan stylesheet: ${source}`, e);
            }
        }

        console.log(`[CSSInspectorPanel] Found ${tokenUsage.size} unique design tokens in use`);

        // Get all defined tokens from :root
        const rootStyle = getComputedStyle(document.documentElement);
        const allDefinedTokens = new Map();

        // Scan for all --color-* custom properties
        Array.from(document.styleSheets).forEach(sheet => {
            try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) return;

                for (const rule of rules) {
                    if (rule.selectorText === ':root' && rule.style) {
                        for (let i = 0; i < rule.style.length; i++) {
                            const prop = rule.style[i];
                            if (prop.startsWith('--color-')) {
                                const value = rootStyle.getPropertyValue(prop).trim();
                                allDefinedTokens.set(prop, value);
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip inaccessible stylesheets
            }
        });

        // Find unused tokens
        const unusedTokens = new Map();
        for (const [tokenName, tokenValue] of allDefinedTokens) {
            if (!tokenUsage.has(tokenName)) {
                unusedTokens.set(tokenName, tokenValue);
            }
        }

        console.log(`[CSSInspectorPanel] Found ${unusedTokens.size} unused design tokens`);

        // Store results for copy functionality
        this.lastTokenUsageScan = {
            timestamp: new Date().toISOString(),
            pageUrl: window.location.href,
            tokens: Array.from(tokenUsage.entries()).map(([name, usages]) => ({
                name,
                value: usages[0]?.computedValue || '',
                usageCount: usages.length,
                usages
            })),
            unusedTokens: Array.from(unusedTokens.entries()).map(([name, value]) => ({
                name,
                value
            })),
            totalDefined: allDefinedTokens.size
        };

        // Render results
        const totalUsages = Array.from(tokenUsage.values()).reduce((sum, arr) => sum + arr.length, 0);

        let html = `
            <div class="token-usage-scan">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <p class="scan-summary" style="margin: 0;">
                            Found <strong>${allDefinedTokens.size}</strong> defined token${allDefinedTokens.size !== 1 ? 's' : ''}
                        </p>
                        <p style="font-size: 11px; color: var(--color-text-secondary); margin: 4px 0 0 0;">
                            <span style="color: var(--color-status-success, #10b981);">✓ ${tokenUsage.size} used</span>
                            ${unusedTokens.size > 0 ? `<span style="color: var(--color-status-warning, #f59e0b); margin-left: 12px;">⚠ ${unusedTokens.size} unused</span>` : ''}
                        </p>
                    </div>
                    <button id="copy-token-usage-btn" class="devpages-btn-ghost" style="font-size: 11px; padding: 4px 8px;">
                        📋 Copy All
                    </button>
                </div>
        `;

        if (tokenUsage.size === 0) {
            html += `<p class="scan-warning">⚠️ No design token usage found. All colors may be hardcoded.</p>`;
        } else {
            // Sort tokens by usage count (most used first)
            const sortedTokens = Array.from(tokenUsage.entries())
                .sort((a, b) => b[1].length - a[1].length);

            html += `
                <div style="margin-top: 16px;">
                    <h3 style="font-size: 14px; font-weight: 700; margin: 0 0 12px 0;">
                        Used Design Tokens (${tokenUsage.size})
                    </h3>
            `;

            for (const [tokenName, usages] of sortedTokens) {
                const computedValue = usages[0]?.computedValue || '';
                const isNotSet = !computedValue;
                const displayValue = isNotSet ? 'not set' : computedValue;
                const usageCount = usages.length;

                // Group usages by stylesheet
                const byStylesheet = {};
                usages.forEach(usage => {
                    if (!byStylesheet[usage.stylesheet]) {
                        byStylesheet[usage.stylesheet] = [];
                    }
                    byStylesheet[usage.stylesheet].push(usage);
                });

                // Error styling for not-set tokens
                const errorStyle = isNotSet ? 'border-left: 4px solid var(--color-status-error, #ef4444); background: rgba(239, 68, 68, 0.05);' : '';
                const errorIcon = isNotSet ? '<span style="color: var(--color-status-error, #ef4444); font-weight: bold; margin-right: 4px;">⚠️ ERROR:</span>' : '';

                html += `
                    <details class="token-usage-details" style="margin-bottom: 8px; border: 1px solid var(--color-border); border-radius: 4px; padding: 8px; ${errorStyle}">
                        <summary style="cursor: pointer; font-weight: 600; display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; align-items: center;">
                            <span class="color-preview" style="display: block; width: 20px; height: 20px; background-color: ${isNotSet ? '#f0f0f0' : computedValue}; border: 1px solid var(--color-border); border-radius: 3px; ${isNotSet ? 'position: relative;' : ''}">
                                ${isNotSet ? '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ef4444; font-size: 16px; line-height: 1;">✕</span>' : ''}
                            </span>
                            <span style="display: flex; flex-direction: column; gap: 2px;">
                                <code style="color: var(--color-inspector-var-name, #7c3aed); font-size: 12px;">${errorIcon}${this.escapeHtml(tokenName)}</code>
                                <code style="font-size: 10px; color: ${isNotSet ? 'var(--color-status-error, #ef4444)' : 'var(--color-text-secondary)'}; font-weight: ${isNotSet ? '600' : 'normal'};">${this.escapeHtml(displayValue)}</code>
                            </span>
                            <span style="font-size: 11px; color: var(--color-text-secondary); font-weight: normal;">
                                ${usageCount} usage${usageCount !== 1 ? 's' : ''}
                            </span>
                        </summary>
                        <div style="margin-top: 12px; margin-left: 32px;">
                            ${isNotSet ? '<p style="color: var(--color-status-error, #ef4444); font-size: 11px; margin: 0 0 8px 0; font-weight: 600;">⚠️ This token is used but never defined. The browser will use inherited or initial values, which may cause display issues.</p>' : ''}
                `;

                // Show usages grouped by stylesheet
                for (const [stylesheet, stylesheetUsages] of Object.entries(byStylesheet)) {
                    html += `
                        <div style="margin-bottom: 12px;">
                            <h4 style="font-size: 12px; font-weight: 600; color: var(--color-text-secondary); margin: 8px 0 4px 0;">
                                ${this.escapeHtml(stylesheet)} (${stylesheetUsages.length})
                            </h4>
                            <table class="css-debug-table" style="font-size: 11px;">
                                <thead>
                                    <tr>
                                        <th>Selector</th>
                                        <th>Property</th>
                                        <th>Full Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;

                    stylesheetUsages.forEach(usage => {
                        html += `
                            <tr>
                                <td><code>${this.escapeHtml(usage.selector)}</code></td>
                                <td><code>${usage.property}</code></td>
                                <td><code style="font-size: 10px;">${this.escapeHtml(usage.rawValue)}</code></td>
                            </tr>
                        `;
                    });

                    html += `
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                html += `
                        </div>
                    </details>
                `;
            }

            html += `</div>`;
        }

        // Show unused tokens section
        if (unusedTokens.size > 0) {
            const sortedUnused = Array.from(unusedTokens.entries()).sort((a, b) => a[0].localeCompare(b[0]));

            html += `
                <div style="margin-top: 32px; padding-top: 16px; border-top: 2px solid var(--color-border);">
                    <h3 style="font-size: 14px; font-weight: 700; margin: 0 0 8px 0; color: var(--color-status-warning, #f59e0b);">
                        ⚠ Unused Design Tokens (${unusedTokens.size})
                    </h3>
                    <p style="font-size: 11px; color: var(--color-text-secondary); margin: 0 0 12px 0;">
                        These tokens are defined but not used anywhere in your stylesheets
                    </p>
            `;

            for (const [tokenName, tokenValue] of sortedUnused) {
                html += `
                    <div style="display: grid; grid-template-columns: 24px 1fr; gap: 8px; align-items: center; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 4px; margin-bottom: 4px; background: var(--color-bg-alt, #f9fafb);">
                        <span class="color-preview" style="display: block; width: 20px; height: 20px; background-color: ${tokenValue}; border: 1px solid var(--color-border); border-radius: 3px;"></span>
                        <span style="display: flex; flex-direction: column; gap: 2px;">
                            <code style="color: var(--color-inspector-var-name, #7c3aed); font-size: 12px;">${this.escapeHtml(tokenName)}</code>
                            <code style="font-size: 10px; color: var(--color-text-secondary);">${this.escapeHtml(tokenValue)}</code>
                        </span>
                    </div>
                `;
            }

            html += `</div>`;
        }

        html += `</div>`;

        content.innerHTML = html;
    }

    copyTokenUsageReport() {
        if (!this.lastTokenUsageScan) {
            alert('No token usage scan data available. Please run "Scan Token Usage" first.');
            return;
        }

        const scan = this.lastTokenUsageScan;
        const totalUsages = scan.tokens.reduce((sum, t) => sum + t.usageCount, 0);

        let report = {
            timestamp: scan.timestamp,
            pageUrl: scan.pageUrl,
            summary: {
                totalDefined: scan.totalDefined || 0,
                usedTokens: scan.tokens.length,
                unusedTokens: scan.unusedTokens?.length || 0,
                totalUsages: totalUsages
            },
            usedTokens: {},
            unusedTokens: {}
        };

        // Group used tokens by name
        scan.tokens.forEach(token => {
            report.usedTokens[token.name] = {
                computedValue: token.value,
                usageCount: token.usageCount,
                usages: token.usages.map(u => ({
                    stylesheet: u.stylesheet,
                    selector: u.selector,
                    property: u.property,
                    fullValue: u.rawValue
                }))
            };
        });

        // Add unused tokens
        if (scan.unusedTokens) {
            scan.unusedTokens.forEach(token => {
                report.unusedTokens[token.name] = {
                    computedValue: token.value,
                    usageCount: 0
                };
            });
        }

        navigator.clipboard.writeText(JSON.stringify(report, null, 2))
            .then(() => {
                console.log('[CSSInspectorPanel] Token usage report copied to clipboard');
                const unusedMsg = scan.unusedTokens?.length ? `\n${scan.unusedTokens.length} unused` : '';
                alert(`✅ Copied design token usage report!\n\n${scan.tokens.length} used tokens, ${totalUsages} usages${unusedMsg}`);
            })
            .catch(err => {
                console.error('[CSSInspectorPanel] Failed to copy:', err);
                alert('❌ Failed to copy to clipboard. Check console for details.');
            });
    }
}

// Register panel
panelRegistry.registerType('css-inspector', CSSInspectorPanel);

export default CSSInspectorPanel;
