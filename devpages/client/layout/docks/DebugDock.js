/**
 * client/layout/docks/DebugDock.js
 * An implementation of BaseDock for a draggable, resizable floating window for debug tools.
 */
import { BaseDock } from './BaseDock.js';
import { logMessage } from '/client/log/index.js';

export class DebugDock extends BaseDock {
    constructor(dockId, title, panelGroup) {
        super(dockId, title, panelGroup, true); // true for isFloating
    }

    /**
     * Create the DOM structure for the debug dock
     */
    createDockDOM() {
        if (document.getElementById(this.dockId)) {
            logMessage(`[${this.constructor.name}] Dock element with ID ${this.dockId} already exists. Re-using.`, 'warn');
            this.dockElement = document.getElementById(this.dockId);
            return;
        }

        this.dockElement = document.createElement('div');
        this.dockElement.id = this.dockId;
        this.dockElement.className = 'floating-dock'; // Keep class for styling

        this.dockElement.innerHTML = `
            <div class="dock-header" draggable="true">
                <span class="dock-title">${this.title}</span>
                <div class="dock-controls">
                    <button class="dock-close-btn" title="Close">&times;</button>
                </div>
            </div>
            <div class="dock-content"></div>
            <div class="dock-resize-handle"></div>
        `;

        document.body.appendChild(this.dockElement);

        // Assign DOM elements to class properties
        this.headerElement = this.dockElement.querySelector('.dock-header');
        this.contentElement = this.dockElement.querySelector('.dock-content');
        this.resizeHandle = this.dockElement.querySelector('.dock-resize-handle');
        this.closeButton = this.dockElement.querySelector('.dock-close-btn');

        logMessage(`[${this.constructor.name}] Created DOM for dock: ${this.dockId}`, 'debug');
    }

    /**
     * Attach event listeners for the debug dock
     */
    attachEventListeners() {
        if (!this.dockElement) {
            logMessage(`[${this.constructor.name}] Cannot attach listeners, dockElement is null for ${this.dockId}`, 'error');
            return;
        }

        // Dragging
        this.headerElement.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.doDrag.bind(this));
        document.addEventListener('mouseup', this.endDrag.bind(this));

        // Resizing
        this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
        document.addEventListener('mousemove', this.doResize.bind(this));
        document.addEventListener('mouseup', this.endResize.bind(this));

        // Close button
        this.closeButton.addEventListener('click', this.toggleVisibility.bind(this));

        // Bring to front on click
        this.dockElement.addEventListener('mousedown', this.bringToFront.bind(this));
    }
}
