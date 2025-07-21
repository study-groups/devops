// --- Action Types ---
const TOGGLE_PANEL = 'panels/togglePanel';
const SET_PANEL_POSITION = 'panels/setPanelPosition';
const SET_PANEL_SIZE = 'panels/setPanelSize';
const TOGGLE_SECTION = 'panels/toggleSection';
const SET_PANEL_STATE = 'panels/setPanelState';
const LOAD_INITIAL_STATE_SUCCESS = 'panels/loadInitialStateSuccess';

// --- Initial State ---
const initialState = {
    sidebarPanels: {}, // Holds state for each panel, e.g., { 'file-browser': { visible: true, order: 1 } }
    instances: {},     // Holds mounted panel instances
};

// --- Reducer ---
export function panelReducer(state = initialState, action) {
    switch (action.type) {
        case TOGGLE_PANEL: {
            const { panelId } = action.payload;
            const currentPanelState = state.sidebarPanels[panelId] || { visible: true }; // Default to visible if not set
            return {
                ...state,
                sidebarPanels: {
                    ...state.sidebarPanels,
                    [panelId]: {
                        ...currentPanelState,
                        visible: !currentPanelState.visible,
                    },
                },
            };
        }
        case SET_PANEL_POSITION:
            return { ...state, position: action.payload };
        case SET_PANEL_SIZE:
            return { ...state, size: action.payload };
        case TOGGLE_SECTION:
            const { sectionId } = action.payload;
            const isSub = sectionId.includes('/') || sectionId.includes(':');
            const target = isSub ? 'collapsedSubsections' : 'collapsedSections';
            return { ...state, [target]: { ...state[target], [sectionId]: !state[target][sectionId] } };
        case LOAD_INITIAL_STATE_SUCCESS:
            return { ...state, ...action.payload };
        default:
            return state;
    }
}

// --- Action Creators ---
export const panelActions = {
    togglePanel: (panelId) => ({ type: TOGGLE_PANEL, payload: { panelId } }),
    setPanelPosition: (position) => ({ type: SET_PANEL_POSITION, payload: position }),
    setPanelSize: (size) => ({ type: SET_PANEL_SIZE, payload: size }),
    toggleSection: (sectionId) => ({ type: TOGGLE_SECTION, payload: { sectionId } }),
    loadInitialStateSuccess: (state) => ({ type: LOAD_INITIAL_STATE_SUCCESS, payload: state }),
};

// --- Thunks ---
export const panelThunks = {
    loadInitialPanelState: (group) => async (dispatch) => {
        try {
            const storageKey = `devpages_${group}_panel_state`;
            const storedState = localStorage.getItem(storageKey);
            if (storedState) {
                dispatch(panelActions.loadInitialStateSuccess(JSON.parse(storedState)));
            }
        } catch (error) {
            console.error(`[PanelSlice] Error loading ${group} panel state:`, error);
        }
    },
    togglePanelVisibility: (panelId) => (dispatch) => {
        dispatch(panelActions.togglePanel(panelId));
    },
    registerPanel: ({ panelId, config }) => async (dispatch) => {
        const { panelRegistry } = await import('/client/panels/panelRegistry.js');
        panelRegistry.register({ id: panelId, ...config });
        // Dispatch an action if the store needs to know about the new panel
    },
    unregisterPanel: (panelId) => async (dispatch) => {
        const { panelRegistry } = await import('/client/panels/panelRegistry.js');
        panelRegistry.unregister(panelId);
        // Dispatch an action if the store needs to know about the removed panel
    },
};

console.log('[panelSlice] Migrated to standard Redux pattern.'); 