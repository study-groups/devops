/**
 * PJA Panel System - Formal UI Architecture
 * 
 * Core Components:
 * - DevWatchPanel: Individual collapsible/draggable content panels
 * - DevWatchColumnLayout: 2-column resizable layout container
 * - DevWatchPanelManager: Manages panel state and interactions
 */

/**
 * DevWatchPanel - Individual content panel with drag/drop and collapse functionality
 */
class DevWatchPanel {
    constructor(options = {}) {
        // Core properties
        this.id = options.id || this.generateId();
        this.title = options.title || 'Panel';
        this.content = options.content || '';
        this.isCollapsed = options.isCollapsed || false;
        this.isDraggable = options.isDraggable !== false;
        this.position = options.position || 'left'; // 'left' or 'right'
        this.className = options.className || '';
        
        // State management
        this.state = {
            isCollapsed: this.isCollapsed,
            position: this.position,
            order: options.order || 0
        };
        
        // Create DOM element
        this.element = this.createElement();
        this.setupEventListeners();
    }
    
    generateId() {
        return 'devwatch-panel-' + Math.random().toString(36).substr(2, 9);
    }
    
    createElement() {
        const panel = document.createElement('div');
        panel.id = this.id;
        panel.className = `devwatch-panel ${this.className}`;
        panel.dataset.position = this.position;
        
        if (this.isDraggable) {
            panel.draggable = true;
            panel.classList.add('devwatch-panel--draggable');
        }
        
        if (this.state.isCollapsed) {
            panel.classList.add('devwatch-panel--collapsed');
        }
        
        panel.innerHTML = `
            <div class="devwatch-panel__header">
                <div class="devwatch-panel__title-area">
                    ${this.isDraggable ? '<span class="devwatch-panel__drag-handle">⋮⋮</span>' : ''}
                    <h3 class="devwatch-panel__title">${this.title}</h3>
                </div>
                <div class="devwatch-panel__controls">
                    <button class="devwatch-panel__toggle devwatch-button--ghost" type="button" aria-label="Toggle panel">
                        <span class="devwatch-panel__toggle-icon">${this.state.isCollapsed ? '▶' : '▼'}</span>
                    </button>
                </div>
            </div>
            <div class="devwatch-panel__content">
                ${this.content}
            </div>
        `;
        
        return panel;
    }
    
    setupEventListeners() {
        // Toggle functionality
        const toggleBtn = this.element.querySelector('.devwatch-panel__toggle');
        const header = this.element.querySelector('.devwatch-panel__header');
        
        const toggle = () => {
            this.state.isCollapsed = !this.state.isCollapsed;
            this.updateDisplay();
            this.saveState();
        };
        
        // Single click toggle
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle();
        });
        
        // Header click toggle (single click)
        header.addEventListener('click', (e) => {
            // Don't toggle if clicking on drag handle or other controls
            if (e.target.classList.contains('devwatch-panel__drag-handle') || 
                e.target.classList.contains('devwatch-panel__toggle') ||
                e.target.closest('.devwatch-panel__controls')) {
                return;
            }
            toggle();
        });
        
        // Long click for panel editor
        this.setupLongClickHandler(header);
        
        // Ctrl key visual feedback
        this.setupCtrlKeyFeedback(header);
        
        // Drag and drop
        if (this.isDraggable) {
            this.setupDragAndDrop();
        }
    }
    
    setupLongClickHandler(element) {
        let longClickTimer = null;
        let isLongClick = false;
        const longClickDuration = 800; // 800ms for long click
        
        element.addEventListener('mousedown', (e) => {
            // Only start timer if Ctrl key is held
            if (!e.ctrlKey && !e.metaKey) {
                return;
            }
            
            isLongClick = false;
            longClickTimer = setTimeout(() => {
                isLongClick = true;
                this.openPanelEditor();
            }, longClickDuration);
        });
        
        element.addEventListener('mouseup', (e) => {
            if (longClickTimer) {
                clearTimeout(longClickTimer);
                longClickTimer = null;
            }
        });
        
        element.addEventListener('mouseleave', () => {
            if (longClickTimer) {
                clearTimeout(longClickTimer);
                longClickTimer = null;
            }
        });
        
        // Clear timer if Ctrl key is released during long click
        element.addEventListener('keyup', (e) => {
            if ((e.key === 'Control' || e.key === 'Meta') && longClickTimer) {
                clearTimeout(longClickTimer);
                longClickTimer = null;
            }
        });
        
        // Prevent context menu during long click
        element.addEventListener('contextmenu', (e) => {
            if (isLongClick) {
                e.preventDefault();
            }
        });
    }
    
    setupCtrlKeyFeedback(element) {
        // Add visual feedback when Ctrl is held
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                element.classList.add('devwatch-panel__header--ctrl-active');
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                element.classList.remove('devwatch-panel__header--ctrl-active');
            }
        });
        
        // Remove class on window blur to handle edge cases
        window.addEventListener('blur', () => {
            element.classList.remove('devwatch-panel__header--ctrl-active');
        });
    }
    
    setupDragAndDrop() {
        this.element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', this.id);
            this.element.classList.add('devwatch-panel--dragging');
            
            // Store original position for potential revert
            this.dragStartPosition = {
                parent: this.element.parentNode,
                nextSibling: this.element.nextSibling
            };
        });
        
        this.element.addEventListener('dragend', (e) => {
            this.element.classList.remove('devwatch-panel--dragging');
            this.removeDragOverClasses();
            this.saveState();
        });
        
        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        this.element.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (!this.element.classList.contains('devwatch-panel--dragging')) {
                this.element.classList.add('devwatch-panel--drag-over');
            }
        });
        
        this.element.addEventListener('dragleave', (e) => {
            if (!this.element.contains(e.relatedTarget)) {
                this.element.classList.remove('devwatch-panel--drag-over');
            }
        });
        
        this.element.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId && draggedId !== this.id) {
                this.handlePanelDrop(draggedId);
            }
            this.removeDragOverClasses();
        });
    }
    
    handlePanelDrop(draggedPanelId) {
        const draggedPanel = document.getElementById(draggedPanelId);
        const targetColumn = this.element.closest('.devwatch-column');
        
        if (draggedPanel && targetColumn) {
            // Insert after this panel
            targetColumn.insertBefore(draggedPanel, this.element.nextSibling);
            
            // Update panel position
            const panelInstance = window.DevWatchPanelManager?.getPanelById(draggedPanelId);
            if (panelInstance) {
                panelInstance.position = targetColumn.dataset.position;
                panelInstance.element.dataset.position = panelInstance.position;
                panelInstance.saveState();
            }
        }
    }
    
    removeDragOverClasses() {
        document.querySelectorAll('.devwatch-panel--drag-over').forEach(el => {
            el.classList.remove('devwatch-panel--drag-over');
        });
    }
    
    updateDisplay() {
        const toggleIcon = this.element.querySelector('.devwatch-panel__toggle-icon');
        
        if (this.state.isCollapsed) {
            this.element.classList.add('devwatch-panel--collapsed');
            toggleIcon.textContent = '▶';
        } else {
            this.element.classList.remove('devwatch-panel--collapsed');
            toggleIcon.textContent = '▼';
        }
    }
    
    toggle(isCollapsed) {
        if (this.state.isCollapsed !== isCollapsed) {
            this.state.isCollapsed = isCollapsed;
            this.element.classList.toggle('devwatch-panel--collapsed', isCollapsed);
            
            const icon = this.element.querySelector('.devwatch-panel__toggle-icon');
            if (icon) {
                icon.textContent = isCollapsed ? '▶' : '▼';
            }
            
            this.saveState();
        }
    }
    
    expand() {
        if (this.state.isCollapsed) {
            this.toggle(false);
        }
    }
    
    collapse() {
        if (!this.state.isCollapsed) {
            this.toggle(true);
        }
    }
    
    setContent(content) {
        this.content = content;
        const contentEl = this.element.querySelector('.devwatch-panel__content');
        if (contentEl) {
            contentEl.innerHTML = content;
        }
    }
    
    saveState() {
        // Save panel state to localStorage or send to server
        const stateKey = `devwatch-panel-${this.id}`;
        const state = {
            isCollapsed: this.state.isCollapsed,
            position: this.state.position,
            order: Array.from(this.element.parentNode?.children || []).indexOf(this.element)
        };
        
        try {
            localStorage.setItem(stateKey, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save panel state:', e);
        }
    }
    
    loadState() {
        const stateKey = `devwatch-panel-${this.id}`;
        try {
            const saved = localStorage.getItem(stateKey);
            if (saved) {
                const state = JSON.parse(saved);
                this.state = { ...this.state, ...state };
                this.updateDisplay();
            }
        } catch (e) {
            console.warn('Failed to load panel state:', e);
        }
    }
    
    openPanelEditor() {
        // Create and show the panel editor modal
        const editor = new DevWatchPanelEditor(this);
        editor.show();
    }
    
    getDebugInfo() {
        return {
            id: this.id,
            title: this.title,
            position: this.position,
            state: this.state,
            isDraggable: this.isDraggable,
            className: this.className,
            element: {
                tagName: this.element.tagName,
                className: this.element.className,
                id: this.element.id,
                offsetWidth: this.element.offsetWidth,
                offsetHeight: this.element.offsetHeight,
                scrollHeight: this.element.scrollHeight,
                children: this.element.children.length
            },
            parentContainer: this.element.parentNode ? {
                tagName: this.element.parentNode.tagName,
                className: this.element.parentNode.className,
                id: this.element.parentNode.id
            } : null,
            localStorage: this.getLocalStorageInfo(),
            eventListeners: this.getEventListenerInfo(),
            computedStyles: this.getComputedStyleInfo(),
            relationships: this.getRelationshipInfo()
        };
    }
    
    getLocalStorageInfo() {
        const stateKey = `devwatch-panel-${this.id}`;
        const layoutKey = `pja-layout-${this.element.closest('.devwatch-column-layout')?.id}`;
        
        return {
            panelState: localStorage.getItem(stateKey),
            layoutState: localStorage.getItem(layoutKey),
            allPanelKeys: Object.keys(localStorage).filter(key => key.startsWith('devwatch-panel-')),
            allLayoutKeys: Object.keys(localStorage).filter(key => key.startsWith('pja-layout-'))
        };
    }
    
    getEventListenerInfo() {
        // Get event listeners attached to this panel
        const listeners = [];
        const element = this.element;
        
        // Check for common event types
        const eventTypes = ['click', 'mousedown', 'mouseup', 'dragstart', 'dragend', 'dragover', 'drop'];
        eventTypes.forEach(type => {
            if (element[`on${type}`] || element.addEventListener.toString().includes(type)) {
                listeners.push(type);
            }
        });
        
        return listeners;
    }
    
    getComputedStyleInfo() {
        const computed = window.getComputedStyle(this.element);
        return {
            display: computed.display,
            position: computed.position,
            width: computed.width,
            height: computed.height,
            backgroundColor: computed.backgroundColor,
            borderColor: computed.borderColor,
            borderRadius: computed.borderRadius,
            padding: computed.padding,
            margin: computed.margin,
            zIndex: computed.zIndex,
            transform: computed.transform,
            transition: computed.transition
        };
    }
    
    getRelationshipInfo() {
        const layout = this.element.closest('.devwatch-column-layout');
        const column = this.element.closest('.devwatch-column');
        const siblings = column ? Array.from(column.children).filter(el => el !== this.element) : [];
        
        return {
            layout: layout ? layout.id : null,
            column: column ? column.dataset.position : null,
            siblings: siblings.map(el => ({
                id: el.id,
                className: el.className,
                title: el.querySelector('.devwatch-panel__title')?.textContent || 'Unknown'
            })),
            canInteractWith: this.getInteractionTargets()
        };
    }
    
    getInteractionTargets() {
        // Find panels this panel can potentially interact with
        const layout = this.element.closest('.devwatch-column-layout');
        if (!layout) return [];
        
        const allPanels = Array.from(layout.querySelectorAll('.devwatch-panel'));
        return allPanels
            .filter(panel => panel !== this.element)
            .map(panel => ({
                id: panel.id,
                title: panel.querySelector('.devwatch-panel__title')?.textContent || 'Unknown',
                position: panel.closest('.devwatch-column')?.dataset.position || 'unknown',
                canControl: this.canControlPanel(panel),
                controlMethods: this.getControlMethods(panel)
            }));
    }
    
    canControlPanel(targetPanel) {
        // Check if this panel has any elements that could control the target panel
        const buttons = this.element.querySelectorAll('button, [data-target], [data-panel-id]');
        return Array.from(buttons).some(btn => 
            btn.dataset.target === targetPanel.id ||
            btn.dataset.panelId === targetPanel.id ||
            btn.textContent.toLowerCase().includes(targetPanel.id.toLowerCase())
        );
    }
    
    getControlMethods(targetPanel) {
        const methods = [];
        const buttons = this.element.querySelectorAll('button, [data-target], [data-panel-id]');
        
        Array.from(buttons).forEach(btn => {
            if (btn.dataset.target === targetPanel.id || btn.dataset.panelId === targetPanel.id) {
                methods.push({
                    element: btn.tagName.toLowerCase(),
                    text: btn.textContent.trim(),
                    attributes: Array.from(btn.attributes).map(attr => `${attr.name}="${attr.value}"`),
                    eventListeners: btn.onclick ? ['click'] : []
                });
            }
        });
        
        return methods;
    }
}

/**
 * DevWatchColumnLayout - 2-column resizable layout container
 */
class DevWatchColumnLayout {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.parentContainer = options.parentContainer;
        this.leftColumnWidth = options.leftColumnWidth || 320;
        this.minLeftWidth = options.minLeftWidth || 150;
        this.maxLeftWidth = options.maxLeftWidth || 600;
        this.minRightWidth = options.minRightWidth || 400;
        
        this.element = this.createElement();
        
        // Store references to columns AFTER element is created
        this.leftColumn = this.element.querySelector('.devwatch-column--left');
        this.rightColumn = this.element.querySelector('.devwatch-column--right');
        this.resizer = this.element.querySelector('.devwatch-column-resizer');
        
        // New properties for tab mode
        this.viewMode = options.viewMode || 'stack'; // 'stack' or 'tab'
        this.activeTabId = null;
        
        // Now set initial widths
        this.setColumnWidths(this.leftColumnWidth);
        
        this.setupResizing();
        
        if (this.parentContainer) {
            this.parentContainer.appendChild(this.element);
        }
    }
    
    generateId() {
        return 'pja-layout-' + Math.random().toString(36).substr(2, 9);
    }
    
    createElement() {
        const layout = document.createElement('div');
        layout.id = this.id;
        layout.className = 'devwatch-column-layout';
        
        layout.innerHTML = `
            <div class="devwatch-column devwatch-column--left" data-position="left"></div>
            <div class="devwatch-column-resizer"></div>
            <div class="devwatch-column devwatch-column--right" data-position="right"></div>
        `;
        
        return layout;
    }
    
    switchViewMode(mode = 'stack') {
        // Validate mode
        if (!['stack', 'tab'].includes(mode)) {
            console.warn(`Invalid view mode: ${mode}. Defaulting to 'stack'.`);
            mode = 'stack';
        }
        
        this.viewMode = mode;
        
        const tabNavigation = this.rightColumn.querySelector('.devwatch-column-tabs');
        const panelContainer = this.rightColumn.querySelector('.devwatch-column-panel-container') 
            || this.createPanelContainer();
        
        if (mode === 'tab') {
            // Hide all panels except active
            this.rightColumn.classList.add('devwatch-column--tab-mode');
            tabNavigation.innerHTML = ''; // Clear existing tabs
            
            // Create tabs for each panel
            Array.from(panelContainer.children).forEach(panel => {
                const tab = this.createTab(panel);
                tabNavigation.appendChild(tab);
            });
            
            // Show first panel if no active tab
            if (!this.activeTabId && panelContainer.firstElementChild) {
                this.activateTab(panelContainer.firstElementChild.id);
            }
        } else {
            // Stacking mode
            this.rightColumn.classList.remove('devwatch-column--tab-mode');
            tabNavigation.innerHTML = ''; // Clear tabs
            
            // Show all panels
            Array.from(panelContainer.children).forEach(panel => {
                panel.style.display = 'block';
            });
        }
    }
    
    createPanelContainer() {
        const panelContainer = document.createElement('div');
        panelContainer.className = 'devwatch-column-panel-container';
        this.rightColumn.appendChild(panelContainer);
        return panelContainer;
    }
    
    createTab(panel) {
        const tab = document.createElement('button');
        tab.className = 'devwatch-column-tab';
        tab.dataset.panelId = panel.id;
        tab.textContent = panel.querySelector('.devwatch-panel__title')?.textContent || 'Untitled';
        
        tab.addEventListener('click', () => {
            this.activateTab(panel.id);
        });
        
        return tab;
    }
    
    activateTab(panelId) {
        const panelContainer = this.rightColumn.querySelector('.devwatch-column-panel-container');
        const tabNavigation = this.rightColumn.querySelector('.devwatch-column-tabs');
        
        if (!panelContainer || !tabNavigation) return;
        
        // Hide all panels
        Array.from(panelContainer.children).forEach(panel => {
            panel.style.display = 'none';
        });
        
        // Deactivate all tabs
        Array.from(tabNavigation.children).forEach(tab => {
            tab.classList.remove('devwatch-column-tab--active');
        });
        
        // Show selected panel
        const activePanel = panelContainer.querySelector(`#${panelId}`);
        if (activePanel) {
            activePanel.style.display = 'block';
            
            // Activate corresponding tab
            const activeTab = tabNavigation.querySelector(`[data-panel-id="${panelId}"]`);
            if (activeTab) {
                activeTab.classList.add('devwatch-column-tab--active');
            }
            
            this.activeTabId = panelId;
        }
    }
    
    setupResizing() {
        this.element.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('devwatch-column-resizer')) {
                this.startResize(e);
            }
        });
        
        // Setup column drop zones
        this.setupColumnDropZones();
    }
    
    setupColumnDropZones() {
        [this.leftColumn, this.rightColumn].forEach(column => {
            if (!column) return;
            
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            
            column.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (!column.querySelector('.devwatch-panel--dragging')) {
                    column.classList.add('devwatch-column--drag-over');
                }
            });
            
            column.addEventListener('dragleave', (e) => {
                if (!column.contains(e.relatedTarget)) {
                    column.classList.remove('devwatch-column--drag-over');
                }
            });
            
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                const draggedPanel = document.getElementById(draggedId);
                
                if (draggedPanel && draggedPanel.parentNode !== column) {
                    column.appendChild(draggedPanel);
                    
                    // Update panel position
                    const panelInstance = window.DevWatchPanelManager?.getPanelById(draggedId);
                    if (panelInstance) {
                        panelInstance.position = column.dataset.position;
                        panelInstance.element.dataset.position = panelInstance.position;
                        panelInstance.saveState();
                    }
                }
                
                column.classList.remove('devwatch-column--drag-over');
            });
        });
    }
    
    startResize(e) {
        e.preventDefault();
        
        const startX = e.clientX;
        const startLeftWidth = this.leftColumn.offsetWidth;
        const containerWidth = this.element.offsetWidth;
        
        const doDrag = (e) => {
            const deltaX = e.clientX - startX;
            let newLeftWidth = startLeftWidth + deltaX;

            // Calculate the maximum width the left panel can have without violating the right panel's minimum width.
            const maxLeftWidthFromRight = containerWidth - this.minRightWidth - this.resizer.offsetWidth;

            // Clamp the new width against all constraints, prioritizing min widths.
            newLeftWidth = Math.max(this.minLeftWidth, Math.min(newLeftWidth, this.maxLeftWidth, maxLeftWidthFromRight));
            
            this.setColumnWidths(newLeftWidth);
        };
        
        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            this.resizer.classList.remove('devwatch-column-resizer--active');
            this.saveLayout();
        };
        
        this.resizer.classList.add('devwatch-column-resizer--active');
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    }
    
    setColumnWidths(leftWidth) {
        this.leftColumnWidth = leftWidth;
        this.leftColumn.style.flex = `0 0 ${leftWidth}px`;
        this.rightColumn.style.flex = '1 1 0';
    }
    
    addPanel(panel, position = 'left') {
        const column = position === 'left' ? this.leftColumn : this.rightColumn;
        
        if (column && panel.element) {
            // If right column, use panel container
            if (position === 'right') {
                const panelContainer = this.rightColumn.querySelector('.devwatch-column-panel-container') 
                    || this.createPanelContainer();
                panelContainer.appendChild(panel.element);
                
                // Recreate tabs if in tab mode
                if (this.viewMode === 'tab') {
                    this.switchViewMode('tab');
                }
            } else {
                column.appendChild(panel.element);
            }
            
            panel.position = position;
            panel.element.dataset.position = position;
        }
    }
    
    saveLayout() {
        const layoutKey = `pja-layout-${this.id}`;
        const state = {
            leftColumnWidth: this.leftColumnWidth
        };
        
        try {
            localStorage.setItem(layoutKey, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save layout state:', e);
        }
    }
    
    loadLayout() {
        const layoutKey = `pja-layout-${this.id}`;
        try {
            const saved = localStorage.getItem(layoutKey);
            if (saved) {
                const state = JSON.parse(saved);
                this.setColumnWidths(state.leftColumnWidth || this.leftColumnWidth);
            }
        } catch (e) {
            console.warn('Failed to load layout state:', e);
        }
    }
}

/**
 * DevWatchPanelManager - Manages panel instances and global state
 */
class DevWatchPanelManager {
    constructor() {
        this.panels = new Map();
        this.layouts = new Map();
    }
    
    registerPanel(panel) {
        this.panels.set(panel.id, panel);
    }
    
    unregisterPanel(panelId) {
        this.panels.delete(panelId);
    }
    
    getPanelById(panelId) {
        return this.panels.get(panelId);
    }
    
    registerLayout(layout) {
        this.layouts.set(layout.id, layout);
    }
    
    getAllPanels() {
        return Array.from(this.panels.values());
    }
    
    getAllLayouts() {
        return Array.from(this.layouts.values());
    }
    
    saveAllStates() {
        this.getAllPanels().forEach(panel => panel.saveState());
        this.getAllLayouts().forEach(layout => layout.saveLayout());
    }
    
    loadAllStates() {
        this.getAllPanels().forEach(panel => panel.loadState());
        this.getAllLayouts().forEach(layout => layout.loadLayout());
    }
}



// Global panel manager instance
window.DevWatchPanelManager = new DevWatchPanelManager();

// Export classes for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DevWatchPanel, DevWatchColumnLayout, DevWatchPanelManager };
}
