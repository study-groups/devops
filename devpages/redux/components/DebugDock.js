/**
 * DebugDock.js - Beautiful Redux-integrated Debug Dock
 * Based on the original PanelUI with full drag/resize functionality
 */

import { zIndexManager } from "../utils/ZIndexManager.js";

export class DebugDock {
    constructor(dockId, dispatch, getState) {
        this.dockId = dockId;
        this.dispatch = dispatch;
        this.getState = getState;
        
        // UI elements
        this.panel = null;
        this.header = null;
        this.resizeHandle = null;
        this.closeButton = null;
        this.minimizeButton = null;
        this.panelContainer = null;
        
        // State
        this.isVisible = true;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isResizing = false;
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        this.currentPos = { x: 300, y: 150 };
        this.currentSize = { width: 600, height: 450 };
        this.zIndex = null;
        
        this.log = (message) => console.log(`[DebugDock][${dockId}] ${message}`);
        
        this.createPanel();
        this.setupEventHandlers();
        this.log('Initialized with beautiful styling and full functionality');
    }
    
    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = this.dockId;
        this.panel.className = 'debug-dock beautiful-dock';
        this.panel.style.cssText = `
            position: fixed;
            left: ${this.currentPos.x}px;
            top: ${this.currentPos.y}px;
            width: ${this.currentSize.width}px;
            height: ${this.currentSize.height}px;
            background: var(--color-bg-elevated, #fff);
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: var(--radius-md, 8px);
            box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.12));
            display: flex;
            flex-direction: column;
            overflow: hidden;
            z-index: var(--z-toast, 1050);
            font-family: var(--font-family-base, system-ui);
        `;
        
        // Create header with drag handle and controls
        this.header = document.createElement('div');
        this.header.className = 'dock-header';
        this.header.innerHTML = `
            <div class="dock-title">
                <span class="dock-icon">🐛</span>
                <span class="dock-title-text">Debug Dock</span>
            </div>
            <div class="dock-controls">
                <button class="dock-btn dock-minimize" title="Minimize">−</button>
                <button class="dock-btn dock-close" title="Close">×</button>
            </div>
        `;
        
        // Create panel container
        this.panelContainer = document.createElement('div');
        this.panelContainer.className = 'dock-panel-container';
        this.panelContainer.id = 'container-pdata-panel';
        
        // Create main content area
        const content = document.createElement('div');
        content.className = 'dock-content';
        content.appendChild(this.panelContainer);
        
        // Create resize handle
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'dock-resize-handle';
        
        // Assemble the panel
        this.panel.appendChild(this.header);
        this.panel.appendChild(content);
        this.panel.appendChild(this.resizeHandle);
        
        // Add to DOM
        document.body.appendChild(this.panel);
        
        // Register with Z-Index Manager IMMEDIATELY after adding to DOM
        if (typeof zIndexManager !== 'undefined') {
            this.zIndex = zIndexManager.register(this.panel, 'UI', 10, { 
                isDraggable: true, 
                isResizable: true,
                name: 'DebugDock'
            });
            this.log(`Registered with ZIndexManager, z-index: ${this.zIndex}`);
        }
        
        // Get references to buttons
        this.closeButton = this.panel.querySelector('.dock-close');
        this.minimizeButton = this.panel.querySelector('.dock-minimize');
        
        this.loadStyles();
        this.log('Beautiful dock created and added to DOM');
    }
    
    loadStyles() {
        if (document.querySelector('style[data-debug-dock-styles]')) return;
        
        const style = document.createElement('style');
        style.setAttribute('data-debug-dock-styles', 'true');
        style.textContent = `
            .beautiful-dock {
                user-select: none;
                backdrop-filter: blur(10px);
                transition: box-shadow var(--transition-fast, 0.15s) ease;
            }
            
            .beautiful-dock:hover {
                box-shadow: var(--shadow-xl, 0 12px 48px rgba(0, 0, 0, 0.15));
            }
            
            .dock-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-3, 12px) var(--space-4, 16px);
                background: linear-gradient(135deg, var(--color-bg-alt, #f8f9fa) 0%, var(--color-bg-muted, #e9ecef) 100%);
                border-bottom: 1px solid var(--color-border, #e1e5e9);
                cursor: move;
                flex-shrink: 0;
            }
            
            .dock-header:hover {
                background: linear-gradient(135deg, var(--color-bg-muted, #e9ecef) 0%, var(--color-bg-alt, #f8f9fa) 100%);
            }
            
            .dock-title {
                display: flex;
                align-items: center;
                gap: var(--space-2, 8px);
                font-weight: var(--font-weight-semibold, 600);
                color: var(--color-fg, #333);
                font-size: var(--font-size-base, 16px);
            }
            
            .dock-icon {
                font-size: 18px;
            }
            
            .dock-controls {
                display: flex;
                gap: var(--space-1, 4px);
            }
            
            .dock-btn {
                width: 24px;
                height: 24px;
                border: none;
                border-radius: var(--radius-sm, 4px);
                background: transparent;
                color: var(--color-fg-muted, #666);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: bold;
                transition: all var(--transition-fast, 0.15s);
            }
            
            .dock-btn:hover {
                background: var(--color-bg-muted, #e9ecef);
                color: var(--color-fg, #333);
                transform: scale(1.1);
            }
            
            .dock-close:hover {
                background: var(--color-danger, #dc3545);
                color: white;
            }
            
            .dock-minimize:hover {
                background: var(--color-warning, #ffc107);
                color: var(--color-warning-contrast, #000);
            }
            
            .dock-content {
                flex: 1;
                overflow: auto;
                background: var(--color-bg, #fff);
                position: relative;
            }
            
            .dock-panel-container {
                width: 100%;
                height: 100%;
                overflow: auto;
            }
            
            .dock-resize-handle {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 20px;
                height: 20px;
                cursor: nw-resize;
                background: linear-gradient(-45deg, transparent 0%, transparent 40%, var(--color-border, #e1e5e9) 50%, transparent 60%, transparent 100%);
                background-size: 4px 4px;
                opacity: 0.5;
                transition: opacity var(--transition-fast, 0.15s);
            }
            
            .dock-resize-handle:hover {
                opacity: 1;
                background-color: var(--color-primary, #007bff);
            }
            
            .beautiful-dock.dragging {
                pointer-events: none;
                box-shadow: var(--shadow-xl, 0 20px 60px rgba(0, 0, 0, 0.25));
            }
            
            .beautiful-dock.resizing {
                user-select: none;
            }
        `;
        document.head.appendChild(style);
    }
    
    setupEventHandlers() {
        // Close button
        if (this.closeButton) {
            this.closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            });
        }
        
        // Minimize button
        if (this.minimizeButton) {
            this.minimizeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleMinimize();
            });
        }
        
        // Dragging
        this.header.addEventListener('mousedown', (e) => this.startDrag(e));
        
        // Resizing
        this.resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
        
        // Click to bring to front
        this.panel.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.dock-btn')) {
                this.bringToFront();
            }
        });
        
        // Global mouse events
        document.addEventListener('mousemove', (e) => {
            this.doDrag(e);
            this.doResize(e);
        });
        
        document.addEventListener('mouseup', () => {
            this.endDrag();
            this.endResize();
        });
    }
    
    startDrag(e) {
        if (e.target.closest('.dock-btn')) return;
        
        this.isDragging = true;
        this.dragOffset = {
            x: e.clientX - this.currentPos.x,
            y: e.clientY - this.currentPos.y
        };
        
        this.panel.classList.add('dragging');
        this.bringToFront();
        e.preventDefault();
    }
    
    doDrag(e) {
        if (!this.isDragging) return;
        
        this.currentPos = {
            x: e.clientX - this.dragOffset.x,
            y: e.clientY - this.dragOffset.y
        };
        
        // Keep within viewport bounds
        this.currentPos.x = Math.max(0, Math.min(window.innerWidth - this.currentSize.width, this.currentPos.x));
        this.currentPos.y = Math.max(0, Math.min(window.innerHeight - this.currentSize.height, this.currentPos.y));
        
        this.panel.style.left = `${this.currentPos.x}px`;
        this.panel.style.top = `${this.currentPos.y}px`;
    }
    
    endDrag() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.panel.classList.remove('dragging');
    }
    
    startResize(e) {
        this.isResizing = true;
        this.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: this.currentSize.width,
            height: this.currentSize.height
        };
        
        this.panel.classList.add('resizing');
        e.preventDefault();
        e.stopPropagation();
    }
    
    doResize(e) {
        if (!this.isResizing) return;
        
        const deltaX = e.clientX - this.resizeStart.x;
        const deltaY = e.clientY - this.resizeStart.y;
        
        this.currentSize = {
            width: Math.max(300, this.resizeStart.width + deltaX),
            height: Math.max(200, this.resizeStart.height + deltaY)
        };
        
        // Keep within viewport bounds
        this.currentSize.width = Math.min(window.innerWidth - this.currentPos.x, this.currentSize.width);
        this.currentSize.height = Math.min(window.innerHeight - this.currentPos.y, this.currentSize.height);
        
        this.panel.style.width = `${this.currentSize.width}px`;
        this.panel.style.height = `${this.currentSize.height}px`;
    }
    
    endResize() {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        this.panel.classList.remove('resizing');
    }
    
    bringToFront() {
        if (typeof zIndexManager !== 'undefined') {
            this.zIndex = zIndexManager.bringToFront(this.panel);
            if (this.zIndex !== undefined) {
                this.log(`Brought to front with z-index: ${this.zIndex}`);
                return;
            }
        }
        
        // Fallback z-index management if ZIndexManager fails or is unavailable
        this.zIndex = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--z-toast') || '1050') + 10;
        this.panel.style.zIndex = this.zIndex;
        this.log(`Brought to front with fallback z-index: ${this.zIndex}`);
    }
    
    show() {
        this.isVisible = true;
        this.panel.style.display = 'flex';
        this.bringToFront();
        this.log('Dock shown');
    }
    
    hide() {
        this.isVisible = false;
        this.panel.style.display = 'none';
        this.log('Dock hidden');
    }
    
    toggleMinimize() {
        const content = this.panel.querySelector('.dock-content');
        const isMinimized = content.style.display === 'none';
        
        if (isMinimized) {
            content.style.display = 'block';
            this.panel.style.height = `${this.currentSize.height}px`;
            this.minimizeButton.textContent = '−';
            this.minimizeButton.title = 'Minimize';
        } else {
            content.style.display = 'none';
            this.panel.style.height = `${this.header.offsetHeight}px`;
            this.minimizeButton.textContent = '+';
            this.minimizeButton.title = 'Restore';
        }
        
        this.log(`Dock ${isMinimized ? 'restored' : 'minimized'}`);
    }
    
    // Compatibility methods for Redux system
    syncWithState(dockState) {
        if (!dockState) return;
        
        if (dockState.isVisible !== this.isVisible) {
            if (dockState.isVisible) {
                this.show();
            } else {
                this.hide();
            }
        }
        
        if (dockState.position) {
            this.currentPos = { ...dockState.position };
            this.panel.style.left = `${this.currentPos.x}px`;
            this.panel.style.top = `${this.currentPos.y}px`;
        }
        
        if (dockState.size) {
            this.currentSize = { ...dockState.size };
            this.panel.style.width = `${this.currentSize.width}px`;
            this.panel.style.height = `${this.currentSize.height}px`;
        }
    }
    
    destroy() {
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
            this.log('Beautiful dock destroyed');
        }
    }
}