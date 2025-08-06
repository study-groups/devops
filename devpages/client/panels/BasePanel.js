/**
 * @file client/panels/BasePanel.js
 * @description A new BasePanel that implements the PanelInterface and provides a standard set of functionalities for all panels.
 */

import { PanelInterface } from './PanelInterface.js';

export class BasePanel extends PanelInterface {
    constructor(options) {
        super(options);
        this.container = null;
    }

    /**
     * Renders the panel's UI and returns the root DOM element.
     * This method should create the panel's DOM structure.
     * @returns {HTMLElement} The root element of the panel.
     */
    render() {
        // Subclasses should override this method to provide their own UI.
        const div = document.createElement('div');
        div.innerHTML = `<h2>${this.id}</h2><p>This is a base panel. Subclasses should override the render() method.</p>`;
        this.element = div;
        return this.element;
    }

    /**
     * Called after the panel's element has been added to the DOM.
     * @param {HTMLElement} container - The DOM element the panel is mounted in.
     */
    onMount(container) {
        this.container = container;
        console.log(`Panel ${this.id} mounted in`, container);
    }

    /**
     * Called when the panel is about to be removed from the DOM.
     */
    onUnmount() {
        console.log(`Panel ${this.id} unmounted`);
        this.container = null;
    }

    /**
     * Called when the panel's visibility changes.
     * @param {boolean} isVisible - Whether the panel is now visible.
     */
    onVisibilityChange(isVisible) {
        if (this.element) {
            this.element.style.display = isVisible ? '' : 'none';
        }
    }
    
    /**
     * Called when the panel's state in the Redux store changes.
     * @param {object} newState - The new state object for this panel.
     */
    onStateChange(newState) {
        // Subclasses can override this to react to state changes.
    }
}
