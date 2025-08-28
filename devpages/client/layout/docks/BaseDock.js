/**
 * BaseDock.js - Simple, working dock component
 * Restored and simplified from the original working system
 */
import { appStore } from '/client/appState.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';

export class BaseDock {
    constructor(dockId) {
        this.dockId = dockId;
        this.container = null;
        this.panelInstances = new Map();
        this.isExpanded = true;

        this.state = this.getDockState();
        this.storeUnsubscribe = appStore.subscribe(this.handleStateChange.bind(this));
    }

    getDockState() {
        const state = appStore.getState();
        return state.panels?.docks?.[this.dockId] || { panels: [], title: this.dockId };
    }

    handleStateChange() {
        const newState = this.getDockState();
        if (JSON.stringify(this.state) !== JSON.stringify(newState)) {
            this.state = newState;
            this.renderPanels();
        }
    }

    async initialize(container) {
        if (!container) {
            console.error(`[BaseDock] No container provided for dock ${this.dockId}`);
            return;
        }
        
        this.container = container;
        this.container.innerHTML = `
            <div class="base-dock" id="${this.dockId}">
                <div class="dock-header">
                    <h3 class="dock-title">${this.state.title || this.dockId}</h3>
                    <div class="dock-controls">
                        <span class="panel-count">0 panels</span>
                        <button class="toggle-expand-btn">▼</button>
                    </div>
                </div>
                <div class="dock-panels-container"></div>
            </div>
        `;

        this.addStyles();
        this.attachEventListeners();
        await this.renderPanels();
    }

    async renderPanels() {
        if (!this.container) return;

        const panelsContainer = this.container.querySelector('.dock-panels-container');
        if (!panelsContainer) return;
        
        panelsContainer.style.display = this.isExpanded ? 'block' : 'none';
        
        const panelIds = this.state.panels || [];
        const panelCountEl = this.container.querySelector('.panel-count');
        if (panelCountEl) {
            panelCountEl.textContent = `${panelIds.length} panels`;
        }

        // Clear existing panels
        panelsContainer.innerHTML = '';
        this.panelInstances.clear();

        // Render each panel
        for (const panelId of panelIds) {
            const panelConfig = panelRegistry.getPanel(panelId);
            if (panelConfig && panelConfig.factory) {
                try {
                    const module = await panelConfig.factory();
                    const PanelClass = module.default || module;
                    const panelInstance = new PanelClass({ id: panelId, store: appStore });
                    this.panelInstances.set(panelId, panelInstance);

                    const panelEl = panelInstance.render();
                    if (panelEl) {
                        panelsContainer.appendChild(panelEl);
                        
                        // Call onMount if it exists
                        if (typeof panelInstance.onMount === 'function') {
                            panelInstance.onMount(panelEl);
                        }
                    }
                } catch (e) {
                    console.error(`Failed to load panel ${panelId}`, e);
                    
                    // Show error in UI
                    const errorEl = document.createElement('div');
                    errorEl.className = 'panel panel-error';
                    errorEl.innerHTML = `
                        <div class="panel-header">
                            <h3 class="panel-title">Error: ${panelId}</h3>
                        </div>
                        <div class="panel-content">
                            <p>Failed to load panel: ${e.message}</p>
                        </div>
                    `;
                    panelsContainer.appendChild(errorEl);
                }
            }
        }
    }

    toggleExpand() {
        this.isExpanded = !this.isExpanded;
        const panelsContainer = this.container.querySelector('.dock-panels-container');
        const toggleBtn = this.container.querySelector('.toggle-expand-btn');
        
        if (panelsContainer) {
            panelsContainer.style.display = this.isExpanded ? 'block' : 'none';
        }
        if (toggleBtn) {
            toggleBtn.textContent = this.isExpanded ? '▼' : '▶';
        }
    }

    attachEventListeners() {
        const header = this.container.querySelector('.dock-header');
        if (header) {
            header.addEventListener('click', () => this.toggleExpand());
        }
    }

    addStyles() {
        const styleId = 'base-dock-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .base-dock {
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 4px;
                margin-bottom: 8px;
                background: var(--color-bg, #ffffff);
            }
            .dock-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: var(--color-bg-alt, #f8f9fa);
                cursor: pointer;
                border-bottom: 1px solid var(--color-border, #e1e5e9);
            }
            .dock-title {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
            }
            .dock-controls {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                color: var(--color-fg-muted, #6c757d);
            }
            .toggle-expand-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 12px;
            }
            .dock-panels-container {
                padding: 8px;
            }
            .panel-error {
                background: #fff5f5;
                border-color: #fed7d7;
            }
            .panel-error .panel-title {
                color: #e53e3e;
            }
        `;
        document.head.appendChild(style);
    }

    destroy() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
        
        // Clean up panel instances
        for (const panelInstance of this.panelInstances.values()) {
            if (typeof panelInstance.onUnmount === 'function') {
                panelInstance.onUnmount();
            }
            if (typeof panelInstance.destroy === 'function') {
                panelInstance.destroy();
            }
        }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}