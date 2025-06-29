/**
 * client/dom-inspector/DomInspectorPanel.js
 * Refactored DOM Inspector Panel using modular architecture
 */

// Import core components
import { StateManager } from "./core/StateManager.js";
import { PanelUI } from "./core/PanelUI.js";
import { HighlightOverlay } from "./interaction/HighlightOverlay.js";
import { ElementPicker } from "./interaction/ElementPicker.js";
import { DomInspectorSettingsPanel } from "./DomInspectorSettingsPanel.js";

// Import new modular managers and components
import { ElementManager } from './managers/ElementManager.js';
import { TreeManager } from './managers/TreeManager.js';
import { AnnotationManager } from './managers/AnnotationManager.js';
import { SelectorManager } from './managers/SelectorManager.js';
import { IframeDetailsManager } from './IframeDetailsManager.js';

export class DomInspectorPanel {
    constructor() {
        if (DomInspectorPanel.instance) {
            return DomInspectorPanel.instance;
        }
        DomInspectorPanel.instance = this;

        // Initialize state manager first
        this.stateManager = new StateManager();
        console.log('[GENERAL] StateManager created, initializing...');
        this.stateManager.initialize();
        console.log('[GENERAL] StateManager initialized');
        
        // Get initial state after state manager is initialized
        const initialState = this.stateManager.getState();
        
        // Initialize PanelUI with callbacks
        this.panelUI = new PanelUI({
            initialSplitPosition: initialState.splitPosition || 33,
            onPositionChange: (position) => this.stateManager.setPosition(position),
            onSizeChange: (size) => this.stateManager.setSize(size),
            onSplitChange: (splitPosition) => this.stateManager.setSplitPosition(splitPosition),
            onClose: () => this.hide(),
            onSettings: () => this.settingsPanel.toggle(),
            onBringToFront: (zIndex) => {
                console.log(`DOM Inspector brought to front: z-index ${zIndex}`);
            }
        });
        
        // Initialize new modular managers
        this.elementManager = new ElementManager();
        this.annotationManager = new AnnotationManager();
        this.treeManager = new TreeManager(this.elementManager, this.annotationManager);
        this.selectorManager = new SelectorManager();
        this.iframeDetailsManager = new IframeDetailsManager(this);
        
        // Get UI element references from PanelUI
        const uiElements = this.panelUI.getElements();
        this.panel = uiElements.panel;
        this.treeContainer = uiElements.treeContainer;
        this.detailsContainer = uiElements.detailsContainer;
        this.querySelectorInput = uiElements.querySelectorInput;
        this.elementPickerButton = uiElements.elementPickerButton;
        this.saveButton = uiElements.saveButton;
        this.clearButton = uiElements.clearButton;
        this.highlightToggleButton = uiElements.highlightToggleButton;
        this.historyContainer = uiElements.historyContainer;
        this.closeButton = uiElements.closeButton;
        this.settingsButton = uiElements.settingsButton;
        this.breadcrumbContainer = uiElements.breadcrumbContainer;
        
        // Set tree container for tree manager
        this.treeManager.setTreeContainer(this.treeContainer);
        
        // Current state
        this.currentElement = null;
        this.selectedElement = null; // Keep for backward compatibility
        
        // Set initial state from StateManager
        this.panelUI.setPosition(initialState.position);
        this.panelUI.setSize(initialState.size);
        this.panelUI.setSplitPosition(initialState.splitPosition || 33);
        
        // Initialize highlight overlay with current settings
        this.highlightOverlay = new HighlightOverlay(initialState.highlight);
        
        // Initialize element picker with callbacks
        this.elementPicker = new ElementPicker({
            onHighlight: (element) => {
                if (element) {
                    this.highlightOverlay.highlight(element);
                } else {
                    this.highlightOverlay.hide();
                }
            },
            onSelect: (element) => this.selectElement(element),
            excludeSelectors: ['.dom-inspector-panel', '.dom-inspector-panel *']
        });

        // Annotation settings for z-index and stacking context display
        this.annotationSettings = {
            showZIndex: true,
            showStackingContext: true,
            showLayoutEngine: true,
            highlightStackingContexts: false,
            colorScheme: 'default'
        };

        // History and breadcrumb tracking
        this.currentBreadcrumbTrail = null;
        this.activeBreadcrumbIndex = -1;

        this.setupEventHandlers();
        this.setupStateListeners();
        this.panelUI.registerWithZIndexManager();
        
        // Create settings panel
        this.settingsPanel = new DomInspectorSettingsPanel(this);

        // BUILD TREE IMMEDIATELY DURING INITIALIZATION
        this.buildTree();

        // Initialize highlight button visuals after UI is created
        this.updateHighlightButtonVisuals();
        
        // Initialize history buttons
        this.updateHistoryButtons();
        
        this.render(initialState);
    }

    setPanelContainer(container) {
        if (container && this.panel.parentNode !== container) {
            container.appendChild(this.panel);
        }
    }

    setupStateListeners() {
        // Listen to specific state changes through the StateManager
        this.stateManager.on('visibilityChanged', (visible) => {
            console.log('[GENERAL] State listener: visibilityChanged =', visible);
            if (visible) {
                console.log('[GENERAL] State listener: calling PanelUI.show()');
                this.panelUI.show();
            } else {
                console.log('[GENERAL] State listener: calling PanelUI.hide()');
                this.panelUI.hide();
            }
        });

        this.stateManager.on('positionChanged', (position) => {
            this.panelUI.setPosition(position);
        });

        this.stateManager.on('sizeChanged', (size) => {
            this.panelUI.setSize(size);
        });

        this.stateManager.on('highlightChanged', (highlight) => {
            this.highlightOverlay.updateSettings(highlight);
            this.updateHighlightButtonVisuals();
        });

        this.stateManager.on('historyChanged', () => {
            this.updateHistoryButtons();
        });

        this.stateManager.on('sectionsChanged', () => {
            this.updateCollapsibleSections();
        });

        this.stateManager.on('splitPositionChanged', (splitPosition) => {
            this.panelUI.setSplitPosition(splitPosition);
        });

        // Listen for element selection changes
        this.stateManager.on('selectedElementChanged', (element) => {
            this.handleElementSelection(element);
        });
    }

    setupEventHandlers() {
        // Query input handling
        if (this.querySelectorInput) {
            this.querySelectorInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const query = this.querySelectorInput.value.trim();
                    if (query) {
                        this.selectElementByQuery(query);
                    }
                }
            });
        }

        // Element picker button
        if (this.elementPickerButton) {
            this.elementPickerButton.addEventListener('click', () => {
                this.elementPicker.toggle();
            });
        }

        // Clear button
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                this.clearSelection();
            });
        }

        // Save button
        if (this.saveButton) {
            this.saveButton.addEventListener('click', () => {
                if (this.querySelectorInput && this.querySelectorInput.value.trim()) {
                    this.savePreset(this.querySelectorInput.value.trim());
                }
            });
        }

        // Highlight toggle button
        this.setupHighlightButtonEvents();
    }

    render(state) {
        if (!this.panel) return;

        // Update panel visibility and position through PanelUI
        if (state.visible) {
            this.panelUI.show();
        } else {
            this.panelUI.hide();
        }

        // Build tree 
        this.buildTree();
        
        // Don't try to select element from state since we no longer store DOM elements there
        // Element selection is handled through the selectedElementChanged event listener
        if (!this.currentElement) {
            this.renderEmptyDetails();
        }
    }

    show() {
        console.log('[GENERAL] DomInspectorPanel.show() called');
        this.stateManager.setVisible(true);
    }

    hide() {
        console.log('[GENERAL] DomInspectorPanel.hide() called');
        this.stateManager.setVisible(false);
    }

    toggle() {
        console.log('[GENERAL] DomInspectorPanel.toggle() called');
        const currentState = this.stateManager.getState();
        if (currentState.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Build the complete DOM tree
     */
    buildTree() {
        if (!this.treeContainer) return;
        
        console.log('DOM Inspector: Building tree with refactored tree manager');
        
        // Use tree manager to build the tree with proper callbacks
        this.treeManager.buildTree({
            onElementClick: (element) => {
                console.log('DOM Inspector: Tree node clicked, element:', element);
                this.selectElement(element);
            },
            onToggleNode: (node) => {
                this.treeManager.toggleNode(node);
            }
        });
    }

    /**
     * Find tree node for element
     */
    findTreeNodeForElement(element) {
        return this.treeManager.findTreeNodeForElement(element);
    }

    /**
     * Expand tree to show the selected element
     */
    expandTreeToElement(element) {
        if (!element) return;
        
        console.log('DOM Inspector: Expanding tree to element:', element);
        
        // Use TreeManager's expandTreeToElement method
        this.treeManager.expandTreeToElement(element);
    }

    /**
     * Handle element selection from state manager
     */
    handleElementSelection(element) {
        if (element === this.currentElement) {
            return;
        }

        this.currentElement = element;
        this.selectedElement = element;

        if (element) {
            this.highlightOverlay.highlight(element);
            this.updateBreadcrumbs(element);
            this.renderElementDetails(element);
            this.updateTreeSelection(element);
            this.expandTreeToElement(element);
        } else {
            this.clearSelection();
        }
    }

    /**
     * Render element details
     */
    renderElementDetails(element) {
        if (!this.detailsContainer || !element) return;

        console.log('DOM Inspector: Rendering element details with UI components');
        
        // Clear previous content
        this.detailsContainer.innerHTML = '';
        
        // Add breadcrumbs at the very top as a header
        if (element) {
            const breadcrumbTrail = this.createEnhancedBreadcrumbTrail(element);
            this.detailsContainer.appendChild(breadcrumbTrail);
        }

        // If the element is an iframe, show special details
        if (element.tagName === 'IFRAME') {
            const iframeDetails = this.iframeDetailsManager.createIframeDetailsSection(element);
            this.detailsContainer.appendChild(iframeDetails);
        }
        
        // DON'T create the ugly element summary - breadcrumbs are enough!
        
        // Create computed styles section with a working filter
        this.createComputedStylesSection(element);
        
        // Create box model section
        this.createBoxModelSection(element);
        
        // Create element details section
        this.createElementDetailsSection(element);
        
        // Create events section
        const eventsSection = this.createEventsSection(element);
        this.detailsContainer.appendChild(eventsSection);
        
        // Create layout engine section
        const engineSection = this.createEngineSection(element);
        this.detailsContainer.appendChild(engineSection);
        
        // Update collapsible sections
        this.updateCollapsibleSections(this.detailsContainer);
    }

    /**
     * Create computed styles section with a working filter
     */
    createComputedStylesSection(element) {
        const computedStyles = window.getComputedStyle(element);
        const sectionContent = document.createElement('div');
        
        const tableContainer = document.createElement('div');
        
        const updateTable = (filterGroup) => {
            tableContainer.innerHTML = '';
            const newTable = this.createStylesTable(computedStyles, filterGroup);
            tableContainer.appendChild(newTable);
        };

        const filterControls = this.createFilterControls(updateTable);
        sectionContent.appendChild(filterControls);
        sectionContent.appendChild(tableContainer);
        
        // Initial render with 'all'
        updateTable('all');

        const section = this.createCollapsibleSection('computed-styles', 'Computed Styles', sectionContent);
        this.detailsContainer.appendChild(section);
    }

    /**
     * Create filter controls for computed styles
     */
    createFilterControls(onFilterChange) {
        const controls = document.createElement('div');
        controls.className = 'dom-inspector-filter-controls';
        
        const select = document.createElement('select');
        const styleGroups = {
            Layout: ['display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'flex', 'grid', 'float', 'clear', 'overflow', 'width', 'height', 'box-sizing'],
            Typography: ['font', 'color', 'text-align', 'text-decoration', 'letter-spacing', 'word-spacing', 'white-space', 'line-height'],
            Spacing: ['margin', 'padding', 'border'],
            Background: ['background', 'opacity'],
        };

        select.innerHTML = `
            <option value="all">All Properties</option>
            ${Object.keys(styleGroups).map(group => `<option value="${group}">${group}</option>`).join('')}
        `;
        
        select.addEventListener('change', (e) => onFilterChange(e.target.value));
        controls.appendChild(select);
        
        return controls;
    }

    /**
     * Create styles table with filtering
     */
    createStylesTable(computedStyles, filterGroup) {
        const table = document.createElement('table');
        table.className = 'dom-inspector-styles-table';
        const tbody = table.createTBody();

        const allProperties = Array.from(computedStyles);
        let propertiesToShow = allProperties;

        const styleGroups = {
            Layout: ['display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'flex', 'grid', 'float', 'clear', 'overflow', 'width', 'height', 'box-sizing'],
            Typography: ['font', 'color', 'text-align', 'text-decoration', 'letter-spacing', 'word-spacing', 'white-space', 'line-height'],
            Spacing: ['margin', 'padding', 'border'],
            Background: ['background', 'opacity'],
        };

        if (filterGroup && filterGroup !== 'all') {
            const groupProps = styleGroups[filterGroup];
            if (groupProps) {
                propertiesToShow = allProperties.filter(prop => 
                    groupProps.some(gp => prop === gp || prop.startsWith(gp + '-'))
                );
            }
        }
        
        propertiesToShow.forEach(property => {
            const value = computedStyles.getPropertyValue(property);
            if (value && value !== 'none' && value !== 'normal' && value !== 'auto' && value !== '0px') {
                const row = tbody.insertRow();
                row.insertCell().textContent = property;
                row.insertCell().textContent = value;
            }
        });

        if (tbody.rows.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 2;
            cell.textContent = 'No matching styles in this group.';
            cell.style.textAlign = 'center';
            cell.style.padding = '10px';
        }

        return table;
    }

    /**
     * Create box model section
     */
    createBoxModelSection(element) {
        const computedStyles = window.getComputedStyle(element);
        const content = this.createBoxModel(computedStyles);
        
        const section = this.createCollapsibleSection('box-model', 'Box Model', content);
        this.detailsContainer.appendChild(section);
    }

    /**
     * Create element details section
     */
    createElementDetailsSection(element) {
        const details = [
            ['Tag Name', element.tagName.toLowerCase()],
            ['Node Type', element.nodeType],
            ['ID', element.id || 'None'],
            ['Classes', element.className || 'None'],
            ['Children', element.children.length]
        ];
        
        if (element.textContent && element.textContent.trim()) {
            const preview = element.textContent.trim().substring(0, 100);
            details.push(['Text Content', preview + (element.textContent.length > 100 ? '...' : '')]);
        }
        
        const content = this.createDetailsTable(details);
        const section = this.createCollapsibleSection('element-details', 'Element Details', content);
        this.detailsContainer.appendChild(section);
    }

    /**
     * Update breadcrumbs
     */
    updateBreadcrumbs(element) {
        if (!this.breadcrumbContainer) return;
        
        console.log('DOM Inspector: Updating breadcrumbs');
        
        // Clear previous breadcrumbs
        this.breadcrumbContainer.innerHTML = '';
        
        if (!element) return;
        
        // Create enhanced breadcrumb trail using the original working method
        const breadcrumbTrail = this.createEnhancedBreadcrumbTrail(element);
        this.breadcrumbContainer.appendChild(breadcrumbTrail);
    }

    /**
     * Create enhanced breadcrumb trail (restored from working version)
     */
    createEnhancedBreadcrumbTrail(element) {
        const container = document.createElement('div');
        container.className = 'enhanced-breadcrumb-trail';

        if (!element) return container;

        const trail = [];
        let current = element;
        while (current && current.tagName?.toLowerCase() !== 'html') {
            trail.unshift(current);
            current = current.parentElement;
        }
        if (current && current.tagName?.toLowerCase() === 'html') {
            trail.unshift(current);
        }

        this.currentBreadcrumbTrail = trail;
        this.activeBreadcrumbIndex = trail.length - 1;

        for (let i = 0; i < this.currentBreadcrumbTrail.length; i++) {
            const el = this.currentBreadcrumbTrail[i];
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'breadcrumb-link';
            link.textContent = this.getElementDisplayName(el);
            link.classList.toggle('active', i === this.activeBreadcrumbIndex);

            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToBreadcrumbElement(i);
            });
            
            container.appendChild(link);
        }

        return container;
    }

    /**
     * Create element identifier for breadcrumbs (ID and classes)
     */
    createElementIdentifier(element) {
        let identifier = '';
        
        if (element.id) {
            identifier += `#${element.id}`;
        }
        
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                // Show first 2 classes, indicate if there are more
                const displayClasses = classes.slice(0, 2);
                identifier += `.${displayClasses.join('.')}`;
                if (classes.length > 2) {
                    identifier += ` (+${classes.length - 2})`;
                }
            }
        } else if (element.className && element.className.toString) {
            // Handle DOMTokenList case
            const classes = element.className.toString().split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                const displayClasses = classes.slice(0, 2);
                identifier += `.${displayClasses.join('.')}`;
                if (classes.length > 2) {
                    identifier += ` (+${classes.length - 2})`;
                }
            }
        }
        
        return identifier;
    }

    /**
     * Navigate to a breadcrumb element. This selects the element and updates views,
     * but does NOT rebuild the breadcrumb trail itself.
     */
    navigateToBreadcrumbElement(index) {
        if (this.currentBreadcrumbTrail && this.currentBreadcrumbTrail[index]) {
            const targetElement = this.currentBreadcrumbTrail[index];
            if (targetElement === this.currentElement) return;

            // Direct element selection without going through state manager to avoid breadcrumb rebuilding
            this.currentElement = targetElement;
            this.selectedElement = targetElement;
            
            // Update only what's necessary without rebuilding breadcrumbs
            this.highlightOverlay.highlight(targetElement);
            this.updateActiveBreadcrumb(targetElement);
            // Update details without rebuilding breadcrumbs
            this.updateElementDetailsOnly(targetElement);
            this.updateTreeSelection(targetElement);
            this.expandTreeToElement(targetElement);
            
            // Update the query input
            if (this.querySelectorInput) {
                const cssSelector = this.generateCSSSelector(targetElement);
                this.querySelectorInput.value = cssSelector;
            }
        }
    }

    /**
     * Update element details without rebuilding breadcrumbs (for breadcrumb navigation)
     */
    updateElementDetailsOnly(element) {
        if (!this.detailsContainer || !element) return;

        console.log('DOM Inspector: Updating element details only (no breadcrumb rebuild)');
        
        // Find existing breadcrumb trail and preserve it
        const existingBreadcrumbs = this.detailsContainer.querySelector('.enhanced-breadcrumb-trail');
        
        // Clear previous content
        this.detailsContainer.innerHTML = '';
        
        // Restore the existing breadcrumbs if they exist
        if (existingBreadcrumbs) {
            this.detailsContainer.appendChild(existingBreadcrumbs);
        }

        // If the element is an iframe, show special details
        if (element.tagName === 'IFRAME') {
            const iframeDetails = this.iframeDetailsManager.createIframeDetailsSection(element);
            this.detailsContainer.appendChild(iframeDetails);
        }
        
        // Create computed styles section with a working filter
        this.createComputedStylesSection(element);
        
        // Create box model section
        this.createBoxModelSection(element);
        
        // Create element details section
        this.createElementDetailsSection(element);
        
        // Create events section
        const eventsSection = this.createEventsSection(element);
        this.detailsContainer.appendChild(eventsSection);
        
        // Create layout engine section
        const engineSection = this.createEngineSection(element);
        this.detailsContainer.appendChild(engineSection);
        
        // Update collapsible sections
        this.updateCollapsibleSections(this.detailsContainer);
    }

    /**
     * Render empty details when no element is selected
     */
    renderEmptyDetails() {
        if (!this.detailsContainer) return;
        
        this.detailsContainer.innerHTML = `
            <div class="dom-inspector-empty-state">
                <h3>No Element Selected</h3>
                <p>Click on an element in the tree or use the selector input to inspect an element.</p>
            </div>
        `;
    }

    /**
     * Test a CSS selector
     */
    selectElementByQuery(query) {
        console.log('DOM Inspector: Testing selector with selector manager:', query);
        
        const result = this.selectorManager.testSelector(query);
        
        if (result.success) {
            this.selectElement(result.element);
            this.addToHistory(query);
        } else {
            this.handleSelectorError(result.query, result.error);
        }
        
        return result;
    }

    /**
     * Handle selector errors
     */
    handleSelectorError(query, error) {
        console.error('DOM Inspector: Selector error:', error);
        
        // Create error information
        const errorInfo = this.selectorManager.createSelectorError(query, { message: error });
        
        // Display error in details panel
        if (this.detailsContainer) {
            this.detailsContainer.innerHTML = `
                <div class="dom-inspector-error">
                    <h4>Selector Error</h4>
                    <p><strong>Query:</strong> <code>${this.escapeHTML(query)}</code></p>
                    <p><strong>Error:</strong> ${this.escapeHTML(error)}</p>
                    ${errorInfo.suggestions.map(suggestion => 
                        `<p><strong>Suggestion:</strong> ${suggestion.description}</p>`
                    ).join('')}
                </div>
            `;
        }
    }

    /**
     * Generate CSS selector for current element
     */
    generateCSSSelector(element) {
        if (!element) element = this.currentElement;
        if (!element) return '';
        
        return this.selectorManager.generateCSSSelector(element);
    }

    /**
     * Get current selected element
     */
    getSelectedElement() {
        return this.currentElement;
    }

    // ===== BACKWARD COMPATIBILITY METHODS =====
    
    clearSelection() {
        // Clear the visual selection
        this.highlightOverlay.hide();
        this.currentElement = null;
        this.selectedElement = null;
        this.renderEmptyDetails();
        this.updateBreadcrumbs(null);
        this.updateTreeSelection(null);
        
        // Clear the query input and remove from history
        if (this.querySelectorInput && this.querySelectorInput.value.trim()) {
            const currentSelector = this.querySelectorInput.value.trim();
            this.querySelectorInput.value = ''; // Clear the input
            
            // Remove from history/presets
            this.removePreset(currentSelector);
            console.log('DOM Inspector: Cleared selection and removed from history:', currentSelector);
        } else {
            // Just clear the input if it has content
            if (this.querySelectorInput) {
                this.querySelectorInput.value = '';
            }
        }
    }

    addToHistory(selector) {
        if (selector) {
            this.stateManager.addToHistory(selector);
        }
    }

    savePreset(selector) {
        if (!selector) return;
        this.stateManager.addToHistory(selector);
        this.updateHistoryButtons(); // Update the UI after saving
        console.log('DOM Inspector: Saved preset:', selector);
    }

    removePreset(selector) {
        if (!selector) return;
        this.stateManager.removeFromHistory(selector);
        this.updateHistoryButtons(); // Update the UI after removing
        console.log('DOM Inspector: Removed preset:', selector);
    }

    updateHistoryButtons() {
        if (!this.historyContainer) return;
        
        // Clear existing buttons
        this.historyContainer.innerHTML = '';
        
        // Get current history from state
        const history = this.stateManager.getSelectorHistory();
        console.log('DOM Inspector: Updating history buttons, history:', history);
        
        // Create buttons for each history item
        history.forEach(selector => {
            const button = document.createElement('button');
            button.textContent = this.abbreviateSelector(selector);
            button.className = 'dom-inspector-preset-btn';
            button.title = `Click to use preset: ${selector}`;
            button.dataset.fullSelector = selector;
            
            // Click handler to load the preset
            button.addEventListener('click', () => {
                this.querySelectorInput.value = selector;
                this.selectElementByQuery(selector);
            });
            
            this.historyContainer.appendChild(button);
        });
    }

    /**
     * Abbreviate selector for display in buttons
     */
    abbreviateSelector(selector, maxLength = 30) {
        if (selector.length <= maxLength) return selector;
        
        // Try to keep the most important parts
        const parts = selector.split(' ');
        if (parts.length === 1) {
            // Single selector, truncate in middle
            const start = selector.substring(0, Math.floor(maxLength / 2) - 2);
            const end = selector.substring(selector.length - Math.floor(maxLength / 2) + 2);
            return `${start}...${end}`;
        }
        
        // Multiple parts, try to keep first and last meaningful parts
        if (parts.length > 2) {
            const abbreviated = `${parts[0]} ... ${parts[parts.length - 1]}`;
            if (abbreviated.length <= maxLength) return abbreviated;
        }
        
        // Fallback to simple truncation
        return selector.substring(0, maxLength - 3) + '...';
    }

    updateCollapsibleSections() {
        // Collapsible functionality is now built into createCollapsibleSection
        // This method is kept for backward compatibility but does nothing
    }

    updateHighlightButtonVisuals() {
        if (!this.highlightToggleButton) return;
        
        const state = this.stateManager.getState();
        const highlight = state.highlight;
        
        // Update button appearance based on mode
        this.highlightToggleButton.classList.remove('active', 'mode-border', 'mode-shade', 'mode-both', 'mode-none');
        
        if (highlight.enabled && highlight.mode !== 'none') {
            this.highlightToggleButton.classList.add('active');
            this.highlightToggleButton.classList.add(`mode-${highlight.mode}`);
            this.highlightToggleButton.style.backgroundColor = highlight.color;
        } else {
            this.highlightToggleButton.style.backgroundColor = '';
            this.highlightToggleButton.classList.add('mode-none');
        }
        
        // Update button text to show current mode
        const modeText = highlight.mode.charAt(0).toUpperCase() + highlight.mode.slice(1);
        this.highlightToggleButton.title = `Highlight Mode: ${modeText} (click to cycle)`;
        
        console.log('DOM Inspector: Updated highlight button for mode:', highlight.mode);
    }

    setupHighlightButtonEvents() {
        if (!this.highlightToggleButton) return;
        
        this.highlightToggleButton.addEventListener('click', () => {
            this.toggleHighlightMode();
        });
    }

    toggleHighlightMode() {
        const state = this.stateManager.getState();
        const currentMode = state.highlight.mode;
        
        // Cycle through the 4 highlight modes: border -> shade -> both -> none -> border
        let nextMode;
        switch (currentMode) {
            case 'border':
                nextMode = 'shade';
                break;
            case 'shade':
                nextMode = 'both';
                break;
            case 'both':
                nextMode = 'none';
                break;
            case 'none':
            default:
                nextMode = 'border';
                break;
        }
        
        console.log('DOM Inspector: Cycling highlight mode from', currentMode, 'to', nextMode);
        
        this.stateManager.setHighlight({
            ...state.highlight,
            mode: nextMode,
            enabled: nextMode !== 'none' // Enable if not 'none'
        });
    }

    // ===== ANNOTATION METHODS =====
    
    updateAnnotationSettings(settings) {
        this.annotationManager.updateSettings(settings);
        this.buildTree(); // Rebuild tree to show new annotations
    }

    getElementAnnotations(element) {
        return this.annotationManager.getElementAnnotations(element);
    }

    // ===== ELEMENT CACHE METHODS (for backward compatibility) =====
    
    cacheElement(element) {
        return this.elementManager.cacheElement(element);
    }

    getElementFromCache(id) {
        return this.elementManager.getElementFromCache(id);
    }

    generateElementId(element) {
        return this.elementManager.generateElementId(element);
    }

    /**
     * Clean up resources
     */
    destroy() {
        console.log('DOM Inspector: Destroying refactored panel');
        
        // Clean up managers
        this.elementManager?.destroy();
        this.treeManager?.destroy();
        this.annotationManager?.destroy();
        this.selectorManager?.destroy();
        this.iframeDetailsManager = null;
        // uiComponents removed
        // breadcrumbManager removed
        
        // Clean up other components
        this.highlightOverlay?.destroy();
        this.elementPicker?.destroy();
        this.settingsPanel?.destroy();
        this.panelUI?.destroy();
        this.stateManager?.destroy();
        
        // Clear references
        this.currentElement = null;
        this.selectedElement = null;
        this.treeContainer = null;
        this.detailsContainer = null;
        this.breadcrumbContainer = null;
        this.querySelectorInput = null;
    }

    /**
     * Select an element and update all views
     */
    selectElement(element) {
        console.log(`[GENERAL] Selecting element:`, element);
        console.log('DOM Inspector: Element tag:', element?.tagName);
        console.log('DOM Inspector: Element id:', element?.id);
        console.log('DOM Inspector: Element classes:', element?.className);
        
        // Generate and populate CSS selector in the input
        if (element && this.querySelectorInput) {
            console.log('DOM Inspector: Query input element:', this.querySelectorInput);
            console.log('DOM Inspector: SelectorManager:', this.selectorManager);
            
            const cssSelector = this.generateCSSSelector(element);
            console.log('DOM Inspector: Generated CSS selector:', cssSelector);
            
            this.querySelectorInput.value = cssSelector;
            console.log('DOM Inspector: Query input value after setting:', this.querySelectorInput.value);
        } else {
            console.warn('DOM Inspector: Missing element or query input:', { element, querySelectorInput: this.querySelectorInput });
        }
        
        // Update state manager
        this.stateManager.setSelectedElement(element);
    }

    /**
     * Update tree selection visual state
     */
    updateTreeSelection(element) {
        if (!this.treeContainer) return;
        
        console.log('DOM Inspector: updateTreeSelection called with element:', element);
        
        // Remove previous selection
        const allNodes = this.treeContainer.querySelectorAll('.dom-inspector-node-header');
        allNodes.forEach(node => {
            node.classList.remove('selected');
        });
        console.log('DOM Inspector: Cleared previous tree selection from', allNodes.length, 'nodes');
        
        // If no element, just clear selection and return
        if (!element) return;
        
        // Find and select new element
        const targetNode = this.findTreeNodeForElement(element);
        console.log('DOM Inspector: Found tree node for element:', targetNode);
        
        if (targetNode) {
            const header = targetNode.querySelector('.dom-inspector-node-header');
            console.log('DOM Inspector: Found header in tree node:', header);
            
            if (header) {
                header.classList.add('selected');
                header.scrollIntoView({ block: 'center', behavior: 'smooth' });
                console.log('DOM Inspector: Successfully selected tree node and scrolled to it');
            } else {
                console.warn('DOM Inspector: Tree node found but no header element');
            }
        } else {
            console.warn('DOM Inspector: Could not find tree node for element:', element);
            console.warn('DOM Inspector: Element tag:', element.tagName);
            console.warn('DOM Inspector: Element classes:', element.className);
            console.warn('DOM Inspector: Element id:', element.id);
        }
    }

    /**
     * Get display name for breadcrumb
     */
    getElementDisplayName(element) {
        let name = element.tagName.toLowerCase();
        
        // Use the same identifier system as the enhanced breadcrumbs
        const identifier = this.createElementIdentifier(element);
        if (identifier) {
            name += identifier;
        }
        
        return name;
    }

    /**
     * Updates the active state of the breadcrumb trail without rebuilding it.
     */
    updateActiveBreadcrumb(newActiveElement) {
        if (!this.breadcrumbContainer) return;
        const newIndex = this.currentBreadcrumbTrail.indexOf(newActiveElement);
        if (newIndex === -1) return;

        this.activeBreadcrumbIndex = newIndex;

        const links = this.breadcrumbContainer.querySelectorAll('.breadcrumb-link');
        links.forEach((link, i) => {
            link.classList.toggle('active', i === this.activeBreadcrumbIndex);
        });
    }

    /**
     * Handle element hover - ALL FUNCTIONALITY REMOVED
     */
    handleElementHover(element) {
        // All on-hover functionality has been removed.
    }

    /**
     * Handle element leave - ALL FUNCTIONALITY REMOVED
     */
    handleElementLeave(element) {
        // All on-hover functionality has been removed.
    }

    // ===== UI COMPONENT METHODS (previously in UIComponents) =====
    
    createEventsSection(element) {
        const content = document.createElement('div');
        content.innerHTML = '<p>Event listeners would be shown here.</p>';
        return this.createCollapsibleSection('events', 'Events', content);
    }
    
    createEngineSection(element) {
        const content = document.createElement('div');
        content.innerHTML = '<p>Layout engine information would be shown here.</p>';
        return this.createCollapsibleSection('layout-engine', 'Layout Engine', content);
    }
    
    createCollapsibleSection(id, title, content) {
        const section = document.createElement('div');
        section.className = 'dom-inspector-section';
        section.dataset.sectionId = id;
        
        const header = document.createElement('h4');
        header.className = 'dom-inspector-section-header';
        
        const arrow = document.createElement('span');
        arrow.className = 'dom-inspector-section-arrow';
        arrow.textContent = '▼';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'dom-inspector-section-title';
        titleSpan.textContent = title;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'dom-inspector-section-content';
        contentDiv.appendChild(content);
        
        // Add click handler for collapsing
        header.addEventListener('click', () => {
            const isCollapsed = section.classList.contains('collapsed');
            section.classList.toggle('collapsed');
            arrow.textContent = isCollapsed ? '▼' : '▶';
        });
        
        header.appendChild(arrow);
        header.appendChild(titleSpan);
        section.appendChild(header);
        section.appendChild(contentDiv);
        
        return section;
    }
    
    createBoxModel(computedStyles) {
        const container = document.createElement('div');
        container.className = 'dom-inspector-box-model';

        const content = document.createElement('div');
        content.className = 'box-model-content';
        content.textContent = `${computedStyles.width} x ${computedStyles.height}`;

        const padding = document.createElement('div');
        padding.className = 'box-model-padding';
        padding.title = `Padding: ${computedStyles.padding}`;

        const border = document.createElement('div');
        border.className = 'box-model-border';
        border.title = `Border: ${computedStyles.border}`;

        const margin = document.createElement('div');
        margin.className = 'box-model-margin';
        margin.title = `Margin: ${computedStyles.margin}`;
        
        padding.appendChild(content);
        border.appendChild(padding);
        margin.appendChild(border);
        
        container.appendChild(margin);

        return container;
    }
    
    createDetailsTable(details) {
        const table = document.createElement('table');
        table.className = 'dom-inspector-details-table';
        
        details.forEach(([key, value]) => {
            const row = table.insertRow();
            row.insertCell().textContent = key;
            row.insertCell().textContent = value;
        });
        
        return table;
    }
    
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
} 