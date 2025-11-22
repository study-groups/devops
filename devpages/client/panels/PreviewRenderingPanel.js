/**
 * PreviewRenderingPanel.js
 *
 * Panel for controlling preview rendering features including plugins like
 * Mermaid, KaTeX, SVG, and syntax highlighting.
 */

import { BasePanel, panelRegistry } from './BasePanel.js';
import { appStore } from '/client/appState.js';
import { updatePluginSettings, setPluginEnabled, registerPlugin } from '/client/store/slices/pluginSlice.js';
import { getIsPluginEnabled } from '/client/store/selectors.js';

const log = window.APP?.services?.log?.createLogger('PreviewRenderingPanel');

export class PreviewRenderingPanel extends BasePanel {
    constructor(options = {}) {
        super({
            id: 'preview-rendering',
            title: 'Preview & Rendering',
            category: 'settings',
            description: 'Control preview rendering features and plugins',
            width: 450,
            height: 600,
            ...options
        });

        this.unsubscribe = null;
        log?.info('PANEL', 'INITIALIZED', 'Preview Rendering Panel created');
    }

    /**
     * Override renderContent to provide initial panel content
     * This is called by BasePanel.createElement() during mount
     */
    renderContent() {
        const state = appStore.getState();
        const plugins = state.plugins?.plugins || {};

        return `
            <div class="preview-rendering-panel">
                ${this.renderPluginsSection(plugins)}
                ${this.renderMermaidSettings(plugins.mermaid)}
                ${this.renderKaTeXSettings(plugins.katex)}
                ${this.renderSVGSettings(plugins.svg)}
                ${this.renderActions()}
            </div>
        `;
    }

    /**
     * Mount the panel and subscribe to Redux state changes
     */
    mount(container) {
        super.mount(container);

        // Subscribe to plugin state changes
        this.unsubscribe = appStore.subscribe(() => {
            this.render();
        });

        // Attach event listeners after initial render
        this.attachEventListeners();

        return this;
    }

    /**
     * Update render method - refreshes the panel content
     */
    render() {
        const state = appStore.getState();
        const plugins = state.plugins?.plugins || {};

        const content = `
            <div class="preview-rendering-panel">
                ${this.renderPluginsSection(plugins)}
                ${this.renderMermaidSettings(plugins.mermaid)}
                ${this.renderKaTeXSettings(plugins.katex)}
                ${this.renderSVGSettings(plugins.svg)}
                ${this.renderActions()}
            </div>
        `;

        // Update panel body content
        const panelBody = this.element?.querySelector('.panel-body');
        if (panelBody) {
            panelBody.innerHTML = content;
            this.attachEventListeners();
        }

        return this;
    }

    /**
     * Render the plugins toggle section
     */
    renderPluginsSection(plugins) {
        const pluginsList = [
            { id: 'mermaid', label: 'Mermaid Diagrams', icon: '📊' },
            { id: 'katex', label: 'KaTeX Math', icon: '∑' },
            { id: 'highlight', label: 'Syntax Highlighting', icon: '🎨' },
            { id: 'graphviz', label: 'Graphviz Graphs', icon: '🔷' },
            { id: 'svg', label: 'SVG Rendering', icon: '🖼️' }
        ];

        return `
            <section class="plugins-section">
                <h4 class="section-title">Plugins</h4>
                <div class="plugins-list">
                    ${pluginsList.map(plugin => `
                        <label class="plugin-toggle">
                            <input
                                type="checkbox"
                                id="plugin-${plugin.id}"
                                data-plugin-id="${plugin.id}"
                                ${plugins[plugin.id]?.enabled !== false ? 'checked' : ''}
                            />
                            <span class="plugin-icon">${plugin.icon}</span>
                            <span class="plugin-label">${plugin.label}</span>
                        </label>
                    `).join('')}
                </div>
            </section>
        `;
    }

    /**
     * Render Mermaid-specific settings
     */
    renderMermaidSettings(mermaidPlugin) {
        if (!mermaidPlugin || mermaidPlugin.enabled === false) {
            return '';
        }

        const settings = mermaidPlugin.settings || {};
        const theme = settings.theme || 'default';
        const zoomEnabled = settings.zoomEnabled !== false;
        const panEnabled = settings.panEnabled !== false;
        const resizeEnabled = settings.resizeEnabled !== false;
        const defaultWidth = settings.defaultWidth || 800;
        const defaultHeight = settings.defaultHeight || 600;

        return `
            <section class="plugin-settings mermaid-settings">
                <h4 class="section-title">Mermaid Settings</h4>

                <div class="setting-group">
                    <label class="setting-label">Theme</label>
                    <select id="mermaid-theme" class="setting-select" data-plugin-id="mermaid" data-setting="theme">
                        <option value="default" ${theme === 'default' ? 'selected' : ''}>Default</option>
                        <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark</option>
                        <option value="forest" ${theme === 'forest' ? 'selected' : ''}>Forest</option>
                        <option value="neutral" ${theme === 'neutral' ? 'selected' : ''}>Neutral</option>
                    </select>
                </div>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input
                            type="checkbox"
                            id="mermaid-zoom"
                            data-plugin-id="mermaid"
                            data-setting="zoomEnabled"
                            ${zoomEnabled ? 'checked' : ''}
                        />
                        <span>Enable zoom controls (Ctrl+Scroll)</span>
                    </label>
                </div>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input
                            type="checkbox"
                            id="mermaid-pan"
                            data-plugin-id="mermaid"
                            data-setting="panEnabled"
                            ${panEnabled ? 'checked' : ''}
                        />
                        <span>Enable pan (click & drag)</span>
                    </label>
                </div>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input
                            type="checkbox"
                            id="mermaid-resize"
                            data-plugin-id="mermaid"
                            data-setting="resizeEnabled"
                            ${resizeEnabled ? 'checked' : ''}
                        />
                        <span>Enable resize handles</span>
                    </label>
                </div>

                <div class="setting-group">
                    <label class="setting-label">Default size</label>
                    <div class="size-inputs">
                        <input
                            type="number"
                            id="mermaid-width"
                            data-plugin-id="mermaid"
                            data-setting="defaultWidth"
                            value="${defaultWidth}"
                            min="300"
                            max="2000"
                            step="100"
                            class="size-input"
                        />
                        <span>×</span>
                        <input
                            type="number"
                            id="mermaid-height"
                            data-plugin-id="mermaid"
                            data-setting="defaultHeight"
                            value="${defaultHeight}"
                            min="200"
                            max="1500"
                            step="100"
                            class="size-input"
                        />
                        <span>px</span>
                    </div>
                </div>
            </section>
        `;
    }

    /**
     * Render KaTeX-specific settings
     */
    renderKaTeXSettings(katexPlugin) {
        if (!katexPlugin || katexPlugin.enabled === false) {
            return '';
        }

        const settings = katexPlugin.settings || {};
        const displayMode = settings.displayMode || false;
        const trust = settings.trust !== false;
        const strict = settings.strict || false;

        return `
            <section class="plugin-settings katex-settings">
                <h4 class="section-title">KaTeX Settings</h4>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input
                            type="checkbox"
                            id="katex-display-mode"
                            data-plugin-id="katex"
                            data-setting="displayMode"
                            ${displayMode ? 'checked' : ''}
                        />
                        <span>Display mode default</span>
                    </label>
                    <small class="setting-help">Use block-level equations by default</small>
                </div>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input
                            type="checkbox"
                            id="katex-trust"
                            data-plugin-id="katex"
                            data-setting="trust"
                            ${trust ? 'checked' : ''}
                        />
                        <span>Trust inline commands</span>
                    </label>
                    <small class="setting-help">Allow \\includegraphics, \\href, etc.</small>
                </div>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input
                            type="checkbox"
                            id="katex-strict"
                            data-plugin-id="katex"
                            data-setting="strict"
                            ${strict ? 'checked' : ''}
                        />
                        <span>Strict mode</span>
                    </label>
                    <small class="setting-help">Throw errors on unsupported commands</small>
                </div>
            </section>
        `;
    }

    /**
     * Render SVG-specific settings
     */
    renderSVGSettings(svgPlugin) {
        const enabled = svgPlugin?.enabled !== false;
        if (!enabled) {
            return '';
        }

        const settings = svgPlugin?.settings || {};
        const inlineEnabled = settings.inlineEnabled !== false;
        const sanitize = settings.sanitize !== false;
        const maxSize = settings.maxSize || 2;

        return `
            <section class="plugin-settings svg-settings">
                <h4 class="section-title">SVG Settings</h4>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input
                            type="checkbox"
                            id="svg-inline"
                            data-plugin-id="svg"
                            data-setting="inlineEnabled"
                            ${inlineEnabled ? 'checked' : ''}
                        />
                        <span>Allow inline SVG rendering</span>
                    </label>
                    <small class="setting-help">Render SVG code blocks as inline graphics</small>
                </div>

                <div class="setting-group">
                    <label class="setting-checkbox">
                        <input
                            type="checkbox"
                            id="svg-sanitize"
                            data-plugin-id="svg"
                            data-setting="sanitize"
                            ${sanitize ? 'checked' : ''}
                        />
                        <span>Sanitize SVG content</span>
                    </label>
                    <small class="setting-help">Remove potentially harmful SVG elements</small>
                </div>

                <div class="setting-group">
                    <label class="setting-label">Max SVG size (MB)</label>
                    <input
                        type="number"
                        id="svg-max-size"
                        data-plugin-id="svg"
                        data-setting="maxSize"
                        value="${maxSize}"
                        min="0.5"
                        max="10"
                        step="0.5"
                        class="setting-input"
                    />
                </div>
            </section>
        `;
    }

    /**
     * Render action buttons
     */
    renderActions() {
        return `
            <section class="preview-rendering-actions">
                <h4 class="section-title">Test & Actions</h4>

                <div class="action-buttons">
                    <button class="btn btn-secondary" id="action-refresh-preview">
                        🔄 Refresh Preview
                    </button>

                    <button class="btn btn-secondary" id="action-test-mermaid">
                        📊 Test Mermaid
                    </button>

                    <button class="btn btn-secondary" id="action-test-katex">
                        ∑ Test KaTeX
                    </button>

                    <button class="btn btn-ghost" id="action-reset-settings">
                        ↺ Reset to Defaults
                    </button>
                </div>
            </section>
        `;
    }

    /**
     * Attach event listeners to interactive elements
     */
    attachEventListeners() {
        const panelElement = this.element;
        if (!panelElement) return;

        // Plugin toggle checkboxes
        panelElement.querySelectorAll('[data-plugin-id]').forEach(input => {
            const pluginId = input.dataset.pluginId;
            const setting = input.dataset.setting;

            input.addEventListener('change', (e) => {
                this.handleSettingChange(pluginId, setting, e.target);
            });
        });

        // Action buttons
        const refreshBtn = panelElement.querySelector('#action-refresh-preview');
        const testMermaidBtn = panelElement.querySelector('#action-test-mermaid');
        const testKaTeXBtn = panelElement.querySelector('#action-test-katex');
        const resetBtn = panelElement.querySelector('#action-reset-settings');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshPreview());
        }
        if (testMermaidBtn) {
            testMermaidBtn.addEventListener('click', () => this.testMermaid());
        }
        if (testKaTeXBtn) {
            testKaTeXBtn.addEventListener('click', () => this.testKaTeX());
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }
    }

    /**
     * Handle settings changes
     */
    handleSettingChange(pluginId, setting, inputElement) {
        let value;

        if (inputElement.type === 'checkbox') {
            value = inputElement.checked;
        } else if (inputElement.type === 'number') {
            value = parseFloat(inputElement.value);
        } else {
            value = inputElement.value;
        }

        // For plugin enable/disable (no setting attribute means it's the main toggle)
        if (!setting) {
            log?.info('PLUGIN', 'TOGGLE', `Plugin ${pluginId} ${value ? 'enabled' : 'disabled'}`);
            appStore.dispatch(setPluginEnabled({
                pluginId,
                enabled: value
            }));
        } else {
            log?.info('PLUGIN', 'SETTING_CHANGE', `${pluginId}.${setting} = ${value}`);
            appStore.dispatch(updatePluginSettings({
                pluginId,
                settings: { [setting]: value }
            }));
        }

        // Refresh preview after settings change
        this.refreshPreview();
    }

    /**
     * Refresh the preview
     */
    refreshPreview() {
        const event = new CustomEvent('preview:refresh');
        window.dispatchEvent(event);
        log?.info('PANEL', 'REFRESH', 'Preview refresh requested');
    }

    /**
     * Insert test Mermaid diagram
     */
    testMermaid() {
        const testDiagram = `graph TD
    A[Start] --> B[Process]
    B --> C{Decision}
    C -->|Yes| D[Success]
    C -->|No| E[Retry]
    E --> B`;

        this.insertTestContent(`\`\`\`mermaid\n${testDiagram}\n\`\`\`\n`);
        log?.info('PANEL', 'TEST_MERMAID', 'Test Mermaid diagram inserted');
    }

    /**
     * Insert test KaTeX equation
     */
    testKaTeX() {
        const testEquation = `$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

Inline: $E = mc^2$`;

        this.insertTestContent(`\n${testEquation}\n`);
        log?.info('PANEL', 'TEST_KATEX', 'Test KaTeX equation inserted');
    }

    /**
     * Insert test content into editor
     */
    insertTestContent(content) {
        // Dispatch event for editor to handle
        const event = new CustomEvent('editor:insert', { detail: { content } });
        window.dispatchEvent(event);
    }

    /**
     * Reset all settings to defaults
     */
    resetSettings() {
        const defaultSettings = {
            mermaid: {
                enabled: true,
                settings: {
                    theme: 'default',
                    zoomEnabled: true,
                    panEnabled: true,
                    resizeEnabled: true,
                    defaultWidth: 800,
                    defaultHeight: 600
                }
            },
            katex: {
                enabled: true,
                settings: {
                    displayMode: false,
                    trust: true,
                    strict: false
                }
            },
            svg: {
                enabled: true,
                settings: {
                    inlineEnabled: true,
                    sanitize: true,
                    maxSize: 2
                }
            },
            highlight: {
                enabled: true,
                settings: {}
            },
            graphviz: {
                enabled: true,
                settings: {}
            }
        };

        Object.entries(defaultSettings).forEach(([pluginId, config]) => {
            appStore.dispatch(setPluginEnabled({
                pluginId,
                enabled: config.enabled
            }));
            appStore.dispatch(updatePluginSettings({
                pluginId,
                settings: config.settings
            }));
        });

        this.render();
        this.refreshPreview();
        log?.info('PANEL', 'RESET', 'All settings reset to defaults');
    }

    /**
     * Cleanup when panel is destroyed
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        super.destroy();
        log?.info('PANEL', 'DESTROYED', 'Preview Rendering Panel destroyed');
    }
}

// Register the panel type
panelRegistry.registerType('preview-rendering', PreviewRenderingPanel);

// Optional: Create a factory function for consistent panel creation
export function createPreviewRenderingPanel(config = {}) {
    return new PreviewRenderingPanel(config);
}

// Ensure the panel is available globally for debugging
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.panels = window.APP.panels || {};
    window.APP.panels.PreviewRenderingPanel = PreviewRenderingPanel;
}

console.log('[PreviewRenderingPanel] Module loaded and registered');
