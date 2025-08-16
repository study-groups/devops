/**
 * client/layout/docks/dockManager.js
 *
 * Centralized manager for creating, tracking, and updating all dock instances.
 * Subscribes to the Redux store to keep dock DOM elements in sync with application state.
 */

import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';

// Import dock implementations
import { SettingsDock } from '/client/layout/docks/SettingsDock.js';
import { DebugDock } from '/client/layout/docks/DebugDock.js';

class DockManager {
    constructor() {
        this.dockInstances = new Map();
        this.isInitialized = false;

        // Store a reference to the last known state to compare against for updates
        this.lastKnownState = null;
    }

    /**
     * Initialize all docks defined in the initial Redux state
     */
    async initialize() {
        if (this.isInitialized) {
            logMessage('[DockManager] Already initialized.', 'warn');
            return;
        }

        logMessage('[DockManager] Initializing all docks...', 'info');
        
        const initialState = appStore.getState().panels.docks;
        this.lastKnownState = initialState;

        for (const dockId in initialState) {
            const dockConfig = initialState[dockId];
            this.createDock(dockId, dockConfig);
        }

        appStore.subscribe(this.handleStateChange.bind(this));
        
        this.isInitialized = true;
        logMessage('[DockManager] All docks initialized and subscribed to state changes.', 'info');
    }

    /**
     * Create a dock instance based on its configuration
     */
    createDock(dockId, dockConfig) {
        let dockInstance = null;
        
        // Simple factory based on dockId prefix or properties
        if (dockId.startsWith('sidebar') || dockId === 'settings-dock') {
            dockInstance = new SettingsDock(dockId, dockConfig.title);
        } else if (dockId === 'debug-dock') { // Assuming 'debug-dock' is always floating
             dockInstance = new DebugDock(dockId, '🐛 Debug Tools', 'debug');
        } else {
            // A generic floating dock as a fallback
            dockInstance = new DebugDock(dockId, dockConfig.title || 'Floating Dock', 'generic');
        }

        if (dockInstance) {
            this.dockInstances.set(dockId, dockInstance);
            dockInstance.initialize().catch(error => {
                logMessage(`[DockManager] Error initializing dock ${dockId}: ${error.message}`, 'error');
            });
        } else {
            logMessage(`[DockManager] No implementation found for dock: ${dockId}`, 'warn');
        }
    }

    /**
     * Handle Redux state changes and update docks accordingly
     */
    handleStateChange() {
        const currentState = appStore.getState().panels.docks;

        for (const dockId in currentState) {
            const currentDockState = currentState[dockId];
            const lastDockState = this.lastKnownState ? this.lastKnownState[dockId] : null;

            // Simple object reference check; for more complex state, use deep comparison
            if (currentDockState !== lastDockState) {
                const dockInstance = this.dockInstances.get(dockId);
                if (dockInstance) {
                    // State has changed, so update the DOM
                    dockInstance.updateDOMFromState();
                }
            }
        }

        // Update the last known state for the next comparison
        this.lastKnownState = currentState;
    }

    /**
     * Get a dock instance by its ID
     */
    getDock(dockId) {
        return this.dockInstances.get(dockId);
    }
}

export const dockManager = new DockManager();
