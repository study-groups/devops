/**
 * @file PanelReorderManager.js
 * @description Enhanced panel reordering system with drag-and-drop support
 * for panels within docks, between docks, and in the sidebar
 */

import { appStore, dispatch } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';
import { logMessage } from '/client/log/index.js';

export class PanelReorderManager {
    constructor() {
        this.dragState = null;
        this.dropZones = new Map();
        this.dragPreview = null;
        
        // Bind event handlers
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragEnter = this.handleDragEnter.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
        
        this.init();
        console.log('[PanelReorderManager] Initialized');
    }
    
    /**
     * Initialize the reorder system
     */
    init() {
        // Set up global drag event listeners
        document.addEventListener('dragover', this.handleDragOver);
        document.addEventListener('dragenter', this.handleDragEnter);
        document.addEventListener('dragleave', this.handleDragLeave);
        document.addEventListener('drop', this.handleDrop);
        document.addEventListener('dragend', this.handleDragEnd);
        
        // Initialize existing panels for reordering
        this.initializeExistingPanels();
    }
    
    /**
     * Initialize existing panels in the DOM for drag-and-drop
     */
    initializeExistingPanels() {
        // Find all panel elements and make them draggable
        const panels = document.querySelectorAll('.panel-header, .subpanel-header, .panel-card');
        panels.forEach(panel => this.makePanelDraggable(panel));
        
        // Find all dock containers and make them drop zones
        const docks = document.querySelectorAll('.dock-content, .sidebar-dock-container, .dock-body');
        docks.forEach(dock => this.makeDockDropZone(dock));
    }
    
    /**
     * Make a panel element draggable
     * @param {HTMLElement} panelElement - The panel element
     */
    makePanelDraggable(panelElement) {
        const panelId = this.getPanelId(panelElement);
        if (!panelId) return;
        
        panelElement.draggable = true;
        panelElement.dataset.panelId = panelId;
        panelElement.classList.add('draggable-panel');
        
        // Add drag handle if not exists
        if (!panelElement.querySelector('.drag-handle')) {
            const dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';
            dragHandle.innerHTML = '⋮⋮';
            dragHandle.title = 'Drag to reorder';
            dragHandle.style.cssText = `
                cursor: grab;
                padding: 4px;
                color: var(--color-text-secondary, #999);
                font-size: 12px;
                line-height: 1;
                opacity: 0.6;
                transition: opacity 0.2s ease;
            `;
            
            panelElement.insertBefore(dragHandle, panelElement.firstChild);
        }
        
        panelElement.addEventListener('dragstart', this.handleDragStart);
        
        // Show drag handle on hover
        panelElement.addEventListener('mouseenter', () => {
            const handle = panelElement.querySelector('.drag-handle');
            if (handle) handle.style.opacity = '1';
        });
        
        panelElement.addEventListener('mouseleave', () => {
            const handle = panelElement.querySelector('.drag-handle');
            if (handle) handle.style.opacity = '0.6';
        });
    }
    
    /**
     * Make a dock container a drop zone
     * @param {HTMLElement} dockElement - The dock element
     */
    makeDockDropZone(dockElement) {
        const dockId = this.getDockId(dockElement);
        if (!dockId) return;
        
        dockElement.classList.add('panel-drop-zone');
        dockElement.dataset.dockId = dockId;
        
        this.dropZones.set(dockId, {
            element: dockElement,
            dockId,
            acceptsPanels: true
        });
    }
    
    /**
     * Get panel ID from element
     * @param {HTMLElement} element - The element
     * @returns {string|null} The panel ID
     */
    getPanelId(element) {
        return element.dataset.panelId || 
               element.dataset.subpanelId ||
               element.id?.replace(/^(panel-|subpanel-)/, '') ||
               null;
    }
    
    /**
     * Get dock ID from element
     * @param {HTMLElement} element - The element
     * @returns {string|null} The dock ID
     */
    getDockId(element) {
        return element.dataset.dockId ||
               element.closest('[data-dock-id]')?.dataset.dockId ||
               element.id?.replace(/-content$/, '') ||
               null;
    }
    
    /**
     * Handle drag start
     * @param {DragEvent} e - The drag event
     */
    handleDragStart(e) {
        const panelElement = e.currentTarget;
        const panelId = this.getPanelId(panelElement);
        const sourceDockId = this.getDockId(panelElement.closest('.panel-drop-zone'));
        
        if (!panelId) {
            e.preventDefault();
            return;
        }
        
        this.dragState = {
            panelId,
            sourceDockId,
            sourceElement: panelElement,
            startTime: Date.now()
        };
        
        // Set drag data
        e.dataTransfer.setData('text/plain', panelId);
        e.dataTransfer.setData('application/x-panel-id', panelId);
        e.dataTransfer.effectAllowed = 'move';
        
        // Create drag preview
        this.createDragPreview(panelElement);
        
        // Add dragging class
        panelElement.classList.add('dragging');
        document.body.classList.add('panel-dragging');
        
        // Highlight drop zones
        this.highlightDropZones(true);
        
        logMessage(`Started dragging panel: ${panelId}`, 'info');
    }
    
    /**
     * Create drag preview element
     * @param {HTMLElement} panelElement - The panel element being dragged
     */
    createDragPreview(panelElement) {
        this.dragPreview = panelElement.cloneNode(true);
        this.dragPreview.className = 'drag-preview';
        this.dragPreview.style.cssText = `
            position: fixed;
            top: -1000px;
            left: -1000px;
            width: ${panelElement.offsetWidth}px;
            height: ${panelElement.offsetHeight}px;
            background: var(--color-bg, white);
            border: 1px solid var(--color-primary, #1976d2);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            opacity: 0.8;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(this.dragPreview);
    }
    
    /**
     * Handle drag over
     * @param {DragEvent} e - The drag event
     */
    handleDragOver(e) {
        if (!this.dragState) return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Update drag preview position
        if (this.dragPreview) {
            this.dragPreview.style.left = `${e.clientX + 10}px`;
            this.dragPreview.style.top = `${e.clientY + 10}px`;
        }
        
        // Find drop target
        const dropTarget = this.findDropTarget(e.target);
        if (dropTarget) {
            this.showDropIndicator(dropTarget, e);
        }
    }
    
    /**
     * Handle drag enter
     * @param {DragEvent} e - The drag event
     */
    handleDragEnter(e) {
        if (!this.dragState) return;
        
        const dropZone = e.target.closest('.panel-drop-zone');
        if (dropZone) {
            dropZone.classList.add('drag-over');
        }
    }
    
    /**
     * Handle drag leave
     * @param {DragEvent} e - The drag event
     */
    handleDragLeave(e) {
        if (!this.dragState) return;
        
        const dropZone = e.target.closest('.panel-drop-zone');
        if (dropZone && !dropZone.contains(e.relatedTarget)) {
            dropZone.classList.remove('drag-over');
            this.hideDropIndicator();
        }
    }
    
    /**
     * Handle drop
     * @param {DragEvent} e - The drag event
     */
    handleDrop(e) {
        if (!this.dragState) return;
        
        e.preventDefault();
        
        const dropTarget = this.findDropTarget(e.target);
        if (dropTarget) {
            this.performDrop(dropTarget, e);
        }
        
        this.cleanup();
    }
    
    /**
     * Handle drag end
     * @param {DragEvent} e - The drag event
     */
    handleDragEnd(e) {
        this.cleanup();
    }
    
    /**
     * Find valid drop target
     * @param {HTMLElement} element - The element under cursor
     * @returns {object|null} Drop target info
     */
    findDropTarget(element) {
        const dropZone = element.closest('.panel-drop-zone');
        if (!dropZone) return null;
        
        const dockId = this.getDockId(dropZone);
        if (!dockId) return null;
        
        // Find insertion point
        const panelElements = Array.from(dropZone.querySelectorAll('.draggable-panel:not(.dragging)'));
        const insertionPoint = this.findInsertionPoint(panelElements, element);
        
        return {
            dockId,
            dropZone,
            insertionPoint,
            targetPanel: insertionPoint.targetPanel
        };
    }
    
    /**
     * Find insertion point within a dock
     * @param {Array<HTMLElement>} panelElements - Panel elements in dock
     * @param {HTMLElement} cursorElement - Element under cursor
     * @returns {object} Insertion point info
     */
    findInsertionPoint(panelElements, cursorElement) {
        const targetPanel = cursorElement.closest('.draggable-panel:not(.dragging)');
        
        if (!targetPanel) {
            return {
                index: panelElements.length,
                targetPanel: null,
                insertBefore: false
            };
        }
        
        const targetIndex = panelElements.indexOf(targetPanel);
        const rect = targetPanel.getBoundingClientRect();
        const mouseY = event.clientY;
        const insertBefore = mouseY < rect.top + rect.height / 2;
        
        return {
            index: insertBefore ? targetIndex : targetIndex + 1,
            targetPanel,
            insertBefore
        };
    }
    
    /**
     * Perform the drop operation
     * @param {object} dropTarget - Drop target info
     * @param {DragEvent} e - The drag event
     */
    performDrop(dropTarget, e) {
        const { panelId, sourceDockId } = this.dragState;
        const { dockId: targetDockId, insertionPoint } = dropTarget;
        
        if (sourceDockId === targetDockId) {
            // Reorder within same dock
            this.reorderPanelInDock(panelId, targetDockId, insertionPoint.index);
        } else {
            // Move panel between docks
            this.movePanelBetweenDocks(panelId, sourceDockId, targetDockId, insertionPoint.index);
        }
        
        logMessage(`Dropped panel ${panelId} in dock ${targetDockId} at position ${insertionPoint.index}`, 'info');
    }
    
    /**
     * Reorder panel within the same dock
     * @param {string} panelId - The panel ID
     * @param {string} dockId - The dock ID
     * @param {number} newIndex - The new index
     */
    reorderPanelInDock(panelId, dockId, newIndex) {
        const state = appStore.getState();
        const dock = state.panels?.docks?.[dockId];
        
        if (!dock || !dock.panels) return;
        
        const currentIndex = dock.panels.indexOf(panelId);
        if (currentIndex === -1) return;
        
        // Create new panel order
        const newOrder = [...dock.panels];
        newOrder.splice(currentIndex, 1);
        newOrder.splice(newIndex > currentIndex ? newIndex - 1 : newIndex, 0, panelId);
        
        // Dispatch reorder action
        dispatch(panelActions.reorderPanels(dockId, newOrder));
        
        // Update visual order
        this.updateVisualOrder(dockId, newOrder);
    }
    
    /**
     * Move panel between different docks
     * @param {string} panelId - The panel ID
     * @param {string} sourceDockId - The source dock ID
     * @param {string} targetDockId - The target dock ID
     * @param {number} targetIndex - The target index
     */
    movePanelBetweenDocks(panelId, sourceDockId, targetDockId, targetIndex) {
        const state = appStore.getState();
        const sourceDock = state.panels?.docks?.[sourceDockId];
        const targetDock = state.panels?.docks?.[targetDockId];
        
        if (!sourceDock || !targetDock) return;
        
        // Remove from source dock
        const sourceOrder = sourceDock.panels.filter(id => id !== panelId);
        dispatch(panelActions.reorderPanels(sourceDockId, sourceOrder));
        
        // Add to target dock
        const targetOrder = [...(targetDock.panels || [])];
        targetOrder.splice(targetIndex, 0, panelId);
        dispatch(panelActions.reorderPanels(targetDockId, targetOrder));
        
        // Update panel's dock assignment
        dispatch(panelActions.updatePanel(panelId, { dockId: targetDockId }));
        
        // Update visual order
        this.updateVisualOrder(sourceDockId, sourceOrder);
        this.updateVisualOrder(targetDockId, targetOrder);
        
        // Trigger panel remount in new dock
        setTimeout(() => {
            dispatch(panelActions.mountPanel(panelId, `${targetDockId}-content`, targetDockId));
        }, 100);
    }
    
    /**
     * Update visual order of panels in DOM
     * @param {string} dockId - The dock ID
     * @param {Array<string>} panelOrder - The new panel order
     */
    updateVisualOrder(dockId, panelOrder) {
        const dockElement = document.querySelector(`[data-dock-id="${dockId}"]`);
        if (!dockElement) return;
        
        panelOrder.forEach((panelId, index) => {
            const panelElement = dockElement.querySelector(`[data-panel-id="${panelId}"]`);
            if (panelElement) {
                panelElement.style.order = index.toString();
            }
        });
    }
    
    /**
     * Show drop indicator
     * @param {object} dropTarget - Drop target info
     * @param {DragEvent} e - The drag event
     */
    showDropIndicator(dropTarget, e) {
        this.hideDropIndicator(); // Remove existing indicator
        
        const { dropZone, insertionPoint } = dropTarget;
        
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
        indicator.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--color-primary, #1976d2);
            border-radius: 1px;
            z-index: 1000;
            pointer-events: none;
        `;
        
        if (insertionPoint.targetPanel) {
            const rect = insertionPoint.targetPanel.getBoundingClientRect();
            const containerRect = dropZone.getBoundingClientRect();
            
            indicator.style.top = insertionPoint.insertBefore 
                ? `${rect.top - containerRect.top - 1}px`
                : `${rect.bottom - containerRect.top - 1}px`;
        } else {
            indicator.style.bottom = '0px';
        }
        
        dropZone.style.position = 'relative';
        dropZone.appendChild(indicator);
    }
    
    /**
     * Hide drop indicator
     */
    hideDropIndicator() {
        const indicators = document.querySelectorAll('.drop-indicator');
        indicators.forEach(indicator => indicator.remove());
    }
    
    /**
     * Highlight drop zones
     * @param {boolean} highlight - Whether to highlight
     */
    highlightDropZones(highlight) {
        const dropZones = document.querySelectorAll('.panel-drop-zone');
        dropZones.forEach(zone => {
            if (highlight) {
                zone.classList.add('drop-zone-active');
            } else {
                zone.classList.remove('drop-zone-active', 'drag-over');
            }
        });
    }
    
    /**
     * Cleanup after drag operation
     */
    cleanup() {
        if (this.dragState?.sourceElement) {
            this.dragState.sourceElement.classList.remove('dragging');
        }
        
        document.body.classList.remove('panel-dragging');
        this.highlightDropZones(false);
        this.hideDropIndicator();
        
        if (this.dragPreview) {
            this.dragPreview.remove();
            this.dragPreview = null;
        }
        
        this.dragState = null;
    }
    
    /**
     * Add reordering capability to a new panel
     * @param {HTMLElement} panelElement - The panel element
     */
    addReorderingToPanel(panelElement) {
        this.makePanelDraggable(panelElement);
    }
    
    /**
     * Add drop zone capability to a new dock
     * @param {HTMLElement} dockElement - The dock element
     */
    addDropZoneToDock(dockElement) {
        this.makeDockDropZone(dockElement);
    }
    
    /**
     * Get current panel order for a dock
     * @param {string} dockId - The dock ID
     * @returns {Array<string>} Panel order
     */
    getPanelOrder(dockId) {
        const state = appStore.getState();
        const dock = state.panels?.docks?.[dockId];
        return dock?.panels || [];
    }
    
    /**
     * Set panel order for a dock
     * @param {string} dockId - The dock ID
     * @param {Array<string>} panelOrder - The new panel order
     */
    setPanelOrder(dockId, panelOrder) {
        dispatch(panelActions.reorderPanels(dockId, panelOrder));
        this.updateVisualOrder(dockId, panelOrder);
    }
}

// Create global instance
export const panelReorderManager = new PanelReorderManager();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.panelReorderManager = panelReorderManager;
}
