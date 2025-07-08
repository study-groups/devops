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
        
        this.log = (message, level, type) => logMessage(message, level, type || `PANEL [${this.panelId}]`);
        
        this.log(`Panel ${this.panelId} initialized`, 'debug');
    }

    /**
     * Dynamically load the panel's base CSS.
     * This ensures all panels have the correct basic layout.
     */
    loadBaseCSS() {
        const cssPath = '/client/panels/styles/BasePanel.css';
        if (!document.querySelector(`link[href="${cssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssPath;
            document.head.appendChild(link);
            this.log('BasePanel CSS loaded.', 'info');
        }
    }

    /**
     * Panel lifecycle - mount the panel to the DOM
     */
    mount(container) {
        if (!container) {
            this.log('Mount failed: container is null or undefined.', 'error');
            return false;
        }

        this.log(`Mounting panel into container: ${container.id}`, 'info');
        this.loadBaseCSS();
        this.createElement(container);
        this.render();

        // Setup event listeners
        this.setupEventListeners();
        
        this.onMount();
        
        this.log('Panel mounted successfully', 'debug');
        return true;
    }

    /**
     * Panel lifecycle - unmount the panel from the DOM
     */
    unmount() {
        if (!this.element) {
            this.log('Panel not mounted, skipping unmount', 'warn');
            return;
        }

        this.log('Unmounting panel...', 'debug');

        this.onUnmount();
        
        // Remove event listeners
        this.removeEventListeners();
        
        // Remove from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Clear references
        this.element = null;
        this.contentElement = null;
        this.headerElement = null;
        this.resizerElement = null;
        
        this.log('Panel unmounted', 'debug');
    }

    /**
     * Create the panel DOM structure
     */
    createElement(container) {
        // Create main panel element
        this.element = document.createElement('div');
        this.element.className = `panel panel-${this.panelId}`;
        this.element.setAttribute('data-panel-id', this.panelId);

        // Add headless class if applicable
        if (this.options.headless) {
            this.element.classList.add('panel-headless');
        }

        // Initial style is hidden, will be shown by .show()
        this.element.style.display = 'none';

        const baseStyles = `
            flex-direction: column;
            background-color: var(--editor-background, #f8f9fa);
            border-right: 1px solid var(--editor-border, #dee2e6);
            min-width: ${this.options.minWidth}px;
            order: ${this.state.order};
            position: relative;
            overflow: hidden;
        `;
        
        this.element.style.cssText += baseStyles;

        // Apply width only if the panel is NOT headless and has a defined width
        if (!this.options.headless && this.state.width !== null) {
            this.element.style.width = `${this.state.width}px`;
            if (this.options.maxWidth !== null) {
                this.element.style.maxWidth = `${this.options.maxWidth}px`;
            }
        }

        // If panel is headless, we only create the content container
        if (this.options.headless) {
            this.contentElement = document.createElement('div');
            this.contentElement.className = 'panel-content';
            this.element.appendChild(this.contentElement);
        } else {
            // Create header if title is provided
            const title = this.getTitle();
            if (title) {
                this.headerElement = document.createElement('div');
                this.headerElement.className = 'panel-header';
                this.headerElement.innerHTML = `
                    <span class="panel-title">${title}</span>
                    <div class="panel-controls">
                        ${this.options.collapsible ? '<button class="panel-collapse-btn">-</button>' : ''}
                    </div>
                `;
                this.element.appendChild(this.headerElement);
            }

            // Create content area
            this.contentElement = document.createElement('div');
            this.contentElement.className = 'panel-content';
            this.element.appendChild(this.contentElement);

            // Create resizer handle
            if (this.options.resizable) {
                this.resizerElement = document.createElement('div');
                this.resizerElement.className = 'panel-resizer';
                this.element.appendChild(this.resizerElement);
            }
        }

        // Append to container
        container.appendChild(this.element);
        this.log(`[DEBUG] Panel ${this.panelId} element appended to container. Container innerHTML: '''${container.innerHTML.substring(0, 500)}...'''`, 'debug');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Panel-specific event listeners will be added by subclasses
        this.onSetupEventListeners();
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        // Clean up all registered event listeners
        this.eventListeners.forEach((listener, element) => {
            if (element && typeof element.removeEventListener === 'function') {
                listener.forEach(({ event, handler }) => {
                    element.removeEventListener(event, handler);
                });
            }
        });
        this.eventListeners.clear();

        this.onRemoveEventListeners();
    }

    /**
     * Register an event listener for cleanup
     */
    addEventListener(element, event, handler) {
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        this.eventListeners.get(element).push({ event, handler });
        element.addEventListener(event, handler);
    }

    /**
     * Show the panel - This now DIRECTLY affects the DOM
     */
    show() {
        if (this.state.visible || !this.element) return;
        this.state.visible = true;
        this.element.style.display = 'flex';
        this.onShow();
    }

    /**
     * Hide the panel - This now DIRECTLY affects the DOM
     */
    hide() {
        if (!this.state.visible || !this.element) return;
        this.state.visible = false;
        this.element.style.display = 'none';
        this.onHide();
    }

    /**
     * Toggle the panel
     */
    toggle() {
        if (this.state.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Toggle panel collapse state
     */
    toggleCollapse() {
        if (!this.options.collapsible) return;

        this.state.collapsed = !this.state.collapsed;
        this.applyState();
        this.persistState();
        
        const collapseBtn = this.headerElement?.querySelector('.panel-collapse-btn');
        if (collapseBtn) {
            collapseBtn.innerHTML = this.state.collapsed ? '▶' : '▼';
        }

        this.onToggleCollapse();
        this.log(`Panel ${this.state.collapsed ? 'collapsed' : 'expanded'}`, 'debug');
    }

    /**
     * Start panel resize operation
     */
    startResize(event) {
        if (!this.options.resizable) return;

        event.preventDefault();
        const startX = event.clientX;
        const startWidth = this.state.width;

        const handleMouseMove = (e) => {
            const deltaX = e.clientX - startX;
            const newWidth = Math.max(
                this.options.minWidth,
                Math.min(this.options.maxWidth, startWidth + deltaX)
            );
            
            this.setWidth(newWidth);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            // Dispatch final width to store
            const finalWidth = this.element.offsetWidth;
            // We need to dispatch this, but from the UIManager, not here.
            // For now, let's notify the manager via an event.
            if (window.eventBus) {
                window.eventBus.emit('panel:resized', { panelId: this.panelId, width: finalWidth });
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    /**
     * Set panel width
     */
    setWidth(width) {
        // If width constraints are null, don't apply them
        let newWidth = width;
        if (this.options.minWidth !== null && this.options.maxWidth !== null) {
            newWidth = Math.max(
                this.options.minWidth,
                Math.min(this.options.maxWidth, width)
            );
        } else if (this.options.minWidth !== null) {
            newWidth = Math.max(this.options.minWidth, width);
        } else if (this.options.maxWidth !== null) {
            newWidth = Math.min(this.options.maxWidth, width);
        }
        
        this.state.width = newWidth;
        if (this.element && newWidth !== null) {
            this.element.style.width = `${newWidth}px`;
        }
        
        this.onResize();
    }

    /**
     * Apply current state to DOM
     */
    applyState() {
        if (!this.element) return;
        
        // Apply visibility
        if (this.state.visible) {
            this.element.style.display = 'flex';
            this.element.classList.add('panel-visible');
        } else {
            this.element.style.display = 'none';
            this.element.classList.remove('panel-visible');
        }

        // Apply width only if defined
        if (this.state.width !== null) {
            this.element.style.width = `${this.state.width}px`;
        }
        
        // Apply collapse state
        if (this.contentElement) {
            this.contentElement.style.display = this.state.collapsed ? 'none' : 'block';
        }
        
        // Apply order
        this.element.style.order = this.state.order;
    }

    /**
     * Load persisted state from localStorage
     */
    loadPersistedState() {
        if (!this.options.persistent) return;

        try {
            const stored = localStorage.getItem(`panel_${this.panelId}_state`);
            if (stored) {
                const state = JSON.parse(stored);
                this.state = { ...this.state, ...state };
                this.log('Loaded persisted state', 'debug');
            }
        } catch (error) {
            this.log(`Failed to load persisted state: ${error.message}`, 'warn');
        }
    }

    /**
     * Persist current state to localStorage
     */
    persistState() {
        if (!this.options.persistent) return;

        try {
            localStorage.setItem(
                `panel_${this.panelId}_state`,
                JSON.stringify({
                    visible: this.state.visible,
                    collapsed: this.state.collapsed,
                    width: this.state.width,
                    order: this.state.order
                })
            );
        } catch (error) {
            this.log(`Failed to persist state: ${error.message}`, 'warn');
        }
    }

    /**
     * Get panel state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Get panel info for layout manager
     */
    getPanelInfo() {
        return {
            id: this.panelId,
            title: this.getTitle(),
            width: this.state.width,
            visible: this.state.visible,
            collapsed: this.state.collapsed,
            order: this.state.order,
            resizable: this.options.resizable,
            collapsible: this.options.collapsible
        };
    }

    /**
     * Logging helper
     */
    log(message, level = 'info') {
        const prefix = `[Panel:${this.panelId}]`;
        if (typeof window.logMessage === 'function') {
            window.logMessage(`${prefix} ${message}`, level, 'PANEL');
        } else {
            console[level] ? console[level](`${prefix} ${message}`) : console.log(`${prefix} ${message}`);
        }
    }

    // ===== ABSTRACT METHODS - TO BE IMPLEMENTED BY SUBCLASSES =====

    /**
     * Get panel title (override in subclasses)
     */
    getTitle() {
        return this.options.title || 'Panel';
    }

    /**
     * Render panel's inner content by calling the subclass's renderContent method.
     * This is called by mount() to populate the panel.
     */
    render() {
        if (!this.contentElement) {
            this.log('Cannot render, content element does not exist.', 'error');
            return;
        }

        // Subclasses should implement renderContent to provide their HTML
        if (typeof this.renderContent === 'function') {
            const content = this.renderContent();
            if (typeof content === 'string') {
                this.contentElement.innerHTML = content;
                this.log('Panel content rendered.', 'debug');
                this.log(`[DEBUG] Panel ${this.panelId} contentElement innerHTML set. contentElement.outerHTML: '''${this.contentElement.outerHTML.substring(0, 500)}...'''`, 'debug');
            } else {
                this.log('renderContent() did not return a string.', 'warn');
            }
        } else {
            this.log('renderContent() method not implemented.', 'warn');
        }
    }

    /**
     * Called after panel is mounted (override in subclasses)
     */
    onMount() {
        this.log(`[PANEL_DEBUG] BasePanel (${this.panelId}): onMount() hook executed.`, 'debug');
    }

    /**
     * Called before panel is unmounted (override in subclasses)
     */
    onUnmount() {
        // Override in subclasses
    }

    /**
     * Called when panel is shown (override in subclasses)
     */
    onShow() {
        // Override in subclasses
    }

    /**
     * Called when panel is hidden (override in subclasses)
     */
    onHide() {
        // Override in subclasses
    }

    /**
     * Called when panel collapse state changes (override in subclasses)
     */
    onToggleCollapse() {
        // Override in subclasses
    }

    /**
     * Called when panel is resized (override in subclasses)
     */
    onResize() {
        // Override in subclasses
    }

    /**
     * Setup panel-specific event listeners (override in subclasses)
     */
    onSetupEventListeners() {
        // Override in subclasses
    }

    /**
     * Remove panel-specific event listeners (override in subclasses)
     */
    onRemoveEventListeners() {
        // Override in subclasses
    }
} 