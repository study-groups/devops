/**
 * BasePanel.js - Base class for all panels in the DevPages panel system
 * 
 * Provides common functionality for:
 * - A standardized rendering pipeline (render, renderContent)
 * - Panel lifecycle management (onMount, onDeactivate)
 * - State management hooks (though state is managed externally)
 * - Event handling and communication stubs
 * - DOM management and cleanup (mount, unmount, destroy)
 */

export class BasePanel {
    constructor(options = {}) {
        if (typeof options === 'string') {
            const panelId = options;
            options = arguments[1] || {};
            options.id = panelId;
        }

        this.id = options.id || `panel-${Date.now()}`;
        this.title = options.title || 'Untitled Panel';
        this.panelId = this.id; // for backward compatibility

        this.options = {
            width: 300,
            minWidth: 200,
            maxWidth: 600,
            resizable: true,
            collapsible: true,
            order: 0,
            headless: false,
            ...options
        };
        
        this.state = {
            isVisible: true,
            isCollapsed: false,
            width: this.options.width,
            order: this.options.order
        };

        this.element = null;
        this.contentElement = null;
        this.headerElement = null;
        this.resizerElement = null;

        this.eventListeners = new Map();
        
        this.log = (message, level = 'info', type = 'PANEL') => console.log(`[${type}] [${this.id}] ${message}`);
        
        this.log(`Initialized`);
    }

    /**
     * Renders the full panel structure, including header and content.
     * This is the entry point for rendering a panel.
     * @returns {HTMLElement} The fully rendered panel element.
     */
    render() {
        this.element = document.createElement('div');
        this.element.id = this.id;
        this.element.className = `sidebar-panel panel-${this.id}`;
        this.element.dataset.panelId = this.id;

        // Apply base styles and state
        this.element.style.order = this.state.order;
        if (!this.options.headless && this.state.width) {
            this.element.style.width = `${this.state.width}px`;
        }
        this.element.classList.toggle('collapsed', this.state.isCollapsed);
        this.element.style.display = this.state.isVisible ? 'flex' : 'none';


        // Create header (if not headless)
        if (!this.options.headless) {
            this.headerElement = this.renderHeader();
            this.element.appendChild(this.headerElement);
        }

        // Create content container
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'panel-content';
        
        // Let the subclass render its specific content
        const content = this.renderContent();
        if (typeof content === 'string') {
            this.contentElement.innerHTML = content;
        } else if (content instanceof Node) {
            this.contentElement.appendChild(content);
        }
        
        this.element.appendChild(this.contentElement);
        
        this.onMount();
        
        return this.element;
    }
    
    /**
     * Renders the panel's header. Can be overridden for custom headers.
     * @returns {HTMLElement} The header element.
     */
    renderHeader() {
        const header = document.createElement('div');
        header.className = 'sidebar-panel-header';
        
        header.innerHTML = `
            <span class="title">${this.title}</span>
            <div class="controls">
                <button class="btn btn-sm btn-ghost toggle-collapse" title="Toggle Collapse">
                    <span class="icon">${this.state.isCollapsed ? '+' : '-'}</span>
                </button>
            </div>
        `;
        
        // Add event listeners for controls
        header.querySelector('.toggle-collapse').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCollapse();
        });
        
        return header;
    }

    /**
     * Subclasses MUST implement this method to provide their content.
     * @returns {string|HTMLElement} The content to be rendered inside the panel.
     */
    renderContent() {
        throw new Error('Subclasses must implement the renderContent() method.');
    }

    /**
     * Lifecycle hook called after the panel's element is created and content is rendered.
     */
    onMount() {
        this.log('Mounted');
    }

    /**
     * Lifecycle hook called just before the panel is removed from the DOM.
     */
    onDeactivate() {
        this.log('Deactivated');
    }

    /**
     * Mount the panel to a container. This is now simplified.
     * @param {HTMLElement} container - The container to mount to.
     */
    mount(container) {
        if (!container) {
            throw new Error('Container element is required for mounting');
        }
        // render() now handles everything, including calling onMount
        container.appendChild(this.render());
    }

    unmount() {
        if (this.element && this.element.parentNode) {
            this.onDeactivate();
            this.element.parentNode.removeChild(this.element);
            this.element = null;
        }
    }

    // --- State Management Methods ---

    setState(newState) {
        const oldState = { ...this.state };
        Object.assign(this.state, newState);
        this.updateUI(oldState);
    }
    
    updateUI(oldState) {
        if (!this.element) return;

        if (this.state.isVisible !== oldState.isVisible) {
            this.element.style.display = this.state.isVisible ? 'flex' : 'none';
        }
        if (this.state.isCollapsed !== oldState.isCollapsed) {
            this.element.classList.toggle('collapsed', this.state.isCollapsed);
            const icon = this.element.querySelector('.toggle-collapse .icon');
            if (icon) {
                icon.textContent = this.state.isCollapsed ? '+' : '-';
            }
        }
        if (this.state.width !== oldState.width) {
             if (!this.options.headless) this.element.style.width = `${this.state.width}px`;
        }
        if (this.state.order !== oldState.order) {
            this.element.style.order = this.state.order;
        }
    }

    toggleCollapse() {
        this.setState({ isCollapsed: !this.state.isCollapsed });
        // In a real scenario, this would dispatch an action to a state manager
        this.log(`Toggled collapse to: ${this.state.isCollapsed}`);
    }
    
    show() {
        this.setState({ isVisible: true });
    }

    hide() {
        this.setState({ isVisible: false });
    }
    
    destroy() {
        this.unmount();
        this.eventListeners.clear();
        this.log('Destroyed');
    }
    
    // ... (keep add/removeEventListener)
    addEventListener(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
        
        if (this.element) {
            this.element.addEventListener(event, handler);
        }
    }

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
} 