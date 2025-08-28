/**
 * @file client/panels/PanelInterface.js
 * @description Defines the standard interface that all panels must implement.
 */

export class PanelInterface {
    constructor(options) {
        this.id = options.id;
        this.title = options.title || this.id;
        this.store = options.store;
        
        // Parent-child relationships
        this.parent = options.parent || null;
        this.children = new Map();
        
        // Panel state
        this.isCollapsed = options.isCollapsed || false;
        this.widthState = options.widthState || 'resized'; // 'full' | 'resized'
        
        // Header configuration
        this.headerInfo = options.headerInfo || '';
        this.headerButtons = options.headerButtons || [];
        
        // Initialize state object
        this.state = {
            isDestroyed: false,
            isVisible: options.isVisible || true,
            lastUpdate: Date.now()
        };
        
        // Render cache for memoization
        this.renderCache = new Map();
        
        // Update queue for batched updates
        this.updateQueue = new Set();
        
        // Throttled update method
        this.throttledUpdate = this.throttle(this.performUpdate, 100);
        
        // Register with parent if provided
        if (this.parent) {
            this.parent.addChild(this);
        }
    }

    render() {
        throw new Error("Subclasses must implement render method");
    }

    // Parent-child management
    addChild(panel) {
        if (panel instanceof PanelInterface) {
            this.children.set(panel.id, panel);
            panel.parent = this;
        }
    }

    removeChild(panelId) {
        const panel = this.children.get(panelId);
        if (panel) {
            panel.parent = null;
            this.children.delete(panelId);
        }
    }

    getChildren() {
        return Array.from(this.children.values());
    }

    // Bulk operations
    openAll() {
        this.isCollapsed = false;
        this.children.forEach(child => child.openAll());
        this.onStateChange();
    }

    closeAll() {
        this.isCollapsed = true;
        this.children.forEach(child => child.closeAll());
        this.onStateChange();
    }

    // Width state management
    setWidthState(state) {
        if (['full', 'resized'].includes(state)) {
            this.widthState = state;
            this.onStateChange();
        }
    }

    toggleWidthState() {
        this.setWidthState(this.widthState === 'full' ? 'resized' : 'full');
    }

    // Header management
    setHeaderInfo(info) {
        this.headerInfo = info;
        this.updateHeader();
    }

    addHeaderButton(button) {
        this.headerButtons.push(button);
        this.updateHeader();
    }

    removeHeaderButton(buttonId) {
        this.headerButtons = this.headerButtons.filter(btn => btn.id !== buttonId);
        this.updateHeader();
    }

    updateHeader() {
        // Override in subclasses to update header display
    }

    // Lifecycle hooks
    onMount() {}
    onUnmount() {}
    onStateChange() {}

    /**
     * Throttle function for performance optimization
     */
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        
        return (...args) => {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    /**
     * Placeholder for update method
     */
    performUpdate() {
        // Subclasses will override this method
    }

    /**
     * Default logging method
     * @param {string} message - The message to log
     * @param {string} [level='log'] - Logging level (log, warn, error)
     */
    log(message, level = 'log') {
        const prefix = `[Panel:${this.id}]`;
        
        switch(level) {
            case 'warn':
                console.warn(prefix, message);
                break;
            case 'error':
                console.error(prefix, message);
                break;
            default:
                console.log(prefix, message);
        }
    }
}
