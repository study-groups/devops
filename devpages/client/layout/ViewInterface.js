/**
 * ViewInterface.js - Base interface for standalone workspace views
 * 
 * Views are different from Panels:
 * - Views are standalone workspace areas (Editor, Preview, Log)
 * - Views have dedicated containers in the workspace layout
 * - Views don't have parent-child relationships or panel features
 * - Views are managed directly by WorkspaceManager
 */

export class ViewInterface {
    constructor(options) {
        this.id = options.id;
        this.title = options.title || this.id;
        this.store = options.store;
        this.container = options.container;
        this.element = null;
        
        // View state
        this.isVisible = options.isVisible !== false;
        this.isInitialized = false;
    }

    /**
     * Render the view's content
     * @returns {HTMLElement} The root element of the view
     */
    render() {
        throw new Error("Views must implement the render() method");
    }

    /**
     * Mount the view to its container
     * @param {HTMLElement} container - The container element
     */
    mount(container) {
        if (!container) {
            throw new Error('Container element is required for mounting view');
        }
        
        this.container = container;
        this.element = this.render();
        
        // Clear container and add view
        container.innerHTML = '';
        container.appendChild(this.element);
        
        this.onMount(container);
        this.isInitialized = true;
    }

    /**
     * Unmount the view from its container
     */
    unmount() {
        this.onUnmount();
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.element = null;
        this.isInitialized = false;
    }

    /**
     * Show the view
     */
    show() {
        this.isVisible = true;
        if (this.container) {
            this.container.style.display = '';
        }
        this.onVisibilityChange(true);
    }

    /**
     * Hide the view
     */
    hide() {
        this.isVisible = false;
        if (this.container) {
            this.container.style.display = 'none';
        }
        this.onVisibilityChange(false);
    }

    /**
     * Toggle view visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Refresh/re-render the view
     */
    refresh() {
        if (this.container && this.isInitialized) {
            this.unmount();
            this.mount(this.container);
        }
    }

    // Lifecycle hooks
    onMount(container) {
        // Override in subclasses
    }

    onUnmount() {
        // Override in subclasses
    }

    onVisibilityChange(isVisible) {
        // Override in subclasses
    }

    onStateChange(newState) {
        // Override in subclasses
    }
}
