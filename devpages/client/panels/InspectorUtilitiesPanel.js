/**
 * InspectorUtilitiesPanel.js - Inspector Utilities panel implementation
 *
 * Provides interactive element inspection tools
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class InspectorUtilitiesPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'inspector-utilities',
            title: 'Inspector Utilities',
            defaultWidth: 700,
            defaultHeight: 600,
            ...config
        });

        this.selectedElement = null;
        this.picker = null;
        this.boxModel = null;
        this.detector = null;
    }

    initializeUtilities() {
        this.picker = window.APP?.utils?.elementPicker;
        this.boxModel = window.APP?.utils?.boxModelRenderer;
        this.detector = window.APP?.utils?.devPagesDetector;
        return !!(this.picker && this.boxModel && this.detector);
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

                <div class="devpages-panel-sections">
                    <!-- Element Info Section -->
                    <div class="devpages-panel-row" data-section="element-info">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Element Info</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="element-info-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- Design Tokens Section -->
                    <div class="devpages-panel-row" data-section="design-tokens">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Design Tokens & Theme</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="design-tokens-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- Z-Index Context Section -->
                    <div class="devpages-panel-row" data-section="zindex">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Z-Index & Stacking</span>
                            <span class="devpages-panel-row-caret">⌄</span>
                        </div>
                        <div class="devpages-panel-row-content" id="zindex-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- DevPages Context Section -->
                    <div class="devpages-panel-row collapsed" data-section="devpages-context">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">DevPages Context</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="devpages-context-content">
                            <div class="devpages-panel-placeholder">No element selected</div>
                        </div>
                    </div>

                    <!-- Page Statistics Section -->
                    <div class="devpages-panel-row collapsed" data-section="stats">
                        <div class="devpages-panel-row-header">
                            <span class="devpages-panel-row-title">Page Statistics</span>
                            <span class="devpages-panel-row-caret">›</span>
                        </div>
                        <div class="devpages-panel-row-content" id="stats-content">
                            <div class="devpages-panel-placeholder">Loading...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount(container = null) {
        console.log('[InspectorUtilitiesPanel] onMount called with container:', container);

        if (container) {
            this.sidebarContainer = container;
        }

        super.onMount(container);

        console.log('[InspectorUtilitiesPanel] Checking window.APP:', {
            hasAPP: !!window.APP,
            hasUtils: !!window.APP?.utils,
            utils: window.APP?.utils
        });

        // Try to initialize utilities
        const initialized = this.initializeUtilities();
        console.log('[InspectorUtilitiesPanel] Initial utilities check:', initialized);

        if (!initialized) {
            console.warn('[InspectorUtilitiesPanel] Utilities not available, retrying in 500ms...');
            setTimeout(() => {
                const retryInitialized = this.initializeUtilities();
                console.log('[InspectorUtilitiesPanel] Retry utilities check:', retryInitialized);
                if (retryInitialized) {
                    this.loadPageStats();
                } else {
                    console.error('[InspectorUtilitiesPanel] Utilities still not available after retry!');
                }
            }, 500);
        } else {
            this.loadPageStats();
        }

        this.attachListeners();
        this.attachCollapseListeners();
    }

    getContainer() {
        return this.element || this.sidebarContainer || document.querySelector(`#panel-instance-${this.id}`);
    }

    attachListeners() {
        const container = this.getContainer();
        console.log('[InspectorUtilitiesPanel] attachListeners - container:', container);

        if (!container) {
            console.error('[InspectorUtilitiesPanel] No container found for attaching listeners!');
            return;
        }

        const pickBtn = container.querySelector('#pick-element-btn');
        const clearBtn = container.querySelector('#clear-btn');
        const refreshBtn = container.querySelector('#refresh-btn');

        console.log('[InspectorUtilitiesPanel] Buttons found:', {
            pickBtn: !!pickBtn,
            clearBtn: !!clearBtn,
            refreshBtn: !!refreshBtn
        });

        if (pickBtn) {
            pickBtn.addEventListener('click', () => {
                console.log('[InspectorUtilitiesPanel] Pick button clicked');
                this.startPicking();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearSelection());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshSelection());
        }
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
        console.log('[InspectorUtilitiesPanel] startPicking called');
        console.log('[InspectorUtilitiesPanel] picker available:', !!this.picker);
        console.log('[InspectorUtilitiesPanel] window.APP.utils:', window.APP?.utils);

        if (!this.picker) {
            // Try to initialize again
            if (this.initializeUtilities()) {
                console.log('[InspectorUtilitiesPanel] Utilities initialized on retry');
            } else {
                console.error('[InspectorUtilitiesPanel] Picker not available! window.APP.utils:', window.APP?.utils);
                alert('Element picker not available. Check console for details.');
                return;
            }
        }

        console.log('[InspectorUtilitiesPanel] Starting picker...');
        this.picker.start({
            onSelect: (element) => {
                console.log('[InspectorUtilitiesPanel] Element selected:', element);
                this.onElementSelected(element);
            },
            onCancel: () => {
                console.log('[InspectorUtilitiesPanel] Picker cancelled');
            },
            ignoreDevPanels: true
        });
    }

    onElementSelected(element) {
        this.selectedElement = element;

        const container = this.getContainer();
        if (container) {
            container.querySelector('#clear-btn')?.removeAttribute('disabled');
        }

        if (this.detector) {
            const info = this.detector.getElementInfo(element);
            this.displayElementInfo(info);
            this.displayDesignTokens(info.designTokens);
            this.displayZIndexContext(info.zIndex);
            this.displayDevPagesContext(element);
        }

        this.expandSection('element-info');
        this.expandSection('design-tokens');
        this.expandSection('zindex');
    }

    displayDevPagesContext(element) {
        const container = this.getContainer();
        const content = container?.querySelector('#devpages-context-content');
        if (!content || !element) return;

        // Check if element is part of DevPages
        const isDevPagesElement = element.closest('.devpages-panel') ||
                                 element.classList.contains('devpages-panel') ||
                                 element.id?.includes('devpages');

        // Get theme mode
        const htmlEl = document.documentElement;
        const themeMode = htmlEl.getAttribute('data-theme') ||
                         htmlEl.classList.contains('dark') ? 'dark' : 'light';

        // Check for panel registry
        const panelElement = element.closest('[data-panel-type]');
        const panelType = panelElement?.getAttribute('data-panel-type');

        // Get app state
        const hasAPP = !!window.APP;
        const hasServices = !!window.APP?.services;
        const hasUtils = !!window.APP?.utils;

        content.innerHTML = `
            <table class="inspector-table compact">
                <tr>
                    <td>DevPages Element</td>
                    <td><span class="badge ${isDevPagesElement ? 'badge-yes' : 'badge-no'}">${isDevPagesElement ? 'Yes' : 'No'}</span></td>
                </tr>
                <tr>
                    <td>Theme Mode</td>
                    <td><span class="theme-badge theme-${themeMode}">${themeMode}</span></td>
                </tr>
                ${panelType ? `
                    <tr>
                        <td>Panel Type</td>
                        <td><code>${panelType}</code></td>
                    </tr>
                ` : ''}
                <tr>
                    <td>window.APP</td>
                    <td><span class="badge ${hasAPP ? 'badge-yes' : 'badge-no'}">${hasAPP ? 'Available' : 'Missing'}</span></td>
                </tr>
                ${hasAPP ? `
                    <tr>
                        <td>APP.services</td>
                        <td><span class="badge ${hasServices ? 'badge-yes' : 'badge-no'}">${hasServices ? 'Available' : 'Missing'}</span></td>
                    </tr>
                    <tr>
                        <td>APP.utils</td>
                        <td><span class="badge ${hasUtils ? 'badge-yes' : 'badge-no'}">${hasUtils ? 'Available' : 'Missing'}</span></td>
                    </tr>
                ` : ''}
            </table>
        `;
    }

    displayElementInfo(info) {
        const container = this.getContainer();
        const content = container?.querySelector('#element-info-content');
        if (!content || !info) return;

        // Build DOM hierarchy
        const hierarchy = this.buildDOMHierarchy(info.element);

        content.innerHTML = `
            <div class="dom-hierarchy">
                ${hierarchy}
            </div>
            <table class="inspector-table">
                <tr><td>Tag</td><td>${info.tagName}</td></tr>
                <tr><td>ID</td><td>${info.id || '(none)'}</td></tr>
                <tr><td>Classes</td><td>${info.classes.join(', ') || '(none)'}</td></tr>
                <tr><td>Path</td><td class="inspector-path">${info.path}</td></tr>
                <tr><td>Size</td><td>${Math.round(info.bounds.width)} × ${Math.round(info.bounds.height)}px</td></tr>
            </table>
        `;
    }

    buildDOMHierarchy(element) {
        if (!element) return '';

        const ancestors = [];
        let current = element;

        // Collect ancestors (up to 10 levels)
        while (current && ancestors.length < 10) {
            ancestors.unshift(current);
            current = current.parentElement;
        }

        // Build hierarchy HTML
        return ancestors.map((el, index) => {
            const isSelected = el === element;
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const classes = el.classList.length > 0 ? '.' + Array.from(el.classList).slice(0, 3).join('.') : '';
            const indent = '  '.repeat(index);

            return `<div class="dom-node ${isSelected ? 'selected' : ''}"><span class="dom-indent">${indent}</span><span class="dom-tag">&lt;${tag}</span><span class="dom-attrs">${id}${classes}</span><span class="dom-tag">&gt;</span></div>`;
        }).join('');
    }

    displayDesignTokens(tokens) {
        const container = this.getContainer();
        const content = container?.querySelector('#design-tokens-content');
        if (!content || !tokens) return;

        const categories = Object.entries(tokens).filter(([_, values]) => Object.keys(values).length > 0);

        if (categories.length === 0) {
            content.innerHTML = '<div class="devpages-panel-placeholder">No design tokens found</div>';
            return;
        }

        // Helper to check if value is a color
        const isColor = (value) => {
            return value && (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl'));
        };

        // Helper to render color swatch
        const renderColorSwatch = (color) => {
            return `<span class="color-swatch" style="background: ${color}" title="${color}"></span>`;
        };

        const html = categories.map(([category, values]) => `
            <div class="token-category">
                <div class="token-category-title">${category}</div>
                <div class="token-grid">
                    ${Object.entries(values).map(([name, value]) => {
                        const hasColor = isColor(value);
                        return `
                            <div class="token-item">
                                <div class="token-name">${name}</div>
                                <div class="token-value">
                                    ${hasColor ? renderColorSwatch(value) : ''}
                                    <span class="token-value-text">${value}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');

        content.innerHTML = html;
    }

    displayZIndexContext(zContext) {
        const container = this.getContainer();
        const content = container?.querySelector('#zindex-content');
        if (!content || !zContext) return;

        // Get computed z-index and position info
        const computed = window.getComputedStyle(this.selectedElement);
        const zIndex = computed.zIndex;
        const position = computed.position;
        const transform = computed.transform;
        const opacity = computed.opacity;
        const willChange = computed.willChange;

        // Determine if creates stacking context
        const createsContext =
            position !== 'static' && zIndex !== 'auto' ||
            transform !== 'none' ||
            opacity !== '1' ||
            willChange === 'transform' || willChange === 'opacity';

        // Get stacking order (how many elements are above/below)
        const rect = this.selectedElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Count elements at same position
        const elementsAbove = [];
        let testElement = document.elementFromPoint(centerX, centerY);
        while (testElement && testElement !== this.selectedElement && elementsAbove.length < 5) {
            elementsAbove.push(testElement);
            testElement.style.pointerEvents = 'none';
            testElement = document.elementFromPoint(centerX, centerY);
        }
        // Restore pointer events
        elementsAbove.forEach(el => el.style.pointerEvents = '');

        content.innerHTML = `
            <div class="zindex-info">
                <div class="zindex-main">
                    <div class="zindex-value ${zIndex === 'auto' ? 'auto' : ''}">${zIndex}</div>
                    <div class="zindex-label">z-index</div>
                </div>
                <table class="inspector-table compact">
                    <tr>
                        <td>Position</td>
                        <td><code>${position}</code></td>
                    </tr>
                    <tr>
                        <td>Creates Context</td>
                        <td><span class="badge ${createsContext ? 'badge-yes' : 'badge-no'}">${createsContext ? 'Yes' : 'No'}</span></td>
                    </tr>
                    ${transform !== 'none' ? `<tr><td>Transform</td><td><code class="truncate">${transform}</code></td></tr>` : ''}
                    ${opacity !== '1' ? `<tr><td>Opacity</td><td><code>${opacity}</code></td></tr>` : ''}
                    ${willChange !== 'auto' ? `<tr><td>Will-Change</td><td><code>${willChange}</code></td></tr>` : ''}
                    ${elementsAbove.length > 0 ? `
                        <tr>
                            <td>Elements Above</td>
                            <td>${elementsAbove.length}</td>
                        </tr>
                    ` : ''}
                </table>
            </div>
        `;
    }

    loadPageStats() {
        if (!this.detector) return;

        const container = this.getContainer();
        const content = container?.querySelector('#stats-content');
        if (!content) return;

        const stats = this.detector.getPageStatistics();

        content.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.totalElements}</div>
                    <div class="stat-label">Elements</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.elementsWithTokens}</div>
                    <div class="stat-label">With Tokens</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.tokenUsagePercentage}%</div>
                    <div class="stat-label">Usage</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.panels}</div>
                    <div class="stat-label">Panels</div>
                </div>
            </div>
        `;
    }

    refreshSelection() {
        if (this.selectedElement) {
            console.log('[InspectorUtilitiesPanel] Refreshing current selection');
            this.onElementSelected(this.selectedElement);
        } else {
            console.log('[InspectorUtilitiesPanel] No element to refresh');
        }
    }

    clearSelection() {
        this.selectedElement = null;

        const container = this.getContainer();
        if (container) {
            container.querySelector('#clear-btn')?.setAttribute('disabled', '');

            container.querySelector('#element-info-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
            container.querySelector('#design-tokens-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
            container.querySelector('#zindex-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
            container.querySelector('#devpages-context-content').innerHTML = '<div class="devpages-panel-placeholder">No element selected</div>';
        }
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

    onDestroy() {
        if (this.picker) {
            this.picker.stop();
        }
        if (this.boxModel) {
            this.boxModel.hide();
        }
        super.onDestroy();
    }
}

// Inline minimal styles
const style = document.createElement('style');
style.textContent = `
    .dom-hierarchy {
        background: var(--color-bg-alt, #f9fafb);
        border: 1px solid var(--color-border, #e5e7eb);
        border-radius: var(--radius-base, 6px);
        padding: var(--space-2, 8px);
        margin-bottom: var(--space-3, 12px);
        font-family: var(--font-family-mono, monospace);
        font-size: var(--font-size-xs, 12px);
        overflow-x: auto;
    }

    .dom-node {
        padding: 2px 0;
        white-space: pre;
        line-height: 1.6;
    }

    .dom-node.selected {
        background: var(--color-primary-background, rgba(59, 130, 246, 0.1));
        border-left: 3px solid var(--color-primary, #3b82f6);
        padding-left: var(--space-1, 4px);
        margin-left: -4px;
    }

    .dom-indent {
        color: var(--color-text-secondary, #6b7280);
    }

    .dom-tag {
        color: var(--color-primary, #3b82f6);
        font-weight: var(--font-weight-semibold, 600);
    }

    .dom-attrs {
        color: var(--color-text, #111827);
    }

    .inspector-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--font-size-sm, 13px);
    }

    .inspector-table td {
        padding: var(--space-2, 8px);
        border-bottom: 1px solid var(--color-border, #e5e7eb);
    }

    .inspector-table td:first-child {
        font-weight: var(--font-weight-semibold, 600);
        color: var(--color-text-secondary, #6b7280);
        width: 120px;
    }

    .inspector-table td:last-child {
        font-family: var(--font-family-mono, monospace);
        color: var(--color-text, #111827);
        font-size: var(--font-size-xs, 12px);
    }

    .inspector-path {
        word-break: break-all;
        font-size: var(--font-size-xs, 11px);
    }

    .token-category {
        margin-bottom: var(--space-3, 12px);
    }

    .token-category-title {
        font-weight: var(--font-weight-semibold, 600);
        color: var(--color-text, #111827);
        margin-bottom: var(--space-2, 8px);
        padding-bottom: var(--space-1, 4px);
        border-bottom: 1px solid var(--color-border, #e5e7eb);
        text-transform: capitalize;
        font-size: var(--font-size-sm, 13px);
    }

    .token-name {
        color: var(--color-primary, #3b82f6);
    }

    .token-value {
        color: var(--color-text-secondary, #6b7280);
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-2, 8px);
    }

    .stat-card {
        background: var(--color-bg-alt, #f9fafb);
        border: 1px solid var(--color-border, #e5e7eb);
        border-radius: var(--radius-base, 6px);
        padding: var(--space-3, 12px);
        text-align: center;
    }

    .stat-value {
        font-size: var(--font-size-xl, 20px);
        font-weight: var(--font-weight-bold, 700);
        color: var(--color-text, #111827);
        margin-bottom: var(--space-1, 4px);
    }

    .stat-label {
        font-size: var(--font-size-xs, 12px);
        color: var(--color-text-secondary, #6b7280);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
`;
document.head.appendChild(style);

export function createInspectorUtilitiesPanel(config = {}) {
    return new InspectorUtilitiesPanel(config);
}

panelRegistry.registerType('inspector-utilities', InspectorUtilitiesPanel);
