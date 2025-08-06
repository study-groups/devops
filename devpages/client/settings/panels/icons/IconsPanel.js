/**
 * @file IconsPanel.js
 * @description A wrapper for the Icons logic to integrate it with the new panel system.
 * REFACTORED to use the new PanelInterface.
 */
import { BasePanel } from '/client/panels/BasePanel.js';
import { Icons } from './Icons.js';

export class IconsPanel extends BasePanel {
    constructor(options) {
        super(options);
        this.icons = null;
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'icons-panel-wrapper';
        return this.element;
    }

    onMount(container) {
        super.onMount(container);
        this.icons = new Icons(this.element);
    }

    onUnmount() {
        super.onUnmount();
        if (this.icons) {
            this.icons.destroy();
            this.icons = null;
        }
    }
    
    onStateChange(state) {
        if (this.icons) {
            this.icons.handleStateChange(state);
        }
    }
}
