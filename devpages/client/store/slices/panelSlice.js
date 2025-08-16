// redux/slices/panelSlice.js - Panel management slice for Redux-native panel system
import { storageService } from '/client/services/storageService.js';

const STATE_VERSION = '2.3'; // Version bump for new actions

// Action Types
const TOGGLE_DOCK_VISIBILITY = 'panels/toggleDockVisibility';
const UPDATE_DOCK_POSITION = 'panels/updateDockPosition';
const UPDATE_DOCK_SIZE = 'panels/updateDockSize';
const BRING_DOCK_TO_FRONT = 'panels/bringDockToFront';
const UPDATE_DOCK = 'panels/updateDock';
const CREATE_PANEL = 'panels/createPanel';
const UPDATE_PANEL = 'panels/updatePanel';
const TOGGLE_PANEL_VISIBILITY = 'panels/togglePanelVisibility';
const REORDER_PANELS = 'panels/reorderPanels';

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
            'sidebar-dock': { id: 'sidebar-dock', title: 'Sidebar Dock', isVisible: true, isCollapsed: false, panels: ['file-browser', 'code'], activePanel: null, zIndex: baseZIndex, zone: 'sidebar' },
            'settings-dock': { id: 'settings-dock', title: '🎨 Settings & Style', isVisible: true, isCollapsed: false, panels: ['settings-panel'], activePanel: null, zIndex: baseZIndex, zone: 'sidebar' },
            'comm-dock': { id: 'comm-dock', title: 'Communications', isVisible: false, isCollapsed: false, panels: ['comm-panel'], activePanel: null, zIndex: baseZIndex, zone: 'sidebar' },
            'preview-dock': {
                id: 'preview-dock',
                panels: ['editor-panel', 'preview-panel'],
                activePanel: 'preview-panel',
                isVisible: true,
                isCollapsed: false,
                zone: 'preview'
            },
            'logs-dock': {
                id: 'logs-dock',
                panels: ['log-display'], // Assuming 'log-display' is the panel ID
                activePanel: 'log-display',
                isVisible: false, // Start hidden by default
                isCollapsed: false,
                zone: 'logs'
            },
            'debug-dock': {
                id: 'debug-dock',
                panels: [], // Panels will be added dynamically
                activePanel: null,
                isVisible: false, // Initially hidden
                isCollapsed: false,
                position: { x: 150, y: 150 },
                size: { width: 500, height: 400 },
                zIndex: baseZIndex + 1,
                zone: 'debug'
            }
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

// Action Creators
export const panelActions = {
    toggleDockVisibility: (payload) => ({ type: TOGGLE_DOCK_VISIBILITY, payload }),
    updateDockPosition: (payload) => ({ type: UPDATE_DOCK_POSITION, payload }),
    updateDockSize: (payload) => ({ type: UPDATE_DOCK_SIZE, payload }),
    bringDockToFront: (payload) => ({ type: BRING_DOCK_TO_FRONT, payload }),
    updateDock: (payload) => ({ type: UPDATE_DOCK, payload }),
    createPanel: (payload) => ({ type: CREATE_PANEL, payload }),
    updatePanel: (payload) => ({ type: UPDATE_PANEL, payload }),
    togglePanelVisibility: (payload) => ({ type: TOGGLE_PANEL_VISIBILITY, payload }),
    reorderPanels: (payload) => ({ type: REORDER_PANELS, payload }),
};

// Reducer
export const panelReducer = (state = initialState, action) => {
    switch (action.type) {
        case TOGGLE_DOCK_VISIBILITY: {
            const { dockId } = action.payload;
            const dock = state.docks[dockId];
            if (dock) {
                return {
                    ...state,
                    docks: {
                        ...state.docks,
                        [dockId]: {
                            ...dock,
                            isVisible: !dock.isVisible,
                        },
                    },
                };
            }
            return state;
        }
        case UPDATE_DOCK_POSITION: {
            const { dockId, position } = action.payload;
            const dock = state.docks[dockId];
            if (dock) {
                return {
                    ...state,
                    docks: {
                        ...state.docks,
                        [dockId]: {
                            ...dock,
                            position,
                        },
                    },
                };
            }
            return state;
        }
        case UPDATE_DOCK_SIZE: {
            const { dockId, size } = action.payload;
            const dock = state.docks[dockId];
            if (dock) {
                return {
                    ...state,
                    docks: {
                        ...state.docks,
                        [dockId]: {
                            ...dock,
                            size,
                        },
                    },
                };
            }
            return state;
        }
        case BRING_DOCK_TO_FRONT: {
            const { dockId } = action.payload;
            const dock = state.docks[dockId];
            if (dock) {
                return {
                    ...state,
                    docks: {
                        ...state.docks,
                        [dockId]: {
                            ...dock,
                            zIndex: getNextZIndex(state),
                        },
                    },
                };
            }
            return state;
        }
        case UPDATE_DOCK: {
            const { dockId, ...updates } = action.payload;
            const dock = state.docks[dockId];
            if (dock) {
                return {
                    ...state,
                    docks: {
                        ...state.docks,
                        [dockId]: {
                            ...dock,
                            ...updates,
                        },
                    },
                };
            }
            return state;
        }
        case CREATE_PANEL: {
            const { id, dockId, title, config } = action.payload;
            const newPanels = {
                ...state.panels,
                [id]: {
                    id,
                    title,
                    dockId,
                    isVisible: true,
                    isCollapsed: false,
                    ...config,
                },
            };
            const dock = state.docks[dockId];
            if (dock && !dock.panels.includes(id)) {
                const newDocks = {
                    ...state.docks,
                    [dockId]: {
                        ...dock,
                        panels: [...dock.panels, id],
                    },
                };
                return { ...state, panels: newPanels, docks: newDocks };
            }
            return { ...state, panels: newPanels };
        }
        case UPDATE_PANEL: {
            const { id, updates } = action.payload;
            const panel = state.panels[id];
            if (panel) {
                return {
                    ...state,
                    panels: {
                        ...state.panels,
                        [id]: {
                            ...panel,
                            ...updates,
                        },
                    },
                };
            }
            return state;
        }
        case TOGGLE_PANEL_VISIBILITY: {
            const { panelId } = action.payload;
            const panel = state.panels[panelId];
            if (panel) {
                return {
                    ...state,
                    panels: {
                        ...state.panels,
                        [panelId]: {
                            ...panel,
                            isVisible: !panel.isVisible,
                        },
                    },
                };
            }
            return state;
        }
        case REORDER_PANELS: {
            const { dockId, panelOrder } = action.payload;
            const dock = state.docks[dockId];
            if (dock) {
                return {
                    ...state,
                    docks: {
                        ...state.docks,
                        [dockId]: {
                            ...dock,
                            panels: panelOrder,
                        },
                    },
                };
            }
            return state;
        }
        default:
            return state;
    }
};


// Selectors
export const selectDocks = (state) => state.panels.docks;
export const selectPanelsByDock = (state, dockId) => {
    const dock = state.panels.docks[dockId];
    if (!dock) return [];
    return dock.panels.map(panelId => state.panels.panels[panelId]);
};

console.log('[PanelSlice] ✅ Refactored Redux panel system ready');
