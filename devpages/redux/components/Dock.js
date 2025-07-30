/**
 * Dock.js - Redux-native Dock Container
 * 
 * A draggable, resizable container that manages multiple panels
 * Features:
 * - Drag and drop positioning
 * - Panel management (tabs, active panel switching)
 * - Resize handles
 * - Maximize/minimize
 * - Redux state synchronization
 */

import * as panelActions from '../slices/panelSlice.js';

export class Dock {
    constructor(dockId, dispatch, getState) {
        this.dockId = dockId;
        this.dispatch = dispatch;
        this.getState = getState;
        
        this.element = null;
        this.headerElement = null;
        this.contentElement = null;
        this.resizeHandles = new Map();
        
        // Drag state
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        // Resize state
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartPos = { x: 0, y: 0 };
        this.resizeStartSize = { width: 0, height: 0 };
        
        this.log = (message, level = 'info') => console.log(`[Dock:${dockId}] ${message}`);
        
        this.init();
    }
    
    init() {
        this.log('Initializing Dock');
        this.createDockStructure();
        this.setupEventListeners();
        this.syncWithState();
    }
    
    createDockStructure() {
        this.element = document.createElement('div');
        this.element.className = 'redux-dock';
        this.element.id = this.dockId;
        
        this.element.innerHTML = `
            <div class="dock-header">
                <div class="dock-tabs"></div>
                <div class="dock-controls">
                    <button class="dock-btn minimize" title="Minimize">−</button>
                    <button class="dock-btn maximize" title="Maximize">□</button>
                    <button class="dock-btn close" title="Close">×</button>
                </div>
            </div>
            <div class="dock-content">
                <div class="dock-panels"></div>
            </div>
            <div class="dock-resize-handles">
                <div class="resize-handle n" data-direction="n"></div>
                <div class="resize-handle s" data-direction="s"></div>
                <div class="resize-handle e" data-direction="e"></div>
                <div class="resize-handle w" data-direction="w"></div>
                <div class="resize-handle ne" data-direction="ne"></div>
                <div class="resize-handle nw" data-direction="nw"></div>
                <div class="resize-handle se" data-direction="se"></div>
                <div class="resize-handle sw" data-direction="sw"></div>
            </div>
        `;
        
        this.headerElement = this.element.querySelector('.dock-header');
        this.contentElement = this.element.querySelector('.dock-content');
        
        // Store resize handle references
        this.element.querySelectorAll('.resize-handle').forEach(handle => {
            this.resizeHandles.set(handle.dataset.direction, handle);
        });
        
        this.applyStyles();
    }
    
    setupEventListeners() {
        // Header drag handling
        this.headerElement.addEventListener('mousedown', this.handleDragStart.bind(this));
        
        // Control buttons
        this.element.querySelector('.minimize').addEventListener('click', () => {
            this.dispatch(panelActions.toggleDockCollapse({ dockId: this.dockId }));
        });
        
        this.element.querySelector('.maximize').addEventListener('click', () => {
            this.dispatch(panelActions.maximizeDock({ dockId: this.dockId }));
        });
        
        this.element.querySelector('.close').addEventListener('click', () => {
            this.dispatch(panelActions.toggleDockVisibility({ dockId: this.dockId }));
        });
        
        // Resize handles
        this.resizeHandles.forEach((handle, direction) => {
            handle.addEventListener('mousedown', (e) => {
                this.handleResizeStart(e, direction);
            });
        });
        
        // Bring to front on click
        this.element.addEventListener('mousedown', () => {
            this.dispatch(panelActions.bringDockToFront({ dockId: this.dockId }));
        });
        
        // Global mouse events
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }
    
    handleDragStart(e) {
        if (e.target.closest('.dock-controls') || e.target.closest('.dock-tabs')) {
            return; // Don't drag when clicking controls or tabs
        }
        
        this.isDragging = true;
        const rect = this.element.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        this.element.classList.add('dragging');
        this.dispatch(panelActions.startDrag({
            itemType: 'dock',
            itemId: this.dockId,
            offset: this.dragOffset
        }));
        
        e.preventDefault();
    }
    
    handleResizeStart(e, direction) {
        this.isResizing = true;
        this.resizeHandle = direction;
        this.resizeStartPos = { x: e.clientX, y: e.clientY };
        
        const rect = this.element.getBoundingClientRect();
        this.resizeStartSize = {
            width: rect.width,
            height: rect.height
        };
        
        this.element.classList.add('resizing');
        this.dispatch(panelActions.startResize({
            itemType: 'dock',
            itemId: this.dockId,
            handle: direction,
            startPosition: this.resizeStartPos,
            startSize: this.resizeStartSize
        }));
        
        e.stopPropagation();
        e.preventDefault();
    }
    
    handleMouseMove(e) {
        if (this.isDragging) {
            this.dispatch(panelActions.updateDragPosition({
                position: { x: e.clientX, y: e.clientY }
            }));
        } else if (this.isResizing) {
            this.dispatch(panelActions.updateResize({
                currentPosition: { x: e.clientX, y: e.clientY }
            }));
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.element.classList.remove('dragging');
            this.dispatch(panelActions.endDrag());
        }
        
        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle = null;
            this.element.classList.remove('resizing');
            this.dispatch(panelActions.endResize());
        }
    }
    
    syncWithState() {
        const state = this.getState();
        const dockState = state.panels.docks[this.dockId];
        
        if (!dockState) return;
        
        // Update position
        this.element.style.left = `${dockState.position.x}px`;
        this.element.style.top = `${dockState.position.y}px`;
        
        // Update size
        this.element.style.width = `${dockState.size.width}px`;
        this.element.style.height = `${dockState.size.height}px`;
        
        // Update z-index
        this.element.style.zIndex = dockState.zIndex;
        
        // Update visibility
        this.element.style.display = dockState.isVisible ? 'block' : 'none';
        
        // Update collapsed state
        this.element.classList.toggle('collapsed', dockState.isCollapsed);
        
        // Update maximized state
        this.element.classList.toggle('maximized', dockState.isMaximized);
        
        // Update tabs
        this.updateTabs(dockState);
        
        // Update active panel
        this.updateActivePanel(dockState);
    }
    
    updateTabs(dockState) {
        const tabsContainer = this.element.querySelector('.dock-tabs');
        const state = this.getState();
        
        if (!dockState.panels || dockState.panels.length === 0) {
            tabsContainer.innerHTML = '';
            return;
        }
        
        tabsContainer.innerHTML = dockState.panels.map(panelId => {
            const panel = state.panels.panels[panelId];
            if (!panel) return '';
            
            return `
                <div class="dock-tab ${panel.isActive ? 'active' : ''}" data-panel-id="${panelId}">
                    <span class="tab-title">${panel.title}</span>
                    <button class="tab-close" title="Close Panel">×</button>
                </div>
            `;
        }).join('');
        
        // Add tab event listeners
        tabsContainer.querySelectorAll('.dock-tab').forEach(tab => {
            const panelId = tab.dataset.panelId;
            
            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('tab-close')) {
                    this.dispatch(panelActions.activatePanel({ panelId }));
                }
            });
            
            const closeBtn = tab.querySelector('.tab-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.dispatch(panelActions.togglePanelVisibility({ panelId }));
                });
            }
        });
    }
    
    updateActivePanel(dockState) {
        const panelsContainer = this.element.querySelector('.dock-panels');
        const state = this.getState();
        
        // Clear existing panels
        panelsContainer.innerHTML = '';
        
        if (!dockState.activePanel) return;
        
        const activePanel = state.panels.panels[dockState.activePanel];
        if (!activePanel) return;
        
        // Create placeholder for the active panel
        const panelContainer = document.createElement('div');
        panelContainer.className = 'dock-panel-container';
        panelContainer.id = `container-${dockState.activePanel}`;
        panelsContainer.appendChild(panelContainer);
        
        // Emit event for panel managers to mount the actual panel
        const mountEvent = new CustomEvent('dock:mountPanel', {
            detail: {
                dockId: this.dockId,
                panelId: dockState.activePanel,
                container: panelContainer
            }
        });
        
        document.dispatchEvent(mountEvent);
    }
    
    addPanel(panelComponent) {
        const container = this.element.querySelector(`#container-${panelComponent.panelId}`);
        if (container && panelComponent.element) {
            container.appendChild(panelComponent.element);
        }
    }
    
    removePanel(panelId) {
        const container = this.element.querySelector(`#container-${panelId}`);
        if (container) {
            container.remove();
        }
    }
    
    applyStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .redux-dock {
                position: fixed;
                background: var(--color-bg, white);
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: var(--radius-md, 8px);
                box-shadow: var(--shadow-xl, 0 10px 25px rgba(0, 0, 0, 0.15));
                min-width: 300px;
                min-height: 200px;
                display: flex;
                flex-direction: column;
                user-select: none;
                overflow: hidden;
            }
            
            .redux-dock.dragging {
                opacity: 0.8;
                z-index: calc(var(--z-toast) * 12) !important; /* Above everything when dragging */
            }
            
            .redux-dock.resizing {
                pointer-events: none;
            }
            
            .redux-dock.resizing * {
                pointer-events: none;
            }
            
            .redux-dock.collapsed .dock-content {
                display: none;
            }
            
            .redux-dock.maximized {
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                border-radius: 0;
            }
            
            .dock-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-1, 4px) var(--space-2, 8px);
                background: var(--color-bg-alt, #f8f9fa);
                border-bottom: 1px solid var(--color-border, #e1e5e9);
                cursor: move;
                flex-shrink: 0;
            }
            
            .dock-tabs {
                display: flex;
                gap: var(--space-1, 4px);
                flex: 1;
                overflow-x: auto;
            }
            
            .dock-tab {
                display: flex;
                align-items: center;
                gap: var(--space-1, 4px);
                padding: var(--space-1, 4px) var(--space-2, 8px);
                background: var(--color-bg, white);
                border: 1px solid var(--color-border-light, #f0f0f0);
                border-radius: var(--radius-sm, 4px);
                cursor: pointer;
                font-size: var(--font-size-xs, 12px);
                white-space: nowrap;
                transition: var(--transition-fast, 0.15s ease);
            }
            
            .dock-tab:hover {
                background: var(--color-bg-hover, #e9ecef);
            }
            
            .dock-tab.active {
                background: var(--color-primary, #007bff);
                color: white;
                border-color: var(--color-primary, #007bff);
            }
            
            .tab-title {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .tab-close {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 14px;
                color: inherit;
                opacity: 0.7;
                padding: 0;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 2px;
            }
            
            .tab-close:hover {
                opacity: 1;
                background: rgba(0, 0, 0, 0.1);
            }
            
            .dock-tab.active .tab-close:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .dock-controls {
                display: flex;
                gap: var(--space-1, 4px);
                flex-shrink: 0;
            }
            
            .dock-btn {
                width: 20px;
                height: 20px;
                border: none;
                background: var(--color-bg-muted, #f5f5f5);
                border-radius: var(--radius-sm, 4px);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                color: var(--color-fg-muted, #666);
                transition: var(--transition-fast, 0.15s ease);
            }
            
            .dock-btn:hover {
                background: var(--color-bg-hover, #e9ecef);
                color: var(--color-fg, #333);
            }
            
            .dock-btn.close:hover {
                background: var(--color-danger, #dc3545);
                color: white;
            }
            
            .dock-content {
                flex: 1;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            .dock-panels {
                flex: 1;
                overflow: hidden;
            }
            
            .dock-panel-container {
                width: 100%;
                height: 100%;
                overflow: auto;
            }
            
            .dock-resize-handles {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
            }
            
            .resize-handle {
                position: absolute;
                pointer-events: auto;
            }
            
            .resize-handle.n {
                top: -3px;
                left: 10px;
                right: 10px;
                height: 6px;
                cursor: n-resize;
            }
            
            .resize-handle.s {
                bottom: -3px;
                left: 10px;
                right: 10px;
                height: 6px;
                cursor: s-resize;
            }
            
            .resize-handle.e {
                top: 10px;
                right: -3px;
                bottom: 10px;
                width: 6px;
                cursor: e-resize;
            }
            
            .resize-handle.w {
                top: 10px;
                left: -3px;
                bottom: 10px;
                width: 6px;
                cursor: w-resize;
            }
            
            .resize-handle.ne {
                top: -3px;
                right: -3px;
                width: 10px;
                height: 10px;
                cursor: ne-resize;
            }
            
            .resize-handle.nw {
                top: -3px;
                left: -3px;
                width: 10px;
                height: 10px;
                cursor: nw-resize;
            }
            
            .resize-handle.se {
                bottom: -3px;
                right: -3px;
                width: 10px;
                height: 10px;
                cursor: se-resize;
            }
            
            .resize-handle.sw {
                bottom: -3px;
                left: -3px;
                width: 10px;
                height: 10px;
                cursor: sw-resize;
            }
            
            .resize-handle:hover {
                background: var(--color-primary, #007bff);
                opacity: 0.5;
            }
            
            /* Responsive adjustments */
            @media (max-width: 768px) {
                .redux-dock {
                    min-width: 280px;
                }
                
                .dock-tab {
                    padding: var(--space-0-5, 2px) var(--space-1, 4px);
                    font-size: 11px;
                }
                
                .dock-btn {
                    width: 18px;
                    height: 18px;
                    font-size: 11px;
                }
                
                .resize-handle.n,
                .resize-handle.s {
                    height: 8px;
                }
                
                .resize-handle.e,
                .resize-handle.w {
                    width: 8px;
                }
                
                .resize-handle.ne,
                .resize-handle.nw,
                .resize-handle.se,
                .resize-handle.sw {
                    width: 12px;
                    height: 12px;
                }
            }
        `;
        
        if (!document.head.querySelector('style[data-redux-dock]')) {
            style.setAttribute('data-redux-dock', 'true');
            document.head.appendChild(style);
        }
    }
    
    mount(container) {
        container.appendChild(this.element);
        this.syncWithState();
        this.log('Dock mounted');
    }
    
    unmount() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.log('Dock unmounted');
    }
    
    destroy() {
        this.unmount();
        this.log('Dock destroyed');
    }
} 