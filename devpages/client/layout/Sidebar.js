/**
 * Sidebar.js - Direct panel management without dock complexity
 * Panels can be nested, expanded/collapsed, and dragged out
 */

import { appStore } from '/client/appState.js';
import { SidebarHeader } from './SidebarHeader.js';
import { CLIPanel } from '../panels/CLIPanel.js';
import { BasePanel } from '../panels/BasePanel.js';

export class Sidebar {
    constructor() {
        this.container = null;
        this.header = new SidebarHeader();
        this.panels = new Map();
        this.panelOrder = [];
    }

    async initialize(container, panelCfgs) {
        this.container = container;
        
        // Load panels from config
        await this.loadPanels(panelCfgs);
        
        // Render the sidebar structure and panels
        this.render();

        // Expose API
        this.exposeAPI();
    }

    async loadPanels(panelCfgs) {
        for (const panelConfig of panelCfgs) {
            try {
                if (panelConfig.factory) {
                    const module = await panelConfig.factory();
                    const exportName = Object.keys(module)[0];
                    const PanelClass = module[exportName];
                    const panel = new PanelClass({ 
                        id: panelConfig.id, 
                        title: panelConfig.title, 
                        store: appStore 
                    });
                    this.registerPanel(panelConfig.id, panel);
                } else {
                    this.createPlaceholderPanel(panelConfig.id, panelConfig.title, `Panel ${panelConfig.id} has no factory.`);
                }
            } catch (error) {
                console.warn(`Failed to load panel ${panelConfig.id}:`, error);
                this.createPlaceholderPanel(panelConfig.id, panelConfig.title, `Error loading panel: ${error.message}`);
            }
        }
    }

    createPlaceholderPanel(panelId, title, description) {
        class PlaceholderPanel extends BasePanel {
            renderContent() {
                return `
                    <div style="padding: 16px; text-align: center; color: var(--color-text-secondary, #6c757d);">
                        <div style="font-size: 14px; margin-bottom: 8px;">${title}</div>
                        <div style="font-size: 12px;">${description}</div>
                    </div>
                `;
            }
        }
        
        const panel = new PlaceholderPanel({ id: panelId, title });
        this.registerPanel(panelId, panel);
    }

    registerPanel(panelId, panel) {
        this.panels.set(panelId, panel);
        
        if (!this.panelOrder.includes(panelId)) {
            this.panelOrder.push(panelId);
        }
        
        console.log(`[Sidebar] Registered panel: ${panelId}`);
    }

    render() {
        if (!this.container) {
            console.error('[Sidebar] Container not set. Cannot render.');
            return;
        }
        
        // Create sidebar structure
        this.container.innerHTML = `
            <div class="simple-sidebar-layout">
                <div class="simple-sidebar-header-container"></div>
                <div class="simple-sidebar-panels-container"></div>
            </div>
        `;
        
        // Render header
        const headerContainer = this.container.querySelector('.simple-sidebar-header-container');
        if (headerContainer) {
            this.header.render(headerContainer);
        }
        
        // Render panels
        this.renderPanels();
        
        // Add styles
        this.addStyles();
        
        console.log('[Sidebar] Rendered with', this.panels.size, 'panels');
    }

    renderPanels() {
        const panelsContainer = this.container?.querySelector('.simple-sidebar-panels-container');
        if (!panelsContainer) return;
        
        // Clear existing panels
        panelsContainer.innerHTML = '';
        
        // Render panels in order
        this.panelOrder.forEach(panelId => {
            const panel = this.panels.get(panelId);
            if (panel) {
                // Check if render returns an element or modifies its container
                const panelElement = panel.render();
                
                // If render returns an element, append it
                if (panelElement instanceof HTMLElement) {
                    panelsContainer.appendChild(panelElement);
                } 
                // If panel has a containerElement, append that
                else if (panel.containerElement instanceof HTMLElement) {
                    panelsContainer.appendChild(panel.containerElement);
                }
                
                // Call onMount if it exists
                if (typeof panel.onMount === 'function') {
                    panel.onMount(panel.containerElement || panelElement);
                }
            }
        });
    }

    togglePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel && panel.toggleCollapse) {
            panel.toggleCollapse();
        }
    }

    showPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.isCollapsed = false;
            this.renderPanels();
        }
    }

    hidePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            panel.isCollapsed = true;
            this.renderPanels();
        }
    }

    getPanel(panelId) {
        return this.panels.get(panelId);
    }

    listPanels() {
        return Array.from(this.panels.entries()).map(([id, panel]) => ({
            id,
            title: panel.title,
            visible: !panel.isCollapsed,
            floating: panel.isFloating
        }));
    }

    addStyles() {
        if (document.querySelector('style[data-simple-sidebar-styles]')) return;
        
        const style = document.createElement('style');
        style.setAttribute('data-simple-sidebar-styles', 'true');
        style.textContent = `
            .simple-sidebar-layout {
                display: flex;
                flex-direction: column;
                height: 100%;
                background: var(--color-bg, #ffffff);
            }
            
            .simple-sidebar-header-container {
                flex-shrink: 0;
            }
            
            .simple-sidebar-panels-container {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 8px;
            }
            
            .simple-sidebar-panels-container::-webkit-scrollbar {
                width: 6px;
            }
            
            .simple-sidebar-panels-container::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .simple-sidebar-panels-container::-webkit-scrollbar-thumb {
                background: var(--color-border, #e1e5e9);
                border-radius: 3px;
            }
            
            .simple-sidebar-panels-container::-webkit-scrollbar-thumb:hover {
                background: var(--color-text-secondary, #6c757d);
            }
        `;
        document.head.appendChild(style);
    }

    exposeAPI() {
        if (typeof window === 'undefined') return;
        
        window.APP = window.APP || {};
        window.APP.sidebar = {
            togglePanel: (panelId) => this.togglePanel(panelId),
            showPanel: (panelId) => this.showPanel(panelId),
            hidePanel: (panelId) => this.hidePanel(panelId),
            getPanel: (panelId) => this.getPanel(panelId),
            listPanels: () => this.listPanels(),
            getSystemInfo: () => ({
                architecture: 'SIMPLE_PANEL_MANAGER',
                version: '2.0',
                totalPanels: this.panels.size,
                panelOrder: [...this.panelOrder]
            })
        };
        
        console.log('[Sidebar] API exposed at window.APP.sidebar');
    }

    destroy() {
        // Clean up panels
        for (const panel of this.panels.values()) {
            if (panel.destroy) {
                panel.destroy();
            }
        }
        
        this.panels.clear();
        this.panelOrder = [];
        
        if (this.header?.destroy) {
            this.header.destroy();
        }
        
        console.log('[Sidebar] Destroyed');
    }
}
