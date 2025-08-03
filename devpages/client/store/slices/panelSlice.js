// redux/slices/panelSlice.js - Panel management slice for Redux-native panel system
// Using vanilla Redux since we're not using Redux Toolkit in this project

// Storage key for persistence
const PANELS_STORAGE_KEY = 'devpages_redux_panels_state';

const STATE_VERSION = '2.1'; // Increment this on any breaking state change

// Helper function to get next available z-index using design tokens
function getNextZIndex(state) {
    // Get the toast z-index from CSS custom properties as our base for docks
    const computedStyle = getComputedStyle(document.documentElement);
    const baseZIndex = parseInt(computedStyle.getPropertyValue('--z-toast')) || 1050;
    
    if (!state.docks || Object.keys(state.docks).length === 0) {
        return baseZIndex;
    }
    
    return Math.max(...Object.values(state.docks).map(d => d.zIndex || 0), baseZIndex) + 1;
}

/**
 * Loads panel state from localStorage, but only if the version matches.
 */
function loadPersistedPanelState() {
    try {
        const serializedState = localStorage.getItem('devpages_panel_state');
        if (serializedState === null) {
            console.log('[PanelSlice] No persisted state found, using defaults');
            return null;
        }

        const persistedState = JSON.parse(serializedState);

        // Version check for compatibility
        if (persistedState.version !== STATE_VERSION) {
            console.warn(`[PanelSlice] Discarding persisted state. Version mismatch (Expected: ${STATE_VERSION}, Found: ${persistedState.version || 'none'}).`);
            localStorage.removeItem('devpages_panel_state'); // Clean up old state
            return null;
        }
        
        console.log('[PanelSlice] Loaded persisted panel state:', persistedState);
        return persistedState;

    } catch (e) {
        console.warn('[PanelSlice] Error loading persisted panel state:', e);
    }
    return null;
}

// Note: Persistence is now handled automatically by persistenceMiddleware

// Get initial state with persistence
function getInitialPanelState() {
    const persistedState = loadPersistedPanelState();
    
    // Get z-index from design tokens for consistent theming
    const computedStyle = getComputedStyle(document.documentElement);
    const baseZIndex = parseInt(computedStyle.getPropertyValue('--z-toast')) || 1050;
    
    const defaultState = {
        version: STATE_VERSION, // Used to invalidate old state structures
        // Dock management
        docks: {
            'debug-dock': {
                id: 'debug-dock',
                title: 'Debug Dock',
                position: { x: 300, y: 150 },
                size: { width: 600, height: 450 },
                isVisible: true,
                isCollapsed: false,
                isMaximized: false,
                panels: ['pdata-panel'], // Panel IDs in this dock
                activePanel: 'pdata-panel',
                zIndex: baseZIndex
            }
        },
        
        // Panel definitions
        panels: {
            'pdata-panel': {
                id: 'pdata-panel',
                title: 'PData Panel',
                type: 'pdata',
                dockId: 'debug-dock', // Home dock
                position: { x: 0, y: 0 },
                size: { width: 400, height: 500 },
                flyoutPosition: { x: 20, y: 20 },
                flyoutSize: { width: 400, height: 600 },
                isVisible: true,
                isCollapsed: false,
                isActive: true,
                isMounted: false,
                mountedDockId: 'debug-dock',
                containerId: null,
                isFlyout: false, // Start docked, not in flyout mode
                config: {
                    showTiming: true,
                    showIntrospection: true,
                    autoRefresh: false,
                    isCollapsed: false
                },
                subPanels: {
                    'auth-subpanel': {
                        id: 'auth-subpanel',
                        title: 'Authentication',
                        isCollapsed: false,
                        order: 0
                    },
                    'api-explorer-subpanel': {
                        id: 'api-explorer-subpanel', 
                        title: 'API Explorer',
                        isCollapsed: false,
                        order: 1
                    },
                    'timing-subpanel': {
                        id: 'timing-subpanel',
                        title: 'Request Timing',
                        isCollapsed: true,
                        order: 2
                    },
                    'introspection-subpanel': {
                        id: 'introspection-subpanel',
                        title: 'Response Introspection', 
                        isCollapsed: true,
                        order: 3
                    }
                }
            }
        },
        
        // Sidebar panel state (legacy compatibility)
        sidebarPanels: {},
        
        // Drag and drop state
        dragState: {
            isDragging: false,
            draggedItem: null, // { type: 'panel'|'dock', id: string }
            dragOffset: { x: 0, y: 0 },
            dropTarget: null
        },
        
        // Resize state
        resizeState: {
            isResizing: false,
            resizedItem: null,
            resizeHandle: null, // 'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'
            startPosition: { x: 0, y: 0 },
            startSize: { width: 0, height: 0 }
        },
        
        // Global panel settings
        settings: {
            snapToGrid: true,
            gridSize: 10,
            enableAnimations: true,
            defaultPanelSize: { width: 300, height: 400 },
            defaultDockSize: { width: 600, height: 500 }
        },
        
        // Keyboard shortcuts
        shortcuts: {
            'debug-dock': { key: 'D', ctrl: true, shift: true, description: 'Toggle Debug Dock' },
            'pdata-panel': { key: 'P', ctrl: true, shift: true, description: 'Toggle PData Panel' },
            'code-panel': { key: 'C', ctrl: true, shift: true, description: 'Toggle Code Panel' },
            'editor-panel': { key: 'E', ctrl: true, shift: true, description: 'Toggle Editor Panel' },
            'preview-panel': { key: 'V', ctrl: true, shift: true, description: 'Toggle Preview Panel' },
            'html-panel': { key: 'H', ctrl: true, shift: true, description: 'Toggle HTML Panel' },
            'context-panel': { key: 'X', ctrl: true, shift: true, description: 'Toggle Context Panel' },
            'reset-defaults': { key: '1', ctrl: true, shift: true, description: 'Reset to Default Panel Layout' }
        }
    };
    
    // Merge with persisted state if available
    if (persistedState) {
        return {
            ...defaultState,
            docks: { ...defaultState.docks, ...persistedState.docks },
            panels: { ...defaultState.panels, ...persistedState.panels },
            sidebarPanels: { ...defaultState.sidebarPanels, ...persistedState.sidebarPanels },
            settings: { ...defaultState.settings, ...persistedState.settings },
            shortcuts: { ...defaultState.shortcuts, ...persistedState.shortcuts }
        };
    }
    
    return defaultState;
}

// Initialize state with persistence
const initialState = getInitialPanelState();

// Action types
const actionTypes = {
    // Dock actions
    CREATE_DOCK: 'panels/createDock',
    UPDATE_DOCK_POSITION: 'panels/updateDockPosition',
    UPDATE_DOCK_SIZE: 'panels/updateDockSize',
    TOGGLE_DOCK_VISIBILITY: 'panels/toggleDockVisibility',
    TOGGLE_DOCK_COLLAPSE: 'panels/toggleDockCollapse',
    MAXIMIZE_DOCK: 'panels/maximizeDock',
    BRING_DOCK_TO_FRONT: 'panels/bringDockToFront',
    
    // Panel actions
    REGISTER_PANEL: 'panels/registerPanel',
    CREATE_PANEL: 'panels/createPanel',
    UPDATE_PANEL_POSITION: 'panels/updatePanelPosition',
    UPDATE_PANEL_SIZE: 'panels/updatePanelSize',
    TOGGLE_PANEL_VISIBILITY: 'panels/togglePanelVisibility',
    ACTIVATE_PANEL: 'panels/activatePanel',
    UPDATE_PANEL_CONFIG: 'panels/updatePanelConfig',
    MOUNT_PANEL: 'panels/mountPanel',
    UNMOUNT_PANEL: 'panels/unmountPanel',
    TOGGLE_PANEL_FLYOUT: 'panels/togglePanelFlyout',
    UPDATE_SUBPANEL_STATE: 'panels/updateSubPanelState',
    UPDATE_PANEL_LAYOUT: 'panels/updatePanelLayout',
    RESET_PANEL_TO_HOME: 'panels/resetPanelToHome',
    
    // Sub-panel actions
    CREATE_SUB_PANEL: 'panels/createSubPanel',
    TOGGLE_SUB_PANEL_COLLAPSE: 'panels/toggleSubPanelCollapse',
    UPDATE_SUB_PANEL_ORDER: 'panels/updateSubPanelOrder',
    
    // Drag and drop actions
    START_DRAG: 'panels/startDrag',
    UPDATE_DRAG_POSITION: 'panels/updateDragPosition',
    SET_DROP_TARGET: 'panels/setDropTarget',
    END_DRAG: 'panels/endDrag',
    
    // Resize actions
    START_RESIZE: 'panels/startResize',
    UPDATE_RESIZE: 'panels/updateResize',
    END_RESIZE: 'panels/endResize',
    
    // Settings actions
    UPDATE_SETTINGS: 'panels/updateSettings',
    
    // Keyboard shortcut actions
    REGISTER_SHORTCUT: 'panels/registerShortcut',
    UNREGISTER_SHORTCUT: 'panels/unregisterShortcut',
    TOGGLE_BY_SHORTCUT: 'panels/toggleByShortcut',
    
    // Reset actions
    RESET_TO_DEFAULTS: 'panels/resetToDefaults'
};

// Action creators
export const createDock = (payload) => ({ type: actionTypes.CREATE_DOCK, payload });
export const updateDockPosition = (payload) => ({ type: actionTypes.UPDATE_DOCK_POSITION, payload });
export const updateDockSize = (payload) => ({ type: actionTypes.UPDATE_DOCK_SIZE, payload });
export const toggleDockVisibility = (payload) => ({ type: actionTypes.TOGGLE_DOCK_VISIBILITY, payload });
export const toggleDockCollapse = (payload) => ({ type: actionTypes.TOGGLE_DOCK_COLLAPSE, payload });
export const maximizeDock = (payload) => ({ type: actionTypes.MAXIMIZE_DOCK, payload });
export const bringDockToFront = (payload) => ({ type: actionTypes.BRING_DOCK_TO_FRONT, payload });

export const registerPanel = (payload) => ({ type: actionTypes.REGISTER_PANEL, payload });
export const createPanel = (payload) => ({ type: actionTypes.CREATE_PANEL, payload });
export const updatePanelPosition = (payload) => ({ type: actionTypes.UPDATE_PANEL_POSITION, payload });
export const updatePanelSize = (payload) => ({ type: actionTypes.UPDATE_PANEL_SIZE, payload });
export const togglePanelVisibility = (payload) => ({ type: actionTypes.TOGGLE_PANEL_VISIBILITY, payload });
export const activatePanel = (payload) => ({ type: actionTypes.ACTIVATE_PANEL, payload });
export const updatePanelConfig = (payload) => ({ type: actionTypes.UPDATE_PANEL_CONFIG, payload });
export const mountPanel = (payload) => ({ type: actionTypes.MOUNT_PANEL, payload });
export const unmountPanel = (payload) => ({ type: actionTypes.UNMOUNT_PANEL, payload });
export const togglePanelFlyout = (payload) => ({ type: actionTypes.TOGGLE_PANEL_FLYOUT, payload });
export const updateSubPanelState = (payload) => ({ type: actionTypes.UPDATE_SUBPANEL_STATE, payload });
export const updatePanelLayout = (payload) => ({ type: actionTypes.UPDATE_PANEL_LAYOUT, payload });
export const resetPanelToHome = (payload) => ({ type: actionTypes.RESET_PANEL_TO_HOME, payload });

export const createSubPanel = (payload) => ({ type: actionTypes.CREATE_SUB_PANEL, payload });
export const toggleSubPanelCollapse = (payload) => ({ type: actionTypes.TOGGLE_SUB_PANEL_COLLAPSE, payload });
export const updateSubPanelOrder = (payload) => ({ type: actionTypes.UPDATE_SUB_PANEL_ORDER, payload });

export const startDrag = (payload) => ({ type: actionTypes.START_DRAG, payload });
export const updateDragPosition = (payload) => ({ type: actionTypes.UPDATE_DRAG_POSITION, payload });
export const setDropTarget = (payload) => ({ type: actionTypes.SET_DROP_TARGET, payload });
export const endDrag = (payload) => ({ type: actionTypes.END_DRAG, payload });

export const startResize = (payload) => ({ type: actionTypes.START_RESIZE, payload });
export const updateResize = (payload) => ({ type: actionTypes.UPDATE_RESIZE, payload });
export const endResize = (payload) => ({ type: actionTypes.END_RESIZE, payload });

export const updateSettings = (payload) => ({ type: actionTypes.UPDATE_SETTINGS, payload });

export const registerShortcut = (payload) => ({ type: actionTypes.REGISTER_SHORTCUT, payload });
export const unregisterShortcut = (payload) => ({ type: actionTypes.UNREGISTER_SHORTCUT, payload });
export const toggleByShortcut = (payload) => ({ type: actionTypes.TOGGLE_BY_SHORTCUT, payload });

// Grouped action creators object for compatibility
export const panelActions = {
    // Dock actions
    createDock,
    updateDockPosition,
    updateDockSize,
    toggleDockVisibility,
    toggleDockCollapse,
    maximizeDock,
    bringDockToFront,
    
    // Panel actions
    registerPanel,
    createPanel,
    updatePanelPosition,
    updatePanelSize,
    togglePanelVisibility,
    activatePanel,
    updatePanelConfig,
    mountPanel,
    unmountPanel,
    togglePanelFlyout,
    updateSubPanelState,
    updatePanelLayout,
    resetPanelToHome,
    
    // Sub-panel actions
    createSubPanel,
    toggleSubPanelCollapse,
    updateSubPanelOrder,
    
    // Drag and drop
    startDrag,
    updateDragPosition,
    setDropTarget,
    endDrag,
    
    // Resize
    startResize,
    updateResize,
    endResize,
    
    // Settings and shortcuts
    updateSettings,
    registerShortcut,
    unregisterShortcut,
    toggleByShortcut
};

export const resetToDefaults = () => ({ type: actionTypes.RESET_TO_DEFAULTS });

// Reducer
const panelsReducer = (state = initialState, action) => {
    switch (action.type) {
        case actionTypes.CREATE_DOCK: {
            const { id, title, position, size } = action.payload;
            return {
                ...state,
                docks: {
                    ...state.docks,
                    [id]: {
                        id,
                        title: title || 'New Dock',
                        position: position || { x: 100, y: 100 },
                        size: size || state.settings.defaultDockSize,
                        isVisible: true,
                        isCollapsed: false,
                        isMaximized: false,
                        panels: [],
                        activePanel: null,
                        zIndex: Math.max(...Object.values(state.docks).map(d => d.zIndex || 0)) + 1
                    }
                }
            };
        }
        
        case actionTypes.UPDATE_DOCK_POSITION: {
            const { dockId, position } = action.payload;
            if (!state.docks[dockId]) return state;
            return {
                ...state,
                docks: {
                    ...state.docks,
                    [dockId]: {
                        ...state.docks[dockId],
                        position
                    }
                }
            };
        }
        
        case actionTypes.UPDATE_DOCK_SIZE: {
            const { dockId, size } = action.payload;
            if (!state.docks[dockId]) return state;
            return {
                ...state,
                docks: {
                    ...state.docks,
                    [dockId]: {
                        ...state.docks[dockId],
                        size
                    }
                }
            };
        }
        
        case actionTypes.TOGGLE_DOCK_VISIBILITY: {
            const { dockId } = action.payload;
            if (!state.docks[dockId]) return state;
            return {
                ...state,
                docks: {
                    ...state.docks,
                    [dockId]: {
                        ...state.docks[dockId],
                        isVisible: !state.docks[dockId].isVisible
                    }
                }
            };
        }
        
        case actionTypes.TOGGLE_DOCK_COLLAPSE: {
            const { dockId } = action.payload;
            if (!state.docks[dockId]) return state;
            return {
                ...state,
                docks: {
                    ...state.docks,
                    [dockId]: {
                        ...state.docks[dockId],
                        isCollapsed: !state.docks[dockId].isCollapsed
                    }
                }
            };
        }
        
        case actionTypes.MAXIMIZE_DOCK: {
            const { dockId } = action.payload;
            if (!state.docks[dockId]) return state;
            const dock = state.docks[dockId];
            return {
                ...state,
                docks: {
                    ...state.docks,
                    [dockId]: {
                        ...dock,
                        isMaximized: !dock.isMaximized,
                        isCollapsed: dock.isMaximized ? dock.isCollapsed : false
                    }
                }
            };
        }
        
        case actionTypes.BRING_DOCK_TO_FRONT: {
            const { dockId } = action.payload;
            if (!state.docks[dockId]) return state;
            const maxZ = Math.max(...Object.values(state.docks).map(d => d.zIndex || 0));
            return {
                ...state,
                docks: {
                    ...state.docks,
                    [dockId]: {
                        ...state.docks[dockId],
                        zIndex: maxZ + 1
                    }
                }
            };
        }
        
        case actionTypes.CREATE_PANEL: {
            const { id, title, type, dockId, config } = action.payload;
            const panel = {
                id,
                title: title || 'New Panel',
                type: type || 'generic',
                dockId: dockId || null,
                position: { x: 0, y: 0 },
                size: state.settings.defaultPanelSize,
                isVisible: true,
                isCollapsed: false,
                isActive: false,
                config: config || {},
                subPanels: {}
            };
            
            let newState = {
                ...state,
                panels: {
                    ...state.panels,
                    [id]: panel
                }
            };
            
            // Add to dock if specified
            if (dockId && state.docks[dockId]) {
                const dock = state.docks[dockId];
                const updatedPanels = dock.panels.includes(id) ? dock.panels : [...dock.panels, id];
                
                newState.docks = {
                    ...newState.docks,
                    [dockId]: {
                        ...dock,
                        panels: updatedPanels,
                        activePanel: dock.activePanel || id
                    }
                };
                
                if (!dock.activePanel) {
                    newState.panels[id].isActive = true;
                }
            }
            
            return newState;
        }
        
        case actionTypes.REGISTER_PANEL: {
            const { panelId, config } = action.payload;
            return {
                ...state,
                sidebarPanels: {
                    ...state.sidebarPanels,
                    [panelId]: {
                        visible: true,
                        collapsed: false,
                        order: Object.keys(state.sidebarPanels).length,
                        config: config || {},
                        ...state.sidebarPanels[panelId]
                    }
                }
            };
        }
        
        case actionTypes.ACTIVATE_PANEL: {
            const { panelId } = action.payload;
            const panel = state.panels[panelId];
            if (!panel || !panel.dockId) return state;
            
            const dock = state.docks[panel.dockId];
            const updatedPanels = { ...state.panels };
            
            // Deactivate other panels in the same dock
            dock.panels.forEach(id => {
                if (updatedPanels[id]) {
                    updatedPanels[id] = {
                        ...updatedPanels[id],
                        isActive: false
                    };
                }
            });
            
            // Activate this panel
            updatedPanels[panelId] = {
                ...updatedPanels[panelId],
                isActive: true
            };
            
            return {
                ...state,
                panels: updatedPanels,
                docks: {
                    ...state.docks,
                    [panel.dockId]: {
                        ...dock,
                        activePanel: panelId
                    }
                }
            };
        }
        
        case actionTypes.UPDATE_PANEL_CONFIG: {
            const { panelId, config } = action.payload;
            if (!state.panels[panelId]) return state;
            return {
                ...state,
                panels: {
                    ...state.panels,
                    [panelId]: {
                        ...state.panels[panelId],
                        config: { ...state.panels[panelId].config, ...config }
                    }
                }
            };
        }
        
        case actionTypes.MOUNT_PANEL: {
            const { panelId, dockId, containerId } = action.payload;
            if (!state.panels[panelId]) return state;
            return {
                ...state,
                panels: {
                    ...state.panels,
                    [panelId]: {
                        ...state.panels[panelId],
                        isMounted: true,
                        mountedDockId: dockId,
                        containerId: containerId
                    }
                }
            };
        }
        
        case actionTypes.UNMOUNT_PANEL: {
            const { panelId } = action.payload;
            if (!state.panels[panelId]) return state;
            return {
                ...state,
                panels: {
                    ...state.panels,
                    [panelId]: {
                        ...state.panels[panelId],
                        isMounted: false,
                        mountedDockId: null,
                        containerId: null
                    }
                }
            };
        }
        
        case actionTypes.TOGGLE_PANEL_FLYOUT: {
            const { panelId } = action.payload;
            if (!state.panels[panelId]) return state;
            
            const currentPanel = state.panels[panelId];
            const newFlyoutState = !currentPanel.isFlyout;
            
            return {
                ...state,
                panels: {
                    ...state.panels,
                    [panelId]: {
                        ...currentPanel,
                        isFlyout: newFlyoutState,
                        // Unmount when toggling to force remount in new mode
                        isMounted: false,
                        mountedDockId: null,
                        containerId: null
                    }
                }
            };
        }
        
        case actionTypes.UPDATE_SUBPANEL_STATE: {
            const { panelId, subPanelId, updates } = action.payload;
            const panel = state.panels[panelId];
            if (!panel || !panel.subPanels || !panel.subPanels[subPanelId]) return state;
            
            return {
                ...state,
                panels: {
                    ...state.panels,
                    [panelId]: {
                        ...panel,
                        subPanels: {
                            ...panel.subPanels,
                            [subPanelId]: {
                                ...panel.subPanels[subPanelId],
                                ...updates
                            }
                        }
                    }
                }
            };
        }
        
        case actionTypes.UPDATE_PANEL_LAYOUT: {
            const { panelId, isFlyout, targetDockId } = action.payload;
            const panel = state.panels[panelId];
            if (!panel) return state;
            
            return {
                ...state,
                panels: {
                    ...state.panels,
                    [panelId]: {
                        ...panel,
                        isFlyout,
                        dockId: targetDockId || panel.dockId,
                        // Clear mounting state to force remount
                        isMounted: false,
                        mountedDockId: null,
                        containerId: null
                    }
                }
            };
        }
        
        case actionTypes.RESET_PANEL_TO_HOME: {
            const { panelId } = action.payload;
            const panel = state.panels[panelId];
            if (!panel) return state;
            
            return {
                ...state,
                panels: {
                    ...state.panels,
                    [panelId]: {
                        ...panel,
                        isFlyout: false,
                        isMounted: false,
                        mountedDockId: null,
                        containerId: null
                    }
                }
            };
        }
        
        case actionTypes.TOGGLE_SUB_PANEL_COLLAPSE: {
            const { panelId, subPanelId } = action.payload;
            const panel = state.panels[panelId];
            if (!panel || !panel.subPanels[subPanelId]) return state;
            
            return {
                ...state,
                panels: {
                    ...state.panels,
                    [panelId]: {
                        ...panel,
                        subPanels: {
                            ...panel.subPanels,
                            [subPanelId]: {
                                ...panel.subPanels[subPanelId],
                                isCollapsed: !panel.subPanels[subPanelId].isCollapsed
                            }
                        }
                    }
                }
            };
        }
        
        case actionTypes.START_DRAG: {
            const { itemType, itemId, offset } = action.payload;
            return {
                ...state,
                dragState: {
                    isDragging: true,
                    draggedItem: { type: itemType, id: itemId },
                    dragOffset: offset || { x: 0, y: 0 },
                    dropTarget: null
                }
            };
        }
        
        case actionTypes.UPDATE_DRAG_POSITION: {
            const { position } = action.payload;
            if (!state.dragState.isDragging || !state.dragState.draggedItem) return state;
            
            const { type, id } = state.dragState.draggedItem;
            const newPosition = {
                x: position.x - state.dragState.dragOffset.x,
                y: position.y - state.dragState.dragOffset.y
            };
            
            if (type === 'dock' && state.docks[id]) {
                return {
                    ...state,
                    docks: {
                        ...state.docks,
                        [id]: {
                            ...state.docks[id],
                            position: newPosition
                        }
                    }
                };
            } else if (type === 'panel' && state.panels[id]) {
                return {
                    ...state,
                    panels: {
                        ...state.panels,
                        [id]: {
                            ...state.panels[id],
                            position: newPosition
                        }
                    }
                };
            }
            
            return state;
        }
        
        case actionTypes.END_DRAG: {
            return {
                ...state,
                dragState: {
                    isDragging: false,
                    draggedItem: null,
                    dragOffset: { x: 0, y: 0 },
                    dropTarget: null
                }
            };
        }
        
        case actionTypes.UPDATE_SETTINGS: {
            return {
                ...state,
                settings: { ...state.settings, ...action.payload }
            };
        }
        
        case actionTypes.REGISTER_SHORTCUT: {
            const { id, shortcut } = action.payload;
            return {
                ...state,
                shortcuts: { ...state.shortcuts, [id]: shortcut }
            };
        }
        
        case actionTypes.UNREGISTER_SHORTCUT: {
            const { id } = action.payload;
            const { [id]: removed, ...remainingShortcuts } = state.shortcuts;
            return {
                ...state,
                shortcuts: remainingShortcuts
            };
        }
        
        case actionTypes.TOGGLE_BY_SHORTCUT: {
            const { id } = action.payload;
            
            // Special case: Create debug dock if it doesn't exist
            if (id === 'debug-dock' && !state.docks[id]) {
                return {
                    ...state,
                    docks: {
                        ...state.docks,
                        'debug-dock': {
                            id: 'debug-dock',
                            title: 'Debug Dock',
                            position: { x: 300, y: 150 },
                            size: { width: 600, height: 450 },
                            isVisible: true,
                            zIndex: getNextZIndex(state),
                            panels: [],
                            activePanel: null
                        }
                    }
                };
            }
            
            // Check if it's a dock
            if (state.docks[id]) {
                return {
                    ...state,
                    docks: {
                        ...state.docks,
                        [id]: {
                            ...state.docks[id],
                            isVisible: !state.docks[id].isVisible
                        }
                    }
                };
            }
            
            // Check if it's a panel
            if (state.panels[id]) {
                return {
                    ...state,
                    panels: {
                        ...state.panels,
                        [id]: {
                            ...state.panels[id],
                            isVisible: !state.panels[id].isVisible
                        }
                    }
                };
            }
            
            return state;
        }
        
        case actionTypes.RESET_TO_DEFAULTS: {
            console.log('🔄 RESETTING PANELS TO DEFAULT STATE...');
            return getInitialPanelState();
        }
        
        default:
            return state;
    }
};

// Export with both default and named exports for compatibility
export default panelsReducer;
export const panelReducer = panelsReducer;  // Named export for appState.js compatibility

// Selectors
export const selectDocks = (state) => state.panels.docks;
export const selectPanels = (state) => state.panels.panels;
export const selectDragState = (state) => state.panels.dragState;
export const selectResizeState = (state) => state.panels.resizeState;
export const selectSettings = (state) => state.panels.settings;

export const selectDockById = (state, dockId) => state.panels.docks[dockId];
export const selectPanelById = (state, panelId) => state.panels.panels[panelId];

export const selectVisibleDocks = (state) => 
    Object.values(state.panels.docks).filter(dock => dock.isVisible);

export const selectActivePanelsInDock = (state, dockId) => {
    const dock = state.panels.docks[dockId];
    if (!dock) return [];
    
    return dock.panels
        .map(panelId => state.panels.panels[panelId])
        .filter(panel => panel && panel.isVisible);
};

// Selector for getting panel state
export const selectPanel = (state, panelId) => {
    return state.panels?.panels?.[panelId] || null;
};

// Selector for getting subpanel state
export const selectSubPanel = (state, panelId, subPanelId) => {
    const panel = selectPanel(state, panelId);
    return panel?.subPanels?.[subPanelId] || null;
};

// Selector for getting flyout panels
export const selectFlyoutPanels = (state) => {
    if (!state.panels?.panels) return [];
    
    return Object.values(state.panels.panels)
        .filter(panel => panel.isFlyout && panel.isVisible);
};

// === THUNKS FOR ASYNC OPERATIONS ===

export const panelThunks = {
    // Register panel
    registerPanel: ({ panelId, config }) => (dispatch) => {
        dispatch(panelActions.registerPanel({ panelId, config }));
    },
    
    // Toggle panel visibility
    togglePanel: (panelId) => (dispatch, getState) => {
        const state = getState();
        const panel = state.panels?.panels?.[panelId];
        if (panel) {
            dispatch(panelActions.togglePanelVisibility({ panelId }));
        }
    },
    
    // Load panel state from persistence
    loadInitialPanelState: () => (dispatch) => {
        // State is already loaded in getInitialPanelState(), no action needed
        console.log('[PanelThunks] Panel state loaded from persistence automatically');
    },
    
    // Save panel state (automatically handled by persistence middleware)
    saveState: () => (dispatch, getState) => {
        const state = getState();
        try {
            localStorage.setItem('devpages_panel_state', JSON.stringify(state.panels));
            console.log('[PanelThunks] Panel state saved to localStorage');
        } catch (error) {
            console.error('[PanelThunks] Failed to save panel state:', error);
        }
    }
};

console.log('[PanelSlice] ✅ Advanced Redux panel system with persistence ready'); 