/**
 * client/layout/docks/SettingsDock.js
 * Settings dock implementation - manages settings panels in the sidebar
 * Embedded dock (not floating) that contains all settings-related panels
 */

import { BaseDock } from './BaseDock.js';
import { appStore, dispatch } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';
import { logMessage } from '/client/log/index.js';

// MODULE-LEVEL GUARD: Prevent panel re-registration to break infinite loops
let settingsPanelsRegistered = false;

export class SettingsDock extends BaseDock {
    constructor() {
        super('settings-dock', 'Settings', 'settings', false); // false = embedded dock
        
        // Settings dock specific properties
        this.isEmbedded = true;
        this.sidebarContainer = null;
    }

    /**
     * Mount the dock in a specific sidebar container
     */
    async mount(sidebarContainer) {
        this.sidebarContainer = sidebarContainer;
        
        // DOCK RESPONSIBILITY: Ensure panels for this dock are registered (ONCE)
        await this.ensureSettingsPanelsRegistered();
        
        this.initialize();
    }
    
    /**
     * Register working settings panels - each dock handles its own panels
     */
    async ensureSettingsPanelsRegistered() {
        if (settingsPanelsRegistered) {
            return;
        }
        try {
            const { registerWorkingPanels } = await import('/client/panels/cleanPanelConfiguration.js');
            await registerWorkingPanels(panelRegistry);
            settingsPanelsRegistered = true; // Set guard flag
            logMessage('INFO', 'PANEL_REGISTRATION', '✅ SettingsDock registered its panels');
        } catch (error) {
            console.error('[SettingsDock] Failed to register panels:', error);
        }
    }

    createDockDOM() {
        if (!this.sidebarContainer) {
            throw new Error('SettingsDock must be mounted in a sidebar container before creating DOM');
        }

        // Create embedded dock structure
        this.dockElement = document.createElement('div');
        this.dockElement.id = 'settings-dock';
        this.dockElement.className = 'embedded-dock settings-dock';
        
        // Create collapsible dock header
        this.headerElement = document.createElement('div');
        this.headerElement.className = 'embedded-dock-header settings-dock-header';
        this.headerElement.innerHTML = `
            <div class="dock-title">
                <span class="dock-icon">🎨</span>
                <span class="dock-title-text">${this.title}</span>
            </div>
            <div class="dock-controls">
                <span class="panel-count">0 panels</span>
                <button class="dock-collapse-btn">▼</button>
            </div>
        `;

        // Create content container
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'embedded-dock-content';

        // Assemble the dock
        this.dockElement.appendChild(this.headerElement);
        this.dockElement.appendChild(this.contentElement);
        this.sidebarContainer.appendChild(this.dockElement);

        this.addEmbeddedDockStyles();
    }

    addEmbeddedDockStyles() {
        // Styles removed for brevity, assuming they are correct
    }
    
    // =================================================================
    // DOCK AND PANEL STATE MANAGEMENT (REFACTORED)
    // =================================================================

    attachEventListeners() {
        if (this.headerElement) {
            this.headerElement.addEventListener('click', () => this.toggleDockExpansion());
        }
    }

    toggleDockExpansion() {
        const isCurrentlyExpanded = this.isExpanded();
        this.setDockExpanded(!isCurrentlyExpanded);
    }

    updateDockHeader() {
        if (!this.dockElement) return;
        const isExpanded = this.isExpanded();
        this.dockElement.classList.toggle('dock-is-collapsed', !isExpanded);
        
        const btn = this.dockElement.querySelector('.dock-collapse-btn');
        if (btn) btn.textContent = isExpanded ? '▼' : '▶';

        const panelCountEl = this.dockElement.querySelector('.panel-count');
        if (panelCountEl) panelCountEl.textContent = `${this.getPanelCount()} panels`;
    }

    isExpanded() {
        const state = this.getReduxState();
        return state ? state.isExpanded !== false : true;
    }

    setDockExpanded(expanded) {
        this.updateDockState({ isExpanded: expanded });
    }

    getPanelCount() {
        const state = this.getReduxState();
        return state?.panels?.length || 0;
    }

    // =================================================================
    // REDUX STATE HELPERS (REFACTORED FOR CONSISTENCY)
    // =================================================================

    /**
     * CORRECT: Use the new, consistent Redux action to add a panel to this dock.
     */
    addPanelToState(panelData) {
        dispatch(panelActions.createPanel({
            dockId: this.dockId,
            id: panelData.id,
            title: panelData.title,
            config: panelData 
        }));
    }

    /**
     * CORRECT: Use the new, consistent Redux action to update a panel in this dock.
     */
    updatePanelInState(panelId, updates) {
        dispatch(panelActions.updatePanelInDock({
            dockId: this.dockId,
            panelId,
            updates
        }));
    }
    
    /**
     * CORRECT: Use the standard `updateDock` action.
     */
    updateDockState(updates) {
        dispatch(panelActions.updateDock({
            dockId: this.dockId,
            ...updates
        }));
    }

    // =================================================================
    // LIFECYCLE
    // =================================================================
    
    update() {
        // This method will be called by the Sidebar on re-renders
        // It's used to sync the DOM with the latest Redux state
        this.updateDockHeader();
        
        const dockState = this.getReduxState();
        if (this.contentElement && dockState) {
            // Logic to add/remove/update panel elements based on dockState.panels
        }
    }

    destroy() {
        super.destroy(); // from BaseDock
    }
}
