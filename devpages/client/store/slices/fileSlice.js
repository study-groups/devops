/**
 * @file fileSlice.js
 * @description File state management slice - MODERNIZED
 * ✅ MODERNIZED: Converted from legacy manual pattern to RTK createSlice
 */

import { createSlice } from '@reduxjs/toolkit';
import { setContent, setContentSaved } from './editorSlice.js';

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
        console.log(`[PATHXXX] fileThunks.loadFileContent - Loading file: '${pathname}'`);
        try {
            dispatch(fileActions.loadFilePending({ pathname }));
            console.log(`[PATHXXX] fileThunks.loadFileContent - Dispatched loadFilePending`);
            
            const response = await fetch(`/api/files/content?pathname=${pathname}`, {
                credentials: 'include'
            });
            console.log(`[PATHXXX] fileThunks.loadFileContent - Fetch response status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch file content: ${response.statusText}`);
            }
            const content = await response.text();
            console.log(`[PATHXXX] fileThunks.loadFileContent - File content loaded, length: ${content.length}`);
            
            dispatch(fileActions.loadFileSuccess({ pathname, content }));
            dispatch(setContent(content));
            console.log(`[PATHXXX] fileThunks.loadFileContent - File successfully loaded and content set in editor`);
        } catch (error) {
            console.error(`[PATHXXX] fileThunks.loadFileContent - Error loading file:`, error);
            dispatch(fileActions.loadFileFailure(error.toString()));
        }
    },

    saveFile: () => async (dispatch, getState) => {
        const state = getState();
        const { currentFile } = state.file;
        const { currentPathname } = state.path;
        const editorContent = state.editor?.content || currentFile.content;
        
        const pathname = currentFile.pathname || currentPathname;
        if (!pathname) {
            console.warn('[fileSlice] No file selected for saving');
            return;
        }

        // Use editor content if available, fallback to file content
        const contentToSave = editorContent || currentFile.content;
        
        try {
            dispatch(fileActions.saveFilePending());
            console.log(`[fileSlice] Saving file: ${pathname} (${contentToSave.length} chars)`);
            
            // Use the correct API endpoint that we verified works
            const response = await fetch('/api/files/save', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    pathname: pathname,
                    content: contentToSave
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errorData.error || `Failed to save file: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log(`[fileSlice] File saved successfully: ${pathname}`, result);
            
            // Mark as saved by updating original content
            dispatch(fileActions.loadFileSuccess({ 
                pathname: pathname, 
                content: contentToSave 
            }));
            
            // Update editor content and mark as saved (not modified)  
            dispatch(setContentSaved(contentToSave));
            
        } catch (error) {
            dispatch(fileActions.loadFileFailure(error.toString()));
            console.error('[fileSlice] Save failed:', error);
            
            // Show user-friendly error
            if (typeof window !== 'undefined' && window.alert) {
                window.alert(`Failed to save file: ${error.message}`);
            }
        }
    }
};