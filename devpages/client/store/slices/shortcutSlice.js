// Action Types
const SHORTCUT_TRIGGERED = 'shortcut/triggered';

const initialState = {
    lastShortcut: null,
};

// Action Creators
export const shortcutTriggered = (shortcut) => ({
    type: SHORTCUT_TRIGGERED,
    payload: shortcut,
});

// Reducer
export const shortcutReducer = (state = initialState, action) => {
    switch (action.type) {
        case SHORTCUT_TRIGGERED:
            return {
                ...state,
                lastShortcut: action.payload,
            };
        default:
            return state;
    }
};
