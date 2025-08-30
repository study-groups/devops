/**
 * panelSlice.js - Redux slice for panel state management
 * 
 * Manages panel state including:
 * - Panel creation/destruction
 * - Position and size updates
 * - Visibility and collapse states
 * - Z-index management
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    panels: {},
    activePanel: null,
    maxZIndex: 1000,
    globalSettings: {
        snapToGrid: false,
        gridSize: 10,
        showGrid: false,
        enableAnimations: true
    }
};

const panelSlice = createSlice({
    name: 'panels',
    initialState,
    reducers: {
        createPanel: (state, action) => {
            const { id, title, type, position, size, visible = false, collapsed = false, zIndex, config } = action.payload;
            
            state.panels[id] = {
                id,
                title,
                type,
                position: position || { x: 100, y: 100 },
                size: size || { width: 400, height: 300 },
                visible,
                collapsed,
                zIndex: zIndex || state.maxZIndex + 1,
                config: config || {},
                mounted: false,
                createdAt: Date.now(),
                lastUpdated: Date.now()
            };
            
            if (zIndex && zIndex > state.maxZIndex) {
                state.maxZIndex = zIndex;
            }
        },

        updatePanel: (state, action) => {
            const { id, updates } = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                Object.assign(panel, updates, { lastUpdated: Date.now() });
                
                // Update maxZIndex if necessary
                if (updates.zIndex && updates.zIndex > state.maxZIndex) {
                    state.maxZIndex = updates.zIndex;
                }
            }
        },

        removePanel: (state, action) => {
            const id = action.payload;
            delete state.panels[id];
            
            if (state.activePanel === id) {
                state.activePanel = null;
            }
        },

        setActivePanel: (state, action) => {
            state.activePanel = action.payload;
        },

        showPanel: (state, action) => {
            const id = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                panel.visible = true;
                panel.zIndex = state.maxZIndex + 1;
                state.maxZIndex += 1;
                state.activePanel = id;
                panel.lastUpdated = Date.now();
            }
        },

        hidePanel: (state, action) => {
            const id = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                panel.visible = false;
                panel.lastUpdated = Date.now();
                
                if (state.activePanel === id) {
                    state.activePanel = null;
                }
            }
        },

        togglePanel: (state, action) => {
            const id = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                if (panel.visible) {
                    panel.visible = false;
                    if (state.activePanel === id) {
                        state.activePanel = null;
                    }
                } else {
                    panel.visible = true;
                    panel.zIndex = state.maxZIndex + 1;
                    state.maxZIndex += 1;
                    state.activePanel = id;
                }
                panel.lastUpdated = Date.now();
            }
        },

        collapsePanel: (state, action) => {
            const id = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                panel.collapsed = true;
                panel.lastUpdated = Date.now();
            }
        },

        expandPanel: (state, action) => {
            const id = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                panel.collapsed = false;
                panel.lastUpdated = Date.now();
            }
        },

        toggleCollapsePanel: (state, action) => {
            const id = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                panel.collapsed = !panel.collapsed;
                panel.lastUpdated = Date.now();
            }
        },

        movePanel: (state, action) => {
            const { id, position } = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                panel.position = position;
                panel.lastUpdated = Date.now();
            }
        },

        resizePanel: (state, action) => {
            const { id, size } = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                panel.size = size;
                panel.lastUpdated = Date.now();
            }
        },

        bringToFront: (state, action) => {
            const id = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                panel.zIndex = state.maxZIndex + 1;
                state.maxZIndex += 1;
                state.activePanel = id;
                panel.lastUpdated = Date.now();
            }
        },

        updateGlobalSettings: (state, action) => {
            Object.assign(state.globalSettings, action.payload);
        },

        resetPanels: (state) => {
            state.panels = {};
            state.activePanel = null;
            state.maxZIndex = 1000;
        },

        // Batch operations
        hideAllPanels: (state) => {
            Object.values(state.panels).forEach(panel => {
                panel.visible = false;
                panel.lastUpdated = Date.now();
            });
            state.activePanel = null;
        },

        showAllPanels: (state) => {
            Object.values(state.panels).forEach(panel => {
                panel.visible = true;
                panel.lastUpdated = Date.now();
            });
        },

        // Layout operations
        cascadePanels: (state) => {
            const visiblePanels = Object.values(state.panels).filter(p => p.visible);
            visiblePanels.forEach((panel, index) => {
                panel.position = {
                    x: 100 + (index * 30),
                    y: 100 + (index * 30)
                };
                panel.zIndex = state.maxZIndex + index + 1;
                panel.lastUpdated = Date.now();
            });
            state.maxZIndex += visiblePanels.length;
        },

        tilePanels: (state) => {
            const visiblePanels = Object.values(state.panels).filter(p => p.visible);
            const cols = Math.ceil(Math.sqrt(visiblePanels.length));
            const panelWidth = Math.floor(window.innerWidth / cols) - 20;
            const panelHeight = Math.floor(window.innerHeight / Math.ceil(visiblePanels.length / cols)) - 20;

            visiblePanels.forEach((panel, index) => {
                const row = Math.floor(index / cols);
                const col = index % cols;
                
                panel.position = {
                    x: col * (panelWidth + 10) + 10,
                    y: row * (panelHeight + 10) + 10
                };
                panel.size = {
                    width: panelWidth,
                    height: panelHeight
                };
                panel.lastUpdated = Date.now();
            });
        }
    }
});

export const panelActions = panelSlice.actions;

// Selectors
export const selectAllPanels = (state) => state.panels.panels;
export const selectVisiblePanels = (state) => 
    Object.values(state.panels.panels).filter(panel => panel.visible);
export const selectActivePanel = (state) => 
    state.panels.activePanel ? state.panels.panels[state.panels.activePanel] : null;
export const selectPanelById = (state, id) => state.panels.panels[id];
export const selectPanelsByType = (state, type) => 
    Object.values(state.panels.panels).filter(panel => panel.type === type);
export const selectGlobalSettings = (state) => state.panels.globalSettings;

// Thunks for complex operations
export const panelThunks = {
    createAndShowPanel: (config) => (dispatch) => {
        const id = config.id || `panel-${Date.now()}`;
        dispatch(panelActions.createPanel({ ...config, id }));
        dispatch(panelActions.showPanel(id));
        return id;
    },

    duplicatePanel: (sourceId) => (dispatch, getState) => {
        const sourcePanel = selectPanelById(getState(), sourceId);
        if (sourcePanel) {
            const newId = `${sourceId}-copy-${Date.now()}`;
            dispatch(panelActions.createPanel({
                ...sourcePanel,
                id: newId,
                title: `${sourcePanel.title} (Copy)`,
                position: {
                    x: sourcePanel.position.x + 30,
                    y: sourcePanel.position.y + 30
                }
            }));
            dispatch(panelActions.showPanel(newId));
            return newId;
        }
    }
};

export default panelSlice.reducer;