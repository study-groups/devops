/**
 * client/layout/docks/LogsDock.js
 * A simple dock for displaying logging-related panels.
 */

import { BaseDock } from './BaseDock.js';

export class LogsDock extends BaseDock {
    constructor() {
        super('logs-dock', 'Logs', 'logs', false); // false = embedded dock
        this.isEmbedded = true;
        this.sidebarContainer = null;
    }

    async mount(sidebarContainer) {
        this.sidebarContainer = sidebarContainer;
        this.initialize();
    }

    createDockDOM() {
        if (!this.sidebarContainer) {
            throw new Error('LogsDock must be mounted in a sidebar container before creating DOM');
        }

        this.dockElement = document.createElement('div');
        this.dockElement.id = 'logs-dock';
        this.dockElement.className = 'embedded-dock logs-dock';
        
        this.headerElement = document.createElement('div');
        this.headerElement.className = 'embedded-dock-header logs-dock-header';
        this.headerElement.innerHTML = `
            <div class="dock-title">
                <span class="dock-icon">📋</span>
                <span class="dock-title-text">${this.title}</span>
            </div>
            <div class="dock-controls">
                <button class="dock-collapse-btn">▼</button>
            </div>
        `;

        this.contentElement = document.createElement('div');
        this.contentElement.className = 'embedded-dock-content';

        this.dockElement.appendChild(this.headerElement);
        this.dockElement.appendChild(this.contentElement);
        this.sidebarContainer.appendChild(this.dockElement);
    }

    attachEventListeners() {
        if (this.headerElement) {
            this.headerElement.addEventListener('click', () => this.toggleDockExpansion());
        }
    }

    toggleDockExpansion() {
        const isExpanded = !this.isCollapsed();
        this.updateDockState({ isCollapsed: isExpanded });
    }

    isCollapsed() {
        const state = this.getReduxState();
        return state ? state.isCollapsed : false;
    }

    updateDockState(updates) {
        dispatch(panelActions.updateDock({ dockId: this.dockId, ...updates }));
    }
}
