/**
 * client/settings/panels/html-render/HtmlRenderSettingsPanel.js
 * Panel for configuring HTML rendering settings.
 */

import { settingsSectionRegistry } from '../../core/settingsSectionRegistry.js';

class HtmlRenderSettingsPanel {
    constructor(container) {
        this.container = container;
        this.id = 'html-render-settings-panel';
        
        // Render immediately upon construction
        this.render();
    }

    render() {
        this.container.innerHTML = `
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

        this.setupEventListeners();
    }

    setupEventListeners() {
        const select = this.container.querySelector('#html-render-mode');
        select.addEventListener('change', (e) => {
            console.log(`HTML Render Mode changed to: ${e.target.value}`);
            // In a real implementation, this would dispatch an action to the app store.
        });
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

// Self-register the panel with the settings registry
settingsSectionRegistry.register(HtmlRenderSettingsPanel.getRegistration()); 