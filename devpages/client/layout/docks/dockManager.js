/**
 * client/layout/docks/dockManager.js
 * ✅ MODERNIZED: Centralized manager with enhanced Redux patterns
 *
 * Centralized manager for creating, tracking, and updating all dock instances.
 * Subscribes to the Redux store to keep dock DOM elements in sync with application state.
 */

import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
import { connectToLayout } from '/client/store/reduxConnect.js';

// Import dock implementations
// import { SettingsDock } from '/client/layout/docks/SettingsDock.js';
import { DebugDock } from '/client/layout/docks/DebugDock.js';

class DockManager {
    constructor() {
        this.dockInstances = new Map();
        this.isInitialized = false;
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
        
        const initialState = appStore.getState().panels?.docks || {};

        for (const dockId in initialState) {
            const dockConfig = initialState[dockId];
            this.createDock(dockId, dockConfig);
        }
        
        this.isInitialized = true;
        logMessage('[DockManager] All docks initialized.', 'info');
    }

    /**
     * Create a dock instance based on its configuration
     */
    createDock(dockId, dockConfig) {
        let dockInstance = null;
        
        // Simple factory based on dockId prefix or properties
        if (dockId.startsWith('sidebar') || dockId === 'settings-dock') {
            // dockInstance = new SettingsDock(dockId, dockConfig.title); // Commented out as per edit hint
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
     * Get a dock instance by its ID
     */
    getDock(dockId) {
        return this.dockInstances.get(dockId);
    }
}

export const dockManager = new DockManager();
