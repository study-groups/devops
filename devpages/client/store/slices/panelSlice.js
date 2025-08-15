// redux/slices/panelSlice.js - Panel management slice for Redux-native panel system
import { createSlice } from '/client/vendor/scripts/redux-toolkit.mjs';
import { storageService } from '/client/services/storageService.js';

const STATE_VERSION = '2.3'; // Version bump for new actions

function getNextZIndex(state) {
    const computedStyle = getComputedStyle(document.documentElement);
    const baseZIndex = parseInt(computedStyle.getPropertyValue('--z-toast')) || 1050;
    if (!state.docks || Object.keys(state.docks).length === 0) {
        return baseZIndex;
    }
    return Math.max(...Object.values(state.docks).map(d => d.zIndex || 0), baseZIndex) + 1;
}

function loadPersistedPanelState() {
    try {
        const persistedState = storageService.getItem('panel_state');
        if (!persistedState) return null;
        
        if (persistedState.version !== STATE_VERSION) {
            storageService.removeItem('panel_state');
            return null;
        }
        return persistedState;
    } catch (e) {
        console.warn('[PanelSlice] Error loading persisted panel state:', e);
        return null;
    }
}

function getInitialPanelState() {
    const persistedState = loadPersistedPanelState();
    const computedStyle = getComputedStyle(document.documentElement);
    const baseZIndex = parseInt(computedStyle.getPropertyValue('--z-toast')) || 1050;
    
    const defaultState = {
        version: STATE_VERSION,
        docks: {
            'sidebar-dock': { id: 'sidebar-dock', title: 'Sidebar Dock', isVisible: true, isCollapsed: false, panels: ['file-browser', 'code'], activePanel: null, zIndex: baseZIndex },
            'settings-dock': { id: 'settings-dock', title: '🎨 Settings & Style', isVisible: true, isCollapsed: false, panels: ['settings-panel'], activePanel: null, zIndex: baseZIndex },
            'comm-dock': { id: 'comm-dock', title: 'Communications', isVisible: false, isCollapsed: false, panels: ['comm-panel'], activePanel: null, zIndex: baseZIndex }
        },
        panels: {},
        // ... other initial state properties
    };
    
    if (persistedState) {
        return {
            ...defaultState,
            docks: { ...defaultState.docks, ...persistedState.docks },
            panels: { ...defaultState.panels, ...(persistedState.panels || {}) },
        };
    }
    
    return defaultState;
}

const initialState = getInitialPanelState();

const panelSlice = createSlice({
    name: 'panels',
    initialState,
    reducers: {
        // =================================================================
        // DOCK ACTIONS
        // =================================================================
        updateDock(state, action) {
            const { dockId, ...updates } = action.payload;
            if (state.docks[dockId]) {
                Object.assign(state.docks[dockId], updates);
            }
        },

        /**
         * A more robust way to register a panel, ensuring it has a home.
         * This will replace the simple `registerPanel`.
         */
        createPanel(state, action) {
            const { id, dockId, title, config } = action.payload;
            
            // 1. Create the panel object
            state.panels[id] = { 
                id, 
                title, 
                dockId,
                isVisible: true, 
                isCollapsed: false,
                ...config 
            };
            
            // 2. Add the panel to the specified dock
            if (state.docks[dockId]) {
                if (!state.docks[dockId].panels.includes(id)) {
                    state.docks[dockId].panels.push(id);
                }
            } else {
                console.warn(`[PanelSlice] Dock not found for createPanel: ${dockId}`);
            }
        },

        /**
         * Update panel properties
         */
        updatePanel(state, action) {
            const { id, updates } = action.payload;
            if (state.panels[id]) {
                Object.assign(state.panels[id], updates);
            }
        },

        /**
         * Toggle panel visibility
         */
        togglePanelVisibility(state, action) {
            const { panelId } = action.payload;
            if (state.panels[panelId]) {
                state.panels[panelId].isVisible = !state.panels[panelId].isVisible;
            }
        },
        
        // Legacy/Deprecated Actions (to be phased out)
        registerPanel(state, action) {
            const { panelId, config } = action.payload;
            // This logic seems incorrect for the new architecture, logging a warning.
            console.warn('[PanelSlice] DEPRECATED: registerPanel was called. Use addPanelToDock instead.');
            state.panels[panelId] = {
                id: panelId,
                title: config.title || 'Untitled',
                visible: true,
                ...config,
            };
        },
    }
});

export const panelActions = panelSlice.actions;
export const panelReducer = panelSlice.reducer;

// Selectors
export const selectDocks = (state) => state.panels.docks;
export const selectPanelsByDock = (state, dockId) => {
    const dock = state.panels.docks[dockId];
    if (!dock) return [];
    return dock.panels.map(panelId => state.panels.panels[panelId]);
};

console.log('[PanelSlice] ✅ Refactored Redux panel system ready');
