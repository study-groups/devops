/**
 * @file uiSlice.js
 * @description UI slice for Redux with standard Redux Toolkit patterns
 * Manages UI state (viewMode, log visibility, theme) with manual persistence
 */

import { createSlice } from '@reduxjs/toolkit';
import { storageService } from '/client/services/storageService.js';

// --- Load persisted state from localStorage ---
const loadPersistedUIState = () => {
    try {
        const stored = storageService.getItem('settings_ui');
        if (stored && typeof stored === 'object') {
            return stored;
        }
    } catch (e) {
        console.warn('[uiSlice] Failed to load persisted UI state:', e);
    }
    return {};
};

// --- Persistence helper ---
const persistUIState = (state) => {
    try {
        // Create a plain object copy immediately while the proxy is still valid
        const plainState = {
            theme: state.theme,
            viewMode: state.viewMode,
            logVisible: state.logVisible,
            logHeight: state.logHeight,
            logMenuVisible: state.logMenuVisible,
            leftSidebarVisible: state.leftSidebarVisible,
            editorVisible: state.editorVisible,
            previewVisible: state.previewVisible,
            contextManagerVisible: state.contextManagerVisible,
            colorScheme: state.colorScheme,
            designDensity: state.designDensity,
            isAuthDropdownVisible: state.isAuthDropdownVisible
        };
        
        // Use setTimeout for async persistence but with the plain object
        setTimeout(() => {
            try {
                storageService.setItem('settings_ui', plainState);
            } catch (e) {
                console.error('[uiSlice] Failed to persist UI state:', e);
            }
        }, 0);
    } catch (e) {
        console.error('[uiSlice] Failed to prepare UI state for persistence:', e);
    }
};

// --- Default UI Settings ---
const defaultUIState = {
    theme: 'light',
    viewMode: 'preview',        // 'preview', 'split', 'editor'
    logVisible: true,
    logHeight: 120,             // pixels
    logMenuVisible: false,
    leftSidebarVisible: false,
    editorVisible: true,
    previewVisible: true,
    contextManagerVisible: true, // PathManager should ALWAYS be visible
    colorScheme: 'system',      // 'light', 'dark', 'system'
    designDensity: 'normal',    // 'compact', 'normal', 'spacious'
    isAuthDropdownVisible: false,
};

// Merge default state with persisted state
const initialState = { ...defaultUIState, ...loadPersistedUIState() };

// --- Create Standard Redux Toolkit Slice ---
const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        updateSetting: (state, action) => {
            const { key, value } = action.payload;
            state[key] = value;
            persistUIState(state);
        },
        toggleLogVisibility: (state) => {
            console.log('[uiSlice] toggleLogVisibility called, current state:', state.logVisible);
            state.logVisible = !state.logVisible;
            console.log('[uiSlice] toggleLogVisibility new state:', state.logVisible);
            persistUIState(state);
        },
        toggleEditorVisibility: (state) => {
            state.editorVisible = !state.editorVisible;
            persistUIState(state);
        },
        togglePreviewVisibility: (state) => {
            state.previewVisible = !state.previewVisible;
            persistUIState(state);
        },
        toggleContextManager: (state) => {
            state.contextManagerVisible = !state.contextManagerVisible;
            persistUIState(state);
        },
        toggleLogMenu: (state) => {
            state.logMenuVisible = !state.logMenuVisible;
            persistUIState(state);
        },
        toggleAuthDropdown: (state) => {
            state.isAuthDropdownVisible = !state.isAuthDropdownVisible;
            persistUIState(state);
        },
        setLeftSidebarVisible: (state, action) => {
            state.leftSidebarVisible = action.payload;
            persistUIState(state);
        },
    }
});

// Export reducer and actions
export const uiReducer = uiSlice.reducer;
export const uiActions = uiSlice.actions;

// --- UI Thunks ---
export const uiThunks = {
    // Set view mode
    setViewMode: (mode) => uiActions.updateSetting({ 
        key: 'viewMode', 
        value: mode 
    }),
    
    // Set log height
    setLogHeight: (height) => uiActions.updateSetting({ 
        key: 'logHeight', 
        value: height 
    }),
    
    // Set theme
    setTheme: (theme) => uiActions.updateSetting({ 
        key: 'theme', 
        value: theme 
    }),
    
    // Toggle left sidebar visibility
    toggleLeftSidebar: () => (dispatch, getState) => {
        const currentlyVisible = getState().ui?.leftSidebarVisible !== false;
        dispatch(uiActions.setLeftSidebarVisible(!currentlyVisible));
    },
    
    // Toggle log visibility - use direct action to avoid any side effects
    toggleLogVisibility: () => uiActions.toggleLogVisibility,
    
    // Toggle theme
    toggleTheme: () => (dispatch, getState) => {
        const currentTheme = getState().ui?.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        dispatch(uiActions.updateSetting({ 
            key: 'theme', 
            value: newTheme 
        }));
    }
};

// Export legacy actions for compatibility
export const { setTheme, toggleTheme } = {
    setTheme: uiThunks.setTheme,
    toggleTheme: uiThunks.toggleTheme
};

console.log('[uiSlice] ✅ Migrated to standard Redux Toolkit pattern with manual persistence.'); 