/**
 * DOMInspectorPanel.js - Unified sophisticated DOM/CSS Inspector
 *
 * Merged architecture combining:
 * - Full DOM tree visualization with expand/collapse
 * - Element picker and highlighting
 * - Box model rendering
 * - Computed styles inspection
 * - Design tokens detection
 * - CSS rules analysis
 *
 * Based on archive/dom-inspector architecture with modern enhancements
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class DOMInspectorPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'dom-inspector',
            title: 'DOM Inspector',
            defaultWidth: 900,
            defaultHeight: 700,
            ...config
        });

        // State
        this.selectedElement = null;
        this.hoveredElement = null;
        this.expandedNodes = new Set();
        this.elementCache = new Map();
        this.highlightMode = 'none'; // 'none', 'border', 'both'
        this.splitPosition = 33; // percentage

        // Component references
        this.treeContainer = null;
        this.detailsContainer = null;
        this.splitter = null;
        this.highlightOverlay = null;

        // Utils
        this.picker = null;
        this.boxModel = null;
        this.detector = null;
    }

    renderContent() {
        return `
            <div class="dom-inspector-panel">
                <!-- Toolbar with selector input and controls -->
                <div class="dom-inspector-query-container">
                    <div class="dom-inspector-input-row">
                        <div class="dom-inspector-input-section">
                            <input
                                type="text"
                                placeholder="CSS Selector (e.g., .class, #id, div)"
                                class="dom-inspector-query-input"
                                id="selector-input"
                            />
                        </div>
                        <div class="dom-inspector-button-group">
                            <button class="dom-inspector-btn dom-inspector-picker-btn" id="picker-btn" title="Pick element from page">
                                Select
                            </button>
                            <button class="dom-inspector-btn dom-inspector-save-btn" id="save-selector-btn" title="Save selector">
                                Save
                            </button>
                            <button class="dom-inspector-btn dom-inspector-clear-btn" id="clear-btn" title="Clear selection">
                                Clear
                            </button>
                            <button class="dom-inspector-btn dom-inspector-highlight-toggle mode-${this.highlightMode}"
                                    id="highlight-toggle"
                                    title="Highlight: ${this.highlightMode}">
                                ○
                            </button>
                        </div>
                    </div>

                    <!-- Quick selector presets -->
                    <div class="dom-inspector-quick-select" id="quick-selectors">
                        ${this.renderQuickSelectors()}
                    </div>
                </div>

                <!-- Main content area with split panes -->
                <div class="dom-inspector-main">
                    <!-- Left: DOM Tree -->
                    <div class="dom-inspector-tree" id="tree-container" style="width: ${this.splitPosition}%">
                        <div class="tree-header">
                            <span class="tree-title">Document Tree</span>
                            <div class="tree-controls">
                                <button class="tree-control-btn" id="expand-all-btn" title="Expand all">▼</button>
                                <button class="tree-control-btn" id="collapse-all-btn" title="Collapse all">▶</button>
                                <button class="tree-control-btn" id="refresh-tree-btn" title="Refresh tree">↻</button>
                            </div>
                        </div>
                        <div class="tree-content" id="tree-content">
                            ${this.renderTreePlaceholder()}
                        </div>
                    </div>

                    <!-- Splitter -->
                    <div class="dom-inspector-splitter" id="splitter">
                        <div class="splitter-handle"></div>
                    </div>

                    <!-- Right: Details Panel -->
                    <div class="dom-inspector-details" id="details-container" style="width: ${100 - this.splitPosition}%">
                        ${this.renderDetailsContent()}
                    </div>
                </div>

                <!-- Highlight overlay (positioned absolutely over page) -->
                <div class="dom-inspector-highlight-overlay" id="highlight-overlay"></div>
            </div>
        `;
    }

    renderQuickSelectors() {
        const presets = [
            'body',
            'header',
            'nav',
            'main',
            '.panel',
            '[data-panel]',
            'button',
            'input'
        ];

        return presets.map(selector => `
            <button class="dom-inspector-preset-btn" data-selector="${selector}">
                ${selector}
            </button>
        `).join('');
    }

    renderTreePlaceholder() {
        return `
            <div class="tree-placeholder">
                <div class="tree-placeholder-icon">🌲</div>
                <div class="tree-placeholder-text">Click "Refresh" to build DOM tree</div>
            </div>
        `;
    }

    renderDetailsContent() {
        if (!this.selectedElement) {
            return `
                <div class="details-placeholder">
                    <div class="details-placeholder-icon">👆</div>
                    <div class="details-placeholder-text">Select an element to inspect</div>
                </div>
            `;
        }

        return `
            <div class="details-sections">
                ${this.renderElementInfoSection()}
                ${this.renderBoxModelSection()}
                ${this.renderComputedStylesSection()}
                ${this.renderDesignTokensSection()}
                ${this.renderCSSRulesSection()}
            </div>
        `;
    }

    renderElementInfoSection() {
        if (!this.selectedElement) return '';

        const el = this.selectedElement;
        const tagName = el.tagName.toLowerCase();
        const id = el.id || '(none)';
        const classes = Array.from(el.classList).join(', ') || '(none)';
        const path = this.getElementPath(el);

        return `
            <div class="dom-inspector-section collapsed" data-section="element-info">
                <div class="dom-inspector-section-header">
                    <span class="dom-inspector-collapse-indicator">▶</span>
                    <h3>Element Info</h3>
                </div>
                <div class="dom-inspector-section-content">
                    <!-- DOM Hierarchy -->
                    <div class="element-hierarchy">
                        ${this.renderElementHierarchy(el)}
                    </div>

                    <!-- Element Details Table -->
                    <table class="dom-inspector-details-table">
                        <tr>
                            <td>Tag</td>
                            <td><code>${tagName}</code></td>
                        </tr>
                        <tr>
                            <td>ID</td>
                            <td><code>${id}</code></td>
                        </tr>
                        <tr>
                            <td>Classes</td>
                            <td><code>${classes}</code></td>
                        </tr>
                        <tr>
                            <td>Path</td>
                            <td><code class="element-path">${path}</code></td>
                        </tr>
                        <tr>
                            <td>Size</td>
                            <td>${Math.round(el.offsetWidth)} × ${Math.round(el.offsetHeight)}px</td>
                        </tr>
                        <tr>
                            <td>Position</td>
                            <td>${this.getComputedStyle(el, 'position')}</td>
                        </tr>
                        <tr>
                            <td>Z-Index</td>
                            <td>${this.getComputedStyle(el, 'z-index')}</td>
                        </tr>
                    </table>
                </div>
            </div>
        `;
    }

    renderElementHierarchy(element) {
        const ancestors = [];
        let current = element;
        const maxDepth = 10;

        while (current && ancestors.length < maxDepth) {
            ancestors.unshift(current);
            current = current.parentElement;
        }

        return ancestors.map((el, index) => {
            const isSelected = el === element;
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const classes = el.classList.length > 0
                ? '.' + Array.from(el.classList).slice(0, 2).join('.')
                : '';
            const indent = '  '.repeat(index);

            return `
                <div class="hierarchy-node ${isSelected ? 'selected' : ''}" data-element-id="${this.cacheElement(el)}">
                    <span class="hierarchy-indent">${indent}</span>
                    <span class="hierarchy-tag">&lt;${tag}</span>
                    <span class="hierarchy-attrs">${id}${classes}</span>
                    <span class="hierarchy-tag">&gt;</span>
                </div>
            `;
        }).join('');
    }

    renderBoxModelSection() {
        if (!this.selectedElement) return '';

        const el = this.selectedElement;
        const computed = window.getComputedStyle(el);

        const margin = {
            top: computed.marginTop,
            right: computed.marginRight,
            bottom: computed.marginBottom,
            left: computed.marginLeft
        };

        const padding = {
            top: computed.paddingTop,
            right: computed.paddingRight,
            bottom: computed.paddingBottom,
            left: computed.paddingLeft
        };

        const border = {
            top: computed.borderTopWidth,
            right: computed.borderRightWidth,
            bottom: computed.borderBottomWidth,
            left: computed.borderLeftWidth
        };

        const size = {
            width: el.offsetWidth,
            height: el.offsetHeight
        };

        return `
            <div class="dom-inspector-section" data-section="box-model">
                <div class="dom-inspector-section-header">
                    <span class="dom-inspector-collapse-indicator">▶</span>
                    <h3>Box Model</h3>
                </div>
                <div class="dom-inspector-section-content">
                    <div class="box-model-diagram">
                        <div class="box-margin">
                            <div class="box-label">margin</div>
                            <div class="box-values">
                                <span class="box-top">${margin.top}</span>
                                <span class="box-right">${margin.right}</span>
                                <span class="box-bottom">${margin.bottom}</span>
                                <span class="box-left">${margin.left}</span>
                            </div>
                            <div class="box-border">
                                <div class="box-label">border</div>
                                <div class="box-values">
                                    <span class="box-top">${border.top}</span>
                                    <span class="box-right">${border.right}</span>
                                    <span class="box-bottom">${border.bottom}</span>
                                    <span class="box-left">${border.left}</span>
                                </div>
                                <div class="box-padding">
                                    <div class="box-label">padding</div>
                                    <div class="box-values">
                                        <span class="box-top">${padding.top}</span>
                                        <span class="box-right">${padding.right}</span>
                                        <span class="box-bottom">${padding.bottom}</span>
                                        <span class="box-left">${padding.left}</span>
                                    </div>
                                    <div class="box-content">
                                        <div class="box-size">${size.width} × ${size.height}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderComputedStylesSection() {
        if (!this.selectedElement) return '';

        const computed = window.getComputedStyle(this.selectedElement);
        const importantProps = [
            'display', 'position', 'width', 'height',
            'margin', 'padding', 'border',
            'background-color', 'color',
            'font-family', 'font-size', 'font-weight',
            'flex-direction', 'justify-content', 'align-items',
            'grid-template-columns', 'gap',
            'z-index', 'opacity', 'transform'
        ];

        return `
            <div class="dom-inspector-section" data-section="computed-styles">
                <div class="dom-inspector-section-header">
                    <span class="dom-inspector-collapse-indicator">▶</span>
                    <h3>Computed Styles</h3>
                </div>
                <div class="dom-inspector-section-content">
                    <div class="styles-filter">
                        <input
                            type="text"
                            placeholder="Filter properties..."
                            class="styles-filter-input"
                            id="styles-filter-input"
                        />
                    </div>
                    <table class="dom-inspector-styles-table">
                        ${importantProps.map(prop => {
                            const value = computed.getPropertyValue(prop);
                            if (!value) return '';
                            return `
                                <tr>
                                    <td>${prop}</td>
                                    <td><code>${value}</code></td>
                                </tr>
                            `;
                        }).join('')}
                    </table>
                </div>
            </div>
        `;
    }

    renderDesignTokensSection() {
        if (!this.selectedElement || !this.detector) return '';

        const info = this.detector.getElementInfo(this.selectedElement);
        const tokens = info.designTokens;

        if (!tokens || Object.keys(tokens).length === 0) {
            return `
                <div class="dom-inspector-section" data-section="design-tokens">
                    <div class="dom-inspector-section-header">
                        <span class="dom-inspector-collapse-indicator">▶</span>
                        <h3>Design Tokens</h3>
                    </div>
                    <div class="dom-inspector-section-content">
                        <p class="no-tokens">No design tokens detected</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="dom-inspector-section" data-section="design-tokens">
                <div class="dom-inspector-section-header">
                    <span class="dom-inspector-collapse-indicator">▶</span>
                    <h3>Design Tokens</h3>
                </div>
                <div class="dom-inspector-section-content">
                    ${Object.entries(tokens).map(([category, values]) => {
                        if (Object.keys(values).length === 0) return '';
                        return `
                            <div class="token-category">
                                <h4>${category}</h4>
                                <table class="dom-inspector-styles-table">
                                    ${Object.entries(values).map(([name, value]) => `
                                        <tr>
                                            <td>${name}</td>
                                            <td><code>${value}</code></td>
                                        </tr>
                                    `).join('')}
                                </table>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    renderCSSRulesSection() {
        if (!this.selectedElement) return '';

        // Get matching CSS rules
        const rules = this.getMatchingCSSRules(this.selectedElement);

        return `
            <div class="dom-inspector-section" data-section="css-rules">
                <div class="dom-inspector-section-header">
                    <span class="dom-inspector-collapse-indicator">▶</span>
                    <h3>CSS Rules (${rules.length})</h3>
                </div>
                <div class="dom-inspector-section-content">
                    ${rules.length === 0 ? '<p class="no-rules">No CSS rules found</p>' : ''}
                    ${rules.map(rule => `
                        <div class="css-rule">
                            <div class="css-rule-selector">${rule.selectorText}</div>
                            <div class="css-rule-source">${rule.source}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);

        // Use this.element if container not provided (called from BasePanel.mount())
        this.container = container || this.element;

        // Initialize utilities
        this.initializeUtilities();

        // Get container references from the panel element
        const el = this.getContainer();
        this.treeContainer = el.querySelector('#tree-content');
        this.detailsContainer = el.querySelector('#details-container');
        this.splitter = el.querySelector('#splitter');
        this.highlightOverlay = el.querySelector('#highlight-overlay');

        // Attach event listeners
        this.attachEventListeners();

        // Build initial tree
        this.buildDOMTree();
    }

    initializeUtilities() {
        this.picker = window.APP?.utils?.elementPicker;
        this.boxModel = window.APP?.utils?.boxModelRenderer;
        this.detector = window.APP?.utils?.devPagesDetector;

        if (!this.picker || !this.boxModel || !this.detector) {
            console.warn('[DOMInspectorPanel] Some utilities not available yet');
            // Retry after delay
            setTimeout(() => this.initializeUtilities(), 500);
        }
    }

    attachEventListeners() {
        const container = this.getContainer();
        if (!container) return;

        // Picker button
        const pickerBtn = container.querySelector('#picker-btn');
        pickerBtn?.addEventListener('click', () => this.startPicker());

        // Selector input
        const selectorInput = container.querySelector('#selector-input');
        selectorInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.selectBySelector(selectorInput.value);
            }
        });

        // Quick selectors
        container.addEventListener('click', (e) => {
            const presetBtn = e.target.closest('.dom-inspector-preset-btn');
            if (presetBtn) {
                const selector = presetBtn.dataset.selector;
                selectorInput.value = selector;
                this.selectBySelector(selector);
            }
        });

        // Clear button
        const clearBtn = container.querySelector('#clear-btn');
        clearBtn?.addEventListener('click', () => this.clearSelection());

        // Highlight toggle
        const highlightToggle = container.querySelector('#highlight-toggle');
        highlightToggle?.addEventListener('click', () => this.cycleHighlightMode());

        // Tree controls
        container.querySelector('#expand-all-btn')?.addEventListener('click', () => this.expandAll());
        container.querySelector('#collapse-all-btn')?.addEventListener('click', () => this.collapseAll());
        container.querySelector('#refresh-tree-btn')?.addEventListener('click', () => this.buildDOMTree());

        // Section collapse/expand
        container.addEventListener('click', (e) => {
            const sectionHeader = e.target.closest('.dom-inspector-section-header');
            if (sectionHeader) {
                const section = sectionHeader.closest('.dom-inspector-section');
                section.classList.toggle('collapsed');
            }
        });

        // Splitter dragging
        this.setupSplitterDrag();

        // Tree node interaction
        this.treeContainer?.addEventListener('click', (e) => {
            const nodeHeader = e.target.closest('.dom-inspector-node-header');
            if (nodeHeader) {
                const node = nodeHeader.closest('.dom-inspector-node');
                const toggle = e.target.closest('.dom-inspector-node-toggle');

                if (toggle) {
                    this.toggleNode(node);
                } else {
                    const elementId = node.dataset.elementId;
                    const element = this.elementCache.get(elementId);
                    if (element) {
                        this.selectElement(element);
                    }
                }
            }
        });
    }

    setupSplitterDrag() {
        let isDragging = false;
        let startX = 0;
        let startSplitPosition = this.splitPosition;

        this.splitter?.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startSplitPosition = this.splitPosition;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const container = this.getContainer();
            const rect = container.getBoundingClientRect();
            const deltaX = e.clientX - startX;
            const deltaPercent = (deltaX / rect.width) * 100;

            this.splitPosition = Math.max(20, Math.min(80, startSplitPosition + deltaPercent));
            this.updateSplitLayout();
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    updateSplitLayout() {
        const container = this.getContainer();
        const treePanel = container.querySelector('#tree-container');
        const detailsPanel = container.querySelector('#details-container');

        if (treePanel) treePanel.style.width = `${this.splitPosition}%`;
        if (detailsPanel) detailsPanel.style.width = `${100 - this.splitPosition}%`;
    }

    buildDOMTree() {
        if (!this.treeContainer) return;

        console.log('[DOMInspectorPanel] Building DOM tree...');
        this.treeContainer.innerHTML = '';
        this.elementCache.clear();

        const rootElement = document.body;
        const rootNode = this.createTreeNode(rootElement);

        if (rootNode) {
            this.treeContainer.appendChild(rootNode);
        }
    }

    createTreeNode(element, depth = 0) {
        if (!element || !element.tagName) return null;
        if (depth > 15) return null; // Prevent infinite recursion

        // Skip DevPages panels to avoid recursion
        if (element.closest('.devpages-panel')) return null;

        const node = document.createElement('div');
        node.className = 'dom-inspector-node';

        const elementId = this.cacheElement(element);
        node.dataset.elementId = elementId;

        const header = document.createElement('div');
        header.className = 'dom-inspector-node-header';

        // Toggle button
        const toggle = document.createElement('span');
        toggle.className = 'dom-inspector-node-toggle';
        if (element.children.length > 0) {
            toggle.textContent = '▶';
        } else {
            toggle.style.visibility = 'hidden';
        }

        // Element name
        const name = document.createElement('span');
        name.className = 'dom-inspector-node-name';
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.classList.length > 0
            ? '.' + Array.from(element.classList).slice(0, 2).join('.')
            : '';
        name.textContent = `<${tag}${id}${classes}>`;

        header.appendChild(toggle);
        header.appendChild(name);
        node.appendChild(header);

        // Children container (hidden by default)
        if (element.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'dom-inspector-node-children';
            childrenContainer.style.display = 'none';

            for (const child of element.children) {
                const childNode = this.createTreeNode(child, depth + 1);
                if (childNode) {
                    childrenContainer.appendChild(childNode);
                }
            }

            node.appendChild(childrenContainer);
        }

        return node;
    }

    toggleNode(node) {
        node.classList.toggle('expanded');
        const isExpanded = node.classList.contains('expanded');

        const toggle = node.querySelector('.dom-inspector-node-toggle');
        const childrenContainer = node.querySelector('.dom-inspector-node-children');

        if (toggle) {
            toggle.textContent = isExpanded ? '▼' : '▶';
        }

        if (childrenContainer) {
            childrenContainer.style.display = isExpanded ? 'block' : 'none';
        }

        // Track expanded state
        const elementId = node.dataset.elementId;
        if (isExpanded) {
            this.expandedNodes.add(elementId);
        } else {
            this.expandedNodes.delete(elementId);
        }
    }

    expandAll() {
        const nodes = this.treeContainer?.querySelectorAll('.dom-inspector-node');
        nodes?.forEach(node => {
            if (!node.classList.contains('expanded')) {
                this.toggleNode(node);
            }
        });
    }

    collapseAll() {
        const nodes = this.treeContainer?.querySelectorAll('.dom-inspector-node.expanded');
        nodes?.forEach(node => {
            this.toggleNode(node);
        });
    }

    startPicker() {
        if (!this.picker) {
            console.error('[DOMInspectorPanel] Element picker not available');
            // Retry initialization
            this.initializeUtilities();

            // Try again after a brief delay
            setTimeout(() => {
                if (this.picker) {
                    this._startPickerImpl();
                } else {
                    alert('Element picker is not yet initialized. Please try again.');
                }
            }, 100);
            return;
        }

        this._startPickerImpl();
    }

    _startPickerImpl() {
        console.log('[DOMInspectorPanel] Starting element picker...');

        // Update button state
        const container = this.getContainer();
        const pickerBtn = container?.querySelector('#picker-btn');
        if (pickerBtn) {
            pickerBtn.textContent = 'Picking...';
            pickerBtn.style.opacity = '0.6';
            pickerBtn.disabled = true;
        }

        this.picker.start({
            onSelect: (element) => {
                console.log('[DOMInspectorPanel] Element picked:', element);
                this.selectElement(element);

                // Reset button state
                if (pickerBtn) {
                    pickerBtn.textContent = 'Select';
                    pickerBtn.style.opacity = '1';
                    pickerBtn.disabled = false;
                }
            },
            onCancel: () => {
                console.log('[DOMInspectorPanel] Picker cancelled');
                // Reset button state
                if (pickerBtn) {
                    pickerBtn.textContent = 'Select';
                    pickerBtn.style.opacity = '1';
                    pickerBtn.disabled = false;
                }
            },
            ignoreDevPanels: true
        });
    }

    selectBySelector(selector) {
        if (!selector) return;

        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                this.selectElement(elements[0]);
            } else {
                console.warn('[DOMInspectorPanel] No elements match selector:', selector);
            }
        } catch (error) {
            console.error('[DOMInspectorPanel] Invalid selector:', selector, error);
        }
    }

    selectElement(element) {
        if (!element) {
            console.warn('[DOMInspectorPanel] Cannot select null element');
            return;
        }

        this.selectedElement = element;

        console.log('[DOMInspectorPanel] Selecting element:', element.tagName, element.className, element.id);

        // Update selector input with a simple CSS selector
        this.updateSelectorInput(element);

        // Update tree selection and expand to show the element
        this.updateTreeSelection(element);

        // Update details panel
        this.updateDetailsPanel();

        // Update highlight
        this.updateHighlight(element);

        console.log('[DOMInspectorPanel] Element selected successfully');
    }

    /**
     * Generate a simple CSS selector for an element
     */
    generateSimpleSelector(element) {
        if (!element) return '';

        // If element has an ID, use that (most specific)
        if (element.id) {
            return `#${element.id}`;
        }

        // Build selector with tag and classes
        let selector = element.tagName.toLowerCase();

        // Add classes if present (limit to first 2 for simplicity)
        if (element.classList.length > 0) {
            const classes = Array.from(element.classList).slice(0, 2);
            selector += '.' + classes.join('.');
        }

        // If selector is too generic (like 'div'), add nth-child for specificity
        if (selector === 'div' || selector === 'span' || selector === 'p') {
            const parent = element.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children);
                const index = siblings.indexOf(element);
                if (index !== -1) {
                    selector += `:nth-child(${index + 1})`;
                }
            }
        }

        return selector;
    }

    /**
     * Update the CSS selector input field
     */
    updateSelectorInput(element) {
        const container = this.getContainer();
        const selectorInput = container?.querySelector('#selector-input');

        if (selectorInput && element) {
            const selector = this.generateSimpleSelector(element);
            selectorInput.value = selector;
            console.log('[DOMInspectorPanel] Updated selector input:', selector);
        }
    }

    updateTreeSelection(element) {
        const container = this.getContainer();

        if (!container || !element) {
            console.warn('[DOMInspectorPanel] Cannot update tree selection: missing container or element');
            return;
        }

        console.log('[DOMInspectorPanel] Updating tree selection for:', element.tagName, element.className, element.id);

        // Clear previous selection
        container.querySelectorAll('.dom-inspector-node-header.selected').forEach(header => {
            header.classList.remove('selected');
        });

        // First, try to find the element in the existing tree using cached ID
        let elementId = this.findCachedElementId(element);
        let node = elementId ? container.querySelector(`[data-element-id="${elementId}"]`) : null;

        // If not found in tree, try finding by matching the actual DOM element
        if (!node) {
            console.log('[DOMInspectorPanel] Element not found in cache, searching tree...');
            node = this.findTreeNodeByElement(element);
        }

        // If still not found, cache it and search once more
        if (!node) {
            console.log('[DOMInspectorPanel] Caching element and searching again...');
            elementId = this.cacheElement(element);
            node = container.querySelector(`[data-element-id="${elementId}"]`);
        }

        if (node) {
            const header = node.querySelector('.dom-inspector-node-header');

            if (header) {
                header.classList.add('selected');

                // Expand parents first so the element becomes visible
                this.expandParentsToNode(node);

                // Small delay to ensure DOM has updated after expansion
                setTimeout(() => {
                    header.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }, 100);

                console.log('[DOMInspectorPanel] Tree node selected and expanded');
            }
        } else {
            console.warn('[DOMInspectorPanel] Could not find tree node for element, tree may need to be expanded');
        }
    }

    /**
     * Find a tree node by searching for its corresponding DOM element
     * @param {HTMLElement} targetElement - The DOM element to find
     * @returns {HTMLElement|null} The tree node or null
     */
    findTreeNodeByElement(targetElement) {
        // Iterate through all tree nodes and check if their cached element matches
        const allNodes = this.treeContainer?.querySelectorAll('.dom-inspector-node');
        if (!allNodes) return null;

        for (const node of allNodes) {
            const elementId = node.dataset.elementId;
            const cachedElement = this.elementCache.get(elementId);
            if (cachedElement === targetElement) {
                return node;
            }
        }

        return null;
    }

    expandParentsToNode(node) {
        let current = node;

        while (current && !current.classList.contains('dom-inspector-tree')) {
            const parent = current.parentElement?.closest('.dom-inspector-node');
            if (parent && !parent.classList.contains('expanded')) {
                this.toggleNode(parent);
            }
            current = parent;
        }
    }

    updateDetailsPanel() {
        if (!this.detailsContainer) {
            console.warn('[DOMInspectorPanel] Details container not available');
            // Try to get the container again
            const el = this.getContainer();
            this.detailsContainer = el?.querySelector('#details-container');

            if (!this.detailsContainer) {
                console.error('[DOMInspectorPanel] Could not find details container');
                return;
            }
        }

        console.log('[DOMInspectorPanel] Updating details panel for:', this.selectedElement?.tagName);
        const content = this.renderDetailsContent();
        this.detailsContainer.innerHTML = content;
        console.log('[DOMInspectorPanel] Details panel updated successfully');
    }

    updateHighlight(element) {
        if (this.highlightMode === 'none' || !element) {
            this.hideHighlight();
            return;
        }

        const rect = element.getBoundingClientRect();
        const overlay = this.highlightOverlay;

        if (overlay) {
            overlay.style.display = 'block';
            overlay.style.top = `${rect.top + window.scrollY}px`;
            overlay.style.left = `${rect.left + window.scrollX}px`;
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height}px`;

            if (this.highlightMode === 'border') {
                overlay.style.border = '2px dashed var(--color-primary-500, #3b82f6)';
                overlay.style.background = 'transparent';
            } else if (this.highlightMode === 'both') {
                overlay.style.border = '2px dashed var(--color-primary-500, #3b82f6)';
                overlay.style.background = 'rgba(59, 130, 246, 0.1)';
            }
        }
    }

    hideHighlight() {
        if (this.highlightOverlay) {
            this.highlightOverlay.style.display = 'none';
        }
    }

    cycleHighlightMode() {
        const modes = ['none', 'border', 'both'];
        const currentIndex = modes.indexOf(this.highlightMode);
        this.highlightMode = modes[(currentIndex + 1) % modes.length];

        const btn = this.getContainer()?.querySelector('#highlight-toggle');
        if (btn) {
            btn.className = `dom-inspector-btn dom-inspector-highlight-toggle mode-${this.highlightMode}`;
            btn.title = `Highlight: ${this.highlightMode}`;
        }

        if (this.selectedElement) {
            this.updateHighlight(this.selectedElement);
        }
    }

    clearSelection() {
        this.selectedElement = null;
        this.hideHighlight();

        const container = this.getContainer();
        container.querySelectorAll('.dom-inspector-node-header.selected').forEach(header => {
            header.classList.remove('selected');
        });

        this.updateDetailsPanel();

        const selectorInput = container.querySelector('#selector-input');
        if (selectorInput) selectorInput.value = '';
    }

    cacheElement(element) {
        // Check if element is already cached
        for (const [id, cachedElement] of this.elementCache.entries()) {
            if (cachedElement === element) {
                return id;
            }
        }

        // Generate unique ID for new element
        const id = `el-${this.elementCache.size}`;
        this.elementCache.set(id, element);
        return id;
    }

    /**
     * Find the cached ID for an element (without creating a new one)
     */
    findCachedElementId(element) {
        for (const [id, cachedElement] of this.elementCache.entries()) {
            if (cachedElement === element) {
                return id;
            }
        }
        return null;
    }

    getElementPath(element) {
        const path = [];
        let current = element;

        while (current && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();

            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
            } else if (current.classList.length > 0) {
                selector += '.' + Array.from(current.classList).join('.');
            }

            // Add nth-child if needed for uniqueness
            const parent = current.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children);
                const index = siblings.indexOf(current);
                if (siblings.filter(s => s.tagName === current.tagName).length > 1) {
                    selector += `:nth-child(${index + 1})`;
                }
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    getComputedStyle(element, property) {
        return window.getComputedStyle(element).getPropertyValue(property);
    }

    getMatchingCSSRules(element) {
        const rules = [];
        const sheets = Array.from(document.styleSheets);

        sheets.forEach(sheet => {
            try {
                const cssRules = Array.from(sheet.cssRules || []);
                cssRules.forEach(rule => {
                    if (rule.selectorText && element.matches(rule.selectorText)) {
                        rules.push({
                            selectorText: rule.selectorText,
                            source: sheet.href || 'inline'
                        });
                    }
                });
            } catch (e) {
                // Cross-origin stylesheets will throw
            }
        });

        return rules;
    }

    getContainer() {
        // Return the panel body (where our content is rendered)
        return this.element?.querySelector('.panel-body') || this.element || this.container;
    }

    onDestroy() {
        this.hideHighlight();
        this.elementCache.clear();
        this.expandedNodes.clear();
        super.onDestroy();
    }
}

panelRegistry.registerType('dom-inspector', DOMInspectorPanel);

export function createDOMInspectorPanel(config = {}) {
    return new DOMInspectorPanel(config);
}
