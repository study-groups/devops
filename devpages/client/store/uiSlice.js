/**
 * @file uiSlice.js
 * @description UI slice for Redux with standard Redux Toolkit patterns
 * Manages UI state (viewMode, log visibility, theme).
 * Persistence is handled by the central persistenceMiddleware.
 */

import { createSlice } from '@reduxjs/toolkit';
import { themeService } from '../services/ThemeService.js';

// --- Default UI Settings ---
export const uiInitialState = {
    theme: 'light',
    // Remove viewMode
    logVisible: true,
    logHeight: 120,             // pixels
    logMenuVisible: false,
    leftSidebarVisible: true,
    editorVisible: true,
    previewVisible: true,
    contextManagerVisible: true, // PathManager should ALWAYS be visible
    colorScheme: 'system',      // 'light', 'dark', 'system'
    designDensity: 'normal',    // 'compact', 'normal', 'spacious'
    isAuthDropdownVisible: false,
    logColumnWidths: {
        timestamp: '70px',
        level: '50px',
        context: '200px',
        message: '1fr',
        melvin: '6rem'
    },
    logWidth: '75vw', // Default log panel width
    workspaceDimensions: {      // Workspace layout dimensions (replaces panel system)
        sidebarWidth: 300,
        previewWidth: 400,
        editorWidth: 'auto'
    },
    // Panel states moved to panelSlice for unified management
};

const initialState = uiInitialState;

// --- Create Standard Redux Toolkit Slice ---
const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        updateSetting: (state, action) => {
            const { key, value } = action.payload;
            state[key] = value;
        },
        setLogColumnWidth: (state, action) => {
            const { column, width } = action.payload;
            state.logColumnWidths = { ...state.logColumnWidths, [column]: width };
        },
        toggleLogVisibility: (state) => {
            state.logVisible = !state.logVisible;
        },
        toggleEditorVisibility: (state) => {
            state.editorVisible = !state.editorVisible;
        },
        togglePreviewVisibility: (state) => {
            state.previewVisible = !state.previewVisible;
        },
        toggleContextManager: (state) => {
            state.contextManagerVisible = !state.contextManagerVisible;
        },
        toggleLogMenu: (state) => {
            state.logMenuVisible = !state.logMenuVisible;
        },
        toggleAuthDropdown: (state) => {
            state.isAuthDropdownVisible = !state.isAuthDropdownVisible;
        },
        setLeftSidebarVisible: (state, action) => {
            state.leftSidebarVisible = action.payload;
        },
        setWorkspaceDimensions: (state, action) => {
            state.workspaceDimensions = {
                ...state.workspaceDimensions,
                ...action.payload
            };
        },
        // Panel actions moved to panelSlice - these are deprecated
        // Use panelActions.toggleSidebarPanel, setSidebarPanelExpanded, 
        // startFloatingPanel, stopFloatingPanel instead
    }
});

// Export reducer and actions
export const uiReducer = uiSlice.reducer;
export const uiActions = uiSlice.actions;

// Update UI Thunks to remove viewMode
export const uiThunks = {
    // Remove setViewMode
    
    // Set log height
    setLogHeight: (height) => uiActions.updateSetting({ 
        key: 'logHeight', 
        value: height 
    }),
    
    // Set theme - connected to themeService
    setTheme: (theme) => async (dispatch) => {
        dispatch(uiActions.updateSetting({
            key: 'theme',
            value: theme
        }));
        // Apply via themeService
        const themeId = theme === 'light' ? 'devpages-light' : 'devpages-dark';
        await themeService.loadTheme(themeId);
    },
    
    // Toggle left sidebar visibility
    toggleLeftSidebar: () => (dispatch, getState) => {
        const currentlyVisible = getState().ui?.leftSidebarVisible !== false;
        dispatch(uiActions.setLeftSidebarVisible(!currentlyVisible));
    },
    
    // Toggle log visibility - use direct action to avoid any side effects
    toggleLogVisibility: () => uiActions.toggleLogVisibility,
    
    // Toggle theme - connected to themeService
    toggleTheme: () => async (dispatch, getState) => {
        const currentTheme = getState().ui?.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        dispatch(uiActions.updateSetting({
            key: 'theme',
            value: newTheme
        }));
        // Apply via themeService
        await themeService.toggleMode();
    }
};

// Export legacy actions for compatibility
export const { setTheme, toggleTheme } = {
    setTheme: uiThunks.setTheme,
    toggleTheme: uiThunks.toggleTheme
}; 