/**
 * @file client/panels/integrate-modern-panels.js
 * @description Integration script to connect modern panels to existing sidebar and keyboard shortcuts
 */

import { ModernBasePanel } from './ModernBasePanel.js';
import { ModernContextPanel } from './ModernContextPanel.js';
import { panelActions } from '/client/store/slices/panelSlice.js';
import { appStore } from '/client/appState.js';
import { panelRegistry } from './panelRegistry.js';

/**
 * Integration class to connect modern panels with existing systems
 */
export class ModernPanelIntegration {
    constructor() {
        this.modernPanels = new Map();
        this.keyboardShortcuts = new Map();
        this.sidebarContainer = null;
        this.initialized = false;
    }

    /**
     * Initialize the integration system
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('🔗 Initializing Modern Panel Integration...');

            // Find sidebar container
            this.findSidebarContainer();

            // Register modern panels with existing registry
            await this.registerModernPanels();

            // Set up keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Hook into existing panel renderer
            this.hookPanelRenderer();

            // Set up Redux integration
            this.setupReduxIntegration();

            this.initialized = true;
            console.log('✅ Modern Panel Integration initialized successfully!');

        } catch (error) {
            console.error('❌ Failed to initialize Modern Panel Integration:', error);
            throw error;
        }
    }

    /**
     * Find the sidebar container in the DOM
     */
    findSidebarContainer() {
        // Try multiple possible sidebar selectors
        const selectors = [
            '#workspace-sidebar',
            '.workspace-sidebar',
            '[data-zone="sidebar"]',
            '.sidebar-container',
            '#sidebar'
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) {
                this.sidebarContainer = container;
                console.log(`📍 Found sidebar container: ${selector}`);
                return;
            }
        }

        // Create sidebar container if not found
        this.createSidebarContainer();
    }

    /**
     * Create sidebar container if it doesn't exist
     */
    createSidebarContainer() {
        console.log('🏗️ Creating sidebar container...');
        
        const sidebar = document.createElement('div');
        sidebar.id = 'modern-panels-sidebar';
        sidebar.className = 'modern-panels-sidebar';
        sidebar.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 300px;
            height: 100vh;
            background: var(--sidebar-bg, #f8f9fa);
            border-right: 1px solid var(--sidebar-border, #e9ecef);
            overflow-y: auto;
            z-index: 1000;
            padding: 10px;
        `;

        document.body.appendChild(sidebar);
        this.sidebarContainer = sidebar;

        // Add toggle button
        this.createSidebarToggle();
    }

    /**
     * Create sidebar toggle button
     */
    createSidebarToggle() {
        const toggle = document.createElement('button');
        toggle.id = 'sidebar-toggle';
        toggle.innerHTML = '☰';
        toggle.style.cssText = `
            position: fixed;
            left: 10px;
            top: 10px;
            z-index: 1001;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 16px;
        `;

        toggle.addEventListener('click', () => {
            const sidebar = this.sidebarContainer;
            const isVisible = sidebar.style.display !== 'none';
            sidebar.style.display = isVisible ? 'none' : 'block';
            toggle.innerHTML = isVisible ? '☰' : '✕';
        });

        document.body.appendChild(toggle);
    }

    /**
     * Register modern panels with the existing panel registry
     */
    async registerModernPanels() {
        console.log('📝 Registering modern panels...');

        // Define modern panels to register
        const modernPanelConfigs = [
            {
                id: 'modern-context',
                title: '🔗 Modern Context',
                component: ModernContextPanel,
                shortcut: 'ctrl+shift+c',
                order: 1,
                visible: true
            },
            {
                id: 'modern-settings',
                title: '⚙️ Modern Settings',
                component: this.createModernSettingsPanel(),
                shortcut: 'ctrl+shift+s',
                order: 2,
                visible: true
            },
            {
                id: 'modern-debug',
                title: '🐛 Modern Debug',
                component: this.createModernDebugPanel(),
                shortcut: 'ctrl+shift+d',
                order: 3,
                visible: false
            }
        ];

        // Register each panel
        for (const config of modernPanelConfigs) {
            try {
                // Register with legacy panel registry
                panelRegistry.register({
                    id: config.id,
                    title: config.title,
                    component: config.component,
                    order: config.order
                });

                // Register with Redux store
                appStore.dispatch(panelActions.createPanel({
                    id: config.id,
                    title: config.title,
                    visible: config.visible,
                    collapsed: false,
                    order: config.order
                }));

                // Store modern panel reference
                this.modernPanels.set(config.id, {
                    config,
                    instance: null
                });

                // Register keyboard shortcut
                if (config.shortcut) {
                    this.keyboardShortcuts.set(config.shortcut, config.id);
                }

                console.log(`✅ Registered modern panel: ${config.id}`);

            } catch (error) {
                console.error(`❌ Failed to register panel ${config.id}:`, error);
            }
        }
    }

    /**
     * Create modern settings panel
     */
    createModernSettingsPanel() {
        return class ModernSettingsPanel extends ModernBasePanel {
            constructor(options) {
                super({
                    id: 'modern-settings',
                    title: '⚙️ Modern Settings',
                    collapsible: true,
                    ...options
                });
            }

            renderContent() {
                const content = document.createElement('div');
                content.innerHTML = `
                    <div style="padding: 16px;">
                        <h4>Modern Settings Panel</h4>
                        <div class="settings-group">
                            <h5>Panel System</h5>
                            <label>
                                <input type="checkbox" checked> Enable modern panels
                            </label>
                            <label>
                                <input type="checkbox" checked> Auto-collapse panels
                            </label>
                        </div>
                        <div class="settings-group">
                            <h5>Keyboard Shortcuts</h5>
                            <p><kbd>Ctrl+Shift+C</kbd> - Context Panel</p>
                            <p><kbd>Ctrl+Shift+S</kbd> - Settings Panel</p>
                            <p><kbd>Ctrl+Shift+D</kbd> - Debug Panel</p>
                        </div>
                    </div>
                `;
                return content;
            }
        };
    }

    /**
     * Create modern debug panel
     */
    createModernDebugPanel() {
        return class ModernDebugPanel extends ModernBasePanel {
            constructor(options) {
                super({
                    id: 'modern-debug',
                    title: '🐛 Modern Debug',
                    collapsible: true,
                    ...options
                });
            }

            renderContent() {
                const content = document.createElement('div');
                content.innerHTML = `
                    <div style="padding: 16px;">
                        <h4>Modern Debug Panel</h4>
                        <div class="debug-info">
                            <h5>Panel System Status</h5>
                            <p>Modern panels: <span id="modern-panel-count">0</span></p>
                            <p>Redux store: <span id="redux-status">Connected</span></p>
                            <p>Keyboard shortcuts: <span id="shortcut-count">0</span></p>
                        </div>
                        <div class="debug-actions">
                            <button onclick="window.modernPanelIntegration.debugInfo()">
                                Show Debug Info
                            </button>
                            <button onclick="window.modernPanelIntegration.refreshPanels()">
                                Refresh Panels
                            </button>
                        </div>
                    </div>
                `;

                // Update debug info
                setTimeout(() => {
                    const panelCount = content.querySelector('#modern-panel-count');
                    const shortcutCount = content.querySelector('#shortcut-count');
                    if (panelCount) panelCount.textContent = this.modernPanels.size;
                    if (shortcutCount) shortcutCount.textContent = this.keyboardShortcuts.size;
                }, 100);

                return content;
            }
        };
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        console.log('⌨️ Setting up keyboard shortcuts...');

        document.addEventListener('keydown', (event) => {
            // Build shortcut string
            const parts = [];
            if (event.ctrlKey || event.metaKey) parts.push('ctrl');
            if (event.shiftKey) parts.push('shift');
            if (event.altKey) parts.push('alt');
            parts.push(event.key.toLowerCase());

            const shortcut = parts.join('+');

            // Check if we have a handler for this shortcut
            if (this.keyboardShortcuts.has(shortcut)) {
                event.preventDefault();
                event.stopPropagation();

                const panelId = this.keyboardShortcuts.get(shortcut);
                this.togglePanel(panelId);

                console.log(`🎯 Triggered shortcut: ${shortcut} -> ${panelId}`);
            }
        });

        console.log(`✅ Registered ${this.keyboardShortcuts.size} keyboard shortcuts`);
    }

    /**
     * Hook into existing panel renderer
     */
    hookPanelRenderer() {
        console.log('🔗 Hooking into panel renderer...');

        // Override the existing panel renderer to include modern panels
        const originalRender = window.PanelRenderer?.prototype?.render;
        if (originalRender) {
            window.PanelRenderer.prototype.render = function() {
                // Call original render
                originalRender.call(this);

                // Add modern panels if this is the sidebar renderer
                if (this.group === 'sidebar') {
                    window.modernPanelIntegration.renderModernPanels(this.container);
                }
            };
        }
    }

    /**
     * Set up Redux integration
     */
    setupReduxIntegration() {
        console.log('🔄 Setting up Redux integration...');

        // Subscribe to Redux state changes
        appStore.subscribe(() => {
            const state = appStore.getState();
            const panelState = state.panels?.sidebarPanels || {};

            // Update modern panel visibility based on Redux state
            for (const [panelId, panelInfo] of this.modernPanels) {
                const reduxPanelState = panelState[panelId];
                if (reduxPanelState && panelInfo.instance) {
                    panelInfo.instance.setVisible(reduxPanelState.visible);
                }
            }
        });
    }

    /**
     * Render modern panels to sidebar
     */
    renderModernPanels(container) {
        if (!container) container = this.sidebarContainer;
        if (!container) return;

        console.log('🎨 Rendering modern panels to sidebar...');

        // Get visible panels from Redux state
        const state = appStore.getState();
        const panelState = state.panels?.sidebarPanels || {};

        // Render each modern panel
        for (const [panelId, panelInfo] of this.modernPanels) {
            const reduxState = panelState[panelId];
            if (reduxState && reduxState.visible) {
                this.renderPanel(panelId, container);
            }
        }
    }

    /**
     * Render a specific panel
     */
    async renderPanel(panelId, container) {
        const panelInfo = this.modernPanels.get(panelId);
        if (!panelInfo) return;

        try {
            // Create panel instance if it doesn't exist
            if (!panelInfo.instance) {
                const PanelClass = panelInfo.config.component;
                panelInfo.instance = new PanelClass();
                await panelInfo.instance.initialize();
            }

            // Render panel
            const panelElement = panelInfo.instance.render();
            container.appendChild(panelElement);

            // Mount panel
            await panelInfo.instance.onMount(panelElement);

            console.log(`✅ Rendered panel: ${panelId}`);

        } catch (error) {
            console.error(`❌ Failed to render panel ${panelId}:`, error);
        }
    }

    /**
     * Toggle panel visibility
     */
    togglePanel(panelId) {
        console.log(`🔄 Toggling panel: ${panelId}`);

        // Update Redux state
        const state = appStore.getState();
        const panelState = state.panels?.sidebarPanels?.[panelId];
        
        if (panelState) {
            appStore.dispatch(panelActions.updatePanel({
                id: panelId,
                visible: !panelState.visible
            }));
        }

        // Re-render panels
        this.refreshPanels();
    }

    /**
     * Refresh all panels
     */
    refreshPanels() {
        console.log('🔄 Refreshing panels...');
        
        if (this.sidebarContainer) {
            // Clear existing panels
            this.sidebarContainer.innerHTML = '';
            
            // Re-render modern panels
            this.renderModernPanels();
        }
    }

    /**
     * Show debug information
     */
    debugInfo() {
        console.log('🐛 Modern Panel Integration Debug Info:');
        console.log('=====================================');
        console.log(`Initialized: ${this.initialized}`);
        console.log(`Sidebar container:`, this.sidebarContainer);
        console.log(`Modern panels: ${this.modernPanels.size}`);
        console.log(`Keyboard shortcuts: ${this.keyboardShortcuts.size}`);
        
        console.log('\nRegistered panels:');
        for (const [id, info] of this.modernPanels) {
            console.log(`  - ${id}: ${info.instance ? 'instantiated' : 'not instantiated'}`);
        }
        
        console.log('\nKeyboard shortcuts:');
        for (const [shortcut, panelId] of this.keyboardShortcuts) {
            console.log(`  - ${shortcut} -> ${panelId}`);
        }

        // Show Redux state
        const state = appStore.getState();
        console.log('\nRedux panel state:', state.panels?.sidebarPanels);
    }
}

// Create and expose global instance
export const modernPanelIntegration = new ModernPanelIntegration();

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    window.modernPanelIntegration = modernPanelIntegration;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            modernPanelIntegration.initialize();
        });
    } else {
        modernPanelIntegration.initialize();
    }
}
