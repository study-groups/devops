/**
 * client/dom-inspector/DomInspectorPanel.js
 * Draggable, resizable DOM inspector panel.
 */

import { appStore } from "/client/appState.js";
import { dispatch, ActionTypes } from "/client/messaging/messageQueue.js";
import { ValidationUtils } from "./utils/ValidationUtils.js";
import { SelectorUtils } from "./utils/SelectorUtils.js";
import { DomUtils } from "./utils/DomUtils.js";
import { zIndexManager } from "/client/utils/ZIndexManager.js";
import { DomInspectorSettingsPanel } from "./DomInspectorSettingsPanel.js";

const DOM_INSPECTOR_STATE_KEY = 'devpages_dom_inspector_state';

function loadPersistedState() {
    try {
        const savedState = localStorage.getItem(DOM_INSPECTOR_STATE_KEY);
        if (savedState) {
            return JSON.parse(savedState);
        }
    } catch (e) {
        console.error('Failed to load DOM Inspector state:', e);
    }
    return null;
}

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

const HIGHLIGHT_MODES = ['none', 'border', 'both'];

export class DomInspectorPanel {
    constructor() {
        this.panel = null;
        this.treeContainer = null;
        this.detailsContainer = null;
        this.closeButton = null;
        this.querySelectorInput = null;
        this.elementPickerButton = null;
        this.breadcrumbContainer = null;
        this.historyContainer = null;
        this.isVisible = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isResizing = false;
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };

        this.selectedElement = null;
        this.isPickerActive = false;
        this.highlightOverlay = null;

        this.stateUnsubscribe = null;
        this.elementCache = new Map();
        this.nextCacheId = 0;
        this.elementIdCounter = 0; // Counter for generating unique element IDs

        const persistedState = loadPersistedState();
        if (persistedState) {
             dispatch({
                type: ActionTypes.DOM_INSPECTOR_SET_STATE,
                payload: persistedState
            });
        }
        
        const initialState = appStore.getState().domInspector;
        this.currentPos = { ...initialState.position };
        this.currentSize = { ...initialState.size };
        
        this.highlightSettings = { ...initialState.highlight };

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

        this.createPanel();
        this.setupEventHandlers();
        this.subscribeToState();
        this.registerWithZIndexManager();
        
        // Create settings panel
        this.settingsPanel = new DomInspectorSettingsPanel(this);

        // Load tree state from app state
        this.loadTreeStateFromAppState();

        // BUILD TREE IMMEDIATELY DURING INITIALIZATION
        // This ensures the tree is ready whether the panel is shown or not
        this.buildTree();

        // Create highlight overlay immediately so it's available for selections
        this.createHighlightOverlay();

        this.render(initialState);
    }

    createPanel() {
        if (this.panel) {
            return;
        }

        this.panel = document.createElement('div');
        this.panel.className = 'dom-inspector-panel base-popup';
        this.panel.style.display = 'none';
        
        const state = appStore.getState().domInspector;
        this.panel.style.width = `${state.size.width}px`;
        this.panel.style.height = `${state.size.height}px`;
        this.panel.style.top = `${state.position.y}px`;
        this.panel.style.left = `${state.position.x}px`;

        const header = document.createElement('div');
        header.className = 'dom-inspector-header';
        header.innerHTML = `
            <span>DOM Inspector</span>
            <div class="header-buttons">
                <button class="dom-inspector-settings-btn" title="Settings">⚙</button>
                <button class="dom-inspector-close" title="Close">×</button>
            </div>
        `;

        this.closeButton = header.querySelector('.dom-inspector-close');
        this.settingsButton = header.querySelector('.dom-inspector-settings-btn');
        this.panel.appendChild(header);

        const queryContainer = document.createElement('div');
        queryContainer.className = 'dom-inspector-query-container';

        // Input section
        const inputSection = document.createElement('div');
        inputSection.className = 'dom-inspector-input-section';

        this.querySelectorInput = document.createElement('input');
        this.querySelectorInput.type = 'text';
        this.querySelectorInput.placeholder = 'CSS Selector';
        this.querySelectorInput.className = 'dom-inspector-query-input';

        // Button group
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'dom-inspector-button-group';

        this.elementPickerButton = document.createElement('button');
        this.elementPickerButton.textContent = 'Select';
        this.elementPickerButton.className = 'dom-inspector-btn dom-inspector-picker-btn';
        this.elementPickerButton.title = 'Click to select element by pointing';

        this.saveButton = document.createElement('button');
        this.saveButton.textContent = 'Save';
        this.saveButton.className = 'dom-inspector-btn dom-inspector-save-btn';
        this.saveButton.title = 'Save current selector to history';

        this.clearButton = document.createElement('button');
        this.clearButton.textContent = 'Clear';
        this.clearButton.className = 'dom-inspector-btn dom-inspector-clear-btn';
        this.clearButton.title = 'Clear input and selection, or delete preset if selector matches';

        this.highlightToggleButton = document.createElement('button');
        this.highlightToggleButton.className = 'dom-inspector-btn dom-inspector-highlight-toggle';
        this.updateHighlightButtonVisuals();

        inputSection.appendChild(this.querySelectorInput);
        buttonGroup.appendChild(this.elementPickerButton);
        buttonGroup.appendChild(this.saveButton);
        buttonGroup.appendChild(this.clearButton);
        buttonGroup.appendChild(this.highlightToggleButton);

        queryContainer.appendChild(inputSection);
        queryContainer.appendChild(buttonGroup);

        const quickSelectContainer = document.createElement('div');
        quickSelectContainer.className = 'dom-inspector-quick-select';
        this.historyContainer = quickSelectContainer;

        this.panel.appendChild(queryContainer);
        this.panel.appendChild(quickSelectContainer);

        const mainContent = document.createElement('div');
        mainContent.className = 'dom-inspector-main';

        this.treeContainer = document.createElement('div');
        this.treeContainer.className = 'dom-inspector-tree';

        this.detailsContainer = document.createElement('div');
        this.detailsContainer.className = 'dom-inspector-details';

        mainContent.appendChild(this.treeContainer);
        mainContent.appendChild(this.detailsContainer);

        this.panel.appendChild(mainContent);
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'dom-inspector-resize-handle';
        this.panel.appendChild(resizeHandle);
        
        document.body.appendChild(this.panel);
        this.updateHistoryButtons();
    }

    subscribeToState() {
        this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
            const oldInspectorState = prevState.domInspector;
            const newInspectorState = newState.domInspector;

            if (oldInspectorState.visible !== newInspectorState.visible) {
                this.isVisible = newInspectorState.visible;
                this.panel.style.display = this.isVisible ? 'flex' : 'none';
            }
            if (!this.isDragging && JSON.stringify(oldInspectorState.position) !== JSON.stringify(newInspectorState.position)) {
                this.panel.style.left = `${newInspectorState.position.x}px`;
                this.panel.style.top = `${newInspectorState.position.y}px`;
                this.currentPos = { ...newInspectorState.position };
            }
            if (!this.isResizing && JSON.stringify(oldInspectorState.size) !== JSON.stringify(newInspectorState.size)) {
                this.panel.style.width = `${newInspectorState.size.width}px`;
                this.panel.style.height = `${newInspectorState.size.height}px`;
                this.currentSize = { ...newInspectorState.size };
            }
            if (JSON.stringify(oldInspectorState.highlight) !== JSON.stringify(newInspectorState.highlight)) {
                this.highlightSettings = { ...newInspectorState.highlight };
                this.updateHighlightButtonVisuals();
                this.updateHighlightStyles();
            }
            if (JSON.stringify(oldInspectorState.selectorHistory) !== JSON.stringify(newInspectorState.selectorHistory)) {
                this.updateHistoryButtons();
            }
            if (this.selectedElement && JSON.stringify(oldInspectorState.collapsedSections) !== JSON.stringify(newInspectorState.collapsedSections)) {
                this.displayElementDetails(this.selectedElement);
            }
        });
    }

    render(state) {
        if (!this.panel) return;

        this.isVisible = state.visible;
        this.panel.style.display = this.isVisible ? 'flex' : 'none';

        if (!this.isDragging) {
            this.panel.style.left = `${state.position.x}px`;
            this.panel.style.top = `${state.position.y}px`;
            this.currentPos = { ...state.position };
        }
        if (!this.isResizing) {
            this.panel.style.width = `${state.size.width}px`;
            this.panel.style.height = `${state.size.height}px`;
            this.currentSize = { ...state.size };
        }
        
        this.highlightSettings = { ...state.highlight };
        this.updateHighlightButtonVisuals();
        this.updateHighlightStyles();
        
        this.updateHistoryButtons();

        if(this.selectedElement) {
            this.displayElementDetails(this.selectedElement);
        }
    }

    setupEventHandlers() {
        const header = this.panel.querySelector('.dom-inspector-header');
        const resizeHandle = this.panel.querySelector('.dom-inspector-resize-handle');

        this.closeButton.addEventListener('click', () => this.hide());
        this.settingsButton.addEventListener('click', () => this.settingsPanel.toggle());

        this.querySelectorInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.selectElementByQuery(e.target.value);
            }
        });

        this.elementPickerButton.addEventListener('click', () => this.togglePickerMode());

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
                const state = appStore.getState().domInspector;
                const history = state.selectorHistory || [];
                
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
                        this.highlightElement(element);
                        // Flash the highlight to make it more visible
                        this.flashHighlight();
                        console.log('DOM Inspector: Shift+click - highlighting element in page');
                    } else {
                        // Normal click selects the element
                        this.selectElement(element);
                    }
                }
            }
        });

        header.addEventListener('mousedown', (e) => this.startDrag(e));
        resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));

        // Click to bring to front functionality
        this.panel.addEventListener('mousedown', (e) => {
            // Only bring to front if not clicking on specific interactive elements
            if (!e.target.closest('button, input, select, textarea, .dom-inspector-node-toggle')) {
                this.bringToFront();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            this.doDrag(e);
            this.doResize(e);
        });
        document.addEventListener('mouseup', () => {
            this.endDrag();
            this.endResize();
        });

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
    
    startDrag(e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        this.isDragging = true;
        const rect = this.panel.getBoundingClientRect();
        this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    doDrag(e) {
        if (!this.isDragging) return;
        this.currentPos.x = e.clientX - this.dragOffset.x;
        this.currentPos.y = e.clientY - this.dragOffset.y;
        this.panel.style.left = `${this.currentPos.x}px`;
        this.panel.style.top = `${this.currentPos.y}px`;
    }

    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        dispatch({ type: ActionTypes.DOM_INSPECTOR_SET_POSITION, payload: this.currentPos });
    }

    startResize(e) {
        e.preventDefault();
        this.isResizing = true;
        this.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: this.panel.offsetWidth,
            height: this.panel.offsetHeight
        };
    }

    doResize(e) {
        if (!this.isResizing) return;
        const newWidth = Math.max(300, this.resizeStart.width + (e.clientX - this.resizeStart.x));
        const newHeight = Math.max(200, this.resizeStart.height + (e.clientY - this.resizeStart.y));
        this.currentSize = { width: newWidth, height: newHeight };
        this.panel.style.width = `${newWidth}px`;
        this.panel.style.height = `${newHeight}px`;
    }

    endResize() {
        if (!this.isResizing) return;
        this.isResizing = false;
        dispatch({ type: ActionTypes.DOM_INSPECTOR_SET_SIZE, payload: this.currentSize });
    }

    show() {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_SET_VISIBLE, payload: true });
        // Always build tree when showing to ensure it's populated
        this.buildTree();
    }

    hide() {
        dispatch({ type: ActionTypes.DOM_INSPECTOR_SET_VISIBLE, payload: false });
        if (this.isPickerActive) {
            this.togglePickerMode();
        }
    }
    
    toggle() {
        // Use the store state for consistency
        const currentState = appStore.getState().domInspector;
        currentState.visible ? this.hide() : this.show();
    }
    
    savePreset(selector) {
        if (!selector) return;
        dispatch({ type: ActionTypes.DOM_INSPECTOR_ADD_SELECTOR_HISTORY, payload: selector });
    }

    removePreset(selector) {
        if (!selector) return;
        dispatch({ type: ActionTypes.DOM_INSPECTOR_REMOVE_SELECTOR_HISTORY, payload: selector });
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
        const state = appStore.getState().domInspector;
        const history = state.selectorHistory || [];

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
                    // Populate the query input with the full selector
                    this.querySelectorInput.value = selector;
                    this.selectElementByQuery(selector);
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
        this.hideHighlight();
        
        // Clear selected element reference
        this.selectedElement = null;
    }

    createCollapsibleSection(id, titleContent, contentEl) {
        const container = document.createElement('div');
        container.className = 'dom-inspector-section';

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

        const state = appStore.getState().domInspector;
        const isCollapsed = state.collapsedSections[id];

        contentEl.style.display = isCollapsed ? 'none' : 'block';
        indicator.textContent = isCollapsed ? '▶' : '▼';
        if (isCollapsed) container.classList.add('collapsed');

        header.addEventListener('click', () => {
            const willBeCollapsed = !container.classList.contains('collapsed');
            dispatch({
                type: ActionTypes.DOM_INSPECTOR_SET_SECTION_COLLAPSED,
                payload: { id, collapsed: willBeCollapsed }
            });
        });

        return container;
    }

    displayElementDetails(element) {
        this.detailsContainer.innerHTML = '';
        this.selectedElement = element;
        this.highlightElement(element);

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

        // Find and select new in tree
        for(const node of allNodes) {
            if(this.getElementFromCache(node.dataset.elementId) === element) {
                const header = node.querySelector('.dom-inspector-node-header');
                if (header) {
                    header.classList.add('selected');
                }
                
                // Expand ALL parents to make selection visible
                this.expandParentsToNode(node);
                
                // Scroll the selected node into view
                node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                break;
            }
        }
        
        // Generate and populate CSS selector
        const cssSelector = this.generateCSSSelector(element);
        this.querySelectorInput.value = cssSelector;
        console.log('DOM Inspector: Generated CSS selector:', cssSelector);
        
        this.displayElementDetails(element);
    }

    // Improved helper method to expand all parents
    expandParentsToNode(targetNode) {
        console.log('DOM Inspector: Expanding parents for node:', targetNode);
        let currentNode = targetNode;
        const nodesToExpand = [];
        
        // Collect all parent nodes that need to be expanded
        while (currentNode) {
            // Look for the parent container (should be .dom-inspector-node-children)
            let parentContainer = currentNode.parentElement;
            
            // If we're directly in the tree container, we've reached the root
            if (parentContainer && parentContainer.classList.contains('dom-inspector-tree')) {
                break;
            }
            
            // If we're in a children container, get its parent node
            if (parentContainer && parentContainer.classList.contains('dom-inspector-node-children')) {
                const parentNode = parentContainer.parentElement;
                if (parentNode && parentNode.classList.contains('dom-inspector-node')) {
                    console.log('DOM Inspector: Found parent node to expand:', parentNode);
                    nodesToExpand.push(parentNode);
                    currentNode = parentNode;
                } else {
                    console.log('DOM Inspector: Parent container found but no valid parent node');
                    break;
                }
            } else {
                // If we're not in a children container, try to find the next parent node
                parentContainer = currentNode.parentElement?.closest('.dom-inspector-node');
                if (parentContainer && parentContainer !== currentNode) {
                    console.log('DOM Inspector: Found closest parent node:', parentContainer);
                    nodesToExpand.push(parentContainer);
                    currentNode = parentContainer;
                } else {
                    console.log('DOM Inspector: No more parent nodes found');
                    break;
                }
            }
        }
        
        console.log('DOM Inspector: Nodes to expand:', nodesToExpand);
        
        // Expand all collected parent nodes
        nodesToExpand.forEach(node => {
            if (!node.classList.contains('expanded')) {
                console.log('DOM Inspector: Expanding node:', node);
                this.toggleNode(node);
            } else {
                console.log('DOM Inspector: Node already expanded:', node);
            }
        });
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
            
            let statusIcon = isDisabled ? '🚫' : '🔒';
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
                enableBtn.textContent = '✅ Enabled!';
                enableBtn.disabled = true;
            });
            
            copyBtn.addEventListener('click', () => {
                const selector = this.generateCSSSelector(element);
                const cssRule = `${selector} {\n  pointer-events: auto !important;\n}\n\n${selector}:disabled {\n  opacity: 1 !important;\n  cursor: pointer !important;\n}`;
                navigator.clipboard.writeText(cssRule).then(() => {
                    copyBtn.textContent = '✅ Copied!';
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
                <h4>🎯 Element Selection Issue</h4>
                <p>This element is covered by child elements, making it hard to click directly.</p>
            `;
            
            if (clickabilityResult.bestClickPoint) {
                content += `
                    <p><strong>✅ Solution:</strong> Element is clickable at the <strong>${clickabilityResult.bestClickPoint.name}</strong> area.</p>
                    <button class="dom-inspector-fix-btn" data-action="highlight-clickable">Show Clickable Area</button>
                `;
            } else {
                content += `
                    <p><strong>💡 Tip:</strong> Try selecting a child element instead, or use the element picker to click on the border/padding area.</p>
                `;
            }
            
            if (clickabilityResult.childInterceptPoints.length > 0) {
                content += `
                    <p><strong>Child elements intercepting clicks:</strong></p>
                    <ul>`;
                
                clickabilityResult.childInterceptPoints.slice(0, 3).forEach(point => {
                    const tagName = point.elementAtPoint.tagName.toLowerCase();
                    const className = point.elementAtPoint.className;
                    content += `<li><code>${tagName}${className ? '.' + className.split(' ')[0] : ''}</code></li>`;
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
        // Create a small highlight dot at the clickable point
        const dot = document.createElement('div');
        dot.className = 'dom-inspector-clickable-dot';
        dot.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: #00ff00;
            border: 2px solid #fff;
            border-radius: 50%;
            z-index: 999999;
            pointer-events: none;
            left: ${clickPoint.x - 5}px;
            top: ${clickPoint.y - 5}px;
            animation: pulse 1s infinite;
        `;
        
        // Add pulse animation
        if (!document.querySelector('#clickable-dot-animation')) {
            const style = document.createElement('style');
            style.id = 'clickable-dot-animation';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(dot);
        
        // Remove after 3 seconds
        setTimeout(() => {
            dot.remove();
        }, 3000);
        
        console.log(`DOM Inspector: Clickable area highlighted at (${clickPoint.x}, ${clickPoint.y})`);
    }

    shouldAllowNormalClick(element) {
        if (!element) {
            return false;
        }

        const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
        const tagName = element.tagName.toLowerCase();

        if (interactiveTags.includes(tagName) && !element.disabled) {
            return true;
        }

        if (element.isContentEditable) {
            return true;
        }

        const role = element.getAttribute('role');
        if (role && ['button', 'link', 'menuitem', 'checkbox', 'radio', 'tab'].includes(role)) {
            return true;
        }

        if (element.hasAttribute('onclick')) {
            return true;
        }

        return false;
    }

    handlePickerClick = (e) => {
        if (!this.isPickerActive) return;
        
        if (this.panel && this.panel.contains(e.target)) {
            return;
        }
        
        if (!this.deepSelectMode && this.shouldAllowNormalClick(e.target)) {
            this.showForcePickHint();
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        this.togglePickerMode();
        this.selectElement(e.target);
    }

    togglePickerMode() {
        this.isPickerActive = !this.isPickerActive;
        this.elementPickerButton.classList.toggle('active', this.isPickerActive);
        if (this.isPickerActive) {
            document.addEventListener('mousemove', this.handlePickerMouseMove, { capture: true, passive: true });
            document.addEventListener('click', this.handlePickerClick, { capture: true });
        } else {
            document.removeEventListener('mousemove', this.handlePickerMouseMove, { capture: true, passive: true });
            document.removeEventListener('click', this.handlePickerClick, { capture: true });
            this.hideHighlight();
        }
    }

    handlePickerMouseMove = (e) => {
        if (!this.isPickerActive) return;
        if (this.panel && this.panel.contains(e.target)) {
            this.hideHighlight();
            return;
        }
        
        this.highlightElement(e.target);
    }

    // --- Z-Index Management ---

    registerWithZIndexManager() {
        if (this.panel && zIndexManager) {
            // Register the DOM inspector in the UI layer with high priority
            this.zIndex = zIndexManager.register(this.panel, 'UI', 75, {
                name: 'DOM Inspector',
                type: 'panel',
                resizable: true,
                draggable: true
            });
            
            console.log(`DOM Inspector registered with Z-Index Manager: z-index ${this.zIndex}`);
        }
    }

    bringToFront() {
        if (this.panel && zIndexManager) {
            const newZIndex = zIndexManager.bringToFront(this.panel);
            this.zIndex = newZIndex;
            console.log(`DOM Inspector brought to front: z-index ${newZIndex}`);
            
            // Add visual feedback
            this.panel.classList.add('brought-to-front');
            setTimeout(() => {
                this.panel.classList.remove('brought-to-front');
            }, 200);
        }
    }

    unregisterFromZIndexManager() {
        if (this.panel && zIndexManager) {
            zIndexManager.unregister(this.panel);
            console.log('DOM Inspector unregistered from Z-Index Manager');
        }
    }

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
        // Unregister from Z-Index Manager
        this.unregisterFromZIndexManager();
        
        // Destroy settings panel
        if (this.settingsPanel) {
            this.settingsPanel.destroy();
            this.settingsPanel = null;
        }
        
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
        this.removeHighlightOverlay();
    }

    // --- Highlight System Methods ---
    updateHighlightButtonVisuals() {
        if (!this.highlightToggleButton) return;
        
        const mode = this.highlightSettings.mode;
        const modeIndex = HIGHLIGHT_MODES.indexOf(mode);
        const nextMode = HIGHLIGHT_MODES[(modeIndex + 1) % HIGHLIGHT_MODES.length];
        
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

    updateHighlightStyles() {
        if (!this.highlightOverlay) return;
        
        const mode = this.highlightSettings.mode;
        const color = this.highlightSettings.color;
        
        // Update overlay styles based on current mode
        if (mode === 'none') {
            this.highlightOverlay.style.border = 'none';
            this.highlightOverlay.style.backgroundColor = 'transparent';
        } else if (mode === 'border') {
            this.highlightOverlay.style.border = `2px solid ${color}`;
            this.highlightOverlay.style.backgroundColor = 'transparent';
        } else if (mode === 'both') {
            this.highlightOverlay.style.border = `2px solid ${color}`;
            // Create a translucent version of the color
            const rgb = this.hexToRgb(color);
            this.highlightOverlay.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
        }
    }

    createHighlightOverlay() {
        if (this.highlightOverlay) {
            this.highlightOverlay.remove();
        }
        
        this.highlightOverlay = document.createElement('div');
        this.highlightOverlay.className = 'dom-inspector-highlight-overlay';
        this.highlightOverlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 999999;
            top: 0;
            left: 0;
            width: 0;
            height: 0;
            transition: all 0.1s ease;
            border-radius: 2px;
            display: none;
        `;
        
        document.body.appendChild(this.highlightOverlay);
        this.updateHighlightStyles();
    }

    removeHighlightOverlay() {
        if (this.highlightOverlay) {
            this.highlightOverlay.remove();
            this.highlightOverlay = null;
        }
    }

    highlightElement(element) {
        if (!this.highlightOverlay || !element) return;
        
        const rect = element.getBoundingClientRect();
        const mode = this.highlightSettings.mode;
        
        if (mode === 'none') {
            this.highlightOverlay.style.display = 'none';
            return;
        }
        
        this.highlightOverlay.style.display = 'block';
        this.highlightOverlay.style.top = `${rect.top}px`;
        this.highlightOverlay.style.left = `${rect.left}px`;
        this.highlightOverlay.style.width = `${rect.width}px`;
        this.highlightOverlay.style.height = `${rect.height}px`;
        
        this.updateHighlightStyles();
    }

    hideHighlight() {
        if (this.highlightOverlay) {
            this.highlightOverlay.style.display = 'none';
        }
    }

    flashHighlight() {
        if (!this.highlightOverlay) return;
        
        // Add a flash animation class
        this.highlightOverlay.classList.add('flash-highlight');
        
        // Remove the class after animation completes
        setTimeout(() => {
            if (this.highlightOverlay) {
                this.highlightOverlay.classList.remove('flash-highlight');
            }
        }, 600);
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
        const currentMode = this.highlightSettings.mode;
        const modeIndex = HIGHLIGHT_MODES.indexOf(currentMode);
        const nextMode = HIGHLIGHT_MODES[(modeIndex + 1) % HIGHLIGHT_MODES.length];
        
        dispatch({
            type: ActionTypes.DOM_INSPECTOR_SET_HIGHLIGHT,
            payload: { ...this.highlightSettings, mode: nextMode }
        });
    }

    openColorPicker() {
        // Create a simple color picker
        const input = document.createElement('input');
        input.type = 'color';
        input.value = this.highlightSettings.color;
        input.style.position = 'fixed';
        input.style.top = '-1000px';
        input.style.left = '-1000px';
        
        document.body.appendChild(input);
        
        input.addEventListener('change', (e) => {
            const newColor = e.target.value;
            dispatch({
                type: ActionTypes.DOM_INSPECTOR_SET_HIGHLIGHT,
                payload: { ...this.highlightSettings, color: newColor }
            });
            input.remove();
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => input.remove(), 100);
        });
        
        input.click();
    }

    // Utility method to convert hex color to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 68, g: 138, b: 255 }; // Default blue
    }

    // --- Missing Element Details Methods ---
    createElementSummary(element) {
        const content = document.createElement('div');
        content.className = 'dom-inspector-element-summary';
        
        const tagName = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
        
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
        
        this.selectElement(targetElement);
    }

    expandTreeToElement(element) {
        // Find the tree node for this element and expand parents
        const allNodes = this.treeContainer.querySelectorAll('.dom-inspector-node');
        for (const node of allNodes) {
            const cachedElement = this.getElementFromCache(node.dataset.elementId);
            if (cachedElement === element) {
                this.expandParentsToNode(node);
                // Scroll into view
                node.scrollIntoView({ block: 'center', behavior: 'smooth' });
                break;
            }
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
            <h4>⚠️ Disabled Element</h4>
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
            const className = element.className.split(' ')[0];
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
                const classes = current.className.split(' ')
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
                            <strong>💡 Fix:</strong> Forward slashes in IDs need to be escaped in CSS selectors.
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
                            <strong>💡 Common fix:</strong> Forward slashes (/) in CSS selectors need to be escaped with backslashes.
                            <br>Or use attribute selectors like <code>[id="element-id"]</code> for IDs containing special characters.
                        </div>
                    `;
                }
            }
            
            errorDiv.innerHTML = `
                <h4>❌ Invalid Selector</h4>
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

    showForcePickHint() {
        console.log('DOM Inspector: Use Shift+Click to force select interactive elements');
        
        // Show temporary tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'dom-inspector-force-pick-hint';
        tooltip.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #333;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000000;
            font-size: 14px;
            pointer-events: none;
        `;
        tooltip.textContent = 'Hold Shift and click to select interactive elements';
        
        document.body.appendChild(tooltip);
        
        setTimeout(() => {
            tooltip.remove();
        }, 2000);
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