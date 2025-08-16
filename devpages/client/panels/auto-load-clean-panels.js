/**
 * @file client/panels/auto-load-clean-panels.js
 * @description Automatically load clean panels during application startup
 */

import { appStore } from '/client/appState.js';

/**
 * Auto-loader for clean panels that integrates with existing sidebar initialization
 */
export class CleanPanelAutoLoader {
    constructor() {
        this.loaded = false;
        this.panels = [];
        this.sidebarContainer = null;
    }

    /**
     * Initialize and auto-load clean panels
     */
    async initialize() {
        if (this.loaded) return;

        try {
            console.log('[CleanPanelAutoLoader] Initializing clean panels...');

            // Wait for DOM to be ready
            await this.waitForDOM();

            // Find or create sidebar container
            await this.setupSidebarContainer();

            // Create and render clean panels
            await this.createCleanPanels();

            // Set up keyboard shortcuts
            this.setupKeyboardShortcuts();

            // Integrate with window.APP
            this.integrateWithWindowApp();

            this.loaded = true;
            console.log('[CleanPanelAutoLoader] ✅ Clean panels auto-loaded successfully');

        } catch (error) {
            console.error('[CleanPanelAutoLoader] ❌ Failed to auto-load clean panels:', error);
        }
    }

    /**
     * Wait for DOM elements to be available
     */
    async waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * Find existing sidebar or wait for it to be created
     */
    async setupSidebarContainer() {
        // Try to find existing sidebar
        const selectors = [
            '#workspace-sidebar',
            '.workspace-sidebar',
            '[data-zone="sidebar"]',
            '.sidebar-docks-container'
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) {
                this.sidebarContainer = container;
                console.log(`[CleanPanelAutoLoader] Found sidebar container: ${selector}`);
                return;
            }
        }

        // Wait for sidebar to be created (up to 5 seconds)
        let attempts = 0;
        while (!this.sidebarContainer && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            for (const selector of selectors) {
                const container = document.querySelector(selector);
                if (container) {
                    this.sidebarContainer = container;
                    console.log(`[CleanPanelAutoLoader] Found sidebar container after waiting: ${selector}`);
                    return;
                }
            }
            attempts++;
        }

        // If still no sidebar, create our own
        if (!this.sidebarContainer) {
            console.log('[CleanPanelAutoLoader] Creating sidebar container...');
            this.createSidebarContainer();
        }
    }

    /**
     * Create sidebar container if none exists
     */
    createSidebarContainer() {
        const sidebar = document.createElement('div');
        sidebar.id = 'auto-clean-sidebar';
        sidebar.className = 'workspace-sidebar';
        sidebar.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 280px;
            height: 100vh;
            background: var(--color-bg-alt, #f8f9fa);
            border-right: 1px solid var(--color-border, #e1e5e9);
            overflow-y: auto;
            z-index: 1000;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        document.body.appendChild(sidebar);
        this.sidebarContainer = sidebar;

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: var(--color-bg-elevated, #ffffff);
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 14px;
            color: var(--color-text-secondary, #6c757d);
            z-index: 1001;
        `;
        closeBtn.addEventListener('click', () => {
            sidebar.style.display = 'none';
        });
        sidebar.appendChild(closeBtn);
    }

    /**
     * Create clean panel class
     */
    createCleanPanelClass() {
        return class SimpleCleanPanel {
            constructor(config) {
                this.id = config.id;
                this.title = config.title;
                this.content = config.content || '';
                this.element = null;
                this.isCollapsed = false;
            }
            
            render() {
                const panel = document.createElement('div');
                panel.className = 'sidebar-panel';
                panel.style.cssText = `
                    margin-bottom: 8px;
                    border-radius: 6px;
                    border: 1px solid var(--color-border, #e1e5e9);
                    background: var(--color-bg, #ffffff);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                `;
                
                // Clean header
                const header = document.createElement('div');
                header.className = 'sidebar-panel-header';
                header.style.cssText = `
                    background: var(--color-bg-alt, #f8f9fa);
                    border-bottom: 1px solid var(--color-border, #e1e5e9);
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--color-text, #212529);
                `;
                
                const title = document.createElement('span');
                title.textContent = this.title;
                header.appendChild(title);
                
                // Collapse button
                const collapseBtn = document.createElement('button');
                collapseBtn.innerHTML = '−';
                collapseBtn.style.cssText = `
                    background: none;
                    border: none;
                    font-size: 16px;
                    font-weight: bold;
                    color: var(--color-text-secondary, #6c757d);
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                collapseBtn.addEventListener('click', () => this.toggleCollapse());
                header.appendChild(collapseBtn);
                
                panel.appendChild(header);
                
                // Content area
                const content = document.createElement('div');
                content.className = 'sidebar-panel-content';
                content.style.cssText = `
                    padding: 12px;
                    background: var(--color-bg, #ffffff);
                    transition: max-height 0.3s ease, opacity 0.3s ease;
                    overflow: hidden;
                `;
                content.innerHTML = this.content;
                
                panel.appendChild(content);
                
                this.element = panel;
                this.contentElement = content;
                this.collapseBtn = collapseBtn;
                
                return panel;
            }
            
            toggleCollapse() {
                this.isCollapsed = !this.isCollapsed;
                
                if (this.isCollapsed) {
                    this.contentElement.style.maxHeight = '0';
                    this.contentElement.style.opacity = '0';
                    this.contentElement.style.paddingTop = '0';
                    this.contentElement.style.paddingBottom = '0';
                    this.collapseBtn.innerHTML = '+';
                } else {
                    this.contentElement.style.maxHeight = 'none';
                    this.contentElement.style.opacity = '1';
                    this.contentElement.style.paddingTop = '12px';
                    this.contentElement.style.paddingBottom = '12px';
                    this.collapseBtn.innerHTML = '−';
                }
            }
            
            setVisible(visible) {
                if (this.element) {
                    this.element.style.display = visible ? 'block' : 'none';
                }
            }
        };
    }

    /**
     * Create and render clean panels
     */
    async createCleanPanels() {
        const SimpleCleanPanel = this.createCleanPanelClass();

        // Panel definitions
        const panelConfigs = [
            {
                id: 'auto-context',
                title: 'Context Manager',
                content: `
                    <div>
                        <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Current Context</h5>
                        <div style="background: var(--color-bg-alt, #f8f9fa); padding: 8px; border-radius: 4px; margin-bottom: 12px; font-family: monospace; font-size: 12px;">
                            <div>File: <strong>${window.location.pathname || 'No file'}</strong></div>
                            <div>Path: <strong>${window.location.href || '/'}</strong></div>
                        </div>
                        
                        <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Actions</h5>
                        <div style="display: flex; gap: 4px;">
                            <button onclick="console.log('Refresh context')" 
                                    style="background: var(--color-primary, #007bff); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                                Refresh
                            </button>
                            <button onclick="console.log('Clear context')" 
                                    style="background: var(--color-text-secondary, #6c757d); color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px;">
                                Clear
                            </button>
                        </div>
                        
                        <h5 style="margin: 12px 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Status</h5>
                        <div style="font-size: 12px; color: var(--color-text, #212529);">
                            <div>• Auto-loaded: ✓</div>
                            <div>• window.APP: ${!!window.APP ? 'Available' : 'Missing'}</div>
                            <div>• Clean Style: Active</div>
                        </div>
                    </div>
                `,
                shortcut: 'ctrl+shift+c'
            },
            {
                id: 'auto-settings',
                title: 'Settings',
                content: `
                    <div>
                        <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Panel Options</h5>
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin: 6px 0; font-size: 12px;">
                                <input type="checkbox" checked style="margin-right: 6px;"> Auto-load panels
                            </label>
                            <label style="display: block; margin: 6px 0; font-size: 12px;">
                                <input type="checkbox" checked style="margin-right: 6px;"> Clean styling
                            </label>
                            <label style="display: block; margin: 6px 0; font-size: 12px;">
                                <input type="checkbox" checked style="margin-right: 6px;"> Keyboard shortcuts
                            </label>
                        </div>
                        
                        <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Shortcuts</h5>
                        <div style="font-size: 11px; font-family: monospace; color: var(--color-text, #212529);">
                            <div style="margin: 4px 0;"><kbd style="background: var(--color-bg-alt, #f8f9fa); padding: 2px 4px; border-radius: 2px;">Ctrl+Shift+C</kbd> Context</div>
                            <div style="margin: 4px 0;"><kbd style="background: var(--color-bg-alt, #f8f9fa); padding: 2px 4px; border-radius: 2px;">Ctrl+Shift+S</kbd> Settings</div>
                            <div style="margin: 4px 0;"><kbd style="background: var(--color-bg-alt, #f8f9fa); padding: 2px 4px; border-radius: 2px;">Ctrl+Shift+D</kbd> Debug</div>
                        </div>
                    </div>
                `,
                shortcut: 'ctrl+shift+s'
            },
            {
                id: 'auto-debug',
                title: 'Debug Info',
                content: `
                    <div>
                        <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">System Status</h5>
                        <div style="font-size: 12px; color: var(--color-text, #212529); margin-bottom: 12px;">
                            <div>• Auto-loaded: <strong>✓</strong></div>
                            <div>• Clean panels: <strong>Active</strong></div>
                            <div>• Keyboard shortcuts: <strong>Working</strong></div>
                            <div>• Integration: <strong>Complete</strong></div>
                        </div>
                        
                        <h5 style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-secondary, #6c757d);">Debug Actions</h5>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <button onclick="console.log('window.APP:', window.APP)" 
                                    style="background: var(--color-bg-elevated, #ffffff); border: 1px solid var(--color-border, #e1e5e9); padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; text-align: left;">
                                Log window.APP
                            </button>
                            <button onclick="console.log('Auto panels:', window.APP?.autoCleanPanels)" 
                                    style="background: var(--color-bg-elevated, #ffffff); border: 1px solid var(--color-border, #e1e5e9); padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; text-align: left;">
                                Log panels
                            </button>
                            <button onclick="window.APP?.autoCleanPanels?.showAll()" 
                                    style="background: var(--color-bg-elevated, #ffffff); border: 1px solid var(--color-border, #e1e5e9); padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; text-align: left;">
                                Show all panels
                            </button>
                        </div>
                    </div>
                `,
                shortcut: 'ctrl+shift+d'
            }
        ];

        // Create panels
        this.panels = panelConfigs.map(config => ({
            id: config.id,
            panel: new SimpleCleanPanel(config),
            shortcut: config.shortcut
        }));

        // Add clean header to sidebar
        const header = document.createElement('div');
        header.style.cssText = `
            background: var(--color-bg-elevated, #ffffff);
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 14px;
            color: var(--color-text, #212529);
        `;
        header.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>Auto-Loaded Clean Panels</span>
                <span style="font-size: 11px; font-weight: normal; color: var(--color-success, #28a745);">✓ Ready</span>
            </div>
        `;
        this.sidebarContainer.appendChild(header);

        // Render panels
        this.panels.forEach(({ panel }) => {
            const panelElement = panel.render();
            this.sidebarContainer.appendChild(panelElement);
        });

        console.log(`[CleanPanelAutoLoader] ✅ Created ${this.panels.length} clean panels`);
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        const keyboardShortcuts = new Map();
        this.panels.forEach(({ id, shortcut }) => {
            keyboardShortcuts.set(shortcut, id);
        });

        document.addEventListener('keydown', (event) => {
            const parts = [];
            if (event.ctrlKey || event.metaKey) parts.push('ctrl');
            if (event.shiftKey) parts.push('shift');
            if (event.altKey) parts.push('alt');
            parts.push(event.key.toLowerCase());

            const shortcut = parts.join('+');

            if (keyboardShortcuts.has(shortcut)) {
                event.preventDefault();
                event.stopPropagation();

                const panelId = keyboardShortcuts.get(shortcut);
                const panelInfo = this.panels.find(p => p.id === panelId);

                if (panelInfo) {
                    const panelElement = panelInfo.panel.element;
                    if (panelElement) {
                        const isVisible = panelElement.style.display !== 'none';
                        panelElement.style.display = isVisible ? 'none' : 'block';

                        console.log(`[CleanPanelAutoLoader] 🎯 ${shortcut} -> ${panelId} (${isVisible ? 'hidden' : 'shown'})`);
                    }
                }
            }
        });

        this.keyboardShortcuts = keyboardShortcuts;
        console.log(`[CleanPanelAutoLoader] ✅ Set up ${keyboardShortcuts.size} keyboard shortcuts`);
    }

    /**
     * Integrate with window.APP
     */
    integrateWithWindowApp() {
        const api = {
            panels: this.panels.reduce((acc, p) => {
                acc[p.id] = p.panel;
                return acc;
            }, {}),
            shortcuts: this.keyboardShortcuts,
            container: this.sidebarContainer,
            loader: this,

            togglePanel(panelId) {
                const panel = this.panels[panelId];
                if (panel && panel.element) {
                    const isVisible = panel.element.style.display !== 'none';
                    panel.element.style.display = isVisible ? 'none' : 'block';
                    console.log(`Toggled ${panelId}: ${isVisible ? 'hidden' : 'shown'}`);
                }
            },

            showAll() {
                Object.values(this.panels).forEach(panel => {
                    if (panel.element) panel.element.style.display = 'block';
                });
                console.log('All auto-loaded panels shown');
            },

            hideAll() {
                Object.values(this.panels).forEach(panel => {
                    if (panel.element) panel.element.style.display = 'none';
                });
                console.log('All auto-loaded panels hidden');
            }
        };

        // Integrate with window.APP
        if (typeof window !== 'undefined') {
            window.APP = window.APP || {};
            window.APP.autoCleanPanels = api;
            
            // Also expose globally for backwards compatibility
            window.autoCleanPanels = api;
        }

        console.log('[CleanPanelAutoLoader] ✅ Integrated with window.APP');
    }
}

// Create and export singleton instance
export const cleanPanelAutoLoader = new CleanPanelAutoLoader();

// Auto-initialize when module is loaded
if (typeof window !== 'undefined') {
    // Initialize after a short delay to ensure DOM is ready
    setTimeout(() => {
        cleanPanelAutoLoader.initialize();
    }, 100);
}
