/**
 * client/store/reducers/workspaceReducer.js
 * Reducer for workspace panel state.
 */
import { ActionTypes } from '/client/messaging/actionTypes.js';

export function workspaceReducer(state = {}, action) {
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