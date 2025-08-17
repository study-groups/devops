/**
 * @file fileSlice.js
 * @description File state management slice - MODERNIZED
 * ✅ MODERNIZED: Converted from legacy manual pattern to RTK createSlice
 */

import { createSlice } from '@reduxjs/toolkit';
import { setContent } from './editorSlice.js';

const initialState = {
    currentFile: {
        pathname: null,
        content: '',
        originalContent: '', // Keep track of the original content to check for dirtiness
        isModified: false,
        lastModified: null
    },
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null
};

// ✅ MODERNIZED: RTK createSlice pattern
const fileSlice = createSlice({
    name: 'file',
    initialState,
    reducers: {
        saveFilePending: (state) => {
            state.status = 'loading';
        },
        loadFilePending: (state, action) => {
            state.status = 'loading';
            state.error = null;
            state.currentFile.pathname = action.payload.pathname;
        },
        loadFileSuccess: (state, action) => {
            state.status = 'succeeded';
            state.error = null;
            state.currentFile = {
                ...state.currentFile,
                ...action.payload,
                originalContent: action.payload.content,
                isModified: false
            };
        },
        loadFileFailure: (state, action) => {
            state.status = 'failed';
            state.error = action.payload;
        },
        clearFile: (state) => {
            state.currentFile = {
                pathname: null,
                content: '',
                originalContent: '',
                isModified: false,
                lastModified: null
            };
            state.status = 'idle';
            state.error = null;
        },
        updateFileContent: (state, action) => {
            state.currentFile.content = action.payload.content;
            state.currentFile.isModified = state.currentFile.content !== state.currentFile.originalContent;
        }
    }
});

// ✅ MODERNIZED: Export RTK slice actions and reducer
export const fileActions = fileSlice.actions;
export const fileReducer = fileSlice.reducer;
export default fileReducer;

// --- Thunks ---
export const fileThunks = {
    loadFileContent: (pathname) => async (dispatch, getState) => {
        try {
            dispatch(fileActions.loadFilePending({ pathname }));
            const response = await fetch(`/api/files/content?pathname=${pathname}`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch file content: ${response.statusText}`);
            }
            const content = await response.text();
            dispatch(fileActions.loadFileSuccess({ pathname, content }));
            dispatch(setContent(content));
        } catch (error) {
            dispatch(fileActions.loadFileFailure(error.toString()));
        }
    },

    saveFile: () => async (dispatch, getState) => {
        const { currentFile } = getState().file;
        if (!currentFile.isModified) {
            return;
        }
        try {
            dispatch(fileActions.saveFilePending());
            const response = await fetch('/api/files/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    pathname: currentFile.pathname,
                    content: currentFile.content
                })
            });
            if (!response.ok) {
                throw new Error(`Failed to save file: ${response.statusText}`);
            }
            // Mark as saved by updating original content
            dispatch(fileActions.loadFileSuccess({ 
                pathname: currentFile.pathname, 
                content: currentFile.content 
            }));
            dispatch(setContent(currentFile.content));
        } catch (error) {
            dispatch(fileActions.loadFileFailure(error.toString()));
            console.error('[fileSlice] Save failed:', error);
        }
    }
};