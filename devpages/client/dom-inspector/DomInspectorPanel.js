/**
 * @file DomInspectorPanel.js
 * @description A wrapper for the DomInspector to integrate it with the new panel system.
 * REFACTORED to use the new PanelInterface.
 */
import { BasePanel } from '/client/panels/BasePanel.js';
import { DomInspector } from './DomInspector.js';

export class DomInspectorPanel extends BasePanel {
    constructor(options) {
        super(options);
        this.domInspector = new DomInspector();
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'dom-inspector-wrapper';
        return this.element;
    }

    onMount(container) {
        super.onMount(container);
        this.domInspector.container = this.element;
        this.domInspector.init(); // Initialize the original inspector logic
    }

    onUnmount() {
        super.onUnmount();
        this.domInspector.destroy();
    }

    onShow() {
        super.onShow();
        this.domInspector.show();
    }

    onHide() {
        super.onHide();
        this.domInspector.hide();
    }
}
