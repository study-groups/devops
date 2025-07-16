/**
 * BasePanel.js - Base class for all panels in the DevPages panel system
 * 
 * Provides common functionality for:
 * - Panel lifecycle (mount, unmount, show, hide)
 * - State management and persistence
 * - Sizing and positioning
 * - Event handling and communication
 * - DOM management
 */

export class BasePanel {
    constructor(panelId, options = {}) {
        this.panelId = panelId;
        this.options = {
            // Default panel configuration
            width: 300,
            minWidth: 200,
            maxWidth: 600,
            resizable: true,
            collapsible: true,
            order: 0, // Panel order for stacking (lower = more left)
            headless: false,
            ...options
        };
        
        // Panel state IS NOW LOCAL to the component again
        this.state = {
            visible: false, // Start as hidden
            width: this.options.width,
            order: this.options.order
        };

        // DOM references
        this.element = null;
        this.contentElement = null;
        this.headerElement = null;
        this.resizerElement = null;

        // Event handlers
        this.eventListeners = new Map();
        
        this.log = (message, level, type) => console.log(`[${type || 'PANEL'}] ${message}`);
        
        this.log(`Panel ${this.panelId} initialized`, 'debug');
    }

    /**
     * Render the panel content
     * @returns {HTMLElement} The rendered panel element
     */
    render() {
        // Check if subclass has renderContent method (backward compatibility)
        if (typeof this.renderContent === 'function') {
            const content = this.renderContent();
            const container = document.createElement('div');
            container.className = `panel panel-${this.panelId}`;
            container.setAttribute('data-panel-id', this.panelId);
            
            if (this.options.headless) {
                container.classList.add('panel-headless');
            }
            
            // Apply base styles
            const baseStyles = `
                flex-direction: column;
                background-color: var(--editor-background, #f8f9fa);
                border-right: 1px solid var(--editor-border, #dee2e6);
                min-width: ${this.options.minWidth}px;
                order: ${this.state.order};
                position: relative;
                overflow: hidden;
            `;
            container.style.cssText += baseStyles;
            
            if (!this.options.headless && this.state.width !== null) {
                container.style.width = `${this.state.width}px`;
                if (this.options.maxWidth !== null) {
                    container.style.maxWidth = `${this.options.maxWidth}px`;
                }
            }
            
            // Create content element
            this.contentElement = document.createElement('div');
            this.contentElement.className = 'panel-content';
            
            if (typeof content === 'string') {
                this.contentElement.innerHTML = content;
            } else if (content instanceof Node) {
                this.contentElement.appendChild(content);
            }
            
            container.appendChild(this.contentElement);
            return container;
        }
        
        // If no renderContent method, throw error
        throw new Error('render() or renderContent() method must be implemented by subclass');
    }

    /**
     * Called when the panel is activated/mounted
     * @param {HTMLElement} contentElement - The panel's content element
     */
    onActivate(contentElement) {
        // Default implementation - can be overridden by subclasses
        this.log(`Panel ${this.panelId} activated`);
        
        // Backward compatibility: call onMount if it exists
        if (typeof this.onMount === 'function') {
            this.onMount();
        }
    }

    /**
     * Called when the panel is mounted (backward compatibility)
     */
    async onMount() {
        // Default implementation - can be overridden by subclasses
        this.log(`Panel ${this.panelId} mounted`);
    }

    /**
     * Called when the panel is deactivated/unmounted
     */
    onDeactivate() {
        // Default implementation - can be overridden by subclasses
        this.log(`Panel ${this.panelId} deactivated`);
        
        // Backward compatibility: call onUnmount if it exists
        if (typeof this.onUnmount === 'function') {
            this.onUnmount();
        }
    }

    /**
     * Mount the panel to a container
     * @param {HTMLElement} container - The container to mount to
     */
    mount(container) {
        if (!container) {
            throw new Error('Container element is required for mounting');
        }

        this.element = this.render();
        if (this.element) {
            container.appendChild(this.element);
            this.onActivate(this.contentElement || this.element);
        }
    }

    /**
     * Unmount the panel from its container
     */
    unmount() {
        if (this.element && this.element.parentNode) {
            this.onDeactivate();
            this.element.parentNode.removeChild(this.element);
            this.element = null;
        }
    }



    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.state.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Set panel width
     * @param {number} width - The new width
     */
    setWidth(width) {
        if (this.element) {
            this.element.style.width = `${width}px`;
            this.state.width = width;
        }
    }

    /**
     * Get current panel width
     * @returns {number} The current width
     */
    getWidth() {
        return this.state.width;
    }

    /**
     * Add event listener to panel
     * @param {string} event - The event name
     * @param {Function} handler - The event handler
     */
    addEventListener(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
        
        if (this.element) {
            this.element.addEventListener(event, handler);
        }
    }

    /**
     * Remove event listener from panel
     * @param {string} event - The event name
     * @param {Function} handler - The event handler
     */
    removeEventListener(event, handler) {
        if (this.element) {
            this.element.removeEventListener(event, handler);
        }
        
        const handlers = this.eventListeners.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Clean up panel resources
     */
    destroy() {
        this.unmount();
        this.eventListeners.clear();
        this.log(`Panel ${this.panelId} destroyed`);
    }

    /**
     * Backward compatibility methods
     */
    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            this.state.visible = true;
        }
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
            this.state.visible = false;
        }
    }

    /**
     * Get panel title (backward compatibility)
     */
    getTitle() {
        return this.options.title || 'Panel';
    }
} 