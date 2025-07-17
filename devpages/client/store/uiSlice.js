/**
 * @file uiSlice.js
 * @description A slice for managing the UI state, such as the theme.
 */

import { createSlice } from '/packages/devpages-statekit/src/index.js';

const initialState = {
    theme: 'light',
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setTheme: (state, action) => {
            state.theme = action.payload;
        },
        toggleTheme: (state) => {
            state.theme = state.theme === 'light' ? 'dark' : 'light';
        },
    },
});

export const { setTheme, toggleTheme } = uiSlice.actions;
export default uiSlice.reducer; 