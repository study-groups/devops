/**
 * @file editorSlice.js
 * @description Editor state management slice - MODERNIZED
 * ✅ MODERNIZED: Converted from legacy manual pattern to RTK createSlice
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    content: '',
    cursorPosition: 0,
    isModified: false,
    lastSaved: null
};

// ✅ MODERNIZED: RTK createSlice pattern
const editorSlice = createSlice({
    name: 'editor',
    initialState,
    reducers: {
        setContent: (state, action) => {
            state.content = action.payload;
            state.isModified = true;
        },
        setModified: (state, action) => {
            state.isModified = action.payload;
        },
        setCursorPosition: (state, action) => {
            state.cursorPosition = action.payload;
        },
        markSaved: (state) => {
            state.isModified = false;
            state.lastSaved = new Date().toISOString();
        },
        resetEditor: (state) => {
            state.content = '';
            state.cursorPosition = 0;
            state.isModified = false;
            state.lastSaved = null;
        }
    }
});

// ✅ MODERNIZED: Export RTK slice actions and reducer
export const { setContent, setModified, setCursorPosition, markSaved, resetEditor } = editorSlice.actions;
export const editorReducer = editorSlice.reducer;
export default editorReducer;