import { createSlice, createAsyncThunk } from '/packages/devpages-statekit/src/index.js';

const SETTINGS_PANEL_STATE_KEY = 'devpages_settings_panel_state';

// --- Async Thunks ---

/**
 * Loads initial panel state from localStorage
 * @param {string} group - The panel group to load ('sidebar', 'debug', etc.)
 */
export const loadInitialPanelState = createAsyncThunk(
    'panels/loadInitialState',
    async (group, { getState }) => {
        try {
            // Determine which localStorage key to use based on group
            let storageKey;
            switch (group) {
                case 'sidebar':
                case 'settings':
                    storageKey = SETTINGS_PANEL_STATE_KEY;
                    break;
                case 'debug':
                    storageKey = 'devpages_debug_panel_state';
                    break;
                default:
                    storageKey = `devpages_${group}_panel_state`;
            }
            
            const storedState = localStorage.getItem(storageKey);
            
            if (storedState) {
                const parsedState = JSON.parse(storedState);
                console.log(`[PanelSlice] Loaded ${group} panel state from localStorage:`, parsedState);
                
                // ✅ CORRECT - Return the data, let reducer handle state updates
                return { group, loadedState: parsedState };
            } else {
                console.log(`[PanelSlice] No stored state found for ${group} panels, using defaults`);
                return { group, loadedState: null };
            }
        } catch (error) {
            console.error(`[PanelSlice] Error loading ${group} panel state:`, error);
            throw error;
        }
    }
);

/**
 * StateKit thunk for registering a panel
 * @param {string} panelId - Panel ID to register
 * @param {object} config - Panel configuration
 */
export const registerPanel = createAsyncThunk(
    'panels/register',
    async ({ panelId, config }, { dispatch, getState }) => {
        try {
            console.log(`[PanelSlice] Registering panel: ${panelId}`);
            
            // Import panelRegistry to register panel configuration
            const { panelRegistry } = await import('/client/panels/panelRegistry.js');
            
            // Register with panelRegistry first
            panelRegistry.register({
                id: panelId,
                ...config
            });
            
            // Return the registration data for the reducer to handle
            return { 
                panelId, 
                config,
                success: true 
            };
        } catch (error) {
            console.error(`[PanelSlice] Error registering panel ${panelId}:`, error);
            throw error;
        }
    }
);

/**
 * StateKit thunk for unregistering a panel
 * @param {string} panelId - Panel ID to unregister
 */
export const unregisterPanel = createAsyncThunk(
    'panels/unregister',
    async (panelId, { dispatch, getState }) => {
        try {
            console.log(`[PanelSlice] Unregistering panel: ${panelId}`);
            
            // Import panelRegistry to unregister panel configuration
            const { panelRegistry } = await import('/client/panels/panelRegistry.js');
            
            // Unregister from panelRegistry
            panelRegistry.unregister(panelId);
            
            // Return the unregistration data for the reducer to handle
            return { 
                panelId, 
                success: true 
            };
        } catch (error) {
            console.error(`[PanelSlice] Error unregistering panel ${panelId}:`, error);
            throw error;
        }
    }
);

const initialState = {
    visible: false,
    position: { x: 100, y: 100 },
    size: { width: 800, height: 600 },
    collapsedSections: {},
    collapsedSubsections: {},
    draggedPanel: null
};

const panelSlice = createSlice({
    name: 'panels',
    initialState,
    reducers: {
        togglePanel(state, action) {
            const { enabled } = action.payload || {};
            state.visible = typeof enabled === 'boolean' ? enabled : !state.visible;
        },
        setPanelPosition(state, action) {
            const { x, y } = action.payload;
            if (typeof x === 'number' && typeof y === 'number') {
                state.position = { x, y };
            }
        },
        setPanelSize(state, action) {
            const { width, height } = action.payload;
            if (typeof width === 'number' && typeof height === 'number') {
                state.size = { width, height };
            }
        },
        toggleSection(state, action) {
            const { sectionId } = action.payload;
            if (typeof sectionId === 'string') {
                if (sectionId.includes('/') || sectionId.includes(':')) {
                    const currentSubsections = state.collapsedSubsections || {};
                    currentSubsections[sectionId] = !currentSubsections[sectionId];
                } else {
                    const currentSections = state.collapsedSections || {};
                    currentSections[sectionId] = !currentSections[sectionId];
                }
            }
        },
        setSectionState(state, action) {
            const { sectionId, collapsed } = action.payload;
            if (typeof sectionId === 'string' && typeof collapsed === 'boolean') {
                if (sectionId.includes('/') || sectionId.includes(':')) {
                    state.collapsedSubsections[sectionId] = collapsed;
                } else {
                    state.collapsedSections[sectionId] = collapsed;
                }
            }
        },
        setPanelState(state, action) {
            if (action.payload && typeof action.payload === 'object') {
                return { ...state, ...action.payload };
            }
        },
        openPanel(state, action) {
            state.visible = true;
            if (action.payload && typeof action.payload === 'string') {
                state.collapsedSections[action.payload] = false;
            }
        },
        refreshPanels(state) {
            // This reducer doesn't need to change the state.
            // Its purpose is to provide a hook for other parts of the app
            // to listen for and react to a panel refresh event.
            return state;
        },
        collapseAllPanels(state, action) {
            const { group } = action.payload || {};
            // Collapse all sections - if group is specified, could be used for filtering in the future
            const newCollapsedSections = {};
            // For now, collapse all sections
            Object.keys(state.collapsedSections || {}).forEach(key => {
                newCollapsedSections[key] = true;
            });
            state.collapsedSections = newCollapsedSections;
            
            // Also collapse all subsections
            const newCollapsedSubsections = {};
            Object.keys(state.collapsedSubsections || {}).forEach(key => {
                newCollapsedSubsections[key] = true;
            });
            state.collapsedSubsections = newCollapsedSubsections;
        },
        setDraggedPanel(state, action) {
            state.draggedPanel = action.payload;
        },
        handleDrop(state, action) {
            const { sourceId, targetId, position } = action.payload || {};
            // Handle panel reordering logic here
            // This is a placeholder implementation
            state.draggedPanel = null;
        }
    },
    // Handle async thunk actions
    extraReducers: (builder) => {
        builder
            .addCase(loadInitialPanelState.fulfilled, (state, action) => {
                const { loadedState } = action.payload;
                
                if (loadedState) {
                    // ✅ CORRECT - Restore state in the reducer
                    if (loadedState.visible !== undefined) {
                        state.visible = loadedState.visible;
                    }
                    if (loadedState.position) {
                        state.position = { ...state.position, ...loadedState.position };
                    }
                    if (loadedState.size) {
                        state.size = { ...state.size, ...loadedState.size };
                    }
                    if (loadedState.collapsedSections) {
                        state.collapsedSections = { ...state.collapsedSections, ...loadedState.collapsedSections };
                    }
                    if (loadedState.collapsedSubsections) {
                        state.collapsedSubsections = { ...state.collapsedSubsections, ...loadedState.collapsedSubsections };
                    }
                }
            })
            .addCase(loadInitialPanelState.rejected, (state, action) => {
                console.error('[PanelSlice] Failed to load initial panel state:', action.error);
                // Keep default state on error
            })
            .addCase(registerPanel.fulfilled, (state, action) => {
                const { panelId, config } = action.payload;
                console.log(`[PanelSlice] Panel registered successfully: ${panelId}`);
                // Panel registration state is handled by panelsReducer, this slice handles UI state
            })
            .addCase(registerPanel.rejected, (state, action) => {
                console.error('[PanelSlice] Failed to register panel:', action.error);
            })
            .addCase(unregisterPanel.fulfilled, (state, action) => {
                const { panelId } = action.payload;
                console.log(`[PanelSlice] Panel unregistered successfully: ${panelId}`);
                // Panel unregistration state is handled by panelsReducer, this slice handles UI state
            })
            .addCase(unregisterPanel.rejected, (state, action) => {
                console.error('[PanelSlice] Failed to unregister panel:', action.error);
            });
    }
});

export const {
    togglePanel,
    setPanelPosition,
    setPanelSize,
    toggleSection,
    setSectionState,
    setPanelState,
    openPanel,
    refreshPanels,
    collapseAllPanels,
    setDraggedPanel,
    handleDrop
} = panelSlice.actions;

export default panelSlice.reducer; 