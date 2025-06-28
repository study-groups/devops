/**
 * client/dom-inspector/DomInspectorPanel.js
 * Draggable, resizable DOM inspector panel - Main orchestrator class.
 */

import { appStore } from "/client/appState.js";
import { dispatch, ActionTypes } from "/client/messaging/messageQueue.js";
import { ValidationUtils } from "./utils/ValidationUtils.js";
import { SelectorUtils } from "./utils/SelectorUtils.js";
import { DomUtils } from "./utils/DomUtils.js";
import { DomInspectorSettingsPanel } from "./DomInspectorSettingsPanel.js";

// Import new modular components
import { HighlightOverlay } from "./interaction/HighlightOverlay.js";
import { ElementPicker } from "./interaction/ElementPicker.js";
import { StateManager } from "./core/StateManager.js";
import { PanelUI } from "./core/PanelUI.js";

const STYLE_CATEGORIES = {
    Layout: [
        'display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear', 'z-index', 'overflow', 'resize',
        'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'margin', 'padding', 'border', 'border-width',
        'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows', 'grid-auto-flow', 'gap',
        'justify-content', 'align-items', 'justify-items', 'align-content', 'flex', 'flex-flow', 'flex-direction', 'flex-wrap'
    ],
    Typography: [
        'color', 'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
        'text-align', 'text-decoration', 'text-transform', 'text-shadow', 'letter-spacing', 'word-spacing',
        'white-space', 'vertical-align'
    ],
    Background: [
        'background', 'background-color', 'background-image', 'background-repeat', 'background-position',
        'background-size', 'background-attachment', 'background-clip', 'background-origin'
    ],
    Borders: [
        'border', 'border-width', 'border-style', 'border-color', 'border-radius',
        'border-top', 'border-right', 'border-bottom', 'border-left',
        'border-image', 'border-image-source', 'border-image-slice', 'border-image-width', 'border-image-outset', 'border-image-repeat',
        'outline', 'outline-width', 'outline-style', 'outline-color', 'outline-offset'
    ],
    Other: [
        'box-shadow', 'opacity', 'visibility', 'cursor', 'transition', 'transform', 'animation', 'filter'
    ]
};

export class DomInspectorPanel {
    constructor() {
        // Element tracking
        this.selectedElement = null;
        this.elementCache = new Map();
        this.nextCacheId = 0;
        this.elementIdCounter = 0;

        // Initialize new modular components
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
                // Optional callback for when panel is brought to front
                console.log(`DOM Inspector brought to front: z-index ${zIndex}`);
            }
        });
        
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
            showComputedZIndex: false,
            showZIndexLayer: true,
            annotationMode: 'compact',
            showBreadcrumbAnnotations: true
        };

        // Tree state for preserving expanded nodes
        this.treeState = {
            expandedNodes: new Set(), // Store element IDs of expanded nodes
            selectedElementId: null
        };

        // Breadcrumb navigation
        this.currentBreadcrumbTrail = null;
        this.activeBreadcrumbIndex = -1;

        this.setupEventHandlers();
        this.setupStateListeners();
        this.panelUI.registerWithZIndexManager();
        
        // Create settings panel
        this.settingsPanel = new DomInspectorSettingsPanel(this);

        // Load tree state from app state
        this.loadTreeStateFromAppState();

        // BUILD TREE IMMEDIATELY DURING INITIALIZATION
        // This ensures the tree is ready whether the panel is shown or not
        this.buildTree();

        // Initialize highlight button visuals after UI is created
        this.updateHighlightButtonVisuals();
        
        // Update history buttons after UI is created
        this.updateHistoryButtons();
        
        this.render(initialState);
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
    }

    render(state) {
        if (!this.panel) return;

        // Update panel visibility and position through PanelUI
        if (state.visible) {
            this.panelUI.show();
        } else {
            this.panelUI.hide();
        }
        
        this.panelUI.setPosition(state.position);
        this.panelUI.setSize(state.size);
        this.panelUI.setSplitPosition(state.splitPosition || 33);
        
        // Update highlight overlay settings
        this.highlightOverlay.updateSettings(state.highlight);
        this.updateHighlightButtonVisuals();
        
        this.updateHistoryButtons();

        if(this.selectedElement) {
            this.displayElementDetails(this.selectedElement);
        }
    }

    setupEventHandlers() {
        // Note: PanelUI handles its own close and settings button events through callbacks

        this.querySelectorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.selectElementByQuery(e.target.value);
            }
        });

        this.elementPickerButton.addEventListener('click', () => {
            this.elementPicker.toggle();
            // Update button visual state
            this.elementPickerButton.classList.toggle('active', this.elementPicker.isPickerActive());
        });

        this.saveButton.addEventListener('click', () => {
            const selector = this.querySelectorInput.value.trim();
            if (selector) {
                this.savePreset(selector);
            }
        });

        this.clearButton.addEventListener('click', () => {
            const selector = this.querySelectorInput.value.trim();
            if (selector) {
                // Check if selector exists in history before attempting to remove
                const history = this.stateManager.getSelectorHistory();
                
                if (history.includes(selector)) {
                    // Remove from presets and clear input
                    this.removePreset(selector);
                    this.querySelectorInput.value = '';
                    this.clearSelection();
                } else {
                    // Just clear the input and selection if not in presets
                    this.querySelectorInput.value = '';
                    this.clearSelection();
                }
            } else {
                // If no text, clear the input and selection
                this.querySelectorInput.value = '';
                this.clearSelection();
            }
        });

        this.treeContainer.addEventListener('click', (e) => {
            const nodeHeader = e.target.closest('.dom-inspector-node-header');
            if (nodeHeader) {
                const node = nodeHeader.parentElement;
                const element = this.getElementFromCache(node.dataset.elementId);
                
                // Handle toggle button clicks first
                if (e.target.classList.contains('dom-inspector-node-toggle')) {
                    this.toggleNode(node);
                    return; // Don't select element when clicking toggle
                }
                
                if (element) {
                    // Shift+click highlights the element in the page
                    if (e.shiftKey) {
                        this.highlightOverlay.highlight(element);
                        // Flash the highlight to make it more visible
                        this.highlightOverlay.flash();
                        console.log('DOM Inspector: Shift+click - highlighting element in page');
                    } else {
                        // Normal click selects the element
                        this.selectElement(element);
                    }
                }
            }
        });

        // Note: PanelUI handles all drag, resize, and bring-to-front functionality

        this.setupHighlightButtonEvents();

        // Add keyboard shortcut for deep selection of interactive elements
        document.addEventListener('keydown', (e) => {
            if (this.isPickerActive && e.key === 'Shift') {
                this.deepSelectMode = true;
                this.elementPickerButton.textContent = 'Deep Select';
                this.elementPickerButton.title = 'Deep Select mode - will select any element including interactive ones';
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (this.isPickerActive && e.key === 'Shift') {
                this.deepSelectMode = false;
                this.elementPickerButton.textContent = 'Select';
                this.elementPickerButton.title = 'Click to select element by pointing';
            }
        });
    }

    show() {
        console.log('[GENERAL] DOM Inspector show() called');
        this.stateManager.setVisible(true);
        // Always build tree when showing to ensure it's populated
        this.buildTree();
    }

    hide() {
        console.log('[GENERAL] DOM Inspector hide() called');
        this.stateManager.setVisible(false);
        if (this.elementPicker.isPickerActive()) {
            this.elementPicker.deactivate();
        }
    }
    
    toggle() {
        const currentVisibility = this.stateManager.isVisible();
        console.log('[GENERAL] DOM Inspector toggle() - current visibility:', currentVisibility);
        
        // Use the state manager for consistency
        if (currentVisibility) {
            console.log('[GENERAL] DOM Inspector is visible, calling hide()');
            this.hide();
        } else {
            console.log('[GENERAL] DOM Inspector is hidden, calling show()');
            this.show();
        }
    }
    
    savePreset(selector) {
        if (!selector) return;
        this.stateManager.addSelectorToHistory(selector);
    }

    removePreset(selector) {
        if (!selector) return;
        this.stateManager.removeSelectorFromHistory(selector);
        console.log('DOM Inspector: Removed preset:', selector);
    }

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

    showDeleteConfirmation(selector, button) {
        // Remove any existing popup
        const existingPopup = document.querySelector('.dom-inspector-delete-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        const popup = document.createElement('div');
        popup.className = 'dom-inspector-delete-popup';
        
        const content = document.createElement('div');
        content.className = 'dom-inspector-delete-content';
        
        const title = document.createElement('div');
        title.className = 'dom-inspector-delete-title';
        title.textContent = 'Delete Preset?';
        
        const message = document.createElement('div');
        message.className = 'dom-inspector-delete-message';
        message.innerHTML = `Delete selector: <code>${this.abbreviateSelector(selector, 50)}</code>`;
        
        const buttons = document.createElement('div');
        buttons.className = 'dom-inspector-delete-buttons';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'dom-inspector-btn dom-inspector-delete-confirm';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'dom-inspector-btn dom-inspector-delete-cancel';
        
        buttons.appendChild(deleteBtn);
        buttons.appendChild(cancelBtn);
        
        content.appendChild(title);
        content.appendChild(message);
        content.appendChild(buttons);
        popup.appendChild(content);
        
        // Position popup near the button
        const rect = button.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 5}px`;
        popup.style.zIndex = '99999';
        
        document.body.appendChild(popup);
        
        // Event handlers
        deleteBtn.addEventListener('click', () => {
            this.removePreset(selector);
            popup.remove();
        });
        
        cancelBtn.addEventListener('click', () => {
            popup.remove();
        });
        
        // Close on click outside
        const closeOnClickOutside = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closeOnClickOutside);
            }
        };
        setTimeout(() => document.addEventListener('click', closeOnClickOutside), 100);
        
        // Close on escape
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') {
                popup.remove();
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
    }

    updateHistoryButtons() {
        this.historyContainer.innerHTML = '';
        const history = this.stateManager.getSelectorHistory();

        history.forEach(selector => {
            const button = document.createElement('button');
            button.textContent = this.abbreviateSelector(selector);
            button.className = 'dom-inspector-preset-btn';
            button.title = `Click to use preset: ${selector}\nLong press to delete`;
            button.dataset.fullSelector = selector; // Store full selector for reference
            
            let longPressTimer = null;
            let isLongPress = false;
            
            // Regular click handler
            button.addEventListener('click', (e) => {
                if (!isLongPress) {
                    // Check if selector exists in history before attempting to remove
                    const history = this.stateManager.getSelectorHistory();
                    
                    if (history.includes(selector)) {
                        // Populate the query input with the full selector
                        this.querySelectorInput.value = selector;
                        this.selectElementByQuery(selector);
                    }
                }
                isLongPress = false;
            });
            
            // Long press handlers
            button.addEventListener('mousedown', (e) => {
                isLongPress = false;
                button.classList.add('long-pressing');
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    button.classList.remove('long-pressing');
                    this.showDeleteConfirmation(selector, button);
                }, 600); // 600ms for long press
            });
            
            button.addEventListener('mouseup', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                button.classList.remove('long-pressing');
            });
            
            button.addEventListener('mouseleave', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                button.classList.remove('long-pressing');
                isLongPress = false;
            });
            
            // Touch support for mobile
            button.addEventListener('touchstart', (e) => {
                isLongPress = false;
                button.classList.add('long-pressing');
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    button.classList.remove('long-pressing');
                    this.showDeleteConfirmation(selector, button);
                    e.preventDefault(); // Prevent context menu
                }, 600);
            });
            
            button.addEventListener('touchend', (e) => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                button.classList.remove('long-pressing');
                if (!isLongPress) {
                    // Normal tap
                    this.querySelectorInput.value = selector;
                    this.selectElementByQuery(selector);
                }
                isLongPress = false;
            });
            
            this.historyContainer.appendChild(button);
        });
    }

    addToHistory(selector) {
        this.savePreset(selector);
    }

    clearSelection() {
        // Clear any selected element in the tree
        const currentlySelected = this.treeContainer.querySelector('.selected');
        if (currentlySelected) {
            currentlySelected.classList.remove('selected');
        }
        
        // Clear the details panel
        this.detailsContainer.innerHTML = '';
        
        // Hide highlight instead of removing overlay
        this.highlightOverlay.hide();
        
        // Clear selected element reference
        this.selectedElement = null;
    }

    createCollapsibleSection(id, titleContent, contentEl) {
        const container = document.createElement('div');
        container.className = 'dom-inspector-section';
        container.dataset.sectionId = id; // Store section ID for later reference

        const header = document.createElement('div');
        header.className = 'dom-inspector-section-header';
        
        const indicator = document.createElement('span');
        indicator.className = 'dom-inspector-collapse-indicator';
        header.appendChild(indicator);
        
        if (typeof titleContent === 'string') {
            const titleEl = document.createElement('span');
            titleEl.textContent = titleContent;
            header.appendChild(titleEl);
        } else {
            header.appendChild(titleContent);
        }

        contentEl.className = 'dom-inspector-section-content';
        container.appendChild(header);
        container.appendChild(contentEl);

        const collapsedSections = this.stateManager.getCollapsedSections();
        const isCollapsed = collapsedSections[id] || false; // Default to expanded

        contentEl.style.display = isCollapsed ? 'none' : 'block';
        indicator.textContent = isCollapsed ? '▶' : '▼';
        if (isCollapsed) container.classList.add('collapsed');

        header.addEventListener('click', () => {
            const willBeCollapsed = !container.classList.contains('collapsed');
            this.stateManager.setSectionCollapsed(id, willBeCollapsed);
            
            // Immediate UI update (optimistic update)
            contentEl.style.display = willBeCollapsed ? 'none' : 'block';
            indicator.textContent = willBeCollapsed ? '▶' : '▼';
            container.classList.toggle('collapsed', willBeCollapsed);
        });

        return container;
    }

    updateCollapsibleSections() {
        // Update all collapsible sections based on current state
        const collapsedSections = this.stateManager.getCollapsedSections();
        const sections = this.detailsContainer.querySelectorAll('.dom-inspector-section');
        
        sections.forEach(section => {
            const sectionId = section.dataset.sectionId;
            if (sectionId && collapsedSections.hasOwnProperty(sectionId)) {
                const isCollapsed = collapsedSections[sectionId];
                const indicator = section.querySelector('.dom-inspector-collapse-indicator');
                const content = section.querySelector('.dom-inspector-section-content');
                
                if (indicator && content) {
                    content.style.display = isCollapsed ? 'none' : 'block';
                    indicator.textContent = isCollapsed ? '▶' : '▼';
                    section.classList.toggle('collapsed', isCollapsed);
                }
            }
        });
    }

    displayElementDetails(element) {
        this.detailsContainer.innerHTML = '';
        this.selectedElement = element;
        this.highlightOverlay.highlight(element);

        // Enhanced breadcrumb trail at the very top
        this.detailsContainer.appendChild(this.createEnhancedBreadcrumbTrail(element));
        
        // Add new content
        this.detailsContainer.appendChild(this.createElementSpecificDetails(element));

        const computedStyles = window.getComputedStyle(element);
        const computedStylesContent = this.createComputedStylesContent(element);
        const computedStylesSection = this.createCollapsibleSection('computed-styles', 'Computed Styles', computedStylesContent);
        
        const boxModelContainer = this.createBoxModel(computedStyles);
        const boxModelSection = this.createCollapsibleSection('box-model', 'Box Model', boxModelContainer);

        this.detailsContainer.appendChild(computedStylesSection);
        this.detailsContainer.appendChild(boxModelSection);
        this.detailsContainer.appendChild(this.renderEventsSection(element));
        this.detailsContainer.appendChild(this.renderEngineSection(element));
    }

    createElementSpecificDetails(element) {
        const content = document.createElement('div');
        content.className = 'element-details-container';
    
        // --- Row 1: Info ---
        const infoRow = document.createElement('div');
        infoRow.className = 'details-info-row';
    
        const inspectorId = element.dataset.domInspectorId || this.generateElementId(element);
        const childrenCount = element.children.length;
        const parentCount = this.currentBreadcrumbTrail ? this.currentBreadcrumbTrail.length - 1 : 0;
    
        infoRow.innerHTML = `
            <div class="info-item">
                <span class="info-label">Inspector ID</span>
                <span class="info-value">${inspectorId}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Parents</span>
                <span class="info-value">${parentCount}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Children</span>
                <span class="info-value">${childrenCount}</span>
            </div>
        `;
        content.appendChild(infoRow);
    
        // --- Row 2: Status ---
        const badges = this.getElementStatusBadges(element);
        if (badges.length > 0) {
            const statusRow = document.createElement('div');
            statusRow.className = 'details-status-row';
            statusRow.innerHTML = badges.map(badge => `<span class="status-badge">${this.escapeHTML(badge)}</span>`).join('');
            content.appendChild(statusRow);
        }
        
        // --- Row 3: HTML View ---
        const htmlView = document.createElement('div');
        htmlView.className = 'details-html-view';
        
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = 'language-html';
        code.textContent = element.outerHTML;
        pre.appendChild(code);
        htmlView.appendChild(pre);
        
        content.appendChild(htmlView);
    
        return this.createCollapsibleSection('element-details', 'Element Details', content);
    }

    getElementStatusBadges(element) {
        const badges = [];
        const tagName = element.tagName.toLowerCase();
    
        if (element.id) badges.push(`#${element.id}`);
        if (element.className) {
            const classes = element.className.toString().split(' ').filter(c => c);
            badges.push(...classes.map(c => `.${c.substring(0, 20)}`));
        }
        if (element.src) badges.push('src');
        if (element.href) badges.push('href');
        if (element.disabled) badges.push('disabled');
        if (element.required) badges.push('required');
        if (element.type) badges.push(`type="${element.type}"`);
    
        switch (tagName) {
            case 'meta':
                if (element.name) badges.push(`name="${element.name}"`);
                break;
            case 'a':
                if (element.target) badges.push(`target="${element.target}"`);
                break;
        }
    
        return badges;
    }

    createComputedStylesContent(element) {
        const computedStyles = window.getComputedStyle(element);
        const propertiesTable = document.createElement('table');
        propertiesTable.className = 'dom-inspector-styles-table';

        const filterControls = document.createElement('div');
        filterControls.className = 'dom-inspector-filter-controls';

        const select = document.createElement('select');
        Object.keys(STYLE_CATEGORIES).forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            select.appendChild(option);
        });

        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'dom-inspector-toggle-label';
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggleLabel.appendChild(toggle);
        toggleLabel.append(' Show only group');

        filterControls.appendChild(select);
        filterControls.appendChild(toggleLabel);

        const tbody = document.createElement('tbody');
        propertiesTable.appendChild(tbody);

        // Function to rebuild the table based on filter settings
        const rebuildTable = () => {
            tbody.innerHTML = ''; // Clear existing rows
            
            let propertiesToShow;
            if (toggle.checked) {
                // Show only properties from selected group
                const selectedGroup = select.value;
                propertiesToShow = STYLE_CATEGORIES[selectedGroup] || [];
            } else {
                // Show all properties
                propertiesToShow = Array.from(computedStyles);
            }

            propertiesToShow.forEach(prop => {
                const value = computedStyles.getPropertyValue(prop);
                if (value && value !== 'normal' && value !== 'auto' && value !== '0px' && value !== 'rgba(0, 0, 0, 0)') {
                    const row = tbody.insertRow();
                    const propCell = row.insertCell();
                    const valueCell = row.insertCell();
                    propCell.textContent = prop;
                    valueCell.textContent = value;
                }
            });
        };

        // Add event listeners for filter controls
        select.addEventListener('change', rebuildTable);
        toggle.addEventListener('change', rebuildTable);

        // Initial build
        rebuildTable();

        const computedStylesContent = document.createElement('div');
        computedStylesContent.appendChild(filterControls);
        computedStylesContent.appendChild(propertiesTable);
        
        return computedStylesContent;
    }

    // --- Element Caching ---
    cacheElement(element) {
        const id = this.nextCacheId++;
        this.elementCache.set(id.toString(), element);
        return id.toString();
    }

    getElementFromCache(id) {
        return this.elementCache.get(id);
    }

    generateElementId(element) {
        // Generate a unique ID for DOM tree nodes for state persistence
        if (!element.dataset.domInspectorId) {
            element.dataset.domInspectorId = `dom_node_${this.elementIdCounter++}`;
        }
        return element.dataset.domInspectorId;
    }
    
    // --- Tree Building and Navigation ---
    buildTree() {
        console.log('DOM Inspector: Building tree...');
        
        // Preserve current state before rebuilding
        this.preserveTreeState();
        
        this.treeContainer.innerHTML = '';
        this.elementCache.clear();
        this.nextCacheId = 0;
        
        // Build complete tree structure with all nodes collapsed
        try {
            // Create the full tree starting from document.documentElement (html)
            const rootNode = this.createFullNodeTree(document.documentElement);
            if (rootNode) {
                this.treeContainer.appendChild(rootNode);
                console.log('DOM Inspector: Complete tree built successfully');
                
                // Restore state after tree is built
                setTimeout(() => {
                    this.restoreTreeState();
                    this.ensureTreeOpen();
                }, 0);
            } else {
                console.error('DOM Inspector: Failed to create tree');
            }
        } catch (error) {
            console.error('DOM Inspector: Error creating tree:', error);
            // Add error message to tree
            const errorDiv = document.createElement('div');
            errorDiv.textContent = `Error: ${error.message}`;
            errorDiv.style.color = 'red';
            errorDiv.style.padding = '10px';
            this.treeContainer.appendChild(errorDiv);
        }
    }

    createFullNodeTree(element) {
        if (!element || !element.tagName) {
            return null;
        }

        const node = document.createElement('div');
        node.className = 'dom-inspector-node'; // All nodes start collapsed
        
        const elementId = this.cacheElement(element);
        const nodeId = this.generateElementId(element);
        node.dataset.elementId = elementId;
        node.dataset.nodeId = nodeId;

        const header = document.createElement('div');
        header.className = 'dom-inspector-node-header';

        const toggle = document.createElement('span');
        toggle.className = 'dom-inspector-node-toggle';
        if (element.children.length > 0) {
            toggle.textContent = '▶'; // Always collapsed initially
        }
        header.appendChild(toggle);

        const name = document.createElement('span');
        name.className = 'dom-inspector-node-name';
        name.textContent = `<${element.tagName.toLowerCase()}>`;
        header.appendChild(name);

        // Add annotations if enabled
        const annotations = this.getElementAnnotations(element);
        if (annotations.length > 0) {
            const annotationContainer = document.createElement('span');
            annotationContainer.className = 'dom-inspector-node-annotations';
            annotationContainer.innerHTML = this.formatAnnotationsForDisplay(annotations, this.annotationSettings.annotationMode);
            header.appendChild(annotationContainer);
        }

        node.appendChild(header);

        // Pre-create children but keep them hidden
        if (element.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'dom-inspector-node-children';
            childrenContainer.style.display = 'none'; // Hidden by default
            
            for (const child of element.children) {
                const childNode = this.createFullNodeTree(child);
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
    }
    
    selectElement(element) {
        if (!element) {
            return;
        }

        console.log('DOM Inspector: Selecting element:', element);

        // Preserve current tree state
        this.preserveTreeState();

        this.selectedElement = element;
        this.treeState.selectedElementId = this.findElementId(element);
        this.cacheElement(element);

        // Update tree selection visuals
        const allNodes = this.treeContainer.querySelectorAll('.dom-inspector-node');
        allNodes.forEach(node => {
            const header = node.querySelector('.dom-inspector-node-header');
            if (header) {
                header.classList.remove('selected');
            }
        });

        // First, ensure the element is in the tree by rebuilding if necessary
        this.ensureElementInTree(element);

        // Find and highlight selected element in tree
        const targetNode = this.findTreeNodeForElement(element);
        if (targetNode) {
            const header = targetNode.querySelector('.dom-inspector-node-header');
            if (header) {
                header.classList.add('selected');
            }
            
            // Expand ALL parents to make selection visible
            this.expandParentsToNode(targetNode);
        } else {
            console.warn('DOM Inspector: Could not find tree node for selected element, rebuilding tree...');
            // If we still can't find it, rebuild the tree and try again
            this.buildTree();
            setTimeout(() => {
                const retryNode = this.findTreeNodeForElement(element);
                if (retryNode) {
                    const header = retryNode.querySelector('.dom-inspector-node-header');
                    if (header) {
                        header.classList.add('selected');
                    }
                    this.expandParentsToNode(retryNode);
                }
            }, 50);
        }
        
        // Generate and populate CSS selector
        const cssSelector = this.generateCSSSelector(element);
        this.querySelectorInput.value = cssSelector;
        console.log('DOM Inspector: Generated CSS selector:', cssSelector);
        
        this.displayElementDetails(element);
    }

    // Helper method to find the tree node for a given element
    findTreeNodeForElement(element) {
        const allNodes = this.treeContainer.querySelectorAll('.dom-inspector-node');
        for (const node of allNodes) {
            if (this.getElementFromCache(node.dataset.elementId) === element) {
                return node;
            }
        }
        return null;
    }

    // Ensure an element is represented in the tree
    ensureElementInTree(element) {
        // Check if element is already in tree
        if (this.findTreeNodeForElement(element)) {
            return; // Already in tree
        }
        
        console.log('DOM Inspector: Element not found in tree, ensuring it\'s included...');
        
        // Check if element is a descendant of the current root
        const currentRoot = this.treeContainer.querySelector('.dom-inspector-node');
        if (currentRoot) {
            const rootElement = this.getElementFromCache(currentRoot.dataset.elementId);
            if (rootElement && rootElement.contains(element)) {
                // Element is within current tree, we just need to expand parents
                this.expandTreeToIncludeElement(element);
                return;
            }
        }
        
        // If element is not in current tree scope, we may need to rebuild
        // For now, let's rebuild the tree to include the new element
        console.log('DOM Inspector: Rebuilding tree to include target element');
        this.buildTree();
    }

    // Expand tree to include a specific element by building missing branches
    expandTreeToIncludeElement(element) {
        // Find the path from current tree root to the target element
        const path = [];
        let current = element;
        
        // Build path from element up to a node that exists in the tree
        while (current && current !== document.documentElement) {
            path.unshift(current);
            current = current.parentElement;
            
            // Check if this parent is already in the tree
            if (this.findTreeNodeForElement(current)) {
                break;
            }
        }
        
        // Now expand each level in the path
        for (let i = 0; i < path.length - 1; i++) {
            const parentElement = path[i];
            const parentNode = this.findTreeNodeForElement(parentElement);
            
            if (parentNode && !parentNode.classList.contains('expanded')) {
                this.toggleNode(parentNode);
            }
        }
    }

    // Improved helper method to expand all parents
    expandParentsToNode(targetNode) {
        console.log('DOM Inspector: Expanding parents for node:', targetNode);
        if (!targetNode) {
            console.warn('DOM Inspector: No target node provided to expandParentsToNode');
            return;
        }

        const nodesToExpand = [];
        let currentNode = targetNode;
        
        // Walk up the DOM tree to find all parent nodes that need to be expanded
        while (currentNode && !currentNode.classList.contains('dom-inspector-tree')) {
            const parentContainer = currentNode.parentElement;
            
            if (parentContainer && parentContainer.classList.contains('dom-inspector-node-children')) {
                // We're in a children container, get the parent node
                const parentNode = parentContainer.parentElement;
                if (parentNode && parentNode.classList.contains('dom-inspector-node')) {
                    nodesToExpand.unshift(parentNode); // Add to beginning to expand from root down
                    currentNode = parentNode;
                } else {
                    break;
                }
            } else if (parentContainer && parentContainer.classList.contains('dom-inspector-tree')) {
                // We've reached the root tree container
                break;
            } else {
                // Try to find the next parent node
                const nextParent = currentNode.parentElement?.closest('.dom-inspector-node');
                if (nextParent && nextParent !== currentNode) {
                    nodesToExpand.unshift(nextParent);
                    currentNode = nextParent;
                } else {
                    break;
                }
            }
        }
        
        console.log('DOM Inspector: Nodes to expand (in order):', nodesToExpand);
        
        // Expand all parent nodes from root down to target
        nodesToExpand.forEach(node => {
            if (!node.classList.contains('expanded')) {
                console.log('DOM Inspector: Expanding node:', node);
                this.toggleNode(node);
            }
        });
        
        // Ensure the target node is visible after expansion
        setTimeout(() => {
            if (targetNode.offsetParent !== null) { // Check if visible
                targetNode.scrollIntoView({ 
                    block: 'center', 
                    behavior: 'smooth',
                    inline: 'nearest'
                });
            }
        }, 100); // Small delay to allow DOM updates
    }

    // --- Element Selection and Highlighting ---
    selectElementByQuery(query) {
        try {
            console.log('DOM Inspector: Attempting to select with query:', query);
            
            // Check for invalid characters that would make the selector fail
            if (this.isInvalidSelector(query)) {
                // Try to auto-fix the selector
                const fixedQuery = this.fixSelector(query);
                if (fixedQuery !== query) {
                    console.log(`DOM Inspector: Auto-fixing selector from "${query}" to "${fixedQuery}"`);
                    // Try the fixed selector
                    this.selectElementByQuery(fixedQuery);
                    return;
                } else {
                    throw new Error(`Selector contains invalid characters. Common issues: forward slashes (/) are not valid in CSS selectors.`);
                }
            }
            
            const element = document.querySelector(query);
            
            if (element) {
                console.log('DOM Inspector: Element found:', element);
                
                // Check if element is disabled
                this.checkElementDisabledState(element);
                
                // Check clickability
                const clickabilityResult = this.testElementClickability(element);
                if (!clickabilityResult.isClickable) {
                    console.warn('DOM Inspector: Element found but not clickable');
                    this.showClickabilityIssue(element, clickabilityResult);
                }
                
                this.selectElement(element);
                this.savePreset(query);
            } else {
                console.warn(`DOM Inspector: No element found for selector: "${query}"`);
                this.debugFailedSelector(query);
            }
        } catch (error) {
            console.error(`DOM Inspector: Invalid selector: "${query}"`, error);
            this.showSelectorError(query, error);
        }
    }

    isInvalidSelector(selector) {
        return ValidationUtils.isInvalidSelector(selector);
    }

    fixSelector(selector) {
        return ValidationUtils.fixSelector(selector);
    }

    checkElementDisabledState(element) {
        const isDisabled = element.disabled || 
                          element.hasAttribute('disabled') || 
                          element.getAttribute('aria-disabled') === 'true';
        
        const isReadonly = element.readOnly || element.hasAttribute('readonly');
        
        if (isDisabled || isReadonly) {
            console.group('DOM Inspector: Disabled/Readonly Element Detected');
            console.log('Element:', element);
            console.log('Disabled:', isDisabled);
            console.log('Readonly:', isReadonly);
            console.log('Disabled attribute:', element.getAttribute('disabled'));
            console.log('Aria-disabled:', element.getAttribute('aria-disabled'));
            
            this.showDisabledElementInfo(element, isDisabled, isReadonly);
            console.groupEnd();
        }
    }

    showDisabledElementInfo(element, isDisabled, isReadonly) {
        if (this.detailsContainer) {
            const disabledDiv = document.createElement('div');
            disabledDiv.className = 'dom-inspector-disabled-info';
            
                    let statusIcon = isDisabled ? 'DISABLED' : 'READONLY';
        let statusText = isDisabled ? 'Disabled' : 'Read-only';
        
        disabledDiv.innerHTML = `
            <h4>${statusIcon} ${statusText} Element</h4>
                <p>This element is currently <strong>${statusText.toLowerCase()}</strong> and cannot be interacted with normally.</p>
                <div class="disabled-details">
                    <p><strong>Element type:</strong> <code>${element.tagName.toLowerCase()}</code></p>
                    <p><strong>Disabled attribute:</strong> <code>${element.getAttribute('disabled') || 'null'}</code></p>
                    ${element.getAttribute('aria-disabled') ? `<p><strong>ARIA disabled:</strong> <code>${element.getAttribute('aria-disabled')}</code></p>` : ''}
                </div>
                <div class="disabled-actions">
                    <button class="dom-inspector-fix-btn" data-action="enable-temp">Enable Temporarily</button>
                    <button class="dom-inspector-fix-btn" data-action="copy-enable-css">Copy Enable CSS</button>
                    <button class="dom-inspector-fix-btn" data-action="inspect-anyway">Inspect Anyway</button>
                </div>
            `;
            
            // Add event listeners
            const enableBtn = disabledDiv.querySelector('[data-action="enable-temp"]');
            const copyBtn = disabledDiv.querySelector('[data-action="copy-enable-css"]');
            const inspectBtn = disabledDiv.querySelector('[data-action="inspect-anyway"]');
            
            enableBtn.addEventListener('click', () => {
                this.temporarilyEnableElement(element);
                enableBtn.textContent = 'Enabled!';
                enableBtn.disabled = true;
            });
            
            copyBtn.addEventListener('click', () => {
                const selector = this.generateCSSSelector(element);
                const cssRule = `${selector} {\n  pointer-events: auto !important;\n}\n\n${selector}:disabled {\n  opacity: 1 !important;\n  cursor: pointer !important;\n}`;
                navigator.clipboard.writeText(cssRule).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => copyBtn.textContent = 'Copy Enable CSS', 2000);
                });
            });
            
            inspectBtn.addEventListener('click', () => {
                // Continue with normal inspection despite disabled state
                disabledDiv.remove();
                this.displayElementDetails(element);
            });
            
            this.detailsContainer.insertBefore(disabledDiv, this.detailsContainer.firstChild);
        }
    }

    temporarilyEnableElement(element) {
        console.log('DOM Inspector: Temporarily enabling element:', element);
        
        // Store original state for restoration
        const originalState = {
            disabled: element.disabled,
            disabledAttr: element.getAttribute('disabled'),
            ariaDisabled: element.getAttribute('aria-disabled'),
            style: element.style.cssText
        };
        
        // Enable the element
        element.disabled = false;
        element.removeAttribute('disabled');
        element.removeAttribute('aria-disabled');
        
        // Override disabled styling
        element.style.cssText += `
            pointer-events: auto !important;
            opacity: 1 !important;
            cursor: pointer !important;
            background-color: var(--color-background) !important;
            color: var(--color-foreground) !important;
        `;
        
        // Store restoration function
        element._domInspectorRestore = () => {
            element.disabled = originalState.disabled;
            if (originalState.disabledAttr !== null) {
                element.setAttribute('disabled', originalState.disabledAttr);
            }
            if (originalState.ariaDisabled) {
                element.setAttribute('aria-disabled', originalState.ariaDisabled);
            }
            element.style.cssText = originalState.style;
            delete element._domInspectorRestore;
        };
        
        console.log('DOM Inspector: Element enabled. Call element._domInspectorRestore() to restore original state.');
        
        // Auto-restore after 30 seconds
        setTimeout(() => {
            if (element._domInspectorRestore) {
                element._domInspectorRestore();
                console.log('DOM Inspector: Auto-restored element to disabled state');
            }
        }, 30000);
    }

    testElementClickability(element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Test multiple points to find where the element is actually clickable
        const testPoints = [
            { x: centerX, y: centerY, name: 'center' },
            { x: rect.left + 5, y: rect.top + 5, name: 'top-left' },
            { x: rect.right - 5, y: rect.top + 5, name: 'top-right' },
            { x: rect.left + 5, y: rect.bottom - 5, name: 'bottom-left' },
            { x: rect.right - 5, y: rect.bottom - 5, name: 'bottom-right' },
            // Test edges
            { x: rect.left + 2, y: centerY, name: 'left-edge' },
            { x: rect.right - 2, y: centerY, name: 'right-edge' },
            { x: centerX, y: rect.top + 2, name: 'top-edge' },
            { x: centerX, y: rect.bottom - 2, name: 'bottom-edge' }
        ];
        
        const results = testPoints.map(point => {
            const elementAtPoint = document.elementFromPoint(point.x, point.y);
            const isDirectHit = elementAtPoint === element;
            const isChildHit = element.contains(elementAtPoint);
            
            return {
                ...point,
                elementAtPoint,
                isDirectHit,
                isChildHit,
                isClickable: isDirectHit || isChildHit
            };
        });
        
        const clickablePoints = results.filter(r => r.isDirectHit);
        const childInterceptPoints = results.filter(r => r.isChildHit && !r.isDirectHit);
        
        console.log('DOM Inspector: Clickability test results:');
        console.log('  Direct hits:', clickablePoints.length);
        console.log('  Child intercepts:', childInterceptPoints.length);
        
        if (childInterceptPoints.length > 0) {
            console.log('  Child elements intercepting clicks:');
            childInterceptPoints.forEach(point => {
                console.log(`    ${point.name}: ${point.elementAtPoint.tagName}${point.elementAtPoint.className ? '.' + point.elementAtPoint.className : ''}`);
            });
        }
        
        return {
            isClickable: clickablePoints.length > 0,
            hasChildIntercepts: childInterceptPoints.length > 0,
            clickablePoints,
            childInterceptPoints,
            bestClickPoint: clickablePoints[0] || null
        };
    }

    showClickabilityIssue(element, clickabilityResult) {
        if (this.detailsContainer) {
            const issueDiv = document.createElement('div');
            issueDiv.className = 'dom-inspector-clickability-issue';
            
            let content = `
                <h4>Element Selection Issue</h4>
                <p>This element is covered by child elements, making it hard to click directly.</p>
            `;
            
            if (clickabilityResult.bestClickPoint) {
                content += `
                    <p><strong>Solution:</strong> Element is clickable at the <strong>${clickabilityResult.bestClickPoint.name}</strong> area.</p>
                    <button class="dom-inspector-fix-btn" data-action="highlight-clickable">Show Clickable Area</button>
                `;
            } else {
                content += `
                    <p><strong>Tip:</strong> Try selecting a child element instead, or use the element picker to click on the border/padding area.</p>
                `;
            }
            
            if (clickabilityResult.childInterceptPoints.length > 0) {
                content += `
                    <p><strong>Child elements intercepting clicks:</strong></p>
                    <ul>`;
                
                clickabilityResult.childInterceptPoints.slice(0, 3).forEach(point => {
                    const tagName = point.elementAtPoint.tagName.toLowerCase();
                    const className = point.elementAtPoint.className;
                    const firstClass = className && typeof className === 'string' ? className.split(' ')[0] : 
                                     className && className.toString ? className.toString().split(' ')[0] : '';
                    content += `<li><code>${tagName}${firstClass ? '.' + firstClass : ''}</code></li>`;
                });
                
                content += `</ul>`;
            }
            
            issueDiv.innerHTML = content;
            
            // Add event listener for highlight button
            const highlightBtn = issueDiv.querySelector('[data-action="highlight-clickable"]');
            if (highlightBtn && clickabilityResult.bestClickPoint) {
                highlightBtn.addEventListener('click', () => {
                    this.highlightClickableArea(element, clickabilityResult.bestClickPoint);
                });
            }
            
            this.detailsContainer.insertBefore(issueDiv, this.detailsContainer.firstChild);
        }
    }

    highlightClickableArea(element, clickPoint) {
        // Use the HighlightOverlay's showClickableDot method
        this.highlightOverlay.showClickableDot(clickPoint.x, clickPoint.y, {
            color: '#00ff00',
            size: 10,
            duration: 3000
        });
        
        console.log(`DOM Inspector: Clickable area highlighted at (${clickPoint.x}, ${clickPoint.y})`);
    }





    // Note: Z-Index management is now handled by PanelUI module

    // --- Annotation Settings ---

    updateAnnotationSettings(settings) {
        this.annotationSettings = { ...this.annotationSettings, ...settings };
        this.updateTreeAnnotations(); // Redraw annotations in the tree
        
        // Update breadcrumb if the setting changed
        if (this.selectedElement) {
            this.updateDetailsContent(this.selectedElement);
        }
    }

    updateTreeAnnotations() {
        if (!this.treeContainer) return;
        // Update annotations on existing tree nodes without rebuilding
        const allNodes = this.treeContainer.querySelectorAll('.dom-inspector-node');
        
        allNodes.forEach(node => {
            const elementId = node.dataset.elementId;
            const element = this.getElementFromCache(elementId);
            
            if (element) {
                // Find existing annotation container or create one
                let annotationContainer = node.querySelector('.dom-inspector-node-annotations');
                const header = node.querySelector('.dom-inspector-node-header');
                
                // Get current annotations
                const annotations = this.getElementAnnotations(element);
                
                if (annotations.length > 0) {
                    if (!annotationContainer) {
                        annotationContainer = document.createElement('span');
                        annotationContainer.className = 'dom-inspector-node-annotations';
                        header.appendChild(annotationContainer);
                    }
                    annotationContainer.innerHTML = this.formatAnnotationsForDisplay(annotations, this.annotationSettings.annotationMode);
                } else if (annotationContainer) {
                    // Remove annotation container if no annotations
                    annotationContainer.remove();
                }
            }
        });
        
        console.log('DOM Inspector: Updated tree annotations without rebuilding');
    }

    saveTreeState() {
        // Clear previous state
        this.treeState.expandedNodes.clear();
        
        // Save currently expanded nodes
        const expandedNodes = this.treeContainer.querySelectorAll('.dom-inspector-node.expanded');
        expandedNodes.forEach(node => {
            const nodeId = node.dataset.nodeId;
            if (nodeId) {
                this.treeState.expandedNodes.add(nodeId);
            }
        });
        
        // Save selected element
        if (this.selectedElement) {
            const selectedId = this.selectedElement.dataset.domInspectorId;
            if (selectedId) {
                this.treeState.selectedElementId = selectedId;
            }
        }
        
        console.log('DOM Inspector: Saved tree state:', {
            expanded: this.treeState.expandedNodes.size,
            selected: this.treeState.selectedElementId
        });
    }

    restoreTreeState() {
        // Restore expanded nodes
        this.treeState.expandedNodes.forEach(nodeId => {
            const node = this.treeContainer.querySelector(`[data-node-id="${nodeId}"]`);
            if (node && !node.classList.contains('expanded')) {
                this.toggleNode(node);
            }
        });
        
        // Restore selected element
        if (this.treeState.selectedElementId) {
            const element = document.querySelector(`[data-dom-inspector-id="${this.treeState.selectedElementId}"]`);
            if (element) {
                this.selectElement(element);
            }
        }
        
        console.log('DOM Inspector: Restored tree state');
    }

    findElementId(element) {
        // Find the element ID in our cache
        for (const [id, cachedElement] of this.elementCache.entries()) {
            if (cachedElement === element) {
                return id;
            }
        }
        return null;
    }

    getElementAnnotations(element) {
        const annotations = [];
        
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return annotations;
        }

        const computedStyle = window.getComputedStyle(element);
        const zIndexInfo = zIndexManager ? zIndexManager.getZIndexInfo(element) : null;

        // Z-Index annotations
        if (this.annotationSettings.showZIndex) {
            const zIndex = computedStyle.zIndex;
            if (zIndex !== 'auto') {
                annotations.push({
                    type: 'z-index',
                    value: zIndex,
                    label: `z:${zIndex}`,
                    className: 'annotation-zindex'
                });
            }
        }

        // Computed Z-Index (effective value)
        if (this.annotationSettings.showComputedZIndex && zIndexInfo) {
            const computedZ = zIndexInfo.computedZIndex;
            if (computedZ !== parseInt(computedStyle.zIndex) || computedStyle.zIndex === 'auto') {
                annotations.push({
                    type: 'computed-z-index',
                    value: computedZ,
                    label: `cz:${computedZ}`,
                    className: 'annotation-computed-zindex'
                });
            }
        }

        // Z-Index Layer
        if (this.annotationSettings.showZIndexLayer && zIndexInfo) {
            const layer = zIndexInfo.layer;
            if (layer && layer !== 'BASE') {
                annotations.push({
                    type: 'z-layer',
                    value: layer,
                    label: layer.toLowerCase(),
                    className: `annotation-layer annotation-layer-${layer.toLowerCase()}`
                });
            }
        }

        // Stacking Context
        if (this.annotationSettings.showStackingContext && zIndexInfo?.stackingContext?.isStackingContext) {
            const reasons = zIndexInfo.stackingContext.reasons;
            annotations.push({
                type: 'stacking-context',
                value: reasons,
                label: 'SC',
                title: `Stacking Context: ${reasons.join(', ')}`,
                className: 'annotation-stacking-context'
            });
        }

        return annotations;
    }

    formatAnnotationsForDisplay(annotations, mode = 'compact') {
        if (!annotations.length) return '';

        switch (mode) {
            case 'minimal':
                // Show only the most important annotation
                const important = annotations.find(a => a.type === 'stacking-context') || annotations[0];
                return important ? `<span class="${important.className}" title="${important.title || ''}">${important.label}</span>` : '';
                
            case 'detailed':
                // Show all annotations with full labels
                return annotations.map(a => 
                    `<span class="${a.className}" title="${a.title || a.type}: ${a.value}">${a.label}</span>`
                ).join(' ');
                
            case 'compact':
            default:
                // Show key annotations in compact form
                return annotations.slice(0, 3).map(a => 
                    `<span class="${a.className}" title="${a.title || a.value}">${a.label}</span>`
                ).join(' ');
        }
    }

    destroy() {
        // Destroy settings panel
        if (this.settingsPanel) {
            this.settingsPanel.destroy();
            this.settingsPanel = null;
        }
        
        // Destroy new modular components
        if (this.stateManager) {
            this.stateManager.destroy();
            this.stateManager = null;
        }
        
        if (this.highlightOverlay) {
            this.highlightOverlay.destroy();
            this.highlightOverlay = null;
        }
        
        if (this.elementPicker) {
            this.elementPicker.destroy();
            this.elementPicker = null;
        }
        
        // Destroy PanelUI (handles Z-index management and panel removal)
        if (this.panelUI) {
            this.panelUI.destroy();
            this.panelUI = null;
        }
        
        // Clear UI element references
        this.panel = null;
        this.treeContainer = null;
        this.detailsContainer = null;
        this.querySelectorInput = null;
        this.elementPickerButton = null;
        this.saveButton = null;
        this.clearButton = null;
        this.highlightToggleButton = null;
        this.historyContainer = null;
        this.closeButton = null;
        this.settingsButton = null;
    }

    // --- Highlight System Methods ---
    updateHighlightButtonVisuals() {
        if (!this.highlightToggleButton) return;
        
        const mode = this.stateManager.getHighlight().mode;
        const nextMode = HighlightOverlay.getNextMode(mode);
        
        // Update button appearance based on current mode
        this.highlightToggleButton.className = 'dom-inspector-btn dom-inspector-highlight-toggle';
        this.highlightToggleButton.dataset.mode = mode;
        
        switch (mode) {
            case 'none':
                this.highlightToggleButton.textContent = '○';
                this.highlightToggleButton.title = 'Highlight: None (click for border)';
                break;
            case 'border':
                this.highlightToggleButton.textContent = '◌';
                this.highlightToggleButton.title = 'Highlight: Border (click for border + shade)';
                break;
            case 'both':
                this.highlightToggleButton.textContent = '⬜';
                this.highlightToggleButton.title = 'Highlight: Border + Shade (click for none)';
                break;
        }
    }



    setupHighlightButtonEvents() {
        if (!this.highlightToggleButton) return;
        
        let longPressTimer = null;
        let isLongPress = false;
        
        // Regular click handler
        this.highlightToggleButton.addEventListener('click', (e) => {
            if (!isLongPress) {
                this.toggleHighlightMode();
            }
            isLongPress = false;
        });
        
        // Long press handlers
        this.highlightToggleButton.addEventListener('mousedown', (e) => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                this.openColorPicker();
            }, 500); // 500ms for long press
        });
        
        this.highlightToggleButton.addEventListener('mouseup', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
        
        this.highlightToggleButton.addEventListener('mouseleave', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            isLongPress = false;
        });
    }

    toggleHighlightMode() {
        const currentHighlight = this.stateManager.getHighlight();
        const nextMode = HighlightOverlay.getNextMode(currentHighlight.mode);
        
        this.stateManager.setHighlight({
            ...currentHighlight,
            mode: nextMode
        });
    }

    openColorPicker() {
        // Create a simple color picker
        const input = document.createElement('input');
        input.type = 'color';
        const currentHighlight = this.stateManager.getHighlight();
        input.value = currentHighlight.color;
        input.style.position = 'fixed';
        input.style.top = '-1000px';
        input.style.left = '-1000px';
        
        document.body.appendChild(input);
        
        input.addEventListener('change', (e) => {
            const newColor = e.target.value;
            this.stateManager.setHighlight({
                ...currentHighlight,
                color: newColor
            });
            input.remove();
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => input.remove(), 100);
        });
        
        input.click();
    }



    // --- Missing Element Details Methods ---
    createElementSummary(element) {
        const content = document.createElement('div');
        content.className = 'dom-inspector-element-summary';
        
        const tagName = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classNames = element.className && typeof element.className === 'string' ? element.className.split(' ') :
                          element.className && element.className.toString ? element.className.toString().split(' ') : [];
        const classes = classNames.length > 0 ? `.${classNames.join('.')}` : '';
        
        content.innerHTML = `
            <h3>Element: <code>&lt;${tagName}${id}${classes}&gt;</code></h3>
            <div class="summary-details">
                <span><strong>Tag:</strong> ${tagName}</span>
                ${id ? `<span><strong>ID:</strong> ${id}</span>` : ''}
                ${classes ? `<span><strong>Classes:</strong> ${classes}</span>` : ''}
                <span><strong>Children:</strong> ${element.children.length}</span>
            </div>
        `;
        
        return content;
    }

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

        trail.forEach((el, index) => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'breadcrumb-link';

            let linkText = `<span class="breadcrumb-tag">${el.tagName.toLowerCase()}</span>`;
            if (this.annotationSettings.showBreadcrumbAnnotations) {
                const identifier = this.createElementIdentifier(el);
                if (identifier) {
                    linkText += `<span class="breadcrumb-identifier">${identifier}</span>`;
                }
            }
            link.innerHTML = linkText;

            if (index === this.activeBreadcrumbIndex) {
                link.classList.add('active');
            }

            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.navigateToBreadcrumbElement(index);
            });

            this.addBreadcrumbHoverTooltip(link, el);
            container.appendChild(link);

            if (index < trail.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'breadcrumb-separator';
                separator.textContent = '›';
                container.appendChild(separator);
            }
        });

        return container;
    }

    createElementIdentifier(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        return '';
    }

    addBreadcrumbHoverTooltip(link, element) {
        let tooltip = null;

        link.addEventListener('mouseenter', (e) => {
            tooltip = document.createElement('div');
            tooltip.className = 'breadcrumb-tooltip';
            
            const summary = this.createElementTooltipSummary(element);
            tooltip.appendChild(summary);
            
            document.body.appendChild(tooltip); // Append to body

            const linkRect = link.getBoundingClientRect();
            tooltip.style.left = `${linkRect.left + linkRect.width / 2}px`;
            tooltip.style.top = `${linkRect.bottom + 5}px`;

            // Make it visible
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
            
            if (window.zIndexManager) {
                window.zIndexManager.registerPopup(tooltip);
            }
        });
        
        link.addEventListener('mouseleave', () => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        });
    }

    createElementTooltipSummary(element) {
        const container = document.createElement('div');
        
        const title = document.createElement('div');
        title.className = 'tooltip-title';
        
        let fullIdentifier = element.tagName.toLowerCase();
        if (element.id) fullIdentifier += `#${element.id}`;
        if (element.className) {
            const classes = element.className.toString().split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                fullIdentifier += `.${classes.slice(0, 2).join('.')}`;
                if (classes.length > 2) fullIdentifier += ` (+${classes.length - 2})`;
            }
        }
        title.textContent = fullIdentifier;
        
        const details = [];
        
        if (element.id) details.push(['ID', element.id]);
        if (element.className) details.push(['Classes', element.className]);
        
        const textContent = element.textContent?.trim();
        if (textContent && textContent.length > 0) {
            const preview = textContent.length > 50 ? textContent.substring(0, 50) + '...' : textContent;
            details.push(['Text', preview]);
        }
        
        details.push(['Children', element.children.length.toString()]);
        
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display !== 'block') {
            details.push(['Display', computedStyle.display]);
        }
        if (computedStyle.position !== 'static') {
            details.push(['Position', computedStyle.position]);
        }
        
        const zIndex = computedStyle.zIndex;
        if (zIndex !== 'auto') {
            details.push(['Z-Index', zIndex]);
        }
        
        const isStackingContext = this.isStackingContext(element, computedStyle);
        if (isStackingContext) {
            details.push(['Stacking', 'Creates context']);
        }
        
        const effectiveZIndex = this.getEffectiveZIndex(element);
        if (effectiveZIndex !== null && effectiveZIndex.toString() !== zIndex) {
            details.push(['Effective Z', effectiveZIndex.toString()]);
        }
        
        container.appendChild(title);
        
        details.forEach(([key, value]) => {
            const row = document.createElement('div');
            row.className = 'tooltip-row';
            
            const keySpan = document.createElement('span');
            keySpan.className = 'tooltip-key';
            keySpan.textContent = key + ':';
            
            const valueSpan = document.createElement('span');
            valueSpan.className = 'tooltip-value';
            valueSpan.textContent = value;
            
            row.appendChild(keySpan);
            row.appendChild(valueSpan);
            container.appendChild(row);
        });
        
        return container;
    }

    isStackingContext(element, computedStyle) {
        if (computedStyle.position !== 'static' && computedStyle.zIndex !== 'auto') return true;
        if (computedStyle.opacity !== '1') return true;
        if (computedStyle.transform !== 'none') return true;
        if (computedStyle.filter !== 'none') return true;
        if (computedStyle.isolation === 'isolate') return true;
        if (computedStyle.mixBlendMode !== 'normal') return true;
        if (computedStyle.contain === 'layout' || computedStyle.contain === 'paint' || computedStyle.contain.includes('layout') || computedStyle.contain.includes('paint')) return true;
        
        return false;
    }

    getEffectiveZIndex(element) {
        let current = element;
        let effectiveZ = null;
        
        while (current && current !== document.documentElement) {
            const style = window.getComputedStyle(current);
            const zIndex = style.zIndex;
            
            if (zIndex !== 'auto') {
                const numericZ = parseInt(zIndex, 10);
                if (!isNaN(numericZ)) {
                    effectiveZ = numericZ;
                }
            }
            
            if (this.isStackingContext(current, style) && current !== element) {
                break;
            }
            
            current = current.parentElement;
        }
        
        return effectiveZ;
    }

    navigateToBreadcrumbElement(index) {
        if (!this.currentBreadcrumbTrail || index >= this.currentBreadcrumbTrail.length) {
            return;
        }
        
        const targetElement = this.currentBreadcrumbTrail[index];
        
        if (targetElement) {
            console.log('DOM Inspector: Navigating to breadcrumb element:', targetElement);
            this.selectElement(targetElement);
        } else {
            console.warn('DOM Inspector: Breadcrumb element reference not found');
        }
    }

    expandTreeToElement(element) {
        console.log('DOM Inspector: Expanding tree to element:', element);
        
        // First ensure the element is in the tree
        this.ensureElementInTree(element);
        
        // Find the tree node for this element and expand parents
        const targetNode = this.findTreeNodeForElement(element);
        if (targetNode) {
            this.expandParentsToNode(targetNode);
            // The expandParentsToNode method now handles scrolling
        } else {
            console.warn('DOM Inspector: Could not find element in tree after ensuring inclusion');
            // Last resort: rebuild tree and try again
            this.buildTree();
            setTimeout(() => {
                const retryNode = this.findTreeNodeForElement(element);
                if (retryNode) {
                    this.expandParentsToNode(retryNode);
                } else {
                    console.error('DOM Inspector: Still cannot find element in tree after rebuild');
                }
            }, 100);
        }
    }

    updateDetailsContent(element) {
        // Update only the content below the breadcrumb
        const breadcrumb = this.detailsContainer.querySelector('.enhanced-breadcrumb-trail');
        
        // Remove all content after breadcrumb
        let nextSibling = breadcrumb.nextSibling;
        while (nextSibling) {
            const toRemove = nextSibling;
            nextSibling = nextSibling.nextSibling;
            toRemove.remove();
        }
        
        // Add new content
        this.detailsContainer.appendChild(this.createElementSpecificDetails(element));
        this.detailsContainer.appendChild(this.renderEngineSection(element));
    }

    createBreadcrumbTrail(element) {
        // Legacy method - redirect to enhanced version
        return this.createEnhancedBreadcrumbTrail(element);
    }

    escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    // ==============================================
    // TREE STATE MANAGEMENT
    // ==============================================

    loadTreeStateFromAppState() {
        const state = appStore.getState();
        const treeState = state.domInspector?.treeState;
        
        if (treeState) {
            this.treeState.expandedNodes = new Set(treeState.expandedNodes || []);
            this.treeState.selectedElementId = treeState.selectedElementId || null;
        }
    }

    saveTreeStateToAppState() {
        const treeState = {
            expandedNodes: Array.from(this.treeState.expandedNodes),
            selectedElementId: this.treeState.selectedElementId,
            scrollPosition: this.treeContainer.scrollTop,
            lastUpdate: Date.now()
        };
        
        dispatch({
            type: ActionTypes.DOM_INSPECTOR_SET_TREE_STATE,
            payload: treeState
        });
    }

    preserveTreeState() {
        // Save current expanded state
        const expandedNodes = this.treeContainer.querySelectorAll('.dom-inspector-node.expanded');
        this.treeState.expandedNodes.clear();
        
        expandedNodes.forEach(node => {
            const elementId = node.dataset.elementId;
            if (elementId) {
                this.treeState.expandedNodes.add(elementId);
            }
        });
        
        // Save scroll position
        this.treeState.scrollPosition = this.treeContainer.scrollTop;
        
        // Save to app state
        this.saveTreeStateToAppState();
    }

    restoreTreeState() {
        // Restore expanded nodes
        this.treeState.expandedNodes.forEach(elementId => {
            const node = this.treeContainer.querySelector(`[data-element-id="${elementId}"]`);
            if (node) {
                const toggle = node.querySelector('.dom-inspector-toggle');
                if (toggle && !node.classList.contains('expanded')) {
                    this.toggleNode(node);
                }
            }
        });
        
        // Restore scroll position
        if (this.treeState.scrollPosition) {
            this.treeContainer.scrollTop = this.treeState.scrollPosition;
        }
    }

    ensureTreeOpen() {
        // Ensure tree is expanded to show current selection
        if (this.selectedElement) {
            this.expandTreeToElement(this.selectedElement);
        }
    }

    createDisabledStateDetails(element) {
        const isDisabled = element.disabled || 
                          element.hasAttribute('disabled') || 
                          element.getAttribute('aria-disabled') === 'true';
        
        if (!isDisabled) return null;
        
        const container = document.createElement('div');
        container.className = 'dom-inspector-disabled-state';
        container.innerHTML = `
            <h4>Disabled Element</h4>
            <p>This element is currently disabled and cannot be interacted with.</p>
        `;
        
        return container;
    }

    createSelectDetails(element) {
        const content = document.createElement('div');
        const details = [];
        
        details.push(['Selected Index', element.selectedIndex]);
        details.push(['Options Count', element.options.length]);
        if (element.multiple) details.push(['Allows Multiple', 'Yes']);
        
        details.forEach(([key, value]) => {
            const row = document.createElement('div');
            row.className = 'details-group';
            row.innerHTML = `
                <span class="details-key">${key}:</span>
                <span class="details-value">${value}</span>
            `;
            content.appendChild(row);
        });
        
        return this.createCollapsibleSection('select-details', 'Select Element Details', content);
    }

    createBoxModel(computedStyles) {
        const container = document.createElement('div');
        container.className = 'dom-inspector-box-model-grid';

        const cleanValue = (value) => {
            const num = parseFloat(value);
            return num === 0 ? '0' : (value || 'auto');
        };

        container.innerHTML = `
            <div class="box-model-grid-row">
                <div class="box-model-label">Margin</div>
                <div class="box-model-grid">
                    <div class="box-model-item"><div>Top</div><div>${cleanValue(computedStyles.marginTop)}</div></div>
                    <div class="box-model-item"><div>Right</div><div>${cleanValue(computedStyles.marginRight)}</div></div>
                    <div class="box-model-item"><div>Bottom</div><div>${cleanValue(computedStyles.marginBottom)}</div></div>
                    <div class="box-model-item"><div>Left</div><div>${cleanValue(computedStyles.marginLeft)}</div></div>
                </div>
            </div>
             <div class="box-model-grid-row">
                <div class="box-model-label">Padding</div>
                <div class="box-model-grid">
                    <div class="box-model-item"><div>Top</div><div>${cleanValue(computedStyles.paddingTop)}</div></div>
                    <div class="box-model-item"><div>Right</div><div>${cleanValue(computedStyles.paddingRight)}</div></div>
                    <div class="box-model-item"><div>Bottom</div><div>${cleanValue(computedStyles.paddingBottom)}</div></div>
                    <div class="box-model-item"><div>Left</div><div>${cleanValue(computedStyles.paddingLeft)}</div></div>
                </div>
            </div>
            <div class="box-model-grid-row">
                <div class="box-model-label">Border</div>
                <div class="box-model-grid">
                    <div class="box-model-item"><div>Top</div><div>${cleanValue(computedStyles.borderTopWidth)}</div></div>
                    <div class="box-model-item"><div>Right</div><div>${cleanValue(computedStyles.borderRightWidth)}</div></div>
                    <div class="box-model-item"><div>Bottom</div><div>${cleanValue(computedStyles.borderBottomWidth)}</div></div>
                    <div class="box-model-item"><div>Left</div><div>${cleanValue(computedStyles.borderLeftWidth)}</div></div>
                </div>
            </div>
            <div class="box-model-grid-row">
                <div class="box-model-label">Size</div>
                <div class="box-model-grid box-model-size-grid">
                    <div class="box-model-item"><div>Width</div><div>${computedStyles.width}</div></div>
                    <div class="box-model-item"><div>Height</div><div>${computedStyles.height}</div></div>
                </div>
            </div>
        `;

        return container;
    }

    renderEventsSection(element) {
        const content = document.createElement('div');
        
        // Get all event listeners (this is limited by browser security)
        const events = [];
        
        // Check for common event attributes
        ['onclick', 'onchange', 'onsubmit', 'onload', 'onerror'].forEach(attr => {
            if (element[attr]) {
                events.push(attr.substring(2)); // Remove 'on' prefix
            }
        });
        
        if (events.length === 0) {
            content.innerHTML = '<p>No detectable event listeners</p>';
        } else {
            content.innerHTML = `
                <div class="events-list">
                    ${events.map(event => `<span class="event-badge">${event}</span>`).join('')}
                </div>
            `;
        }
        
        return this.createCollapsibleSection('events', 'Event Listeners', content);
    }

    renderEngineSection(element) {
        const content = document.createElement('div');
        const computedStyles = window.getComputedStyle(element);
        
        const engineDetails = [
            ['Display', computedStyles.display],
            ['Position', computedStyles.position],
            ['Z-Index', computedStyles.zIndex],
            ['Float', computedStyles.float],
            ['Clear', computedStyles.clear],
            ['Overflow', computedStyles.overflow],
        ];

        content.appendChild(this.createDetailsTable(engineDetails));
        
        return this.createCollapsibleSection('engine', 'Layout Engine', content);
    }

    createDetailsTable(items) {
        const table = document.createElement('table');
        table.className = 'dom-inspector-details-table';
        const tbody = table.createTBody();

        items.forEach(([key, value]) => {
            const row = tbody.insertRow();
            const keyCell = row.insertCell();
            const valueCell = row.insertCell();
            
            keyCell.className = 'details-table-key';
            keyCell.textContent = key;
            
            valueCell.className = 'details-table-value';
            valueCell.textContent = value;
        });

        return table;
    }

    generateCSSSelector(element) {
        if (!element || element === document) return '';
        if (element === document.documentElement) return 'html';
        
        // Try ID first (but sanitize it)
        if (element.id) {
            const sanitizedId = this.sanitizeSelector(element.id);
            if (sanitizedId && sanitizedId === element.id) {
                return `#${sanitizedId}`;
            }
        }
        
        // Try class if unique
        if (element.className) {
            const classNames = element.className && typeof element.className === 'string' ? element.className.split(' ') :
                              element.className && element.className.toString ? element.className.toString().split(' ') : [];
            const className = classNames[0];
            const sanitizedClass = this.sanitizeSelector(className);
            if (sanitizedClass && document.querySelectorAll(`.${sanitizedClass}`).length === 1) {
                return `.${sanitizedClass}`;
            }
        }
        
        // Build path selector
        const path = [];
        let current = element;
        
        while (current && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id) {
                const sanitizedId = this.sanitizeSelector(current.id);
                if (sanitizedId) {
                    selector += `#${sanitizedId}`;
                    path.unshift(selector);
                    break;
                }
            }
            
            if (current.className) {
                const classNames = current.className && typeof current.className === 'string' ? current.className.split(' ') :
                                  current.className && current.className.toString ? current.className.toString().split(' ') : [];
                const classes = classNames
                    .filter(c => c.trim())
                    .map(c => this.sanitizeSelector(c))
                    .filter(c => c);
                if (classes.length > 0) {
                    selector += `.${classes.join('.')}`;
                }
            }
            
            // Add nth-child if needed for uniqueness
            const siblings = Array.from(current.parentElement?.children || [])
                .filter(sibling => sibling.tagName === current.tagName);
            
            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
            }
            
            path.unshift(selector);
            current = current.parentElement;
        }
        
        return path.join(' > ');
    }

    sanitizeSelector(selector) {
        if (!selector) return '';
        
        // Remove invalid characters for CSS selectors
        // Keep only letters, numbers, hyphens, underscores
        return selector.replace(/[^a-zA-Z0-9\-_]/g, '');
    }

    debugFailedSelector(query) {
        console.group('DOM Inspector: Selector Debug');
        console.log('Failed query:', query);
        
        try {
            // Try to parse the selector by testing parts
            const parts = query.split(' ');
            console.log('Query parts:', parts);
            
            for (let i = 0; i < parts.length; i++) {
                const partialQuery = parts.slice(0, i + 1).join(' ');
                try {
                    const elements = document.querySelectorAll(partialQuery);
                    console.log(`Part "${partialQuery}": ${elements.length} matches`);
                } catch (e) {
                    console.log(`Part "${partialQuery}": INVALID`);
                }
            }
        } catch (e) {
            console.log('Debug failed:', e);
        }
        
        console.groupEnd();
    }

    showSelectorError(query, error) {
        console.error('DOM Inspector: Selector error:', error);
        
        if (this.detailsContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'dom-inspector-error';
            
            let suggestions = '';
            if (query.includes('/')) {
                // Try to suggest a corrected selector
                let correctedQuery = query;
                
                // Handle the specific case of theme-selector/directory-information
                if (query.includes('theme-selector/directory-information')) {
                    correctedQuery = query.replace('theme-selector/directory-information', 'theme-selector\\/directory-information');
                    suggestions = `
                        <div style="margin-top: 10px;">
                            <strong>Fix:</strong> Forward slashes in IDs need to be escaped in CSS selectors.
                            <br><strong>Try this:</strong> <code>${correctedQuery}</code>
                            <br><strong>Or use attribute selector:</strong> <code>[id="theme-selector/directory-information"] > h2.settings-section-header</code>
                            <button class="dom-inspector-fix-btn" onclick="
                                const input = document.querySelector('.dom-inspector-query-input');
                                if (input) { 
                                    input.value = '${correctedQuery}'; 
                                    input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
                                }
                            ">Try Fixed Selector</button>
                        </div>
                    `;
                } else {
                    suggestions = `
                        <div style="margin-top: 10px;">
                            <strong>Common fix:</strong> Forward slashes (/) in CSS selectors need to be escaped with backslashes.
                            <br>Or use attribute selectors like <code>[id="element-id"]</code> for IDs containing special characters.
                        </div>
                    `;
                }
            }
            
            errorDiv.innerHTML = `
                <h4>Invalid Selector</h4>
                <p><strong>Query:</strong> <code>${query}</code></p>
                <p><strong>Error:</strong> ${error.message}</p>
                ${suggestions}
                <div style="margin-top: 10px;">
                    <button class="dom-inspector-fix-btn" onclick="this.parentElement.parentElement.remove()">Dismiss</button>
                </div>
            `;
            this.detailsContainer.innerHTML = '';
            this.detailsContainer.appendChild(errorDiv);
        }
    }



    // Helper method you can call from console for testing
    testSelector(query) {
        console.log('DOM Inspector: Testing selector:', query);
        
        // Test the full selector
        const fullResult = document.querySelector(query);
        console.log('Full selector result:', fullResult);
        
        // Test each part
        const wrapper = document.querySelector('div.context-path-and-file-wrapper');
        console.log('Wrapper element:', wrapper);
        
        if (wrapper) {
            const breadcrumbs = wrapper.querySelector('div.context-breadcrumbs');
            console.log('Breadcrumbs in wrapper:', breadcrumbs);
        }
        
        // Test just the breadcrumbs class
        const allBreadcrumbs = document.querySelectorAll('.context-breadcrumbs');
        console.log('All elements with context-breadcrumbs class:', allBreadcrumbs);
        
        // Test the wrapper class
        const allWrappers = document.querySelectorAll('.context-path-and-file-wrapper');
        console.log('All elements with context-path-and-file-wrapper class:', allWrappers);
        
        return {
            fullResult,
            wrapper,
            allBreadcrumbs,
            allWrappers
        };
    }
} 