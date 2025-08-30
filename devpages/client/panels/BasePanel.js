/**
 * BasePanel.js - Core panel system with Redux integration
 * 
 * Provides a standardized panel interface with:
 * - Position and size management
 * - State persistence via Redux
 * - Lifecycle management
 * - Debug integration
 */

import { appStore } from '../appState.js';
import { panelActions } from '../store/slices/panelSlice.js';

/**
 * Base class for creating dynamic, draggable, and resizable panels.
 * Integrates with Redux for state management and aligns with the application's design system.
 * Panels can be instantiated, mounted to the DOM, shown/hidden, and destroyed.
 * Provides lifecycle hooks for extended functionality.
 * @property {string} id - Unique identifier for the panel.
 * @property {string} title - Title displayed in the panel header.
 * @property {string} type - Type of the panel, used for styling and identification.
 * @property {HTMLElement|null} element - The root DOM element for the panel.
 * @property {boolean} mounted - True if the panel is currently in the DOM.
 * @property {object} config - Configuration options for the panel's behavior and appearance.
 */
export class BasePanel {
    /**
     * @param {object} [config={}] - Configuration for the panel.
     * @param {string} [config.id] - A unique ID. If not provided, one is generated.
     * @param {string} [config.title='Untitled Panel'] - The title for the panel header.
     * @param {string} [config.type='generic'] - The type of the panel.
     * @param {boolean} [config.resizable=true] - Whether the panel can be resized.
     * @param {boolean} [config.draggable=true] - Whether the panel can be dragged.
     * @param {boolean} [config.collapsible=true] - Whether the panel can be collapsed.
     * @param {boolean} [config.closable=true] - Whether to show a close button.
     */
    constructor(config = {}) {
        this.id = config.id || `panel-${Date.now()}`;
        this.title = config.title || 'Untitled Panel';
        this.type = config.type || 'generic';
        this.element = null;
        this.mounted = false;
        
        // Default configuration
        this.config = {
            resizable: true,
            draggable: true,
            collapsible: true,
            closable: true,
            modal: false,
            zIndex: 1000,
            minWidth: 200,
            minHeight: 150,
            defaultWidth: 400,
            defaultHeight: 300,
            defaultPosition: { x: 100, y: 100 },
            ...config
        };

        // Bind methods
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        // Initialize panel state in Redux
        this.initializeState();
    }

    initializeState() {
        const existingState = this.getState();
        if (!existingState) {
            appStore.dispatch(panelActions.createPanel({
                id: this.id,
                title: this.title,
                type: this.type,
                position: this.config.defaultPosition,
                size: { 
                    width: this.config.defaultWidth, 
                    height: this.config.defaultHeight 
                },
                visible: false,
                collapsed: false,
                zIndex: this.config.zIndex,
                config: this.config
            }));
        }
    }

    getState() {
        return appStore.getState().panels.panels[this.id];
    }

    updateState(updates) {
        appStore.dispatch(panelActions.updatePanel({
            id: this.id,
            updates
        }));
    }

    /**
     * Mounts the panel to a container in the DOM.
     * Creates the panel element, attaches event listeners, and applies its state.
     * @param {HTMLElement} [container=document.body] - The container element to append the panel to.
     * @returns {BasePanel} The panel instance for chaining.
     */
    mount(container = document.body) {
        if (this.mounted) return this;

        this.createElement();
        container.appendChild(this.element);
        this.attachEventListeners();
        this.applyStateToElement();
        this.mounted = true;

        this.updateState({ mounted: true });
        this.onMount();

        return this;
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = `base-panel panel-${this.type}`;
        this.element.id = this.id;
        this.element.setAttribute('data-panel-id', this.id);

        const state = this.getState();
        
        this.element.innerHTML = `
            <div class="panel-header" data-action="drag">
                <div class="panel-title">${this.title}</div>
                <div class="panel-controls">
                    ${this.config.collapsible ? '<button class="panel-btn collapse-btn" data-action="collapse" title="Collapse">−</button>' : ''}
                    ${this.config.closable ? '<button class="panel-btn close-btn" data-action="close" title="Close">×</button>' : ''}
                </div>
            </div>
            <div class="panel-body">
                ${this.renderContent()}
            </div>
            ${this.config.resizable ? '<div class="panel-resize-handle" data-action="resize"></div>' : ''}
        `;
    }

    /**
     * Renders the main content of the panel. This method should be overridden by subclasses
     * to provide specific content.
     * @returns {string} HTML string for the panel's body.
     */
    renderContent() {
        // Override in subclasses
        return '<div class="panel-placeholder">Panel content goes here</div>';
    }

    applyStateToElement() {
        if (!this.element) return;

        const state = this.getState();
        if (!state) return;

        // Position and size
        this.element.style.left = `${state.position.x}px`;
        this.element.style.top = `${state.position.y}px`;
        this.element.style.width = `${state.size.width}px`;
        this.element.style.height = `${state.size.height}px`;
        this.element.style.zIndex = state.zIndex;

        // Visibility
        this.element.style.display = state.visible ? 'flex' : 'none';
        if (state.visible) {
            // Use a timeout to allow the element to be rendered before adding the class
            setTimeout(() => {
                this.element.classList.add('is-visible');
            }, 10);
        } else {
            this.element.classList.remove('is-visible');
        }

        // Collapsed state
        if (state.collapsed) {
            this.element.classList.add('collapsed');
            const body = this.element.querySelector('.panel-body');
            if (body) body.style.display = 'none';
        } else {
            this.element.classList.remove('collapsed');
            const body = this.element.querySelector('.panel-body');
            if (body) body.style.display = 'block';
        }
    }

    /**
     * Attaches all necessary event listeners to the panel element.
     * Handles controls, dragging, and resizing.
     */
    attachEventListeners() {
        if (!this.element) return;

        // Panel controls
        this.element.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action');
            switch (action) {
                case 'close':
                    this.hide();
                    break;
                case 'collapse':
                    this.toggleCollapse();
                    break;
            }
        });

        // Drag and resize
        this.element.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('keydown', this.handleKeyDown);
    }

    /**
     * Handles the mousedown event to initiate dragging or resizing.
     * @param {MouseEvent} e - The mouse event.
     */
    handleMouseDown(e) {
        const action = e.target.getAttribute('data-action') || 
                     e.target.closest('[data-action]')?.getAttribute('data-action');
        
        if (!action) return;

        e.preventDefault();
        const rect = this.element.getBoundingClientRect();
        
        this.dragState = {
            action,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left,
            startTop: rect.top,
            startWidth: rect.width,
            startHeight: rect.height
        };

        // Bring to front
        this.bringToFront();
    }

    /**
     * Handles the mousemove event to update panel position or size during a drag.
     * @param {MouseEvent} e - The mouse event.
     */
    handleMouseMove(e) {
        if (!this.dragState) return;

        const deltaX = e.clientX - this.dragState.startX;
        const deltaY = e.clientY - this.dragState.startY;

        switch (this.dragState.action) {
            case 'drag':
                if (this.config.draggable) {
                    const newX = Math.max(0, this.dragState.startLeft + deltaX);
                    const newY = Math.max(0, this.dragState.startTop + deltaY);
                    this.updateState({ position: { x: newX, y: newY } });
                }
                break;
            case 'resize':
                if (this.config.resizable) {
                    const newWidth = Math.max(this.config.minWidth, this.dragState.startWidth + deltaX);
                    const newHeight = Math.max(this.config.minHeight, this.dragState.startHeight + deltaY);
                    this.updateState({ size: { width: newWidth, height: newHeight } });
                }
                break;
        }

        this.applyStateToElement();
    }

    /**
     * Handles the mouseup event to end a drag or resize operation.
     * @param {MouseEvent} e - The mouse event.
     */
    handleMouseUp(e) {
        this.dragState = null;
    }

    /**
     * Handles keydown events, such as closing the panel with the Escape key.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    handleKeyDown(e) {
        if (e.key === 'Escape' && this.getState()?.visible) {
            this.hide();
        }
    }

    /**
     * Shows the panel and brings it to the front.
     * @returns {BasePanel} The panel instance for chaining.
     */
    show() {
        this.updateState({ visible: true });
        this.applyStateToElement();
        this.bringToFront();
        this.onShow();
        return this;
    }

    /**
     * Hides the panel.
     * @returns {BasePanel} The panel instance for chaining.
     */
    hide() {
        this.element.classList.remove('is-visible');
        
        // Wait for animation to finish before hiding
        setTimeout(() => {
            this.updateState({ visible: false });
            this.applyStateToElement();
            this.onHide();
        }, 200); // Should match transition duration

        return this;
    }

    /**
     * Toggles the collapsed state of the panel.
     * @returns {BasePanel} The panel instance for chaining.
     */
    toggleCollapse() {
        const state = this.getState();
        this.updateState({ collapsed: !state.collapsed });
        this.applyStateToElement();
        return this;
    }

    /**
     * Brings the panel to the front by increasing its z-index.
     */
    bringToFront() {
        const allPanels = appStore.getState().panels.panels;
        const maxZ = Math.max(...Object.values(allPanels).map(p => p.zIndex || 1000));
        this.updateState({ zIndex: maxZ + 1 });
        this.applyStateToElement();
    }

    /**
     * Removes the panel from the DOM and cleans up its state.
     */
    destroy() {
        if (this.element) {
            this.element.remove();
        }
        this.mounted = false;
        appStore.dispatch(panelActions.removePanel(this.id));
        this.onDestroy();
    }

    // Lifecycle hooks - override in subclasses
    onMount() {}
    onShow() {}
    onHide() {}
    onDestroy() {}

    // Debug helpers
    getDebugInfo() {
        return {
            id: this.id,
            title: this.title,
            type: this.type,
            mounted: this.mounted,
            state: this.getState(),
            config: this.config
        };
    }
}

// Panel Registry
/**
 * Manages the registration and lifecycle of panel types and instances.
 */
export class PanelRegistry {
    constructor() {
        this.panels = new Map();
        this.types = new Map();
    }

    /**
     * Registers a new panel type.
     * @param {string} type - The name of the panel type.
     * @param {typeof BasePanel} panelClass - The class constructor for the panel.
     */
    registerType(type, panelClass) {
        this.types.set(type, panelClass);
    }

    createPanel(type, config) {
        const PanelClass = this.types.get(type) || BasePanel;
        const panel = new PanelClass({ ...config, type });
        this.panels.set(panel.id, panel);
        return panel;
    }

    getPanel(id) {
        return this.panels.get(id);
    }

    getAllPanels() {
        return Array.from(this.panels.values());
    }

    destroyPanel(id) {
        const panel = this.panels.get(id);
        if (panel) {
            panel.destroy();
            this.panels.delete(id);
        }
    }

    getDebugInfo() {
        return {
            totalPanels: this.panels.size,
            types: Array.from(this.types.keys()),
            panels: Array.from(this.panels.values()).map(p => p.getDebugInfo())
        };
    }
}

// Global registry instance
export const panelRegistry = new PanelRegistry();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.panels = {
        registry: panelRegistry,
        BasePanel
    };
}
