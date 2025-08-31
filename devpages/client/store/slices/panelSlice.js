/**
 * panelSlice.js - Unified Redux slice for panel state management
 * 
 * Manages ALL panel state including:
 * - Panel creation/destruction with PanelConfigLoader integration
 * - Position and size updates
 * - Visibility and collapse states
 * - Floating/docked states (replaces uiSlice panel state)
 * - Sidebar expanded/collapsed states
 * - Z-index management
 * - Persistence-ready state structure
 */

import { createSlice } from '@reduxjs/toolkit';
import { panelConfigLoader } from '../../config/PanelConfigLoader.js';
import { panelRegistry } from '../../panels/BasePanel.js';

const initialState = {
    // Runtime panel instances with full state
    panels: {},
    activePanel: null,
    maxZIndex: 1000,
    
    // Sidebar panel states (moved from uiSlice)
    sidebarPanels: {},
    
    // Global floating panel state (moved from uiSlice)
    floatingPanelState: {
        isFloating: false,
        currentPanelId: null
    },
    
    // Global settings
    globalSettings: {
        snapToGrid: false,
        gridSize: 10,
        showGrid: false,
        enableAnimations: true
    },
    
    // Initialization flag to prevent multiple initializations
    _initialized: false,
    
    // Active sidebar category (persisted)
    activeSidebarCategory: 'dev',
    
    // Panel ordering per category (persisted)
    panelOrders: {
        dev: [],
        settings: [],
        publish: []
    }
};

const panelSlice = createSlice({
    name: 'panels',
    initialState,
    reducers: {
        createPanel: (state, action) => {
            const { id, title, type, position, size, visible = false, collapsed = false, zIndex, config } = action.payload;
            
            // Defensively ensure the panels object exists on the state
            if (!state.panels) {
                state.panels = {};
            }

            // Don't overwrite existing panel state - just update what's needed
            if (state.panels[id]) {
                console.log('Panel already exists, not overwriting:', id);
                return;
            }

            // Get panel config from PanelConfigLoader for defaults
            const panelConfig = panelConfigLoader.config.panels[id] || {};

            state.panels[id] = {
                id,
                title: title || panelConfig.title || 'Untitled Panel',
                type: type || id,
                x: (position && position.x) || 100,
                y: (position && position.y) || 100,
                width: (size && size.width) || 400,
                height: (size && size.height) || 300,
                visible,
                collapsed,
                zIndex: zIndex || state.maxZIndex + 1,
                isFloating: false,
                isDocked: true,
                mounted: false,
                sidebarExpanded: panelConfig.default_expanded || false,
                config: { ...panelConfig, ...config },
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
                console.log('Redux movePanel:', id, 'from', panel.x, panel.y, 'to', position.x, position.y);
                panel.x = position.x;
                panel.y = position.y;
                panel.lastUpdated = Date.now();
            }
        },

        resizePanel: (state, action) => {
            const { id, size } = action.payload;
            const panel = state.panels[id];
            
            if (panel) {
                console.log('Redux resizePanel:', id, 'from', panel.width, panel.height, 'to', size.width, size.height);
                panel.width = size.width;
                panel.height = size.height;
                panel.lastUpdated = Date.now();
                console.log('Panel state after resize:', JSON.stringify(panel, null, 2));
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

        // New unified panel state actions (replacing uiSlice actions)
        setSidebarPanelExpanded: (state, action) => {
            const { panelId, expanded } = action.payload;
            
            // Update in panels if it exists
            if (state.panels && state.panels[panelId]) {
                state.panels[panelId].sidebarExpanded = expanded;
                state.panels[panelId].lastUpdated = Date.now();
            }
            
            // Always maintain sidebarPanels for sidebar state
            if (!state.sidebarPanels) {
                state.sidebarPanels = {};
            }
            if (!state.sidebarPanels[panelId]) {
                state.sidebarPanels[panelId] = { expanded: false };
            }
            state.sidebarPanels[panelId].expanded = expanded;
        },

        toggleSidebarPanel: (state, action) => {
            const panelId = action.payload;
            const currentExpanded = state.panels[panelId]?.sidebarExpanded || 
                                  state.sidebarPanels[panelId]?.expanded || 
                                  false;
            
            // Use the existing setSidebarPanelExpanded logic
            panelSlice.caseReducers.setSidebarPanelExpanded(state, {
                payload: { panelId, expanded: !currentExpanded }
            });
        },

        startFloatingPanel: (state, action) => {
            const { panelId } = action.payload;
            
            // Update global floating state
            state.floatingPanelState = {
                isFloating: true,
                currentPanelId: panelId
            };
            
            // Update specific panel state
            if (state.panels[panelId]) {
                state.panels[panelId].isDocked = false;
                state.panels[panelId].isFloating = true;
                state.panels[panelId].visible = true;
                state.panels[panelId].lastUpdated = Date.now();
            }
        },

        stopFloatingPanel: (state, action) => {
            const panelId = action.payload || state.floatingPanelState.currentPanelId;
            
            // Update global floating state
            state.floatingPanelState = {
                isFloating: false,
                currentPanelId: null
            };
            
            // Update specific panel state
            if (panelId && state.panels[panelId]) {
                state.panels[panelId].isDocked = true;
                state.panels[panelId].isFloating = false;
                state.panels[panelId].lastUpdated = Date.now();
            }
        },

        togglePanelFloating: (state, action) => {
            const panelId = action.payload;
            const panel = state.panels[panelId];
            
            if (panel) {
                if (panel.isFloating) {
                    panelSlice.caseReducers.stopFloatingPanel(state, { payload: panelId });
                } else {
                    panelSlice.caseReducers.startFloatingPanel(state, { payload: { panelId } });
                }
            }
        },

        updateGlobalSettings: (state, action) => {
            Object.assign(state.globalSettings, action.payload);
        },

        markInitialized: (state) => {
            state._initialized = true;
        },

        setActiveSidebarCategory: (state, action) => {
            state.activeSidebarCategory = action.payload;
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
        },

        // Panel ordering actions
        setPanelOrder: (state, action) => {
            const { category, panelIds } = action.payload;
            if (!state.panelOrders) {
                state.panelOrders = { dev: [], settings: [], publish: [] };
            }
            state.panelOrders[category] = panelIds;
        },

        reorderPanel: (state, action) => {
            const { category, fromIndex, toIndex } = action.payload;
            if (!state.panelOrders || !state.panelOrders[category]) {
                return;
            }
            
            const panelIds = [...state.panelOrders[category]];
            const [movedPanel] = panelIds.splice(fromIndex, 1);
            panelIds.splice(toIndex, 0, movedPanel);
            state.panelOrders[category] = panelIds;
        },

        initializePanelOrder: (state, action) => {
            const { category, panelIds } = action.payload;
            if (!state.panelOrders) {
                state.panelOrders = { dev: [], settings: [], publish: [] };
            }
            // Only initialize if category order is empty
            if (!state.panelOrders[category] || state.panelOrders[category].length === 0) {
                state.panelOrders[category] = panelIds;
            }
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

// Thunks for complex operations with unified panel system
export const panelThunks = {
    // Create panel using unified registry (PREFERRED METHOD)
    createPanelUnified: (panelType, overrides = {}) => async (dispatch) => {
        try {
            // Check if panel type is available in unified registry
            if (!panelRegistry.isTypeAvailable(panelType)) {
                console.error(`[panelThunks] Panel type not available: ${panelType}`);
                return null;
            }

            // Create panel instance using unified registry
            const panelInstance = await panelRegistry.createPanel(panelType, overrides);
            
            if (!panelInstance) {
                console.error(`[panelThunks] Failed to create panel instance: ${panelType}`);
                return null;
            }

            // Create Redux state for the panel
            const config = {
                id: panelInstance.id,
                title: panelInstance.title,
                type: panelInstance.type,
                visible: false,
                collapsed: false,
                ...overrides
            };

            dispatch(panelActions.createPanel(config));
            console.log(`[panelThunks] Created unified panel: ${panelType} (${panelInstance.id})`);
            return panelInstance.id;
        } catch (error) {
            console.error(`[panelThunks] Error creating unified panel ${panelType}:`, error);
            return null;
        }
    },

    // Legacy method - Create panel from PanelConfigLoader definition
    createPanelFromConfig: (panelId, overrides = {}) => async (dispatch) => {
        const panelConfig = await panelConfigLoader.getPanel(panelId);
        if (!panelConfig) {
            console.error(`[panelThunks] Panel config not found for: ${panelId}`);
            return null;
        }

        const config = {
            id: panelId,
            title: panelConfig.title,
            type: panelId,
            visible: false,
            collapsed: false,
            ...overrides
        };

        dispatch(panelActions.createPanel(config));
        return panelId;
    },

    // Create and show panel using unified registry (PREFERRED METHOD)
    createAndShowPanelUnified: (panelType, overrides = {}) => async (dispatch) => {
        const id = await dispatch(panelThunks.createPanelUnified(panelType, overrides));
        if (id) {
            dispatch(panelActions.showPanel(id));
        }
        return id;
    },

    // Legacy method - Create and show panel with config integration
    createAndShowPanel: (panelId, overrides = {}) => async (dispatch) => {
        const id = await dispatch(panelThunks.createPanelFromConfig(panelId, overrides));
        if (id) {
            dispatch(panelActions.showPanel(id));
        }
        return id;
    },

    // Initialize all sidebar panels from config
    initializeSidebarPanels: () => async (dispatch, getState) => {
        try {
            // Prevent multiple initializations
            const state = getState();
            console.log('[panelThunks] Checking initialization state:', {
                _initialized: state.panels?._initialized,
                fullPanelsState: state.panels
            });
            
            if (state.panels?._initialized) {
                console.log('[panelThunks] Sidebar panels already initialized, skipping');
                return;
            }
            
            const sidebarPanels = await panelConfigLoader.getSidebarPanels();
            
            // Defensive check for panels state
            const existingPanels = state.panels?.panels || {};
            let createdCount = 0;
            
            for (const [panelId, panelConfig] of Object.entries(sidebarPanels)) {
                // Only create if doesn't exist
                if (!existingPanels[panelId]) {
                    console.log(`[panelThunks] Initializing sidebar panel: ${panelId} using unified registry`);
                    // Use unified registry if panel type is available, fallback to legacy method
                    if (panelRegistry.isTypeAvailable(panelId)) {
                        await dispatch(panelThunks.createPanelUnified(panelId, { id: panelId }));
                    } else {
                        console.warn(`[panelThunks] Panel type ${panelId} not in registry, using legacy method`);
                        await dispatch(panelThunks.createPanelFromConfig(panelId));
                    }
                    createdCount++;
                }
            }
            
            // Mark as initialized to prevent re-running
            dispatch(panelActions.markInitialized());
            
            console.log(`[panelThunks] Initialized ${createdCount} new sidebar panels (${Object.keys(sidebarPanels).length} total)`);
        } catch (error) {
            console.error('[panelThunks] Error initializing sidebar panels:', error);
        }
    },

    // Restore floating panels from persisted state
    restoreFloatingPanels: () => (dispatch, getState) => {
        try {
            const state = getState();
            const panels = state.panels?.panels || {};
            
            // Find any panels that were floating before reload
            let restoredCount = 0;
            for (const [panelId, panel] of Object.entries(panels)) {
                console.log(`[panelThunks] Checking panel ${panelId}:`, {
                    isFloating: panel.isFloating,
                    isDocked: panel.isDocked,
                    visible: panel.visible,
                    x: panel.x,
                    y: panel.y,
                    width: panel.width,
                    height: panel.height
                });
                if (panel.isFloating && !panel.isDocked) {
                    console.log(`[panelThunks] Restoring floating panel: ${panelId}`);
                    dispatch(panelActions.startFloatingPanel({ panelId }));
                    if (panel.visible) {
                        dispatch(panelActions.showPanel(panelId));
                    }
                    restoredCount++;
                }
            }
            
            console.log(`[panelThunks] Restored ${restoredCount} floating panels`);
        } catch (error) {
            console.error('[panelThunks] Error restoring floating panels:', error);
        }
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