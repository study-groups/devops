/**
 * @file DockFlyoutManager.js
 * @description Manages dock fly-out functionality - docks can float or be parked in sidebar
 */

import { appStore, dispatch } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';
import { zIndexManager } from '/client/utils/ZIndexManager.js';
import { logMessage } from '/client/log/index.js';

export class DockFlyoutManager {
    constructor() {
        this.floatingDocks = new Map(); // dockId -> floating dock data
        this.sidebarContainer = null;
        this.floatingContainer = null;
        
        this.createContainers();
        
        // Bind event handlers
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        
        console.log('[DockFlyoutManager] Initialized');
    }
    
    /**
     * Create containers for sidebar and floating docks
     */
    createContainers() {
        // Find or create sidebar container
        this.sidebarContainer = document.querySelector('.sidebar-container') || 
                               document.querySelector('#workspace-zone-left');
        
        // Create floating docks container
        this.floatingContainer = document.createElement('div');
        this.floatingContainer.id = 'floating-docks-container';
        this.floatingContainer.className = 'floating-docks-container';
        this.floatingContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 900;
        `;
        document.body.appendChild(this.floatingContainer);
    }
    
    /**
     * Float a dock (move from sidebar to floating)
     * @param {string} dockId - The dock ID to float
     * @param {object} options - Float options
     */
    async floatDock(dockId, options = {}) {
        const state = appStore.getState();
        const dock = state.panels?.docks?.[dockId];
        
        if (!dock) {
            console.error(`[DockFlyoutManager] Dock ${dockId} not found`);
            return false;
        }
        
        if (this.floatingDocks.has(dockId)) {
            console.warn(`[DockFlyoutManager] Dock ${dockId} already floating`);
            return false;
        }
        
        const floatOptions = {
            position: options.position || { x: 250, y: 150 },
            size: options.size || { width: 350, height: 500 },
            title: options.title || dock.title || dockId,
            ...options
        };
        
        // Create floating dock window
        const floatingDock = this.createFloatingDock(dockId, floatOptions);
        
        // Store floating dock data
        this.floatingDocks.set(dockId, {
            element: floatingDock,
            options: floatOptions,
            originalZone: dock.zone || 'sidebar',
            isFloating: true,
            dragState: null
        });
        
        // Update Redux state
        dispatch(panelActions.updateDock(dockId, {
            isFloating: true,
            floatingPosition: floatOptions.position,
            floatingSize: floatOptions.size,
            zone: 'floating'
        }));
        
        // Move dock content to floating window
        await this.moveDockToFloating(dockId, floatingDock);
        
        logMessage(`Dock ${dockId} floated successfully`, 'info');
        return true;
    }
    
    /**
     * Park a floating dock back in sidebar
     * @param {string} dockId - The dock ID to park
     */
    async parkDock(dockId) {
        const floatingData = this.floatingDocks.get(dockId);
        if (!floatingData) {
            console.warn(`[DockFlyoutManager] Dock ${dockId} is not floating`);
            return false;
        }
        
        // Remove floating dock element
        if (floatingData.element && floatingData.element.parentNode) {
            floatingData.element.parentNode.removeChild(floatingData.element);
        }
        
        // Update Redux state
        dispatch(panelActions.updateDock(dockId, {
            isFloating: false,
            floatingPosition: null,
            floatingSize: null,
            zone: floatingData.originalZone
        }));
        
        // Remove from floating tracking
        this.floatingDocks.delete(dockId);
        
        // Move dock content back to sidebar
        await this.moveDockToSidebar(dockId);
        
        logMessage(`Dock ${dockId} parked successfully`, 'info');
        return true;
    }
    
    /**
     * Toggle dock between floating and parked states
     * @param {string} dockId - The dock ID to toggle
     */
    async toggleDockFloat(dockId) {
        if (this.floatingDocks.has(dockId)) {
            return await this.parkDock(dockId);
        } else {
            return await this.floatDock(dockId);
        }
    }
    
    /**
     * Create a floating dock window
     * @param {string} dockId - The dock ID
     * @param {object} options - Window options
     * @returns {HTMLElement} The floating dock element
     */
    createFloatingDock(dockId, options) {
        const dockWindow = document.createElement('div');
        dockWindow.className = 'floating-dock-window';
        dockWindow.id = `floating-${dockId}`;
        dockWindow.style.cssText = `
            position: absolute;
            left: ${options.position.x}px;
            top: ${options.position.y}px;
            width: ${options.size.width}px;
            height: ${options.size.height}px;
            background: var(--color-bg, white);
            border: 1px solid var(--color-border, #ddd);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            pointer-events: auto;
            z-index: ${zIndexManager.getNextZIndex()};
            min-width: 250px;
            min-height: 200px;
        `;
        
        // Create dock header
        const header = this.createDockHeader(dockId, options);
        
        // Create dock content area
        const content = document.createElement('div');
        content.className = 'floating-dock-content';
        content.id = `floating-${dockId}-content`;
        content.style.cssText = `
            flex: 1;
            overflow: auto;
            display: flex;
            flex-direction: column;
        `;
        
        // Create resize handles
        const resizeHandles = this.createResizeHandles(dockId);
        
        dockWindow.appendChild(header);
        dockWindow.appendChild(content);
        resizeHandles.forEach(handle => dockWindow.appendChild(handle));
        
        this.floatingContainer.appendChild(dockWindow);
        
        return dockWindow;
    }
    
    /**
     * Create dock header with controls
     * @param {string} dockId - The dock ID
     * @param {object} options - Header options
     * @returns {HTMLElement} The header element
     */
    createDockHeader(dockId, options) {
        const header = document.createElement('div');
        header.className = 'floating-dock-header';
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: var(--color-bg-secondary, #f8f9fa);
            border-bottom: 1px solid var(--color-border, #ddd);
            border-radius: 7px 7px 0 0;
            cursor: move;
            user-select: none;
            min-height: 36px;
        `;
        
        const title = document.createElement('span');
        title.className = 'floating-dock-title';
        title.textContent = options.title;
        title.style.cssText = `
            font-weight: 500;
            font-size: 14px;
            color: var(--color-text, #333);
            flex: 1;
        `;
        
        const controls = document.createElement('div');
        controls.className = 'floating-dock-controls';
        controls.style.cssText = `
            display: flex;
            gap: 4px;
            align-items: center;
        `;
        
        // Collapse/Expand button
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'floating-dock-collapse-btn';
        collapseBtn.innerHTML = '−';
        collapseBtn.title = 'Collapse dock';
        collapseBtn.style.cssText = this.getControlButtonStyles();
        collapseBtn.addEventListener('click', () => this.toggleDockCollapse(dockId));
        
        // Park button (return to sidebar)
        const parkBtn = document.createElement('button');
        parkBtn.className = 'floating-dock-park-btn';
        parkBtn.innerHTML = '⚓';
        parkBtn.title = 'Park in sidebar';
        parkBtn.style.cssText = this.getControlButtonStyles();
        parkBtn.addEventListener('click', () => this.parkDock(dockId));
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'floating-dock-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Hide dock';
        closeBtn.style.cssText = this.getControlButtonStyles();
        closeBtn.addEventListener('click', () => this.hideDock(dockId));
        
        controls.appendChild(collapseBtn);
        controls.appendChild(parkBtn);
        controls.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(controls);
        
        // Set up dragging
        header.addEventListener('mousedown', (e) => {
            this.startDockDrag(dockId, e);
        });
        
        return header;
    }
    
    /**
     * Get common styles for control buttons
     * @returns {string} CSS styles
     */
    getControlButtonStyles() {
        return `
            background: none;
            border: none;
            padding: 4px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            color: var(--color-text-secondary, #666);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            height: 24px;
        `;
    }
    
    /**
     * Create resize handles for floating dock
     * @param {string} dockId - The dock ID
     * @returns {Array<HTMLElement>} Array of resize handle elements
     */
    createResizeHandles(dockId) {
        const handles = [];
        const positions = [
            { class: 'se', cursor: 'nw-resize', position: 'bottom: 0; right: 0;' },
            { class: 'sw', cursor: 'ne-resize', position: 'bottom: 0; left: 0;' },
            { class: 'ne', cursor: 'sw-resize', position: 'top: 0; right: 0;' },
            { class: 'nw', cursor: 'se-resize', position: 'top: 0; left: 0;' },
            { class: 'n', cursor: 'n-resize', position: 'top: 0; left: 50%; transform: translateX(-50%);' },
            { class: 's', cursor: 's-resize', position: 'bottom: 0; left: 50%; transform: translateX(-50%);' },
            { class: 'e', cursor: 'e-resize', position: 'right: 0; top: 50%; transform: translateY(-50%);' },
            { class: 'w', cursor: 'w-resize', position: 'left: 0; top: 50%; transform: translateY(-50%);' }
        ];
        
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `floating-dock-resize-handle resize-${pos.class}`;
            handle.style.cssText = `
                position: absolute;
                ${pos.position}
                width: ${pos.class.length === 1 ? '4px' : '8px'};
                height: ${pos.class.length === 1 ? '4px' : '8px'};
                cursor: ${pos.cursor};
                background: transparent;
                z-index: 10;
            `;
            
            handle.addEventListener('mousedown', (e) => {
                this.startDockResize(dockId, e, pos.class);
            });
            
            handles.push(handle);
        });
        
        return handles;
    }
    
    /**
     * Move dock content to floating window
     * @param {string} dockId - The dock ID
     * @param {HTMLElement} floatingDock - The floating dock element
     */
    async moveDockToFloating(dockId, floatingDock) {
        const contentArea = floatingDock.querySelector(`#floating-${dockId}-content`);
        if (!contentArea) return;
        
        // Find existing dock content in sidebar
        const sidebarDock = document.querySelector(`#${dockId}, .dock-${dockId}`);
        if (sidebarDock) {
            // Move existing content
            const existingContent = sidebarDock.querySelector('.dock-content, .dock-body');
            if (existingContent) {
                contentArea.appendChild(existingContent.cloneNode(true));
            }
            
            // Hide sidebar dock
            sidebarDock.style.display = 'none';
        }
        
        // Trigger dock content refresh
        this.refreshDockContent(dockId, contentArea);
    }
    
    /**
     * Move dock content back to sidebar
     * @param {string} dockId - The dock ID
     */
    async moveDockToSidebar(dockId) {
        // Find sidebar dock and show it
        const sidebarDock = document.querySelector(`#${dockId}, .dock-${dockId}`);
        if (sidebarDock) {
            sidebarDock.style.display = '';
        }
        
        // Trigger dock content refresh in sidebar
        const sidebarContent = sidebarDock?.querySelector('.dock-content, .dock-body');
        if (sidebarContent) {
            this.refreshDockContent(dockId, sidebarContent);
        }
    }
    
    /**
     * Refresh dock content (re-mount panels)
     * @param {string} dockId - The dock ID
     * @param {HTMLElement} contentArea - The content area element
     */
    refreshDockContent(dockId, contentArea) {
        const state = appStore.getState();
        const dock = state.panels?.docks?.[dockId];
        
        if (dock && dock.panels) {
            dock.panels.forEach(panelId => {
                // Trigger panel remount
                dispatch(panelActions.mountPanel(panelId, contentArea.id, dockId));
            });
        }
    }
    
    /**
     * Start dragging a floating dock
     * @param {string} dockId - The dock ID
     * @param {MouseEvent} e - The mouse event
     */
    startDockDrag(dockId, e) {
        const floatingData = this.floatingDocks.get(dockId);
        if (!floatingData) return;
        
        e.preventDefault();
        
        const rect = floatingData.element.getBoundingClientRect();
        floatingData.dragState = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left,
            startTop: rect.top
        };
        
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        
        // Bring to front
        floatingData.element.style.zIndex = zIndexManager.getNextZIndex();
    }
    
    /**
     * Start resizing a floating dock
     * @param {string} dockId - The dock ID
     * @param {MouseEvent} e - The mouse event
     * @param {string} direction - Resize direction
     */
    startDockResize(dockId, e, direction) {
        const floatingData = this.floatingDocks.get(dockId);
        if (!floatingData) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const rect = floatingData.element.getBoundingClientRect();
        floatingData.resizeState = {
            isResizing: true,
            direction,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            startLeft: rect.left,
            startTop: rect.top
        };
        
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }
    
    /**
     * Handle mouse movement for drag/resize
     * @param {MouseEvent} e - The mouse event
     */
    handleMouseMove(e) {
        // Handle dragging
        this.floatingDocks.forEach((data, dockId) => {
            if (data.dragState?.isDragging) {
                const { startX, startY, startLeft, startTop } = data.dragState;
                const newLeft = startLeft + (e.clientX - startX);
                const newTop = startTop + (e.clientY - startY);
                
                data.element.style.left = `${newLeft}px`;
                data.element.style.top = `${newTop}px`;
                
                data.options.position = { x: newLeft, y: newTop };
            }
            
            if (data.resizeState?.isResizing) {
                this.handleDockResize(dockId, data, e);
            }
        });
    }
    
    /**
     * Handle dock resizing
     * @param {string} dockId - The dock ID
     * @param {object} data - Floating dock data
     * @param {MouseEvent} e - The mouse event
     */
    handleDockResize(dockId, data, e) {
        const { direction, startX, startY, startWidth, startHeight, startLeft, startTop } = data.resizeState;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;
        
        // Calculate new dimensions based on resize direction
        if (direction.includes('e')) newWidth = Math.max(250, startWidth + deltaX);
        if (direction.includes('w')) {
            newWidth = Math.max(250, startWidth - deltaX);
            newLeft = startLeft + deltaX;
        }
        if (direction.includes('s')) newHeight = Math.max(200, startHeight + deltaY);
        if (direction.includes('n')) {
            newHeight = Math.max(200, startHeight - deltaY);
            newTop = startTop + deltaY;
        }
        
        // Apply new dimensions
        data.element.style.width = `${newWidth}px`;
        data.element.style.height = `${newHeight}px`;
        data.element.style.left = `${newLeft}px`;
        data.element.style.top = `${newTop}px`;
        
        // Update stored options
        data.options.size = { width: newWidth, height: newHeight };
        data.options.position = { x: newLeft, y: newTop };
    }
    
    /**
     * Handle mouse up to end drag/resize
     * @param {MouseEvent} e - The mouse event
     */
    handleMouseUp(e) {
        this.floatingDocks.forEach((data, dockId) => {
            if (data.dragState?.isDragging) {
                // Update Redux state with new position
                dispatch(panelActions.updateDock(dockId, {
                    floatingPosition: data.options.position
                }));
                
                data.dragState = null;
            }
            
            if (data.resizeState?.isResizing) {
                // Update Redux state with new size and position
                dispatch(panelActions.updateDock(dockId, {
                    floatingSize: data.options.size,
                    floatingPosition: data.options.position
                }));
                
                data.resizeState = null;
            }
        });
        
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }
    
    /**
     * Toggle dock collapse state
     * @param {string} dockId - The dock ID
     */
    toggleDockCollapse(dockId) {
        dispatch(panelActions.toggleDockVisibility(dockId));
        
        const floatingData = this.floatingDocks.get(dockId);
        if (floatingData) {
            const content = floatingData.element.querySelector('.floating-dock-content');
            const collapseBtn = floatingData.element.querySelector('.floating-dock-collapse-btn');
            
            if (content && collapseBtn) {
                const isCollapsed = content.style.display === 'none';
                content.style.display = isCollapsed ? '' : 'none';
                collapseBtn.innerHTML = isCollapsed ? '−' : '+';
                collapseBtn.title = isCollapsed ? 'Collapse dock' : 'Expand dock';
            }
        }
    }
    
    /**
     * Hide a floating dock
     * @param {string} dockId - The dock ID
     */
    hideDock(dockId) {
        const floatingData = this.floatingDocks.get(dockId);
        if (floatingData) {
            floatingData.element.style.display = 'none';
            dispatch(panelActions.updateDock(dockId, { isVisible: false }));
        }
    }
    
    /**
     * Show a hidden floating dock
     * @param {string} dockId - The dock ID
     */
    showDock(dockId) {
        const floatingData = this.floatingDocks.get(dockId);
        if (floatingData) {
            floatingData.element.style.display = '';
            floatingData.element.style.zIndex = zIndexManager.getNextZIndex();
            dispatch(panelActions.updateDock(dockId, { isVisible: true }));
        }
    }
    
    /**
     * Get all currently floating docks
     * @returns {Array} Array of dock IDs that are floating
     */
    getFloatingDocks() {
        return Array.from(this.floatingDocks.keys());
    }
    
    /**
     * Check if a dock is currently floating
     * @param {string} dockId - The dock ID to check
     * @returns {boolean} True if dock is floating
     */
    isDockFloating(dockId) {
        return this.floatingDocks.has(dockId);
    }
    
    /**
     * Restore floating docks from Redux state (on page load)
     */
    restoreFloatingDocks() {
        const state = appStore.getState();
        const docks = state.panels?.docks || {};
        
        Object.entries(docks).forEach(([dockId, dock]) => {
            if (dock.isFloating && dock.floatingPosition && dock.floatingSize) {
                this.floatDock(dockId, {
                    position: dock.floatingPosition,
                    size: dock.floatingSize,
                    title: dock.title
                });
            }
        });
    }
}

// Create global instance
export const dockFlyoutManager = new DockFlyoutManager();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.dockFlyoutManager = dockFlyoutManager;
}
