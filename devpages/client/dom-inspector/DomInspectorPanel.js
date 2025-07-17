/**
 * client/dom-inspector/DomInspectorPanel.js
 * Refactored DOM Inspector Panel using modular architecture
 */

// Import core components
import { panelRegistry } from "/client/panels/panelRegistry.js";
import { eventBus } from "/client/eventBus.js";
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

// Import UI components
import { BoxModelComponent } from './components/BoxModelComponent.js';
import { ComputedStylesComponent } from './components/ComputedStylesComponent.js';
import { IframeAnalyzer } from './components/IframeAnalyzer.js';
import { SectionManager } from './components/SectionManager.js';
import { BreadcrumbManager } from './components/BreadcrumbManager.js';
import { ElementDetailsRenderer } from './components/ElementDetailsRenderer.js';
import { HistoryManager } from './components/HistoryManager.js';
import { HighlightManager } from './components/HighlightManager.js';
import { UIUtilities } from './components/UIUtilities.js';

export class DomInspectorPanel {
    constructor() {
        if (DomInspectorPanel.instance) {
            return DomInspectorPanel.instance;
        }
        DomInspectorPanel.instance = this;

        // Initialize state manager first (but don't initialize yet)
        this.stateManager = new StateManager();
        console.log('[GENERAL] StateManager created, will initialize after components are ready');
        
        // Initialize PanelUI with callbacks (will get initial state later)
        this.panelUI = new PanelUI({
            initialSplitPosition: 33, // Default value, will be updated later
            onPositionChange: (position) => this.stateManager.setPosition(position),
            onSizeChange: (size) => this.stateManager.setSize(size),
            onSplitChange: (splitPosition) => this.stateManager.setSplitPosition(splitPosition),
            onClose: () => this.hide(),
            onSettings: () => {
                // Use a safe method that waits for settings panel to be ready
                if (this.settingsPanel && typeof this.settingsPanel.toggle === 'function') {
                    this.settingsPanel.toggle();
                } else {
                    // Defer until settings panel is ready
                    setTimeout(() => this.handleSettingsClick(), 100);
                }
            },
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
        
        // Initialize UI components
        this.boxModelComponent = new BoxModelComponent();
        this.computedStylesComponent = new ComputedStylesComponent();
        this.iframeAnalyzer = new IframeAnalyzer();
        this.sectionManager = new SectionManager();
        this.breadcrumbManager = new BreadcrumbManager();
        this.elementDetailsRenderer = new ElementDetailsRenderer();
        this.historyManager = new HistoryManager(this.stateManager);
        this.highlightManager = new HighlightManager(this.stateManager);
        
        // Add drag and drop styles
        SectionManager.addDragDropStyles();
        
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
        this.treeBuilt = false; // Track if tree has been built
        
        // NOW initialize StateManager after components are ready
        console.log('[GENERAL] All required components created, initializing StateManager...');
        this.setupStateListeners();
        this.stateManager.initialize();
        console.log('[GENERAL] StateManager initialized');
        
        // Get initial state after state manager is initialized
        const initialState = this.stateManager.getState();
        
        // Set initial state from StateManager with safety checks
        if (initialState.position && typeof initialState.position.x === 'number' && typeof initialState.position.y === 'number') {
            this.panelUI.setPosition(initialState.position);
        } else {
            console.warn('[DomInspectorPanel] Invalid position in initial state:', initialState.position);
        }
        
        if (initialState.size && typeof initialState.size.width === 'number' && typeof initialState.size.height === 'number') {
            this.panelUI.setSize(initialState.size);
        } else {
            console.warn('[DomInspectorPanel] Invalid size in initial state:', initialState.size);
        }
        
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

        // Setup component callbacks
        this.breadcrumbManager.setCallbacks({
            onBreadcrumbClick: (index) => {
                const targetElement = this.breadcrumbManager.navigateToBreadcrumbElement(index);
                if (targetElement) {
                    this.currentElement = targetElement;
                    this.selectedElement = targetElement;
                    this.highlightOverlay.highlight(targetElement);
                    this.updateElementDetailsOnly(targetElement);
                    this.updateTreeSelection(targetElement);
                    this.expandTreeToElement(targetElement);
                }
            },
            onNavigate: (element, index) => {
                // Already handled in onBreadcrumbClick
            }
        });

        this.setupEventHandlers();
        this.panelUI.registerWithZIndexManager();
        
        // Create settings panel
        this.settingsPanel = new DomInspectorSettingsPanel(this);

        // DON'T BUILD TREE UNTIL PANEL IS OPENED
        // Tree will be built on-demand when user opens the panel
        console.log('DOM Inspector: Tree building deferred until panel is opened');

        // Initialize component UI elements
        this.historyManager.setUIElements(this.historyContainer, this.querySelectorInput);
        this.historyManager.setOnPresetClick((selector) => this.selectElementByQuery(selector));
        this.highlightManager.setUIElements(this.highlightToggleButton);
        
        // Initialize history buttons
        this.historyManager.updateHistoryButtons();
        
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
                // Build tree on first visibility change if not already built
                if (!this.treeBuilt) {
                    console.log('[GENERAL] Building tree on visibility change...');
                    this.buildTree();
                    this.treeBuilt = true;
                }
                this.panelUI.show();
            } else {
                console.log('[GENERAL] State listener: calling PanelUI.hide()');
                this.panelUI.hide();
            }
        });

        this.stateManager.on('positionChanged', (position) => {
            if (position && typeof position.x === 'number' && typeof position.y === 'number') {
                this.panelUI.setPosition(position);
            } else {
                console.warn('[DomInspectorPanel] Invalid position received in positionChanged event:', position);
            }
        });

        this.stateManager.on('sizeChanged', (size) => {
            if (size && typeof size.width === 'number' && typeof size.height === 'number') {
                this.panelUI.setSize(size);
            } else {
                console.warn('[DomInspectorPanel] Invalid size received in sizeChanged event:', size);
            }
        });

        this.stateManager.on('highlightChanged', (highlight) => {
            this.highlightOverlay.updateSettings(highlight);
            this.highlightManager.updateHighlightButtonVisuals();
        });

        this.stateManager.on('historyChanged', () => {
            this.historyManager.updateHistoryButtons();
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

        // Highlight toggle button events are handled by HighlightManager
    }

    render(state) {
        if (!this.panel) return;

        // Update panel visibility and position through PanelUI
        if (state.visible) {
            this.panelUI.show();
        } else {
            this.panelUI.hide();
        }

        // Don't build tree here - it will be built when panel is opened
        // this.buildTree();
        
        // Don't try to select element from state since we no longer store DOM elements there
        // Element selection is handled through the selectedElementChanged event listener
        if (!this.currentElement) {
            this.renderEmptyDetails();
        }
    }

    show() {
        console.log('[GENERAL] DomInspectorPanel.show() called');
        
        // Build tree only when panel is opened
        if (!this.treeBuilt) {
            console.log('[GENERAL] Building tree on first open...');
            this.buildTree();
            this.treeBuilt = true;
        }
        
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
        
        // Ensure callbacks are properly defined before building
        const callbacks = {
            onElementClick: (element) => {
                console.log('DOM Inspector: Tree node clicked, element:', element);
                this.selectElement(element);
            },
            onToggleNode: (node) => {
                console.log('DOM Inspector: Tree node toggle clicked, node:', node);
                this.treeManager.toggleNode(node);
            }
        };
        
        // Use tree manager to build the tree with proper callbacks
        this.treeManager.buildTree(callbacks);
        
        // Ensure the tree is properly initialized immediately
        // Verify tree event handlers are working
        const firstToggle = this.treeContainer.querySelector('.dom-inspector-node-toggle');
        const firstHeader = this.treeContainer.querySelector('.dom-inspector-node-header');
        
        if (firstToggle) {
            console.log('DOM Inspector: Tree toggle buttons are ready');
        }
        if (firstHeader) {
            console.log('DOM Inspector: Tree headers are ready');
        }
        
        // If we have a current element, make sure it's visible and selected in the tree
        if (this.currentElement) {
            this.updateTreeSelection(this.currentElement);
            this.expandTreeToElement(this.currentElement);
        }
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
        
        // Clear previous content first
        this.detailsContainer.innerHTML = '';
        
        // Add breadcrumbs at the very top (non-draggable, always fixed)
        const breadcrumbTrail = this.breadcrumbManager.createEnhancedBreadcrumbTrail(element);
        breadcrumbTrail.style.cssText = `
            position: sticky;
            top: 0;
            background: white;
            border-bottom: 1px solid #e1e4e8;
            padding: 8px 0;
            margin-bottom: 8px;
            z-index: 10;
        `;
        this.detailsContainer.appendChild(breadcrumbTrail);
        
        // Collect all sections
        const sectionsData = [];
        
        // Create element details section
        const elementDetailsContent = this.elementDetailsRenderer.createElementDetailsContent(element);
        sectionsData.push({
            id: 'element-details',
            section: this.sectionManager.createCollapsibleSection('element-details', 'Element Details', elementDetailsContent)
        });
        
        // Create box model section
        const boxModelContent = this.boxModelComponent.createBoxModel(window.getComputedStyle(element));
        sectionsData.push({
            id: 'box-model',
            section: this.sectionManager.createCollapsibleSection('box-model', 'Box Model', boxModelContent)
        });
        
        // Create computed styles section
        const computedStylesContent = this.computedStylesComponent.createComputedStyles(element);
        sectionsData.push({
            id: 'computed-styles',
            section: this.sectionManager.createCollapsibleSection('computed-styles', 'Computed Styles', computedStylesContent)
        });
        
        // If the element is an iframe, add iframe deep dive section
        if (element.tagName === 'IFRAME') {
            // Add iframe deep dive section
            const deepDiveContent = this.iframeAnalyzer.createIframeDeepDiveContent(element);
            sectionsData.push({
                id: 'iframe-deep-dive',
                section: this.sectionManager.createCollapsibleSection('iframe-deep-dive', 'Iframe Deep Dive', deepDiveContent)
            });
        }
        
        // Create events section
        const eventsContent = this.elementDetailsRenderer.createEventsContent(element);
        sectionsData.push({
            id: 'events',
            section: this.sectionManager.createCollapsibleSection('events', 'Events', eventsContent)
        });
        
        // Create layout engine section
        const engineContent = this.elementDetailsRenderer.createEngineContent(element);
        sectionsData.push({
            id: 'layout-engine',
            section: this.sectionManager.createCollapsibleSection('layout-engine', 'Layout Engine', engineContent)
        });
        
        // Render sections in order using SectionManager (breadcrumbs will be preserved)
        this.sectionManager.renderSections(this.detailsContainer, sectionsData);
    }

    /**
     * Update element details without rebuilding breadcrumbs (for breadcrumb navigation)
     */
    updateElementDetailsOnly(element) {
        if (!this.detailsContainer || !element) return;

        console.log('DOM Inspector: Updating element details only (no breadcrumb rebuild)');
        
        // Breadcrumbs should already exist and be preserved by SectionManager
        // Just collect and render the sections with new content
        
        // Collect all sections
        const sectionsData = [];
        
        // Create element details section
        const elementDetailsContent = this.elementDetailsRenderer.createElementDetailsContent(element);
        sectionsData.push({
            id: 'element-details',
            section: this.sectionManager.createCollapsibleSection('element-details', 'Element Details', elementDetailsContent)
        });
        
        // Create box model section
        const boxModelContent = this.boxModelComponent.createBoxModel(window.getComputedStyle(element));
        sectionsData.push({
            id: 'box-model',
            section: this.sectionManager.createCollapsibleSection('box-model', 'Box Model', boxModelContent)
        });
        
        // Create computed styles section
        const computedStylesContent = this.computedStylesComponent.createComputedStyles(element);
        sectionsData.push({
            id: 'computed-styles',
            section: this.sectionManager.createCollapsibleSection('computed-styles', 'Computed Styles', computedStylesContent)
        });
        
        // If the element is an iframe, add iframe deep dive section
        if (element.tagName === 'IFRAME') {
            const deepDiveContent = this.iframeAnalyzer.createIframeDeepDiveContent(element);
            sectionsData.push({
                id: 'iframe-deep-dive',
                section: this.sectionManager.createCollapsibleSection('iframe-deep-dive', 'Iframe Deep Dive', deepDiveContent)
            });
        }
        
        // Create events section
        const eventsContent = this.elementDetailsRenderer.createEventsContent(element);
        sectionsData.push({
            id: 'events',
            section: this.sectionManager.createCollapsibleSection('events', 'Events', eventsContent)
        });
        
        // Create layout engine section
        const engineContent = this.elementDetailsRenderer.createEngineContent(element);
        sectionsData.push({
            id: 'layout-engine',
            section: this.sectionManager.createCollapsibleSection('layout-engine', 'Layout Engine', engineContent)
        });
        
        // Render sections in order using SectionManager (breadcrumbs will be preserved)
        this.sectionManager.renderSections(this.detailsContainer, sectionsData);
    }

    /**
     * Render empty details when no element is selected
     */
    renderEmptyDetails() {
        UIUtilities.renderEmptyDetails(this.detailsContainer);
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
                    <p><strong>Query:</strong> <code>${UIUtilities.escapeHTML(query)}</code></p>
                    <p><strong>Error:</strong> ${UIUtilities.escapeHTML(error)}</p>
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
        this.updateTreeSelection(null);
        
        // Clear the query input and remove from history
        if (this.querySelectorInput && this.querySelectorInput.value.trim()) {
            const currentSelector = this.querySelectorInput.value.trim();
            this.querySelectorInput.value = ''; // Clear the input
            
            // Remove from history/presets
            this.historyManager.removePreset(currentSelector);
            console.log('DOM Inspector: Cleared selection and removed from history:', currentSelector);
        } else {
            // Just clear the input if it has content
            if (this.querySelectorInput) {
                this.querySelectorInput.value = '';
            }
        }
    }

    addToHistory(selector) {
        this.historyManager.addToHistory(selector);
    }

    savePreset(selector) {
        this.historyManager.savePreset(selector);
    }

    removePreset(selector) {
        this.historyManager.removePreset(selector);
    }

    

    // ===== ANNOTATION METHODS =====
    
    updateAnnotationSettings(settings) {
        this.annotationManager.updateSettings(settings);
        
        // Preserve tree state before rebuilding
        this.treeManager.preserveTreeState();
        
        // Rebuild tree to show new annotations
        this.buildTree();
        
        // Restore tree state after rebuilding
        setTimeout(() => {
            this.treeManager.restoreTreeState();
        }, 50); // Small delay to ensure DOM is updated
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
     * Handle settings button click
     */
    handleSettingsClick() {
        if (this.settingsPanel && typeof this.settingsPanel.toggle === 'function') {
            this.settingsPanel.toggle();
        } else {
            console.warn('DOM Inspector: Settings panel not yet initialized');
        }
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
        this.sectionManager = null;
        
        // Clean up new components
        this.breadcrumbManager = null;
        this.elementDetailsRenderer = null;
        this.historyManager = null;
        this.highlightManager = null;
        
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

        // Remove previous selection
        const previouslySelected = this.treeContainer.querySelector('.dom-inspector-node-header.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }
        
        if (!element) return;

        // Ensure the element is visible in the tree by expanding parent nodes
        this.expandTreeToElement(element);

        const tryToSelect = () => {
            const targetNode = this.findTreeNodeForElement(element);
            if (targetNode) {
                const header = targetNode.querySelector('.dom-inspector-node-header');
                if (header) {
                    header.classList.add('selected');
                    // Use 'auto' for behavior to make it instant. 'smooth' can feel slow.
                    // 'nearest' prevents large scrolls.
                    header.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                    return true;
                }
            }
            return false;
        };

        // Try to select immediately. If it fails, try again on the next animation frame.
        if (!tryToSelect()) {
            requestAnimationFrame(() => {
                if (!tryToSelect()) {
                    console.error('DOM Inspector: Failed to select node after rAF retry for element:', element);
                }
            });
        }
    }

    /**
     * Get display name for breadcrumb
     */
    getElementDisplayName(element) {
        return UIUtilities.getElementDisplayName(element);
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
} 