// Action Types
const SET_CONTENT = 'editor/setContent';
const SET_DIRTY = 'editor/setDirty';

const initialState = {
    content: '',
    isDirty: false,
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
};

// Action Creators
export const setContent = (content) => ({
    type: SET_CONTENT,
    payload: content,
});

export const setDirty = (isDirty) => ({
    type: SET_DIRTY,
    payload: isDirty,
});

// Reducer
export const editorReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_CONTENT:
            return {
                ...state,
                content: action.payload,
                isDirty: false,
            };
        case SET_DIRTY:
            return {
                ...state,
                isDirty: action.payload,
            };
        default:
            return state;
    }
};
