/**
 * @file PanelStatePersistence.js
 * @description Enhanced state persistence for panels, docks, flyouts, and reordering
 */

import { storageService } from '/client/services/storageService.js';
import { appStore } from '/client/appState.js';

export class PanelStatePersistence {
    constructor() {
        this.storageKeys = {
            panels: 'devpages_panels_state_v3',
            docks: 'devpages_docks_state_v3',
            flyouts: 'devpages_flyouts_state_v3',
            reorder: 'devpages_reorder_state_v3',
            collapse: 'devpages_collapse_state_v3',
            resizers: 'devpages_resizers_state_v1'
        };
        
        this.debounceTimers = new Map();
        this.saveDelay = 500; // ms
        
        this.init();
        console.log('[PanelStatePersistence] Initialized');
    }
    
    /**
     * Initialize persistence system
     */
    init() {
        // Subscribe to Redux store changes
        if (appStore) {
            appStore.subscribe(() => {
                this.handleStateChange();
            });
        }
        
        // Listen for beforeunload to save immediately
        window.addEventListener('beforeunload', () => {
            this.saveAllStatesImmediate();
        });
        
        // Periodic save as backup
        setInterval(() => {
            this.saveAllStatesImmediate();
        }, 30000); // Every 30 seconds
    }
    
    /**
     * Handle Redux state changes
     */
    handleStateChange() {
        const state = appStore.getState();
        
        // Debounced save for different state types
        this.debouncedSave('panels', () => this.savePanelState(state));
        this.debouncedSave('docks', () => this.saveDockState(state));
        this.debouncedSave('resizers', () => this.saveResizerState(state));
    }
    
    /**
     * Debounced save function
     * @param {string} key - The debounce key
     * @param {Function} saveFunction - The save function to call
     */
    debouncedSave(key, saveFunction) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        const timer = setTimeout(() => {
            saveFunction();
            this.debounceTimers.delete(key);
        }, this.saveDelay);
        
        this.debounceTimers.set(key, timer);
    }
    
    /**
     * Save panel state
     * @param {object} state - Redux state
     */
    savePanelState(state) {
        const panelState = state.panels?.panels || {};
        const persistData = {};
        
        // Extract persistable panel data
        Object.entries(panelState).forEach(([panelId, panel]) => {
            persistData[panelId] = {
                id: panel.id,
                title: panel.title,
                dockId: panel.dockId,
                isVisible: panel.isVisible,
                isCollapsed: panel.isCollapsed,
                isFlyout: panel.isFlyout,
                flyoutPosition: panel.flyoutPosition,
                flyoutSize: panel.flyoutSize,
                order: panel.order,
                lastModified: Date.now()
            };
        });
        
        try {
            storageService.setItem(this.storageKeys.panels, {
                version: '3.0',
                timestamp: Date.now(),
                panels: persistData
            });
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to save panel state:', error);
        }
    }
    
    /**
     * Save dock state
     * @param {object} state - Redux state
     */
    saveDockState(state) {
        const dockState = state.panels?.docks || {};
        const persistData = {};
        
        // Extract persistable dock data
        Object.entries(dockState).forEach(([dockId, dock]) => {
            persistData[dockId] = {
                id: dock.id,
                title: dock.title,
                isVisible: dock.isVisible,
                isCollapsed: dock.isCollapsed,
                isFloating: dock.isFloating,
                floatingPosition: dock.floatingPosition,
                floatingSize: dock.floatingSize,
                panels: dock.panels || [],
                activePanel: dock.activePanel,
                zone: dock.zone,
                zIndex: dock.zIndex,
                lastModified: Date.now()
            };
        });
        
        try {
            storageService.setItem(this.storageKeys.docks, {
                version: '3.0',
                timestamp: Date.now(),
                docks: persistData
            });
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to save dock state:', error);
        }
    }
    
    saveResizerState(state) {
        const resizerState = state.panelSizes || {};
        try {
            storageService.setItem(this.storageKeys.resizers, {
                version: '1.0',
                timestamp: Date.now(),
                sizes: resizerState
            });
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to save resizer state:', error);
        }
    }

    /**
     * Save flyout state
     * @param {object} flyoutData - Flyout data from managers
     */
    saveFlyoutState(flyoutData) {
        try {
            storageService.setItem(this.storageKeys.flyouts, {
                version: '3.0',
                timestamp: Date.now(),
                flyouts: flyoutData
            });
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to save flyout state:', error);
        }
    }
    
    /**
     * Save reorder state
     * @param {object} reorderData - Reorder data
     */
    saveReorderState(reorderData) {
        try {
            storageService.setItem(this.storageKeys.reorder, {
                version: '3.0',
                timestamp: Date.now(),
                reorder: reorderData
            });
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to save reorder state:', error);
        }
    }
    
    /**
     * Save collapse state
     * @param {object} collapseData - Collapse state data
     */
    saveCollapseState(collapseData) {
        try {
            storageService.setItem(this.storageKeys.collapse, {
                version: '3.0',
                timestamp: Date.now(),
                collapse: collapseData
            });
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to save collapse state:', error);
        }
    }
    
    /**
     * Load panel state
     * @returns {object|null} Loaded panel state
     */
    loadPanelState() {
        try {
            const data = storageService.getItem(this.storageKeys.panels);
            if (data && data.version === '3.0' && data.panels) {
                return data.panels;
            }
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to load panel state:', error);
        }
        return null;
    }
    
    /**
     * Load dock state
     * @returns {object|null} Loaded dock state
     */
    loadDockState() {
        try {
            const data = storageService.getItem(this.storageKeys.docks);
            if (data && data.version === '3.0' && data.docks) {
                return data.docks;
            }
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to load dock state:', error);
        }
        return null;
    }
    
    /**
     * Load flyout state
     * @returns {object|null} Loaded flyout state
     */
    loadFlyoutState() {
        try {
            const data = storageService.getItem(this.storageKeys.flyouts);
            if (data && data.version === '3.0' && data.flyouts) {
                return data.flyouts;
            }
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to load flyout state:', error);
        }
        return null;
    }
    
    /**
     * Load reorder state
     * @returns {object|null} Loaded reorder state
     */
    loadReorderState() {
        try {
            const data = storageService.getItem(this.storageKeys.reorder);
            if (data && data.version === '3.0' && data.reorder) {
                return data.reorder;
            }
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to load reorder state:', error);
        }
        return null;
    }
    
    /**
     * Load collapse state
     * @returns {object|null} Loaded collapse state
     */
    loadCollapseState() {
        try {
            const data = storageService.getItem(this.storageKeys.collapse);
            if (data && data.version === '3.0' && data.collapse) {
                return data.collapse;
            }
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to load collapse state:', error);
        }
        return null;
    }
    
    /**
     * Load resizer state
     * @returns {object|null} Loaded resizer state
     */
    loadResizerState() {
        try {
            const data = storageService.getItem(this.storageKeys.resizers);
            if (data && data.version === '1.0' && data.sizes) {
                return data.sizes;
            }
        } catch (error) {
            console.warn('[PanelStatePersistence] Failed to load resizer state:', error);
        }
        return null;
    }
    
    /**
     * Save all states immediately (no debouncing)
     */
    saveAllStatesImmediate() {
        const state = appStore.getState();
        this.savePanelState(state);
        this.saveDockState(state);
        
        // Save flyout states from managers if available
        if (window.panelFlyoutManager) {
            const flyoutPanels = {};
            window.panelFlyoutManager.getFlyoutPanels().forEach(panelId => {
                const flyoutData = window.panelFlyoutManager.flyoutPanels.get(panelId);
                if (flyoutData) {
                    flyoutPanels[panelId] = {
                        position: flyoutData.options.position,
                        size: flyoutData.options.size,
                        title: flyoutData.options.title
                    };
                }
            });
            this.saveFlyoutState({ panels: flyoutPanels });
        }
        
        if (window.dockFlyoutManager) {
            const floatingDocks = {};
            window.dockFlyoutManager.getFloatingDocks().forEach(dockId => {
                const dockData = window.dockFlyoutManager.floatingDocks.get(dockId);
                if (dockData) {
                    floatingDocks[dockId] = {
                        position: dockData.options.position,
                        size: dockData.options.size,
                        title: dockData.options.title
                    };
                }
            });
            this.saveFlyoutState({ docks: floatingDocks });
        }
    }
    
    /**
     * Restore all states
     */
    restoreAllStates() {
        const panelState = this.loadPanelState();
        const dockState = this.loadDockState();
        const flyoutState = this.loadFlyoutState();
        const reorderState = this.loadReorderState();
        const collapseState = this.loadCollapseState();
        const resizerState = this.loadResizerState();
        
        return {
            panels: panelState,
            docks: dockState,
            flyouts: flyoutState,
            reorder: reorderState,
            collapse: collapseState,
            resizers: resizerState
        };
    }
    
    /**
     * Clear all persisted state
     */
    clearAllStates() {
        Object.values(this.storageKeys).forEach(key => {
            try {
                storageService.removeItem(key);
            } catch (error) {
                console.warn(`[PanelStatePersistence] Failed to clear ${key}:`, error);
            }
        });
        
        console.log('[PanelStatePersistence] All states cleared');
    }
    
    /**
     * Export all state data
     * @returns {object} All state data
     */
    exportAllStates() {
        const exported = {};
        
        Object.entries(this.storageKeys).forEach(([type, key]) => {
            try {
                const data = storageService.getItem(key);
                if (data) {
                    exported[type] = data;
                }
            } catch (error) {
                console.warn(`[PanelStatePersistence] Failed to export ${type}:`, error);
            }
        });
        
        return {
            exported: Date.now(),
            version: '3.0',
            data: exported
        };
    }
    
    /**
     * Import state data
     * @param {object} importData - Data to import
     */
    importAllStates(importData) {
        if (!importData || !importData.data) {
            throw new Error('Invalid import data');
        }
        
        Object.entries(importData.data).forEach(([type, data]) => {
            const key = this.storageKeys[type];
            if (key) {
                try {
                    storageService.setItem(key, data);
                } catch (error) {
                    console.warn(`[PanelStatePersistence] Failed to import ${type}:`, error);
                }
            }
        });
        
        console.log('[PanelStatePersistence] States imported successfully');
    }
    
    /**
     * Get storage usage statistics
     * @returns {object} Storage usage info
     */
    getStorageStats() {
        const stats = {
            totalSize: 0,
            itemCount: 0,
            items: {}
        };
        
        Object.entries(this.storageKeys).forEach(([type, key]) => {
            try {
                const data = storageService.getItem(key);
                if (data) {
                    const size = JSON.stringify(data).length;
                    stats.items[type] = {
                        size,
                        timestamp: data.timestamp,
                        version: data.version
                    };
                    stats.totalSize += size;
                    stats.itemCount++;
                }
            } catch (error) {
                stats.items[type] = { error: error.message };
            }
        });
        
        return stats;
    }
    
    /**
     * Cleanup old or corrupted state data
     */
    cleanupStates() {
        let cleaned = 0;
        
        Object.entries(this.storageKeys).forEach(([type, key]) => {
            try {
                const data = storageService.getItem(key);
                if (data) {
                    // Remove if too old (older than 30 days)
                    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
                    if (data.timestamp && (Date.now() - data.timestamp) > maxAge) {
                        storageService.removeItem(key);
                        cleaned++;
                        console.log(`[PanelStatePersistence] Cleaned old ${type} state`);
                    }
                    // Remove if wrong version
                    else if (!data.version || data.version !== '3.0') {
                        storageService.removeItem(key);
                        cleaned++;
                        console.log(`[PanelStatePersistence] Cleaned outdated ${type} state`);
                    }
                }
            } catch (error) {
                // Remove corrupted data
                storageService.removeItem(key);
                cleaned++;
                console.log(`[PanelStatePersistence] Cleaned corrupted ${type} state`);
            }
        });
        
        if (cleaned > 0) {
            console.log(`[PanelStatePersistence] Cleaned ${cleaned} state items`);
        }
        
        return cleaned;
    }
}

// Create global instance
export const panelStatePersistence = new PanelStatePersistence();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.panelStatePersistence = panelStatePersistence;
    
    // Add debug functions
    window.debugPanelState = {
        save: () => panelStatePersistence.saveAllStatesImmediate(),
        load: () => panelStatePersistence.restoreAllStates(),
        clear: () => panelStatePersistence.clearAllStates(),
        export: () => panelStatePersistence.exportAllStates(),
        import: (data) => panelStatePersistence.importAllStates(data),
        stats: () => panelStatePersistence.getStorageStats(),
        cleanup: () => panelStatePersistence.cleanupStates()
    };
}
