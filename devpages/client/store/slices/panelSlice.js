/**
 * Panel Slice - Redux state management for panels and docks
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    docks: {
        'debug-dock': {
            id: 'debug-dock',
            title: 'Debug Tools',
            zone: 'floating',
            panels: ['css-files', 'dom-inspector', 'devtools'],
            position: { x: 100, y: 100 },
            size: { width: 400, height: 600 },
            isVisible: true,
            isExpanded: true,
            zIndex: 1000
        },
        'sidebar-dock': {
            id: 'sidebar-dock',
            title: 'Sidebar',
            zone: 'sidebar',
            panels: ['context-panel', 'file-browser', 'design-tokens'],
            isVisible: true,
            isExpanded: true
        },
        'main-dock': {
            id: 'main-dock',
            title: 'Main Content',
            zone: 'main',
            panels: [],
            isVisible: true,
            isExpanded: true
        }
    },
    panels: {
        'context-panel': {
            id: 'context-panel',
            dockId: 'sidebar-dock',
            isVisible: true,
            order: 0
        },
        'file-browser': {
            id: 'file-browser',
            dockId: 'sidebar-dock',
            isVisible: true,
            order: 1
        },
        'design-tokens': {
            id: 'design-tokens',
            dockId: 'sidebar-dock',
            isVisible: true,
            order: 2
        }
    },
    activePanel: 'context-panel',
    dragState: null
};

const panelSlice = createSlice({
    name: 'panels',
    initialState,
    reducers: {
        // Dock management
        updateDockPosition: (state, action) => {
            const { dockId, position } = action.payload;
            if (state.docks[dockId]) {
                state.docks[dockId].position = position;
            }
        },
        
        updateDockSize: (state, action) => {
            const { dockId, size } = action.payload;
            if (state.docks[dockId]) {
                state.docks[dockId].size = size;
            }
        },
        
        toggleDockVisibility: (state, action) => {
            const { dockId } = action.payload;
            if (state.docks[dockId]) {
                state.docks[dockId].isVisible = !state.docks[dockId].isVisible;
            }
        },
        
        expandDock: (state, action) => {
            const { dockId } = action.payload;
            if (state.docks[dockId]) {
                state.docks[dockId].isExpanded = true;
            }
        },
        
        collapseDock: (state, action) => {
            const { dockId } = action.payload;
            if (state.docks[dockId]) {
                state.docks[dockId].isExpanded = false;
            }
        },
        
        bringDockToFront: (state, action) => {
            const { dockId } = action.payload;
            if (state.docks[dockId]) {
                // Find the highest z-index and add 1
                const maxZIndex = Math.max(...Object.values(state.docks).map(dock => dock.zIndex || 0));
                state.docks[dockId].zIndex = maxZIndex + 1;
            }
        },
        
        // Panel management
        togglePanelVisibility: (state, action) => {
            const { panelId } = action.payload;
            if (state.panels[panelId]) {
                state.panels[panelId].isVisible = !state.panels[panelId].isVisible;
            }
        },
        
        showPanel: (state, action) => {
            const { panelId } = action.payload;
            if (state.panels[panelId]) {
                state.panels[panelId].isVisible = true;
                state.activePanel = panelId;
            }
        },
        
        hidePanel: (state, action) => {
            const { panelId } = action.payload;
            if (state.panels[panelId]) {
                state.panels[panelId].isVisible = false;
            }
        },
        
        // Drag and drop
        startDrag: (state, action) => {
            state.dragState = action.payload;
        },
        
        endDrag: (state) => {
            state.dragState = null;
        },
        
        // Register new panel
        registerPanel: (state, action) => {
            const { id, dockId = 'sidebar-dock', config = {} } = action.payload;
            
            // Defensive checks
            if (!id) {
                console.warn('[PanelSlice] Attempted to register panel without ID', action.payload);
                return state;
            }
            
            // Ensure the panels object exists
            if (!state.panels) {
                state.panels = {};
            }
            
            // Ensure the docks object exists
            if (!state.docks) {
                state.docks = {
                    'sidebar-dock': {
                        id: 'sidebar-dock',
                        title: 'Sidebar',
                        zone: 'sidebar',
                        panels: [],
                        isVisible: true,
                        isExpanded: true
                    }
                };
            }
            
            // Ensure the specified dock exists
            if (!state.docks[dockId]) {
                state.docks[dockId] = {
                    id: dockId,
                    title: `${dockId} Dock`,
                    zone: 'sidebar', // default zone
                    panels: [],
                    isVisible: true,
                    isExpanded: true
                };
            }
            
            // Add or update panel
            state.panels[id] = {
                id,
                dockId,
                isVisible: config.isVisible !== false,
                order: config.order || 0,
                ...config
            };
            
            // Add to dock if not already there
            const dock = state.docks[dockId];
            if (dock && !dock.panels.includes(id)) {
                dock.panels.push(id);
            }
        }
    }
});

// Export actions and reducer
export const panelActions = panelSlice.actions;
export default panelSlice.reducer;

// Selectors
export const selectDocks = (state) => state.panels?.docks || {};
export const selectPanels = (state) => state.panels?.panels || {};
export const selectActivePanel = (state) => state.panels?.activePanel;