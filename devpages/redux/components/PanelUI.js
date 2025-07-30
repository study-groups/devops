/**
 * client/dom-inspector/core/PanelUI.js
 * Handles DOM Inspector panel UI creation, dragging, resizing, and Z-index management
 */

import { zIndexManager } from "../utils/ZIndexManager.js";

export class PanelUI {
    constructor(options = {}) {
        this.panel = null;
        this.header = null;
        this.resizeHandle = null;
        this.splitter = null;
        
        // UI element references
        this.closeButton = null;
        this.settingsButton = null;
        this.treeContainer = null;
        this.detailsContainer = null;
        this.querySelectorInput = null;
        this.elementPickerButton = null;
        this.saveButton = null;
        this.clearButton = null;
        this.highlightToggleButton = null;
        this.historyContainer = null;
        
        // State
        this.isVisible = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isResizing = false;
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        this.isSplitterDragging = false;
        this.splitPosition = options.initialSplitPosition || 33;
        this.currentPos = { x: 100, y: 100 };
        this.currentSize = { width: 800, height: 600 };
        this.zIndex = null;
        
        // Callbacks
        this.onPositionChange = options.onPositionChange || null;
        this.onSizeChange = options.onSizeChange || null;
        this.onSplitChange = options.onSplitChange || null;
        this.onClose = options.onClose || null;
        this.onSettings = options.onSettings || null;
        this.onBringToFront = options.onBringToFront || null;
        
        // Create panel immediately
        this.createPanel();
        this.setupEventHandlers();
    }

    /**
     * Create the main panel DOM structure
     */
    createPanel() {
        if (this.panel) {
            return;
        }

        this.panel = document.createElement('div');
        this.panel.className = 'dom-inspector-panel base-popup';
        this.panel.style.display = 'none';
        this.panel.style.width = `${this.currentSize.width}px`;
        this.panel.style.height = `${this.currentSize.height}px`;
        this.panel.style.top = `${this.currentPos.y}px`;
        this.panel.style.left = `${this.currentPos.x}px`;

        // Create header
        this.header = document.createElement('div');
        this.header.className = 'dom-inspector-header';
        this.header.innerHTML = `
            <span class="dom-inspector-title">DOM Inspector</span>
            <div class="header-buttons">
                <button class="btn btn-sm btn-ghost dom-inspector-settings-btn" title="Settings">⚙</button>
                <button class="btn btn-sm btn-ghost dom-inspector-close" title="Close">×</button>
            </div>
        `;

        this.closeButton = this.header.querySelector('.dom-inspector-close');
        this.settingsButton = this.header.querySelector('.dom-inspector-settings-btn');
        this.panel.appendChild(this.header);

        // Create query container
        const queryContainer = this.createQueryContainer();
        this.panel.appendChild(queryContainer);

        // Create main content area
        const mainContent = document.createElement('div');
        mainContent.className = 'dom-inspector-main';

        this.treeContainer = document.createElement('div');
        this.treeContainer.className = 'dom-inspector-tree';
        this.treeContainer.style.width = `${this.splitPosition}%`;

        // Create splitter
        this.splitter = document.createElement('div');
        this.splitter.className = 'dom-inspector-splitter';
        this.splitter.innerHTML = '<div class="splitter-handle"></div>';

        this.detailsContainer = document.createElement('div');
        this.detailsContainer.className = 'dom-inspector-details';
        this.detailsContainer.style.width = `${100 - this.splitPosition}%`;

        mainContent.appendChild(this.treeContainer);
        mainContent.appendChild(this.splitter);
        mainContent.appendChild(this.detailsContainer);
        this.panel.appendChild(mainContent);
        
        // Create resize handle
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'dom-inspector-resize-handle';
        this.panel.appendChild(this.resizeHandle);
        
        // Add to DOM
        document.body.appendChild(this.panel);
    }

    /**
     * Create the query/input container with all controls
     */
    createQueryContainer() {
        const queryContainer = document.createElement('div');
        queryContainer.className = 'dom-inspector-query-container';

        // Input row (top row with input and buttons)
        const inputRow = document.createElement('div');
        inputRow.className = 'dom-inspector-input-row';

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
        this.highlightToggleButton.textContent = '○'; // Default highlight button text
        this.highlightToggleButton.title = 'Highlight: None (click for border)';

        inputSection.appendChild(this.querySelectorInput);
        buttonGroup.appendChild(this.elementPickerButton);
        buttonGroup.appendChild(this.saveButton);
        buttonGroup.appendChild(this.clearButton);
        buttonGroup.appendChild(this.highlightToggleButton);

        inputRow.appendChild(inputSection);
        inputRow.appendChild(buttonGroup);
        queryContainer.appendChild(inputRow);

        // History container (bottom row with smaller preset buttons)
        const quickSelectContainer = document.createElement('div');
        quickSelectContainer.className = 'dom-inspector-quick-select';
        this.historyContainer = quickSelectContainer;
        queryContainer.appendChild(quickSelectContainer);

        return queryContainer;
    }

    /**
     * Setup event handlers for panel interactions
     */
    setupEventHandlers() {
        // Close and settings buttons
        if (this.closeButton && this.onClose) {
            this.closeButton.addEventListener('click', this.onClose);
        }
        if (this.settingsButton && this.onSettings) {
            this.settingsButton.addEventListener('click', this.onSettings);
        }

        // Dragging
        this.header.addEventListener('mousedown', (e) => this.startDrag(e));

        // Resizing
        this.resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));

        // Splitter dragging
        this.splitter.addEventListener('mousedown', (e) => this.startSplitterDrag(e));

        // Click to bring to front functionality
        this.panel.addEventListener('mousedown', (e) => {
            // Only bring to front if not clicking on specific interactive elements
            if (!e.target.closest('button, input, select, textarea, .dom-inspector-node-toggle, .dom-inspector-splitter')) {
                this.bringToFront();
            }
        });
        
        // Global mouse events for drag and resize
        document.addEventListener('mousemove', (e) => {
            this.doDrag(e);
            this.doResize(e);
            this.doSplitterDrag(e);
        });
        
        document.addEventListener('mouseup', () => {
            this.endDrag();
            this.endResize();
            this.endSplitterDrag();
        });
    }

    /**
     * Start dragging operation
     */
    startDrag(e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        this.isDragging = true;
        const rect = this.panel.getBoundingClientRect();
        this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    /**
     * Handle drag movement
     */
    doDrag(e) {
        if (!this.isDragging) return;
        this.currentPos.x = e.clientX - this.dragOffset.x;
        this.currentPos.y = e.clientY - this.dragOffset.y;
        this.panel.style.left = `${this.currentPos.x}px`;
        this.panel.style.top = `${this.currentPos.y}px`;
    }

    /**
     * End dragging operation
     */
    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (this.onPositionChange) {
            this.onPositionChange(this.currentPos);
        }
    }

    /**
     * Start resize operation
     */
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

    /**
     * Handle resize movement
     */
    doResize(e) {
        if (!this.isResizing) return;
        const newWidth = Math.max(300, this.resizeStart.width + (e.clientX - this.resizeStart.x));
        const newHeight = Math.max(200, this.resizeStart.height + (e.clientY - this.resizeStart.y));
        this.currentSize = { width: newWidth, height: newHeight };
        this.panel.style.width = `${newWidth}px`;
        this.panel.style.height = `${newHeight}px`;
    }

    /**
     * End resize operation
     */
    endResize() {
        if (!this.isResizing) return;
        this.isResizing = false;
        if (this.onSizeChange) {
            this.onSizeChange(this.currentSize);
        }
    }

    /**
     * Start splitter drag operation
     */
    startSplitterDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        this.isSplitterDragging = true;
        document.body.classList.add('dom-inspector-splitter-dragging');
    }

    /**
     * Handle splitter drag movement
     */
    doSplitterDrag(e) {
        if (!this.isSplitterDragging) return;
        const rect = this.panel.getBoundingClientRect();
        const newSplitPosition = ((e.clientX - rect.left) / rect.width) * 100;

        // Clamp position between 10% and 90%
        this.splitPosition = Math.max(10, Math.min(90, newSplitPosition));
        this.updateSplitLayout();
    }

    /**
     * End splitter drag operation
     */
    endSplitterDrag() {
        if (!this.isSplitterDragging) return;
        this.isSplitterDragging = false;
        document.body.style.cursor = '';
        if (this.onSplitChange) {
            this.onSplitChange(this.splitPosition);
        }
    }

    /**
     * Update the layout based on current split position
     */
    updateSplitLayout() {
        if (!this.treeContainer || !this.detailsContainer) return;
        this.treeContainer.style.width = `${this.splitPosition}%`;
        this.detailsContainer.style.width = `${100 - this.splitPosition}%`;
    }

    /**
     * Show the panel
     */
    show() {
        console.log('[PanelUI] show() called.');
        if (!this.panel) {
            console.error('[PanelUI] this.panel is null in show()');
            return;
        }
        console.log(`[PanelUI] Before show: display=${this.panel.style.display}`);
        this.panel.style.display = 'flex';
        console.log(`[PanelUI] After show: display=${this.panel.style.display}`);
        this.isVisible = true;
        this.bringToFront();
    }

    /**
     * Hide the panel
     */
    hide() {
        console.log('[PanelUI] hide() called.');
        if (!this.panel) {
            console.error('[PanelUI] this.panel is null in hide()');
            return;
        }
        console.log(`[PanelUI] Before hide: display=${this.panel.style.display}`);
        this.panel.style.display = 'none';
        console.log(`[PanelUI] After hide: display=${this.panel.style.display}`);
        this.isVisible = false;
    }

    /**
     * Check if panel is visible
     */
    isShowing() {
        return this.isVisible;
    }

    /**
     * Update panel position
     */
    setPosition(position) {
        if (!this.isDragging && position && typeof position.x === 'number' && typeof position.y === 'number') {
            this.panel.style.left = `${position.x}px`;
            this.panel.style.top = `${position.y}px`;
            this.currentPos = { ...position };
        } else {
            console.warn('[PanelUI] Invalid position provided to setPosition:', position);
        }
    }

    /**
     * Update panel size
     */
    setSize(size) {
        if (!this.isResizing && size && typeof size.width === 'number' && typeof size.height === 'number') {
            this.panel.style.width = `${size.width}px`;
            this.panel.style.height = `${size.height}px`;
            this.currentSize = { ...size };
        } else {
            console.warn('[PanelUI] Invalid size provided to setSize:', size);
        }
    }

    /**
     * Get current position
     */
    getPosition() {
        return { ...this.currentPos };
    }

    /**
     * Get current size
     */
    getSize() {
        return { ...this.currentSize };
    }

    /**
     * Get current split position
     */
    getSplitPosition() {
        return this.splitPosition;
    }

    /**
     * Set split position
     */
    setSplitPosition(position) {
        this.splitPosition = Math.max(15, Math.min(85, position));
        this.updateSplitLayout();
    }

    /**
     * Register with Z-Index Manager
     */
    registerWithZIndexManager() {
        if (this.panel && zIndexManager) {
            this.zIndex = zIndexManager.register(this.panel, 'UI', 75, {
                name: 'DOM Inspector',
                type: 'panel',
                resizable: true,
                draggable: true
            });
            
            console.log(`DOM Inspector registered with Z-Index Manager: z-index ${this.zIndex}`);
        }
    }

    /**
     * Bring panel to front
     */
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
            
            if (this.onBringToFront) {
                this.onBringToFront(newZIndex);
            }
        }
    }

    /**
     * Unregister from Z-Index Manager
     */
    unregisterFromZIndexManager() {
        if (this.panel && zIndexManager) {
            zIndexManager.unregister(this.panel);
            console.log('DOM Inspector unregistered from Z-Index Manager');
        }
    }

    /**
     * Get UI element references
     */
    getElements() {
        return {
            panel: this.panel,
            header: this.header,
            splitter: this.splitter,
            treeContainer: this.treeContainer,
            detailsContainer: this.detailsContainer,
            querySelectorInput: this.querySelectorInput,
            elementPickerButton: this.elementPickerButton,
            saveButton: this.saveButton,
            clearButton: this.clearButton,
            highlightToggleButton: this.highlightToggleButton,
            historyContainer: this.historyContainer,
            closeButton: this.closeButton,
            settingsButton: this.settingsButton
        };
    }

    /**
     * Destroy the panel and clean up
     */
    destroy() {
        this.unregisterFromZIndexManager();
        
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
        
        // Clear references
        this.header = null;
        this.resizeHandle = null;
        this.splitter = null;
        this.closeButton = null;
        this.settingsButton = null;
        this.treeContainer = null;
        this.detailsContainer = null;
        this.querySelectorInput = null;
        this.elementPickerButton = null;
        this.saveButton = null;
        this.clearButton = null;
        this.highlightToggleButton = null;
        this.historyContainer = null;
        
        // Clear callbacks
        this.onPositionChange = null;
        this.onSizeChange = null;
        this.onClose = null;
        this.onSettings = null;
        this.onBringToFront = null;
    }
} 