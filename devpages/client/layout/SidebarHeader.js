/**
 * SidebarHeader.js - Minimal sidebar header
 * Just shows panel count and basic info
 */

import { appStore } from '/client/appState.js';

export class SidebarHeader {
    constructor() {
        this.container = null;
        this.panelCountElement = null;
    }

    render(container) {
        this.container = container;
        
        container.innerHTML = `
            <div class="simple-sidebar-header">
                <div class="header-title">DevPages</div>
                <div class="panel-count">0 panels</div>
            </div>
        `;

        this.panelCountElement = container.querySelector('.panel-count');
        this.addStyles();
        this.updatePanelCount();
        
        // Subscribe to store changes
        this.subscribeToStore();
    }

    subscribeToStore() {
        if (!appStore) return;
        
        appStore.subscribe(() => {
            this.updatePanelCount();
        });
    }

    updatePanelCount() {
        if (!this.panelCountElement) return;
        
        try {
            const state = appStore.getState();
            const panels = state.panels?.panels || {};
            const visiblePanels = Object.values(panels).filter(p => p.isVisible);
            const totalPanels = Object.keys(panels).length;
            
            this.panelCountElement.textContent = `${visiblePanels.length}/${totalPanels} panels`;
        } catch (error) {
            this.panelCountElement.textContent = '0 panels';
        }
    }

    addStyles() {
        if (document.querySelector('style[data-simple-sidebar-header]')) return;
        
        const style = document.createElement('style');
        style.setAttribute('data-simple-sidebar-header', 'true');
        style.textContent = `
            .simple-sidebar-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: var(--color-bg-elevated, #ffffff);
                border-bottom: 1px solid var(--color-border, #e1e5e9);
                font-size: 14px;
            }
            
            .header-title {
                font-weight: 600;
                color: var(--color-text, #212529);
            }
            
            .panel-count {
                font-size: 12px;
                color: var(--color-text-secondary, #6c757d);
                font-weight: normal;
            }
        `;
        document.head.appendChild(style);
    }

    destroy() {
        // Cleanup if needed
    }
}
