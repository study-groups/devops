/**
 * client/layout/docks/BaseDock.js
 * Base class for all dock implementations (floating and embedded)
 * Extracted from DebugPanelManager to provide common dock functionality
 */

import { appStore, dispatch } from '/client/appState.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';
import { logMessage } from '/client/log/index.js';

export class BaseDock {
    constructor(dockId, title, panelGroup, isFloating = false) {
        this.dockId = dockId;
        this.title = title;
        this.panelGroup = panelGroup;
        this.isFloating = isFloating;
        
        // Panel management
        this.panelInstances = new Map();
        this.sectionInstances = {}; // For compatibility with current DebugPanelManager
        
        // State management
        this.isVisible = false;
        this.collapsedSections = new Set();
        
        // For floating docks
        if (this.isFloating) {
            this.currentPos = { x: 150, y: 150 };
            this.currentSize = { width: 500, height: 400 };
            this.isDragging = false;
            this.isResizing = false;
            this.dragOffset = { x: 0, y: 0 };
            this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        }
        
        // DOM elements (set by subclasses)
        this.dockElement = null;
        this.headerElement = null;
        this.contentElement = null;
        this.resizeHandle = null;
        this.closeButton = null;
    }

    /**
     * Initialize the dock - must be called after construction
     */
    async initialize() {
        this.loadPersistedState();
        this.createDockDOM();
        this.attachEventListeners();
        this.updateVisibility();
        
        logMessage(`[${this.constructor.name}] Initialized dock: ${this.dockId}`, 'debug');
    }

    /**
     * Create the DOM structure for this dock
     * Must be implemented by subclasses
     */
    createDockDOM() {
        throw new Error(`${this.constructor.name} must implement createDockDOM()`);
    }

    /**
     * Attach event listeners for this dock type
     * Must be implemented by subclasses
     */
    attachEventListeners() {
        throw new Error(`${this.constructor.name} must implement attachEventListeners()`);
    }

    /**
     * Toggle collapse state of a panel section
     */
    toggleSectionCollapse(sectionId) {
        // Update state in Redux
        this.updatePanelInState(sectionId, { 
            collapsed: !this.isPanelCollapsed(sectionId) 
        });
        
        // Update UI
        const container = this.dockElement.querySelector(`[data-panel-id="${sectionId}"]`);
        if (container) {
            const isCollapsed = this.isPanelCollapsed(sectionId);
            const titleElement = container.querySelector('.dock-section-title');
            
            if (titleElement) {
                // Apply collapsed state
                container.classList.toggle('collapsed', isCollapsed);
                
                // Update indicator
                const indicator = isCollapsed ? '+' : '-';
                const titleText = titleElement.textContent.substring(2); // Remove old indicator
                titleElement.textContent = `${indicator} ${titleText}`;
            }
        }
        
        logMessage(`[${this.constructor.name}] Toggled section ${sectionId} to ${this.isPanelCollapsed(sectionId) ? 'collapsed' : 'expanded'}`, 'debug');
    }

    /**
     * Show/hide the dock
     */
    toggleVisibility() {
        this.isVisible ? this.hide() : this.show();
    }

    show() {
        this.isVisible = true;
        this.updateVisibility();
        this.savePersistedState();
        logMessage(`[${this.constructor.name}] Dock shown: ${this.dockId}`, 'debug');
    }

    hide() {
        this.isVisible = false;
        this.updateVisibility();
        this.savePersistedState();
        logMessage(`[${this.constructor.name}] Dock hidden: ${this.dockId}`, 'debug');
    }

    /**
     * Update DOM visibility based on state
     */
    updateVisibility() {
        if (this.dockElement) {
            this.dockElement.style.display = this.isVisible ? 'flex' : 'none';
        }
    }

    /**
     * Get this dock's state from Redux
     */
    getReduxState() {
        const state = appStore.getState();
        
        if (this.isFloating) {
            return state.debugPanel; // For floating debug dock
        } else {
            // For embedded docks in sidebar
            return state.panels?.docks?.[this.dockId];
        }
    }

    /**
     * Check if a panel is collapsed
     */
    isPanelCollapsed(panelId) {
        const state = this.getReduxState();
        if (this.isFloating) {
            return state.collapsedSections?.includes(panelId) || false;
        } else {
            return state?.panels?.[panelId]?.collapsed || false;
        }
    }

    /**
     * Add a panel to Redux state
     */
    addPanelToState(panelData) {
        // Implementation depends on dock type - override in subclasses
        logMessage(`[${this.constructor.name}] addPanelToState not implemented for ${this.dockId}`, 'warn');
    }

    /**
     * Update a panel in Redux state
     */
    updatePanelInState(panelId, updates) {
        // Implementation depends on dock type - override in subclasses
        logMessage(`[${this.constructor.name}] updatePanelInState not implemented for ${this.dockId}`, 'warn');
    }

    /**
     * Save dock state to Redux
     */
    savePersistedState() {
        // Implementation depends on dock type - override in subclasses
        logMessage(`[${this.constructor.name}] savePersistedState not implemented for ${this.dockId}`, 'warn');
    }

    /**
     * Load dock state from Redux
     */
    loadPersistedState() {
        try {
            const state = this.getReduxState();
            
            if (this.isFloating && state) {
                this.currentPos = state.position || this.currentPos;
                this.currentSize = state.size || this.currentSize;
                this.isVisible = state.visible !== undefined ? state.visible : false;
            } else if (!this.isFloating && state) {
                this.isVisible = state.isVisible !== undefined ? state.isVisible : true;
            }
        } catch (error) {
            logMessage(`[${this.constructor.name}] Failed to load persisted state: ${error.message}`, 'error');
        }
    }

    /**
     * Clear all panel instances
     */
    clearPanelInstances() {
        Object.values(this.sectionInstances).forEach(instance => {
            if (instance && typeof instance.destroy === 'function') {
                instance.destroy();
            }
        });
        this.sectionInstances = {};
        this.panelInstances.clear();
        
        if (this.contentElement) {
            this.contentElement.innerHTML = '';
        }
    }

    /**
     * Destroy the dock and clean up
     */
    destroy() {
        this.clearPanelInstances();
        
        if (this.dockElement) {
            this.dockElement.remove();
            this.dockElement = null;
        }
        
        logMessage(`[${this.constructor.name}] Dock destroyed: ${this.dockId}`, 'debug');
    }

    // =================================================================
    // FLOATING DOCK METHODS (for floating docks only)
    // =================================================================

    /**
     * Start dragging (floating docks only)
     */
    startDrag(e) {
        if (!this.isFloating || e.target.tagName === 'BUTTON') return;
        
        this.isDragging = true;
        const rect = this.dockElement.getBoundingClientRect();
        this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    /**
     * Handle drag movement (floating docks only)
     */
    doDrag(e) {
        if (!this.isFloating || !this.isDragging) return;
        
        this.currentPos.x = e.clientX - this.dragOffset.x;
        this.currentPos.y = e.clientY - this.dragOffset.y;
        this.dockElement.style.left = `${this.currentPos.x}px`;
        this.dockElement.style.top = `${this.currentPos.y}px`;
    }

    /**
     * End dragging (floating docks only)
     */
    endDrag() {
        if (!this.isFloating || !this.isDragging) return;
        
        this.isDragging = false;
        this.savePersistedState();
    }

    /**
     * Start resizing (floating docks only)
     */
    startResize(e) {
        if (!this.isFloating) return;
        
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;
        this.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: this.dockElement.offsetWidth,
            height: this.dockElement.offsetHeight
        };
    }

    /**
     * Handle resize movement (floating docks only)
     */
    doResize(e) {
        if (!this.isFloating || !this.isResizing) return;
        
        this.currentSize.width = Math.max(300, this.resizeStart.width + (e.clientX - this.resizeStart.x));
        this.currentSize.height = Math.max(200, this.resizeStart.height + (e.clientY - this.resizeStart.y));
        this.dockElement.style.width = `${this.currentSize.width}px`;
        this.dockElement.style.height = `${this.currentSize.height}px`;
    }

    /**
     * End resizing (floating docks only)
     */
    endResize() {
        if (!this.isFloating || !this.isResizing) return;
        
        this.isResizing = false;
        this.savePersistedState();
    }

    /**
     * Bring floating dock to front
     */
    bringToFront() {
        if (!this.isFloating) return;
        
        // Simple z-index increment - could be improved with a z-index manager
        const currentZ = parseInt(this.dockElement.style.zIndex) || 1000;
        this.dockElement.style.zIndex = currentZ + 1;
    }
}