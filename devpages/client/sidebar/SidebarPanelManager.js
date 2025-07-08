/**
 * SidebarPanelManager.js - Manages reorderable sidebar panels with drag and drop
 * @module SidebarPanelManager
 */
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { PublishedSummaryPanel } from './panels/PublishedSummaryPanel.js';
import { FileBrowserPanel } from '/client/file-browser/FileBrowserPanel.js';

export class SidebarPanelManager {
    /**
     * Initializes the SidebarPanelManager.
     * Sets up panel storage, container, and drag/drop properties.
     */
    constructor() {
        this.panels = new Map();
        this.container = null;
        this.panelOrder = []; // Start with an empty order, will be loaded in initializeDefaultPanels
        this.draggedPanel = null;
        this.dropZone = null;
        this.tokens = {
            color: [
                { name: '--color-gray-100', value: '#f5f5f5' },
                { name: '--color-gray-500', value: '#737373' },
                { name: '--color-gray-900', value: '#171717' },
                { name: '--color-blue-100', value: '#dbeafe' },
                { name: '--color-blue-500', value: '#3b82f6' },
                { name: '--color-blue-900', value: '#1e3a8a' },
                { name: '--color-green-100', value: '#dcfce7' },
                { name: '--color-green-500', value: '#22c55e' },
                { name: '--color-green-900', value: '#14532d' },
                { name: '--color-red-100', value: '#fee2e2' },
                { name: '--color-red-500', value: '#ef4444' },
                { name: '--color-red-900', value: '#7f1d1d' },
                { name: '--color-yellow-100', value: '#fef3c7' },
                { name: '--color-yellow-500', value: '#f59e0b' },
                { name: '--color-yellow-900', value: '#78350f' },
                { name: '--color-purple-100', value: '#f3e8ff' },
                { name: '--color-purple-500', value: '#a855f7' },
                { name: '--color-purple-900', value: '#581c87' },
            ],
            typography: [
                { name: '--font-family-header', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
                { name: '--font-family-text', value: 'ui-serif, Georgia, serif' },
                { name: '--font-family-code', value: 'ui-monospace, "SF Mono", Monaco, "Roboto Mono", monospace' },
                { name: '--font-family-alt', value: '"Arial Light", sans-serif' },
                { name: '--font-size-sm', value: '0.875rem' },
                { name: '--font-size-normal', value: '1rem' },
                { name: '--font-size-lg', value: '1.125rem' },
                { name: '--font-size-xl', value: '1.25rem' },
                { name: '--font-weight-light', value: '300' },
                { name: '--font-weight-normal', value: '400' },
                { name: '--font-weight-semibold', value: '600' },
                { name: '--font-weight-bold', value: '700' },
                { name: '--line-height-tight', value: '1.25' },
                { name: '--line-height-normal', value: '1.5' },
                { name: '--line-height-relaxed', value: '1.75' },
            ],
            spacing: [
                { name: '--space-sm', value: '0.5rem' },
                { name: '--space-normal', value: '1rem' },
                { name: '--space-large', value: '2rem' },
            ],
            layout: [
                { name: '--radius-none', value: '0' },
                { name: '--radius-sm', value: '0.25rem' },
                { name: '--radius-full', value: '9999px' },
            ],
            elevation: [
                { name: '--shadow-sm', value: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)' },
                { name: '--shadow-med', value: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)' },
                { name: '--shadow-lg', value: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
                { name: '--z-layer-base', value: '0' },
                { name: '--z-layer-ui', value: '100' },
                { name: '--z-layer-popup', value: '1000' },
                { name: '--z-layer-system', value: '10000' },
                { name: '--z-layer-debug', value: '100000' },
            ],
            transition: [
                { name: '--transition-fast', value: '150ms ease-in-out' },
                { name: '--transition-base', value: '250ms ease-in-out' },
                { name: '--transition-slow', value: '350ms ease-in-out' },
                { name: '--transition-colors', value: 'color 150ms ease-in-out, background-color 150ms ease-in-out, border-color 150ms ease-in-out' },
                { name: '--transition-transform', value: 'transform 150ms ease-in-out' },
                { name: '--transition-opacity', value: 'opacity 250ms ease-in-out' },
                { name: '--transition-all', value: 'all 150ms ease-in-out' },
            ],
        };
        
        this.log('SidebarPanelManager created');
    }

    /**
     * Logs messages from the SidebarPanelManager.
     * @param {string} message - The message to log.
     * @param {string} [level='info'] - The log level (e.g., 'info', 'warn', 'error').
     */
    log(message, level = 'info') {
        const type = 'SIDEBAR_PANELS';
        if (typeof window.logMessage === 'function') {
            window.logMessage(message, level, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /**
     * Sets the main container element for the sidebar panels and initializes drag and drop.
     * @param {HTMLElement} containerElement - The DOM element that will contain the panels.
     */
    setContainer(containerElement) {
        this.container = containerElement;
        this.setupDragAndDrop();
        this.log('Container set and drag/drop initialized');
        
        // If panels are already registered, render them
        if (this.panels.size > 0) {
            this.renderAllPanels();
        }
    }

    /**
     * Registers a new sidebar panel with the manager.
     * @param {string} panelId - A unique identifier for the panel.
     * @param {object} config - Configuration object for the panel.
     * @param {string} [config.title=panelId] - The display title of the panel.
     * @param {string} [config.icon='default'] - The icon identifier for the panel.
     * @param {string} [config.category='general'] - The category of the panel.
     * @param {number} [config.priority=50] - The display priority for ordering panels.
     * @param {function(): string} [config.render] - A function that returns the HTML content of the panel.
     * @param {function(): void} [config.onActivate] - Callback when the panel is activated/rendered.
     * @param {function(): void} [config.onFloat] - Callback when the panel is floated.
     * @param {function(): void} [config.onDock] - Callback when the panel is docked.
     * @param {boolean} [config.canFloat=true] - Whether the panel can be floated.
     * @param {boolean} [config.canClose=true] - Whether the panel can be closed.
     * @param {boolean} [config.isVisible=true] - Initial visibility state of the panel.
     * @param {object} [config.metadata={}] - Additional metadata for the panel.
     */
    register(panelId, config) {
        const panel = {
            id: panelId,
            title: config.title || panelId,
            icon: config.icon || 'default',
            category: config.category || 'general',
            priority: config.priority || 50,
            // Accept both `render` and legacy `content` keys for backward compatibility
            render: config.render || config.content || (() => `<div>Panel ${panelId}</div>`),
            onActivate: config.onActivate || (() => {}),
            onFloat: config.onFloat || (() => {}),
            onDock: config.onDock || (() => {}),
            canFloat: config.canFloat !== false,
            canClose: config.canClose !== false,
            // New flags with sensible defaults
            isDraggable: config.isDraggable !== false,
            isCollapsible: config.isCollapsible !== false,
            isVisible: config.isVisible !== false,
            isFloating: false,
            metadata: config.metadata || {},
            element: null,
            instance: config.instance || null,
        };

        this.panels.set(panelId, panel);
        
        // Add to order if not already there
        if (!this.panelOrder.includes(panelId)) {
            this.panelOrder.push(panelId);
            this.savePanelOrder();
        }

        this.log(`Registered panel: ${panelId} (${panel.title}), isVisible: ${panel.isVisible}`);
    }

    /**
     * Creates a panel element for the given panel configuration.
     * @param {object} panel - The panel configuration object.
     * @returns {HTMLElement} The created panel element.
     */
    createPanelElement(panel) {
        // Create panel element
        const panelElement = document.createElement('div');
        panelElement.className = 'sidebar-panel';
        panelElement.dataset.panelId = panel.id;
        panelElement.draggable = true;
        
        // Log for context panel specifically
        if (panel.id === 'context') {
            this.log(`[DEBUG] Creating Context panel element. isVisible: ${panel.isVisible}`);
            this.log(`[DEBUG] Context panel HTML content: ${panel.render().substring(0, 200)}...`);
        }
        
        const headerElement = document.createElement('div');
        headerElement.className = 'sidebar-panel-header';

        const dragHandle = document.createElement('div');
        dragHandle.className = 'panel-drag-handle';
        const iconImg = document.createElement('img');
        iconImg.src = `/client/styles/icons/${panel.icon}.svg`;
        iconImg.alt = `${panel.title} icon`;
        dragHandle.appendChild(iconImg);

        const titleElement = document.createElement('div');
        titleElement.className = 'panel-title';
        titleElement.textContent = panel.title;

        const actionsElement = document.createElement('div');
        actionsElement.className = 'panel-actions';

        if (panel.canFloat) {
            const floatBtn = document.createElement('button');
            floatBtn.className = 'panel-action-btn float-btn';
            floatBtn.title = 'Float Panel';
            floatBtn.innerHTML = '&#x235F;'; // Unicode for eject symbol
            actionsElement.appendChild(floatBtn);
        }

        if (panel.canClose) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'panel-action-btn close-btn';
            closeBtn.title = 'Close Panel';
            closeBtn.innerHTML = '&times;'; // Unicode for multiplication sign (close)
            actionsElement.appendChild(closeBtn);
        }

        // Add reset button for Panel Manager (instead of close button)
        if (panel.id === 'panel-manager') {
            const resetBtn = document.createElement('button');
            resetBtn.className = 'panel-action-btn panel-reset-btn';
            resetBtn.title = 'Show All Panels';
            resetBtn.innerHTML = '↻'; // Unicode circular arrow
            actionsElement.appendChild(resetBtn);
        }

        headerElement.appendChild(dragHandle);
        headerElement.appendChild(titleElement);
        headerElement.appendChild(actionsElement);

        const contentElement = document.createElement('div');
        contentElement.className = 'sidebar-panel-content';
        
        if (panel.instance && typeof panel.instance.render === 'function') {
            contentElement.innerHTML = '<div class="loading-spinner" style="margin: 20px auto;"></div>'; // Placeholder
            panel.instance.render().then(html => {
                contentElement.innerHTML = html;
                if (typeof panel.instance.onActivate === 'function') {
                    panel.instance.onActivate(contentElement);
                }
            }).catch(error => {
                contentElement.innerHTML = `<div class="panel-info-text">Error loading panel.</div>`;
                this.log(`Error rendering panel ${panel.id}: ${error.message}`, 'error');
            });
        } else {
            contentElement.innerHTML = panel.render();
        }

        panelElement.appendChild(headerElement);
        panelElement.appendChild(contentElement);

        return panelElement;
    }

    /**
     * Renders a specific sidebar panel into the container.
     * If the panel is already rendered, it will be re-rendered.
     * @param {string} panelId - The ID of the panel to render.
     */
    renderPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || !this.container) {
            this.log(`Attempted to render non-existent panel: ${panelId} or container not set.`, 'warn');
            return;
        }
        
        // Remove existing panel element if it exists
        const existingElement = this.container.querySelector(`.sidebar-panel[data-panel-id="${panelId}"]`);
        if (existingElement) {
            existingElement.remove();
        }

        const panelElement = this.createPanelElement(panel);
        this.insertPanelInOrder(panelElement, panelId);
        
        // Re-attach event listeners
        this.attachPanelEventListeners(panelElement, panel);
        
        // Call onActivate if the panel is visible
        if (panel.isVisible) {
            panel.onActivate();
        }
    }

    /**
     * Inserts a panel element into the DOM in the correct order.
     * @param {HTMLElement} panelElement - The panel element to insert.
     * @param {string} panelId - The ID of the panel being inserted.
     */
    insertPanelInOrder(panelElement, panelId) {
        const index = this.panelOrder.indexOf(panelId);
        if (index === -1) {
            this.container.appendChild(panelElement); // Append to end if not in order
            return;
        }

        let inserted = false;
        for (let i = index + 1; i < this.panelOrder.length; i++) {
            const nextPanelId = this.panelOrder[i];
            const nextPanelElement = this.container.querySelector(`.sidebar-panel[data-panel-id="${nextPanelId}"]`);
            if (nextPanelElement) {
                this.container.insertBefore(panelElement, nextPanelElement);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            this.container.appendChild(panelElement);
        }
    }

    /**
     * Attaches event listeners to a panel's header actions.
     * @param {HTMLElement} panelElement - The panel element.
     * @param {object} panel - The panel configuration object.
     */
    attachPanelEventListeners(panelElement, panel) {
        const floatBtn = panelElement.querySelector('.float-btn');
        if (floatBtn) {
            floatBtn.addEventListener('click', () => this.floatPanel(panel.id));
        }

        const closeBtn = panelElement.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel(panel.id));
        }

        const header = panelElement.querySelector('.sidebar-panel-header');
        if (header) {
            header.addEventListener('dblclick', (e) => {
                // Prevent toggling when clicking on buttons
                if (e.target.closest('.panel-actions')) return;
                this.togglePanelCollapse(panel.id);
            });
        }

        // Color grid toggle for tokens panel
        if (panel.id === 'tokens') {
            const toggleBtn = panelElement.querySelector('.color-grid-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    this.tokensColorGrid = !this.tokensColorGrid;
                    this.renderPanel('tokens');
                });
            }
        }
    }

    togglePanelCollapse(panelId) {
        const panel = this.getPanel(panelId);
        if (panel && panel.element) {
            panel.element.classList.toggle('collapsed');
        }
    }
    
    /**
     * Sets up the drag and drop functionality for the panels.
     */
    setupDragAndDrop() {
        if (!this.container) return;

        this.container.addEventListener('dragstart', e => {
            if (e.target.classList.contains('sidebar-panel')) {
                const panelId = e.target.dataset.panelId;
                const panel = this.getPanel(panelId);
                this.handleDragStart(e, panel);
            }
        });
        
        this.container.addEventListener('dragend', e => this.handleDragEnd(e));
        this.container.addEventListener('dragover', e => this.handleDragOver(e));
        this.container.addEventListener('drop', e => this.handleDrop(e));
        this.container.addEventListener('dragleave', e => this.handleDragLeave(e));
    }
    
    handleDragStart(e, panel) {
        if (!panel.isDraggable) {
            e.preventDefault();
            return;
        }
        this.draggedPanel = panel;
        this.draggedPanelElement = e.target;
        // Add a delay to allow the browser to create the drag image
        setTimeout(() => {
            e.target.classList.add('dragging');
        }, 0);
    }
    
    handleDragEnd(e) {
        if (this.draggedPanelElement) {
            this.draggedPanelElement.classList.remove('dragging');
        }
        this.clearDropZones();
        this.draggedPanel = null;
        this.draggedPanelElement = null;
    }
    
    handleDragOver(e) {
        e.preventDefault();
        const afterElement = this.getDragAfterElement(e.clientY);
        this.showDropZone(afterElement);
    }
    
    handleDrop(e) {
        e.preventDefault();
        if (!this.draggedPanel) return;
        
        const afterElement = this.getDragAfterElement(e.clientY);
        const oldIndex = this.panelOrder.indexOf(this.draggedPanel.id);
        
        let newIndex;
        if (afterElement == null) {
            newIndex = this.panelOrder.length -1;
        } else {
            const afterPanelId = afterElement.dataset.panelId;
            newIndex = this.panelOrder.indexOf(afterPanelId);
        }

        // Move the item in the panelOrder array
        this.panelOrder.splice(oldIndex, 1);
        this.panelOrder.splice(newIndex > oldIndex ? newIndex - 1 : newIndex, 0, this.draggedPanel.id);
        
        this.savePanelOrder();
        this.renderAllPanels();
    }
    
    handleDragLeave(e) {
        // Only clear if leaving the container itself
        if (e.target === this.container) {
            this.clearDropZones();
        }
    }

    getDragAfterElement(y) {
        const draggableElements = [...this.container.querySelectorAll('.sidebar-panel:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    showDropZone(afterElement) {
        this.clearDropZones();
        this.dropZone = document.createElement('div');
        this.dropZone.className = 'drop-zone';
        if (afterElement == null) {
            this.container.appendChild(this.dropZone);
        } else {
            this.container.insertBefore(this.dropZone, afterElement);
        }
    }

    clearDropZones() {
        const zones = this.container.querySelectorAll('.drop-zone');
        zones.forEach(zone => zone.remove());
        this.dropZone = null;
    }

    /**
     * Activates a panel, ensuring it is rendered and visible.
     * @param {string} panelId - The ID of the panel to activate.
     */
    activatePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            if (!panel.element) {
                this.renderPanel(panelId);
            }
            panel.isVisible = true;
            if (panel.element) {
                panel.element.style.display = 'block';
            }
            this.log(`Activated panel: ${panelId}`);
            
            // Call onActivate callback
            panel.onActivate();
            
            // Update the panel manager UI to reflect the change
            this.updatePanelManager();
        }
    }

    /**
     * Floats a panel, creating a separate, draggable window for it.
     * @param {string} panelId - The ID of the panel to float.
     */
    floatPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || !panel.canFloat || panel.isFloating) {
            return;
        }

        panel.isFloating = true;
        panel.isVisible = true;
        
        // Hide the docked version
        if (panel.element) {
            panel.element.style.display = 'none';
        }

        // Create floating window
        const floatingWindow = document.createElement('div');
        floatingWindow.className = 'floating-panel-window';
        floatingWindow.style.position = 'absolute';
        floatingWindow.style.left = '300px';
        floatingWindow.style.top = '100px';
        floatingWindow.style.zIndex = '1001';
        floatingWindow.style.width = '420px';
        floatingWindow.style.height = '320px';
        floatingWindow.style.maxHeight = '90vh';
        floatingWindow.style.maxWidth = '90vw';
        
        const header = document.createElement('div');
        header.className = 'floating-panel-header';
        header.textContent = panel.title;
        
        const dockBtn = document.createElement('button');
        dockBtn.className = 'panel-action-btn dock-btn';
        dockBtn.title = 'Dock Panel';
        dockBtn.innerHTML = '&#x21A9;'; // Downwards arrow with corner
        dockBtn.onclick = () => this.dockPanel(panelId);
        header.appendChild(dockBtn);

        const content = document.createElement('div');
        content.className = 'floating-panel-content';
        content.innerHTML = panel.render();
        
        floatingWindow.appendChild(header);
        floatingWindow.appendChild(content);
        
        document.body.appendChild(floatingWindow);
        panel.floatingElement = floatingWindow;

        // Make it draggable
        this.makeFloatingPanelDraggable(floatingWindow);
        
        // Call onFloat callback
        panel.onFloat();
        
        this.updatePanelManager();
        this.log(`Floated panel: ${panelId}`);
    }

    /**
     * Docks a floating panel back into the sidebar.
     * @param {string} panelId - The ID of the panel to dock.
     */
    dockPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || !panel.isFloating) {
            return;
        }

        panel.isFloating = false;
        
        // Remove the floating window
        if (panel.floatingElement) {
            panel.floatingElement.remove();
            panel.floatingElement = null;
        }

        // Show the docked version
        if (panel.element) {
            panel.element.style.display = 'block';
        }
        
        // Call onDock callback
        panel.onDock();
        
        this.updatePanelManager();
        this.log(`Docked panel: ${panelId}`);
    }

    /**
     * Closes a panel, making it invisible.
     * @param {string} panelId - The ID of the panel to close.
     */
    closePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel && panel.canClose) {
            panel.isVisible = false;
            
            if (panel.isFloating && panel.floatingElement) {
                panel.floatingElement.remove();
                panel.floatingElement = null;
                panel.isFloating = false; // Also dock it
            }
            
            if (panel.element) {
                panel.element.style.display = 'none';
            }
            
            this.updatePanelManager();
            this.log(`Closed panel: ${panelId}`);
        }
    }

    /**
     * Shows a panel, making it visible.
     * @param {string} panelId - The ID of the panel to show.
     */
    showPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.isVisible = true;
            
            // If it's floating, show its floating element
            if (panel.isFloating && panel.floatingElement) {
                panel.floatingElement.style.display = 'block';
            } else if (panel.element) { // Otherwise show docked element
                panel.element.style.display = 'block';
            } else { // If element doesn't exist, render it
                this.renderPanel(panelId);
            }
            
            this.updatePanelManager();
            this.log(`Shown panel: ${panelId}`);
        }
    }
    
    /**
     * Toggles the visibility of a panel.
     * @param {string} panelId - The ID of the panel to toggle.
     */
    togglePanelVisibility(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            if (panel.isVisible) {
                this.closePanel(panelId);
            } else {
                this.showPanel(panelId);
            }
        }
    }

    makeFloatingPanelDraggable(windowElement) {
        let offsetX, offsetY, isDragging = false;
        const header = windowElement.querySelector('.floating-panel-header');

        const handleMouseDown = (e) => {
            isDragging = true;
            offsetX = e.clientX - windowElement.offsetLeft;
            offsetY = e.clientY - windowElement.offsetTop;
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        };

        const handleMouseMove = (e) => {
            if (isDragging) {
                windowElement.style.left = `${e.clientX - offsetX}px`;
                windowElement.style.top = `${e.clientY - offsetY}px`;
            }
        };

        const handleMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        header.addEventListener('mousedown', handleMouseDown);
    }

    /**
     * Renders all visible panels in the correct order.
     */
    renderAllPanels() {
        this.log('Rendering all panels...');
        if (!this.container) {
            this.log('Cannot render panels, container not set.', 'error');
            return;
        }

        // Clear existing panels from the DOM to prevent duplicates
        this.container.innerHTML = '';
        this.log('Cleared existing panel elements from the container.');

        // Use this.panelOrder to render panels in the correct order
        for (const panelId of this.panelOrder) {
            const panel = this.panels.get(panelId);
            if (panel) {
                if (panel.isVisible && !panel.isFloating) {
                    // Create panel element directly here instead of calling renderPanel
                    const panelElement = this.createPanelElement(panel);
                    this.container.appendChild(panelElement);
                    panel.element = panelElement;
                    
                    // Attach event listeners
                    this.attachPanelEventListeners(panelElement, panel);
                    
                    // Call activation handler
                    if (panel.onActivate) {
                        panel.onActivate();
                    }
                    
                    this.log(`[DEBUG] Rendered and appended panel: ${panel.id}`);
                } else {
                    this.log(`[DEBUG] Skipping render for panel: ${panel.id} (isVisible: ${panel.isVisible})`);
                }
            } else {
                this.log(`[DEBUG] Panel ${panelId} not found in panels map`, 'warn');
            }
        }

        this.log('Finished rendering all panels.');
        // No longer relying on mutations from generatePanelManagerContent to attach listeners
        this.updatePanelManager(); // Ensure panel manager UI is updated and listeners attached
    }

    /**
     * Saves the current order of panels to local storage.
     */
    savePanelOrder() {
        localStorage.setItem('sidebarPanelOrder', JSON.stringify(this.panelOrder));
    }

    /**
     * Retrieves the current order of panels.
     * @returns {string[]} An array of panel IDs in their current order.
     */
    getPanelOrder() {
        return [...this.panelOrder];
    }

    /**
     * Sets a new order for the panels and re-renders them.
     * @param {string[]} newOrder - An array of panel IDs in the desired new order.
     */
    setPanelOrder(newOrder) {
        this.panelOrder = newOrder;
        this.savePanelOrder();
        this.renderAllPanels();
    }

    /**
     * Retrieves a panel configuration by its ID.
     * @param {string} panelId - The ID of the panel to retrieve.
     * @returns {object|undefined} The panel configuration object, or undefined if not found.
     */
    getPanel(panelId) {
        return this.panels.get(panelId);
    }

    /**
     * Retrieves all registered panel configurations.
     * @returns {object[]} An array of all panel configuration objects.
     */
    getAllPanels() {
        return Array.from(this.panels.values());
    }

    /**
     * Generates the HTML content for the 'Panel Manager' panel, displaying toggle buttons for other panels.
     * @returns {string} The HTML string for the panel manager content.
     */
    generatePanelManagerContent() {
        let content = `
            <div class="panel-manager-grid">
        `;
        const sortedPanels = [...this.panels.values()].sort((a, b) => a.priority - b.priority);

        for (const panel of sortedPanels) {
            if (panel.id === 'panel-manager') continue;
            
            const iconPath = `/client/styles/icons/${panel.icon}.svg`;
            const activeClass = panel.isVisible && !panel.isFloating ? 'active' : 'inactive';
            content += `
                <div class="panel-manager-item ${activeClass}" data-panel-id="${panel.id}" title="Toggle ${panel.title}">
                    <div class="panel-manager-icon"><img src="${iconPath}" alt="${panel.title}"/></div>
                </div>
            `;
        }
        content += '</div>';
        return content;
    }

    /**
     * Attaches event listeners to the Panel Manager grid items.
     * This should be called after the HTML for the Panel Manager has been rendered into the DOM.
     */
    attachPanelManagerEventListeners() {
        const panelManager = this.panels.get('panel-manager');
        if (panelManager && panelManager.element) {
            const contentArea = panelManager.element.querySelector('.sidebar-panel-content');
            if (contentArea) {
                contentArea.querySelectorAll('.panel-manager-item').forEach(item => {
                    const panelId = item.dataset.panelId;
                    
                    if (panelId) {
                        item.addEventListener('click', () => this.togglePanelVisibility(panelId));
                    }
                });

                // Attach event listener for the reset button in the header
                const resetBtn = panelManager.element.querySelector('.panel-reset-btn');
                if (resetBtn) {
                    resetBtn.addEventListener('click', () => this.showAllPanels());
                    this.log('Panel Manager reset button event listener attached.');
                }

                this.log('Panel Manager event listeners attached.');
            } else {
                this.log('Could not find content area for Panel Manager to attach event listeners.', 'warn');
            }
        } else if (!panelManager) {
            this.log('Panel Manager panel not registered, cannot attach event listeners.', 'warn');
        }
    }

    /**
     * Resets all sidebar panel states to their default, including order and visibility.
     */
    resetPanelStates() {
        this.log('Resetting all panel states...');

        // Clear saved order from local storage
        localStorage.removeItem('sidebarPanelOrder');
        
        // Reset panel order to default order based on priority
        const defaultPanels = ['panel-manager', 'files', 'context', 'tokens', 'logs'];
        this.panelOrder = defaultPanels;
        this.savePanelOrder();

        // Ensure all panels are visible and not floating, then re-render
        this.panels.forEach(panel => {
            panel.isVisible = true;
            panel.isFloating = false;
            if (panel.floatingElement) { // Remove floating element if it exists
                panel.floatingElement.remove();
                panel.floatingElement = null;
            }
            if (panel.element) { // Ensure docked element is visible
                panel.element.style.display = '';
                panel.element.classList.remove('collapsed'); // Also uncollapse
            }
        });

        // Re-render all panels to reflect the reset state
        this.renderAllPanels();
        this.log('All panel states reset and re-rendered.');
        this.updatePanelManager(); // Update Panel Manager UI to reflect active/inactive states
    }

    /**
     * Shows all panels by making them visible but in a collapsed state.
     */
    showAllPanels() {
        this.log('Showing all panels in collapsed state...');
        
        // Make all panels visible but collapsed, and dock floating ones
        this.panels.forEach(panel => {
            panel.isVisible = true;
            
            // Dock any floating panels
            if (panel.isFloating && panel.floatingElement) {
                this.dockPanel(panel.id);
            }
            
            // Ensure panel element is visible but collapsed
            if (panel.element) {
                panel.element.style.display = '';
                panel.element.classList.add('collapsed'); // Add collapsed class instead of removing
            }
        });
        
        // Re-render all panels to ensure they're displayed
        this.renderAllPanels();
        
        // After rendering, ensure all panels are collapsed
        this.panels.forEach(panel => {
            if (panel.element && panel.id !== 'panel-manager') { // Don't collapse the panel manager itself
                panel.element.classList.add('collapsed');
            }
        });
        
        this.log('All panels are now visible but collapsed.');
        this.updatePanelManager(); // Update Panel Manager UI to reflect all panels as active
    }

    /**
     * Completely reinstalls all panels - performs a full reset and reinitialize.
     * This is more thorough than resetPanelStates and rebuilds everything from scratch.
     */
    reinstallAllPanels() {
        this.log('Reinstalling all panels...');
        
        // Clear all local storage related to panels
        localStorage.removeItem('sidebarPanelOrder');
        
        // Reset internal state
        this.panelOrder = [];
        this.panels.forEach(panel => {
            if (panel.floatingElement) {
                panel.floatingElement.remove();
            }
        });
        this.panels.clear();
        
        // Re-initialize default panels
        this.initializeDefaultPanels();
        
        // Re-render
        this.renderAllPanels();
        
        this.log('All panels have been reinstalled.');
    }

    /**
     * Updates the Panel Manager panel's content to reflect the current state of other panels.
     */
    updatePanelManager() {
        const panelManager = this.panels.get('panel-manager');
        if (panelManager && panelManager.element) {
            const contentArea = panelManager.element.querySelector('.sidebar-panel-content');
            if (contentArea) {
                contentArea.innerHTML = this.generatePanelManagerContent();
                this.attachPanelManagerEventListeners();
            }
        }
    }

    /**
     * Generates dummy content for the 'Files' panel.
     * @returns {string} HTML string.
     */
    generateFilesContent() {
        return `
            <div id="file-list-container">
                <!-- File list will be rendered here by another component -->
                <p>Loading file tree...</p>
            </div>
        `;
    }

    /**
     * Generates content for the 'Context' panel with publishing contexts and dev info.
     * @returns {string} HTML string.
     */
    generateContextContent() {
        return `
            <div class="context-manager">
                <!-- Base URL and Dev Info Section -->
                <div class="context-section">
                    <h4 class="context-section-title">Development Info</h4>
                    <div class="dev-info">
                        <div class="info-item">
                            <label>Base URL:</label>
                            <input type="text" class="base-url-input" value="http://localhost:3000" placeholder="Base URL">
                        </div>
                        <div class="info-item">
                            <label>Environment:</label>
                            <select class="env-select">
                                <option value="development">Development</option>
                                <option value="staging">Staging</option>
                                <option value="production">Production</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Publishing Contexts Section -->
                <div class="context-section">
                    <h4 class="context-section-title">Publishing Contexts</h4>
                    
                    <!-- Main Site Context -->
                    <div class="publish-context" data-context="main">
                        <div class="context-header">
                            <span class="context-name">Main Site</span>
                            <div class="context-actions">
                                <button class="context-action-btn" title="Edit">⚙</button>
                            </div>
                        </div>
                        
                        <div class="context-details">
                            <div class="context-subsection">
                                <h5>Files</h5>
                                <div class="file-list">
                                    <a href="#" class="file-link" data-file="content/index.md">content/index.md</a>
                                    <a href="#" class="file-link" data-file="content/about.md">content/about.md</a>
                                    <a href="#" class="file-link" data-file="content/blog/post1.md">content/blog/post1.md</a>
                                </div>
                            </div>
                            
                            <div class="context-subsection">
                                <h5>Styles</h5>
                                <div class="style-info">
                                    <span class="style-path">styles/main/</span>
                                    <small>Core, Light, Dark variants</small>
                                </div>
                            </div>
                            
                            <div class="context-subsection">
                                <h5>Endpoint</h5>
                                <input type="text" class="endpoint-input" value="https://api.example.com" placeholder="API Endpoint">
                            </div>
                            
                            <div class="context-subsection">
                                <h5>Digital Ocean</h5>
                                <div class="do-credentials">
                                    <input type="text" class="do-token" placeholder="DO Token" value="••••••••">
                                    <input type="text" class="do-space" placeholder="Space Name" value="main-site">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Documentation Context -->
                    <div class="publish-context" data-context="docs">
                        <div class="context-header">
                            <span class="context-name">Documentation</span>
                            <div class="context-actions">
                                <button class="context-action-btn" title="Edit">⚙</button>
                            </div>
                        </div>
                        
                        <div class="context-details">
                            <div class="context-subsection">
                                <h5>Files</h5>
                                <div class="file-list">
                                    <a href="#" class="file-link" data-file="docs/api.md">docs/api.md</a>
                                    <a href="#" class="file-link" data-file="docs/guide.md">docs/guide.md</a>
                                    <a href="#" class="file-link" data-file="docs/examples.md">docs/examples.md</a>
                                </div>
                            </div>
                            
                            <div class="context-subsection">
                                <h5>Styles</h5>
                                <div class="style-info">
                                    <span class="style-path">styles/docs/</span>
                                    <small>Core, Light, Dark variants</small>
                                </div>
                            </div>
                            
                            <div class="context-subsection">
                                <h5>Endpoint</h5>
                                <input type="text" class="endpoint-input" value="https://docs-api.example.com" placeholder="API Endpoint">
                            </div>
                            
                            <div class="context-subsection">
                                <h5>Digital Ocean</h5>
                                <div class="do-credentials">
                                    <input type="text" class="do-token" placeholder="DO Token" value="••••••••">
                                    <input type="text" class="do-space" placeholder="Space Name" value="docs-site">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Notepad Context Section -->
                <div class="context-section">
                    <h4 class="context-section-title">Notepads</h4>
                    <div class="notepad-list">
                        <a href="#" class="file-link notepad-link" data-file="notepads/sdk/001.md">@notepad/sdk/001.md</a>
                        <a href="#" class="file-link notepad-link" data-file="notepads/sdk/002.md">@notepad/sdk/002.md</a>
                        <a href="#" class="file-link notepad-link" data-file="notepads/api/reference.md">@notepad/api/reference.md</a>
                        <a href="#" class="file-link notepad-link" data-file="notepads/guides/setup.md">@notepad/guides/setup.md</a>
                    </div>
                </div>

                <div class="context-actions-footer">
                    <button class="add-context-btn">Add Publishing Context</button>
                </div>
            </div>
        `;
    }

    /**
     * Generates content for the 'Tokens' panel, displaying design tokens.
     * @returns {string} HTML string.
     */
    generateTokensContent() {
        if (this.tokensColorGrid === undefined) this.tokensColorGrid = false;

        let content = `
            <div class="design-tokens-panel">
                <div class="tokens-panel-header">
                    <!-- Design Token display options could go here -->
                    <button class="color-grid-toggle" title="Toggle color grid view">🔳</button>
                </div>
                <div class="token-grid">
        `;

        // Only color category for sidebar
        for (const category in this.tokens) {
            content += `
                    <div class="token-category">
                        <div class="token-category-title">${category.charAt(0).toUpperCase() + category.slice(1)}</div>
            `;
            if (category === 'color' && this.tokensColorGrid) {
                content += this.renderSidebarColorGrid();
            } else {
                this.tokens[category].forEach(token => {
                    let previewStyle = '';
                    if (category === 'color') {
                        previewStyle = `background-color: ${token.value};`;
                    }
                    content += `
                            <div class="token-item" data-category="${category}" data-token-name="${token.name}">
                                <div class="token-info">
                                    <div class="token-name">${token.name}</div>
                                    <div class="token-value">${token.value}</div>
                                </div>
                                ${category === 'color' ? `<div class="token-preview" style="${previewStyle}"></div>` : ''}
                            </div>
                    `;
                });
            }
            content += `
                    </div>
            `;
        }

        content += `
                </div>
            </div>
        `;

        return content;
    }

    // Render compact grid like DesignTokensPanel but for sidebar
    renderSidebarColorGrid() {
        const hueMap = {};
        const intensitySet = new Set();
        const hueRegex = /--color-([^\-]+)-(\d+)/;
        this.tokens.color.forEach(token => {
            const m = token.name.match(hueRegex);
            if (!m) return;
            const hue = m[1];
            const intensity = parseInt(m[2], 10);
            if (!hueMap[hue]) hueMap[hue] = {};
            hueMap[hue][intensity] = token;
            intensitySet.add(intensity);
        });
        const intensities = Array.from(intensitySet).sort((a,b)=>a-b);
        const hues = Object.keys(hueMap).sort();

        let html = `
            <div class="color-mini-grid" style="display:flex; flex-direction:column; gap:4px;">
                <div class="color-grid-row" style="display:flex; align-items:center; gap:4px;">
                    <div style="width:32px;"></div>`;
        intensities.forEach(i=>{
            html += `<div style="width:26px; font-size:9px; text-align:center; color:var(--color-foreground-muted);">${i}</div>`;
        });
        html += `</div>`;

        hues.forEach(hue=>{
            html += `<div class="color-grid-row" style="display:flex; align-items:center; gap:4px;">`;
            html += `<div style="width:32px; font-size:9px; color:var(--color-foreground-muted); text-transform:capitalize;">${hue}</div>`;
            intensities.forEach(i=>{
                const token = hueMap[hue][i];
                const value = token ? token.value : 'transparent';
                html += `<div class="grid-swatch" style="width:22px; height:22px; border-radius:3px; background:${value}; border:1px solid var(--color-border);"></div>`;
            });
            html += `</div>`;
        });
        html += `</div>`;
        html += `</div>`;
        return html;
    }

    /**
     * Generates dummy content for the 'Logs' panel.
     * @returns {string} HTML string.
     */
    generateLogsContent() {
        // This could display a few recent log entries
        return `
            <div class="log-viewer">
                <p>Log panel content goes here.</p>
                <div class="log-entry log-info">[INFO] Application initialized.</div>
                <div class="log-entry log-warn">[WARN] Deprecated function called.</div>
            </div>
        `;
    }
    
    // --- Event Handlers for UI actions within panels ---

    addContext() {
        const name = prompt('Enter new context name:');
        if (name) {
            dispatch({ type: ActionTypes.ADD_CONTEXT, payload: { name } });
            // In a real app, the component should re-render based on state change.
            // For this demo, we'll manually refresh.
            this.renderPanel('context');
        }
    }

    editContext(contextId) {
        const newName = prompt('Enter new name for the context:');
        if (newName) {
            dispatch({ type: ActionTypes.EDIT_CONTEXT, payload: { contextId, newName } });
            this.renderPanel('context');
        }
    }

    deleteContext(contextId) {
        if (confirm('Are you sure you want to delete this context?')) {
            dispatch({ type: ActionTypes.DELETE_CONTEXT, payload: { contextId } });
            this.renderPanel('context');
        }
    }
    
    updateDesignTokens(newTokens) {
        // This function would be called when theme/design tokens change
        // For now, it's a placeholder
        this.log('Design tokens updated, re-rendering panels might be needed.');
    }

    initializeDefaultPanels() {
        this.log('Initializing default panels...');

        this.loadPanelOrder();

        this.register('panel-manager', {
            title: 'Panel Manager',
            icon: 'panel-manager',
            category: 'system',
            priority: 100,
            render: () => this.generatePanelManagerContent(),
            onActivate: () => this.attachPanelManagerEventListeners(),
            canClose: false,
            isVisible: true,
            metadata: {
                description: 'This panel allows you to manage and reorder other sidebar panels.'
            }
        });
        
        const publishedSummaryPanel = new PublishedSummaryPanel();
        this.register('published-summary', {
            title: 'Published Contexts',
            icon: 'files',
            category: 'general',
            priority: 30,
            instance: publishedSummaryPanel,
            canFloat: true,
            canClose: true,
            isVisible: true,
        });

        // Files panel
        const fileBrowserPanel = new FileBrowserPanel();
        this.register('files', {
            title: 'Files',
            icon: 'files',
            category: 'general',
            priority: 20,
            instance: fileBrowserPanel,
            canFloat: true,
            canClose: true,
            isVisible: true,
        });

        this.register('context', {
            id: 'context',
            title: 'Context',
            icon: 'context',
            render: this.generateContextContent.bind(this),
            isVisible: true,
            isDraggable: true,
            isCollapsible: true,
            isClosable: true,
            priority: 3,
            onActivate: () => {
                this.attachContextEventListeners();
            }
        });
        
        this.register('tokens', {
            id: 'tokens',
            title: 'Design Tokens',
            icon: 'tokens',
            render: this.generateTokensContent.bind(this),
            isVisible: true, // Make visible by default
            isDraggable: true,
            isCollapsible: true,
            isClosable: true,
            priority: 4
        });
        
        this.register('logs', {
            id: 'logs',
            title: 'Logs',
            icon: 'logs',
            render: this.generateLogsContent.bind(this),
            isVisible: false, // Hidden by default
            isDraggable: true,
            isCollapsible: true,
            isClosable: true,
            priority: 5
        });

        this.log('Default panels initialized.');
    }

    forceShowAllPanels() {
        this.log('Forcing all panels to be visible...');
        this.panels.forEach(panel => {
            panel.isVisible = true;
            if (panel.element) {
                panel.element.style.display = 'block';
                panel.element.classList.remove('collapsed');
            }
             if (panel.isFloating && panel.floatingElement) {
                this.dockPanel(panel.id);
            }
        });
        this.renderAllPanels();
        this.updatePanelManager();
    }
    
    debugState() {
        this.log('--- SidebarPanelManager State ---', 'debug');
        this.log(`Container: ${this.container ? 'Set' : 'Not Set'}`, 'debug');
        this.log(`Panel Order: [${this.panelOrder.join(', ')}]`, 'debug');
        this.log('Panels:', 'debug');
        this.panels.forEach(panel => {
            this.log(`  - ${panel.id}: isVisible=${panel.isVisible}, isFloating=${panel.isFloating}, element=${panel.element ? 'Exists' : 'null'}`, 'debug');
        });
        this.log('---------------------------------', 'debug');
    }

    reinitialize() {
        this.log('Reinitializing SidebarPanelManager...');
        
        // Clear DOM
        if(this.container) {
            this.container.innerHTML = '';
        }
        
        // Clear floating panels
        this.panels.forEach(panel => {
            if (panel.floatingElement) {
                panel.floatingElement.remove();
            }
        });
        
        // Reset state
        this.panels.clear();
        this.panelOrder = [];
        this.draggedPanel = null;
        this.dropZone = null;
        
        // Re-initialize
        this.initializeDefaultPanels();
        this.renderAllPanels();
        
        this.log('SidebarPanelManager reinitialized.');
    }
    
    ensureAllPanelsPresent() {
        this.log('Ensuring all panels are present in the DOM...');
        let needsReRender = false;
        
        this.panelOrder.forEach(panelId => {
            const panel = this.panels.get(panelId);
            if (panel && panel.isVisible && !panel.isFloating) {
                const element = this.container.querySelector(`.sidebar-panel[data-panel-id="${panelId}"]`);
                if (!element) {
                    this.log(`Panel "${panelId}" is missing from the DOM.`, 'warn');
                    needsReRender = true;
                }
            }
        });
        
        if (needsReRender) {
            this.log('One or more panels were missing. Re-rendering all panels.', 'warn');
            this.renderAllPanels();
        } else {
            this.log('All visible panels are present.');
        }
    }
    
    debugDOM() {
        if (!this.container) {
            this.log('Container not set, cannot debug DOM.', 'warn');
            return;
        }
        
        this.log('--- Debugging Sidebar DOM ---');
        
        const childNodes = this.container.children;
        this.log(`Container has ${childNodes.length} direct children.`);
        
        const panelElements = this.container.querySelectorAll('.sidebar-panel');
        this.log(`Found ${panelElements.length} elements with .sidebar-panel class.`);
        
        const domOrder = Array.from(panelElements).map(el => el.dataset.panelId);
        this.log(`DOM Order: [${domOrder.join(', ')}]`);
        
        this.log(`Internal Order: [${this.panelOrder.join(', ')}]`);
        
        if (JSON.stringify(domOrder) !== JSON.stringify(this.panelOrder.filter(id => {
            const p = this.panels.get(id);
            return p && p.isVisible && !p.isFloating;
        }))) {
            this.log('DOM order does not match internal order of visible panels.', 'warn');
        } else {
            this.log('DOM order matches internal order.');
        }

        this.panels.forEach(panel => {
            if (panel.isVisible && !panel.isFloating) {
                const el = this.container.querySelector(`.sidebar-panel[data-panel-id="${panel.id}"]`);
                if (!el) {
                    this.log(`Panel ${panel.id} should be visible but element not found.`, 'error');
                } else {
                    this.log(`Panel ${panel.id} element found.`, 'info');
                }
            }
        });
        
        this.log('--- End DOM Debug ---');
    }

    emergencyFix() {
        this.log('!!! EMERGENCY FIX ACTIVATED !!!', 'error');
        this.log('Attempting to force-reset panel states and re-render.', 'warn');

        try {
            // Force reset local storage and internal order
            localStorage.removeItem('sidebarPanelOrder');
            this.panelOrder = ['panel-manager', 'files', 'context', 'tokens', 'logs'];
            this.savePanelOrder();

            // Force all panels to be visible and docked
            this.panels.forEach(panel => {
                panel.isVisible = true;
                panel.isFloating = false;
                if (panel.floatingElement) {
                    panel.floatingElement.remove();
                    panel.floatingElement = null;
                }
            });

            // Re-render everything from scratch
            this.renderAllPanels();
            
            this.log('Emergency fix complete. Please check the UI.', 'info');
        } catch (error) {
            this.log(`Emergency fix failed: ${error.message}`, 'error');
            this.log('The UI might be in an unrecoverable state. Please try refreshing the page.', 'error');
        }
    }

    attachGlobalPanelEventListeners() {
        // Placeholder for any global listeners related to panels
        this.log('Attaching global panel event listeners...');
    }

    loadPanelOrder() {
        try {
            const savedOrder = JSON.parse(localStorage.getItem('sidebarPanelOrder'));
            if (Array.isArray(savedOrder)) {
                return savedOrder;
            }
        } catch (error) {
            this.log('Could not parse sidebarPanelOrder from localStorage.', 'warn');
        }
        return []; // Default empty array
    }

    attachContextEventListeners() {
        const contextPanel = this.panels.get('context');
        if (!contextPanel || !contextPanel.element) {
            this.log('Context panel element not found for event listeners', 'warn');
            return;
        }

        const contentArea = contextPanel.element.querySelector('.sidebar-panel-content');
        if (!contentArea) {
            this.log('Context panel content area not found', 'warn');
            return;
        }

        // Handle file link clicks
        contentArea.addEventListener('click', (event) => {
            const fileLink = event.target.closest('.file-link');
            if (fileLink) {
                event.preventDefault();
                const filePath = fileLink.dataset.file;
                if (filePath) {
                    this.loadFileIntoEditor(filePath);
                }
            }

            // Handle context action buttons
            const actionBtn = event.target.closest('.context-action-btn');
            if (actionBtn) {
                const contextEl = actionBtn.closest('.publish-context');
                const contextName = contextEl ? contextEl.dataset.context : null;
                if (contextName) {
                    this.editPublishingContext(contextName);
                }
            }

            // Handle add context button
            const addBtn = event.target.closest('.add-context-btn');
            if (addBtn) {
                this.addPublishingContext();
            }
        });

        this.log('Context event listeners attached.');
    }

    async loadFileIntoEditor(filePath) {
        try {
            this.log(`Loading file into editor: ${filePath}`);
            
            // Use the fileManager to load the file
            if (window.fileManager && typeof window.fileManager.loadFile === 'function') {
                await window.fileManager.loadFile(filePath);
            } else {
                // Fallback: try to import and use the fileManager
                const { loadFile } = await import('/client/filesystem/fileManager.js');
                await loadFile(filePath);
            }
            
            this.log(`Successfully loaded file: ${filePath}`);
        } catch (error) {
            this.log(`Error loading file ${filePath}: ${error.message}`, 'error');
        }
    }

    editPublishingContext(contextName) {
        this.log(`Editing publishing context: ${contextName}`);
        // Placeholder for context editing functionality
        // In a real implementation, this might open a modal or settings panel
    }

    addPublishingContext() {
        const name = prompt('Enter new publishing context name:');
        if (name) {
            this.log(`Adding new publishing context: ${name}`);
            // Placeholder for adding new context
            // This would need to integrate with a proper state management system
            this.renderPanel('context'); // Re-render to show the new context
        }
    }
}

// Create singleton instance
export const sidebarPanelManager = new SidebarPanelManager();
