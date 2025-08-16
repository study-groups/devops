// Action Types
const BUTTON_CLICKED = 'button/clicked';

const initialState = {
    lastClicked: null,
};

// Action Creators
export const buttonClicked = (buttonId) => ({
    type: BUTTON_CLICKED,
    payload: buttonId,
});

// Reducer
export const buttonReducer = (state = initialState, action) => {
    switch (action.type) {
        case BUTTON_CLICKED:
            return {
                ...state,
                lastClicked: action.payload,
            };
        default:
            return state;
    }
};
