/**
 * @file client/settings/panels/html-render/HtmlRenderSettingsPanel.js
 * @description Panel for configuring HTML rendering settings.
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import { e } from '/components/elements.js';
import { appStore } from '/client/appState.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';

export class HtmlRenderSettingsPanel extends BasePanel {
    constructor(options) {
        super(options);
    }

    render() {
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.className = 'html-render-settings-panel';
        }
        
        this.element.innerHTML = `
            <div class="settings-section-content">
                <div class="setting-item">
                    <p>This panel will contain settings to control how .html files are rendered in the preview pane.</p>
                </div>
                <div class="setting-item">
                    <label for="html-render-mode">Render Mode:</label>
                    <select id="html-render-mode">
                        <option value="iframe" selected>Isolated Iframe</option>
                        <option value="sanitize">Sanitized Direct Render</option>
                    </select>
                    <p class="setting-description">
                        'Isolated Iframe' is recommended for security and style consistency. 'Sanitized' may be faster but can break complex pages.
                    </p>
                </div>
            </div>
        `;
        
        return this.element;
    }

    onMount(container) {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const select = this.element.querySelector('#html-render-mode');
        if (select) {
            select.addEventListener('change', (e) => {
                this.log(`HTML Render Mode changed to: ${e.target.value}`);
                // In a real implementation, this would dispatch an action to the app store.
            });
        }
    }

    static getRegistration() {
        return {
            id: 'html-render-settings-panel',
            title: 'HTML Rendering',
            component: HtmlRenderSettingsPanel,
            defaultCollapsed: true
        };
    }
}

// Register this panel with the registry
panelRegistry.register({
    id: 'html-render-settings',
    title: 'HTML Rendering',
    component: HtmlRenderSettingsPanel,
    defaultCollapsed: true
}); 