/**
 * client/layout/docks/DebugDock.js
 * A floating, draggable, and resizable dock for debug tools, built on the modern BaseDock.
 */
import { BaseDock } from './BaseDock.js';
import { appStore, dispatch } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';

export class DebugDock extends BaseDock {
    constructor(dockId) {
        super(dockId);
        this.isDragging = false;
        this.isResizing = false;
    }

    async initialize(container) {
        // Create a floating container instead of mounting in the provided one
        const floatingContainer = document.createElement('div');
        floatingContainer.id = `${this.dockId}-container`;
        floatingContainer.className = 'floating-dock-container';
        document.body.appendChild(floatingContainer);

        await super.initialize(floatingContainer);

        this.makeFloatable();
    }

    makeFloatable() {
        const header = this.container.querySelector('.dock-header');
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        this.container.querySelector('.base-dock').appendChild(resizeHandle);

        // Dragging
        header.addEventListener('mousedown', e => {
            this.isDragging = true;
            this.dragOffsetX = e.clientX - this.container.offsetLeft;
            this.dragOffsetY = e.clientY - this.container.offsetTop;
            dispatch(panelActions.bringDockToFront({ dockId: this.dockId }));
        });

        // Resizing
        resizeHandle.addEventListener('mousedown', e => {
            e.stopPropagation();
            this.isResizing = true;
        });

        document.addEventListener('mousemove', e => {
            if (this.isDragging) {
                const x = e.clientX - this.dragOffsetX;
                const y = e.clientY - this.dragOffsetY;
                dispatch(panelActions.updateDockPosition({ dockId: this.dockId, position: { x, y } }));
            }
            if (this.isResizing) {
                const width = e.clientX - this.container.offsetLeft;
                const height = e.clientY - this.container.offsetTop;
                dispatch(panelActions.updateDockSize({ dockId: this.dockId, size: { width, height } }));
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.isResizing = false;
        });
        
        this.updatePositionAndSize();
    }

    handleStateChange() {
        super.handleStateChange();
        this.updatePositionAndSize();
    }
    
    updatePositionAndSize() {
        if (!this.container || !this.state.position || !this.state.size) return;
        this.container.style.left = `${this.state.position.x}px`;
        this.container.style.top = `${this.state.position.y}px`;
        this.container.style.width = `${this.state.size.width}px`;
        this.container.style.height = `${this.state.size.height}px`;
    }

    addStyles() {
        super.addStyles();
        const styleId = 'debug-dock-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .floating-dock-container {
                position: absolute;
                z-index: 1000; /* Will be managed by Redux state later */
            }
            .resize-handle {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 10px;
                height: 10px;
                cursor: se-resize;
            }
        `;
        document.head.appendChild(style);
    }
}
