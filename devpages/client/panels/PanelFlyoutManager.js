/**
 * @file PanelFlyoutManager.js
 * @description Enhanced panel fly-out system that handles individual panel detachment,
 * floating windows, and seamless transitions between docked and floating states.
 */

import { appStore, dispatch } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';
import { zIndexManager } from '/client/utils/ZIndexManager.js';
import { logMessage } from '/client/log/index.js';

export class PanelFlyoutManager {
    constructor() {
        this.flyoutPanels = new Map(); // panelId -> flyout window data
        this.dragState = null;
        this.resizeState = null;
        
        // Create flyout container
        this.createFlyoutContainer();
        
        // Bind event handlers
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        
        console.log('[PanelFlyoutManager] Initialized');
    }
    
    /**
     * Create the main flyout container for floating panels
     */
    createFlyoutContainer() {
        this.flyoutContainer = document.createElement('div');
        this.flyoutContainer.id = 'panel-flyout-container';
        this.flyoutContainer.className = 'panel-flyout-container';
        this.flyoutContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.flyoutContainer);
    }
    
    /**
     * Fly out a panel from its dock to a floating window
     * @param {string} panelId - The panel ID to fly out
     * @param {object} options - Flyout options
     */
    async flyOutPanel(panelId, options = {}) {
        const state = appStore.getState();
        const panel = state.panels?.panels?.[panelId];
        
        if (!panel) {
            console.error(`[PanelFlyoutManager] Panel ${panelId} not found`);
            return false;
        }
        
        if (this.flyoutPanels.has(panelId)) {
            console.warn(`[PanelFlyoutManager] Panel ${panelId} already flying out`);
            return false;
        }
        
        const flyoutOptions = {
            position: options.position || { x: 200, y: 150 },
            size: options.size || { width: 400, height: 300 },
            title: options.title || panel.title || panelId,
            resizable: options.resizable !== false,
            draggable: options.draggable !== false,
            ...options
        };
        
        // Create floating window
        const flyoutWindow = this.createFlyoutWindow(panelId, flyoutOptions);
        
        // Store flyout data
        this.flyoutPanels.set(panelId, {
            window: flyoutWindow,
            options: flyoutOptions,
            originalDock: panel.dockId,
            isFloating: true
        });
        
        // Update Redux state
        dispatch(panelActions.updatePanel({
            id: panelId,
            updates: {
                isFlyout: true,
                flyoutPosition: flyoutOptions.position,
                flyoutSize: flyoutOptions.size,
                isVisible: true
            }
        }));
        
        // Mount panel content in flyout window
        await this.mountPanelInFlyout(panelId, flyoutWindow);
        
        logMessage(`Panel ${panelId} flew out successfully`, 'info');
        return true;
    }
    
    /**
     * Dock a flying panel back to its home dock
     * @param {string} panelId - The panel ID to dock
     */
    async dockPanel(panelId) {
        const flyoutData = this.flyoutPanels.get(panelId);
        if (!flyoutData) {
            console.warn(`[PanelFlyoutManager] Panel ${panelId} is not flying out`);
            return false;
        }
        
        // Remove flyout window
        if (flyoutData.window && flyoutData.window.parentNode) {
            flyoutData.window.parentNode.removeChild(flyoutData.window);
        }
        
        // Update Redux state
        dispatch(panelActions.updatePanel({
            id: panelId,
            updates: {
                isFlyout: false,
                flyoutPosition: null,
                flyoutSize: null
            }
        }));
        
        // Remove from flyout tracking
        this.flyoutPanels.delete(panelId);
        
        // Trigger panel remount in dock
        dispatch(panelActions.mountPanel({
            panelId,
            dockId: flyoutData.originalDock,
            containerId: `dock-${flyoutData.originalDock}-content`
        }));
        
        logMessage(`Panel ${panelId} docked successfully`, 'info');
        return true;
    }
    
    /**
     * Toggle panel between docked and flyout states
     * @param {string} panelId - The panel ID to toggle
     */
    async togglePanelFlyout(panelId) {
        if (this.flyoutPanels.has(panelId)) {
            return await this.dockPanel(panelId);
        } else {
            return await this.flyOutPanel(panelId);
        }
    }
    
    /**
     * Create a floating window for a panel
     * @param {string} panelId - The panel ID
     * @param {object} options - Window options
     * @returns {HTMLElement} The flyout window element
     */
    createFlyoutWindow(panelId, options) {
        const window = document.createElement('div');
        window.className = 'panel-flyout-window';
        window.id = `flyout-${panelId}`;
        window.style.cssText = `
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
        `;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'panel-flyout-header';
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: var(--color-bg-secondary, #f8f9fa);
            border-bottom: 1px solid var(--color-border, #ddd);
            border-radius: 7px 7px 0 0;
            cursor: ${options.draggable ? 'move' : 'default'};
            user-select: none;
        `;
        
        const title = document.createElement('span');
        title.className = 'panel-flyout-title';
        title.textContent = options.title;
        title.style.cssText = `
            font-weight: 500;
            font-size: 14px;
            color: var(--color-text, #333);
        `;
        
        const controls = document.createElement('div');
        controls.className = 'panel-flyout-controls';
        controls.style.cssText = `
            display: flex;
            gap: 4px;
        `;
        
        // Dock button
        const dockBtn = document.createElement('button');
        dockBtn.className = 'panel-flyout-dock-btn';
        dockBtn.innerHTML = '⚓';
        dockBtn.title = 'Dock panel';
        dockBtn.style.cssText = `
            background: none;
            border: none;
            padding: 4px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            color: var(--color-text-secondary, #666);
        `;
        dockBtn.addEventListener('click', () => this.dockPanel(panelId));
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'panel-flyout-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Close panel';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            padding: 4px 6px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            color: var(--color-text-secondary, #666);
        `;
        closeBtn.addEventListener('click', () => this.closeFlyoutPanel(panelId));
        
        controls.appendChild(dockBtn);
        controls.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(controls);
        
        // Create content area
        const content = document.createElement('div');
        content.className = 'panel-flyout-content';
        content.id = `flyout-${panelId}-content`;
        content.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 0;
        `;
        
        // Create resize handle if resizable
        if (options.resizable) {
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'panel-flyout-resize-handle';
            resizeHandle.innerHTML = '⋰';
            resizeHandle.style.cssText = `
                position: absolute;
                bottom: 0;
                right: 0;
                width: 16px;
                height: 16px;
                cursor: nw-resize;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                color: var(--color-text-secondary, #999);
                background: var(--color-bg, white);
                border-radius: 0 0 7px 0;
            `;
            
            resizeHandle.addEventListener('mousedown', (e) => {
                this.startResize(panelId, e);
            });
            
            window.appendChild(resizeHandle);
        }
        
        // Set up dragging if enabled
        if (options.draggable) {
            header.addEventListener('mousedown', (e) => {
                this.startDrag(panelId, e);
            });
        }
        
        window.appendChild(header);
        window.appendChild(content);
        this.flyoutContainer.appendChild(window);
        
        return window;
    }
    
    /**
     * Mount panel content in flyout window
     * @param {string} panelId - The panel ID
     * @param {HTMLElement} flyoutWindow - The flyout window element
     */
    async mountPanelInFlyout(panelId, flyoutWindow) {
        const contentArea = flyoutWindow.querySelector(`#flyout-${panelId}-content`);
        if (!contentArea) {
            console.error(`[PanelFlyoutManager] Content area not found for ${panelId}`);
            return;
        }
        
        // Dispatch mount action for the panel
        dispatch(panelActions.mountPanel({
            panelId,
            containerId: contentArea.id,
            isFlyout: true
        }));
    }
    
    /**
     * Close a flyout panel (hide it)
     * @param {string} panelId - The panel ID to close
     */
    closeFlyoutPanel(panelId) {
        const flyoutData = this.flyoutPanels.get(panelId);
        if (!flyoutData) return;
        
        // Hide the window
        if (flyoutData.window) {
            flyoutData.window.style.display = 'none';
        }
        
        // Update Redux state
        dispatch(panelActions.updatePanel({
            id: panelId,
            updates: { isVisible: false }
        }));
        
        logMessage(`Panel ${panelId} flyout closed`, 'info');
    }
    
    /**
     * Start dragging a flyout panel
     * @param {string} panelId - The panel ID
     * @param {MouseEvent} e - The mouse event
     */
    startDrag(panelId, e) {
        const flyoutData = this.flyoutPanels.get(panelId);
        if (!flyoutData) return;
        
        e.preventDefault();
        
        const rect = flyoutData.window.getBoundingClientRect();
        this.dragState = {
            panelId,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left,
            startTop: rect.top,
            isDragging: true
        };
        
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        
        // Bring to front
        flyoutData.window.style.zIndex = zIndexManager.getNextZIndex();
    }
    
    /**
     * Start resizing a flyout panel
     * @param {string} panelId - The panel ID
     * @param {MouseEvent} e - The mouse event
     */
    startResize(panelId, e) {
        const flyoutData = this.flyoutPanels.get(panelId);
        if (!flyoutData) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const rect = flyoutData.window.getBoundingClientRect();
        this.resizeState = {
            panelId,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            isResizing: true
        };
        
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }
    
    /**
     * Handle mouse movement for drag/resize
     * @param {MouseEvent} e - The mouse event
     */
    handleMouseMove(e) {
        if (this.dragState?.isDragging) {
            const { panelId, startX, startY, startLeft, startTop } = this.dragState;
            const flyoutData = this.flyoutPanels.get(panelId);
            
            if (flyoutData) {
                const newLeft = startLeft + (e.clientX - startX);
                const newTop = startTop + (e.clientY - startY);
                
                flyoutData.window.style.left = `${newLeft}px`;
                flyoutData.window.style.top = `${newTop}px`;
                
                // Update stored position
                flyoutData.options.position = { x: newLeft, y: newTop };
            }
        }
        
        if (this.resizeState?.isResizing) {
            const { panelId, startX, startY, startWidth, startHeight } = this.resizeState;
            const flyoutData = this.flyoutPanels.get(panelId);
            
            if (flyoutData) {
                const newWidth = Math.max(200, startWidth + (e.clientX - startX));
                const newHeight = Math.max(150, startHeight + (e.clientY - startY));
                
                flyoutData.window.style.width = `${newWidth}px`;
                flyoutData.window.style.height = `${newHeight}px`;
                
                // Update stored size
                flyoutData.options.size = { width: newWidth, height: newHeight };
            }
        }
    }
    
    /**
     * Handle mouse up to end drag/resize
     * @param {MouseEvent} e - The mouse event
     */
    handleMouseUp(e) {
        if (this.dragState?.isDragging) {
            const { panelId } = this.dragState;
            const flyoutData = this.flyoutPanels.get(panelId);
            
            if (flyoutData) {
                // Update Redux state with new position
                dispatch(panelActions.updatePanel({
                    id: panelId,
                    updates: {
                        flyoutPosition: flyoutData.options.position
                    }
                }));
            }
            
            this.dragState = null;
        }
        
        if (this.resizeState?.isResizing) {
            const { panelId } = this.resizeState;
            const flyoutData = this.flyoutPanels.get(panelId);
            
            if (flyoutData) {
                // Update Redux state with new size
                dispatch(panelActions.updatePanel({
                    id: panelId,
                    updates: {
                        flyoutSize: flyoutData.options.size
                    }
                }));
            }
            
            this.resizeState = null;
        }
        
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }
    
    /**
     * Get all currently flying out panels
     * @returns {Array} Array of panel IDs that are flying out
     */
    getFlyoutPanels() {
        return Array.from(this.flyoutPanels.keys());
    }
    
    /**
     * Check if a panel is currently flying out
     * @param {string} panelId - The panel ID to check
     * @returns {boolean} True if panel is flying out
     */
    isPanelFlyingOut(panelId) {
        return this.flyoutPanels.has(panelId);
    }
    
    /**
     * Restore flyout panels from Redux state (on page load)
     */
    restoreFlyoutPanels() {
        const state = appStore.getState();
        const panels = state.panels?.panels || {};
        
        Object.entries(panels).forEach(([panelId, panel]) => {
            if (panel.isFlyout && panel.flyoutPosition && panel.flyoutSize) {
                this.flyOutPanel(panelId, {
                    position: panel.flyoutPosition,
                    size: panel.flyoutSize,
                    title: panel.title
                });
            }
        });
    }
}

// Create global instance
export const panelFlyoutManager = new PanelFlyoutManager();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.panelFlyoutManager = panelFlyoutManager;
}
