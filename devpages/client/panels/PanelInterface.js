/**
 * @file client/panels/PanelInterface.js
 * @description Defines the standard interface that all panels must implement.
 */

export class PanelInterface {
    /**
     * @param {object} options - Panel configuration.
     * @param {string} options.id - The unique ID of the panel.
     * @param {object} options.store - The Redux store instance.
     */
    constructor(options) {
        if (this.constructor === PanelInterface) {
            throw new Error("Cannot instantiate abstract class PanelInterface.");
        }
        this.id = options.id;
        this.store = options.store;
        this.element = null;
    }

    /**
     * Renders the panel's UI and returns the root DOM element.
     * This method should create the panel's DOM structure.
     * @returns {HTMLElement} The root element of the panel.
     */
    render() {
        throw new Error("Panel must implement the render() method.");
    }

    /**
     * Called after the panel's element has been added to the DOM.
     * Use this for post-render setup, like attaching event listeners.
     * @param {HTMLElement} container - The DOM element the panel is mounted in.
     */
    onMount(container) {
        // Optional: Subclasses can implement this.
    }

    /**
     * Called when the panel is about to be removed from the DOM.
     * Use this for cleanup, like removing event listeners.
     */
    onUnmount() {
        // Optional: Subclasses can implement this.
    }

    /**
     * Called when the panel's visibility changes.
     * @param {boolean} isVisible - Whether the panel is now visible.
     */
    onVisibilityChange(isVisible) {
        // Optional: Subclasses can implement this.
    }
    
    /**
     * Called when the panel's state in the Redux store changes.
     * @param {object} newState - The new state object for this panel.
     */
    onStateChange(newState) {
        // Optional: Subclasses can implement this.
    }
}
