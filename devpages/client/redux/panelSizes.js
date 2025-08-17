/**
 * redux/panelSizes.js
 *
 * This file contains the Redux actions and reducers for managing the sizes
 * of the resizable panels in the workspace.
 */

// Actions
const SET_PANEL_SIZE = 'panelSizes/SET_PANEL_SIZE';

// Action Creators
export const setPanelSize = (panel, size) => ({
    type: SET_PANEL_SIZE,
    payload: { panel, size },
});

// Initial State
const initialState = {
    sidebar: 300, // default width
    preview: 300, // default width
};

// Reducer
export default function panelSizesReducer(state = initialState, action) {
    switch (action.type) {
        case SET_PANEL_SIZE:
            return {
                ...state,
                [action.payload.panel]: action.payload.size,
            };
        default:
            return state;
    }
}
