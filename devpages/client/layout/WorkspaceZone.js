/**
 * WorkspaceZone.js
 * A component that manages the content of a workspace zone (e.g., left, main, right).
 * It is responsible for on-demand loading and rendering of panels within its zone.
 */
import { appStore } from '../appState.js';
import { panelStateService } from '../panels/PanelStateManager.js';

export class WorkspaceZone {
    constructor(zoneId) {
        this.zoneId = zoneId;
        this.container = document.getElementById(zoneId);
        this.loadedPanels = new Map(); // Keep track of loaded panel instances
    }

    initialize() {
        if (!this.container) {
            console.error(`[WorkspaceZone] Container element not found for zone: ${this.zoneId}`);
            return;
        }
        appStore.subscribe(() => this.render());
        this.render();
    }

    async render() {
        const visiblePanels = panelStateService.getVisiblePanels()
            .filter(p => p.config.defaultZone === this.zoneId);

        for (const panel of visiblePanels) {
            if (!this.loadedPanels.has(panel.id)) {
                await this.loadAndMountPanel(panel);
            }
        }

        // Optional: Add logic to unmount panels that are no longer visible
    }

    async loadAndMountPanel(panel) {
        try {
            const PanelClass = await panel.config.factory();
            const panelInstance = new PanelClass();
            
            // For now, let's just mount the panel directly into the zone
            // Later, we will introduce Docks here
            if (typeof panelInstance.mount === 'function') {
                panelInstance.mount(this.container);
            } else {
                this.container.appendChild(panelInstance.element);
            }

            this.loadedPanels.set(panel.id, panelInstance);
            console.log(`[WorkspaceZone] Panel ${panel.id} loaded and mounted in ${this.zoneId}`);
        } catch (error) {
            console.error(`[WorkspaceZone] Failed to load panel ${panel.id}:`, error);
        }
    }
}
