/**
 * client/store/reducers/workspaceReducer.js
 * Reducer for workspace panel state.
 */
import { ActionTypes } from '/client/messaging/actionTypes.js';

// Initial workspace state with default panel configurations
const initialState = {
    sidebar: {
        visible: false,
        width: 300,
        activeSection: null // No active section initially
    },
    editor: {
        visible: true, // Start with editor visible
        width: 50 // 50% width in split mode
    },
    preview: {
        visible: true, // Start with preview visible
        width: 50 // 50% width in split mode
    }
};

export function workspaceReducer(state = initialState, action) {
    switch (action.type) {
        case ActionTypes.WORKSPACE_SET_PANEL_VISIBILITY: {
            const { panel, visible } = action.payload;
            if (!state[panel]) return state;

            return {
                ...state,
                [panel]: {
                    ...state[panel],
                    visible,
                },
            };
        }

        case ActionTypes.WORKSPACE_SET_PANEL_WIDTH: {
            const { panel, width } = action.payload;
            if (!state[panel]) return state;

            return {
                ...state,
                [panel]: {
                    ...state[panel],
                    width,
                },
            };
        }

        default:
            return state;
    }
} 