/**
 * @file DomInspectorSettingsPanel.js
 * @description A wrapper for the DomInspectorSettings to integrate it with the new panel system.
 * REFACTORED to use the new PanelInterface.
 */
import { BasePanel } from '/client/panels/BasePanel.js';
import { DomInspectorSettings } from './DomInspectorSettings.js';

export class DomInspectorSettingsPanel extends BasePanel {
    constructor(options) {
        super(options);
        this.domInspectorSettings = new DomInspectorSettings(options.domInspector);
    }

    render() {
        // The original settings class creates its own element.
        // We will just return that element here.
        this.element = this.domInspectorSettings.panel;
        return this.element;
    }

    onMount(container) {
        super.onMount(container);
        // The original settings panel appends itself to the body, so we don't need to do anything here.
    }

    onUnmount() {
        super.onUnmount();
        this.domInspectorSettings.destroy();
    }

    onShow() {
        super.onShow();
        this.domInspectorSettings.show();
    }

    onHide() {
        super.onHide();
        this.domInspectorSettings.hide();
    }
}
