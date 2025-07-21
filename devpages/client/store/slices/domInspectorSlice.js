/**
 * DOM Inspector Slice - Manages state for the DOM Inspector tool
 */

// --- Action Types ---
const SET_STATE = 'domInspector/setState';

// --- Initial State ---
const initialState = {
    visible: false,
    position: { x: 10, y: 10 },
    size: { width: 600, height: 400 },
    splitPosition: 50,
    elementDetails: null,
    highlightedElement: null,
    isPicking: false,
    highlight: {
        enabled: true,
        mode: 'border' // or 'both', 'none'
    },
    selectorHistory: [],
    collapsedSections: {},
    treeState: {}
};

// --- Reducer ---
export function domInspectorReducer(state = initialState, action) {
    switch (action.type) {
        case SET_STATE:
            return { ...state, ...action.payload };
        default:
            return state;
    }
}

// --- Action Creators ---
export const setState = (payload) => ({ type: SET_STATE, payload }); 