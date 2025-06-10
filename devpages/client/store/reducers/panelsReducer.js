import { ActionTypes } from '/client/messaging/messageQueue.js';

// The initial state for this slice is provided by appState.js
export function panelsReducer(state = {}, action) {
    switch (action.type) {
        case ActionTypes.PANEL_SET_STATE: {
            const { panelId, newState } = action.payload;
            if (!panelId || !state[panelId]) {
                return state;
            }
            
            const updatedPanel = {
                ...state[panelId],
                ...newState
            };

            return {
                ...state,
                [panelId]: updatedPanel
            };
        }

        case ActionTypes.PANEL_TOGGLE_VISIBILITY: {
            const { panelId } = action.payload;
            if (!panelId || !state[panelId]) {
                return state;
            }

            const currentPanel = state[panelId];
            const updatedPanel = {
                ...currentPanel,
                visible: !currentPanel.visible
            };

            return {
                ...state,
                [panelId]: updatedPanel
            };
        }

        case ActionTypes.PANEL_SET_WIDTH: {
            const { panelId, width } = action.payload;
            if (!panelId || typeof width !== 'number' || !state[panelId]) {
                return state;
            }

            const updatedPanel = {
                ...state[panelId],
                width: width
            };

            return {
                ...state,
                [panelId]: updatedPanel
            };
        }

        default:
            return state;
    }
} 