/**
 * @file debugPanelSlice.js
 * @description Redux slice for managing the state of the debug panel system.
 *
 * ARCHITECTURE BLUEPRINT: This slice follows the clean, refactored Redux pattern.
 * 1.  **Pure Reducers:** All reducers are pure functions that only modify the state.
 * 2.  **No Side Effects:** There are NO calls to `localStorage` or other APIs inside the slice.
 * 3.  **Centralized Persistence:** State persistence is handled declaratively by the `persistenceMiddleware`.
 *     Actions that should trigger a save are added to the middleware's whitelist.
 */

import { createSlice } from '@reduxjs/toolkit';

const defaultState = {
    visible: false,
    position: { x: 150, y: 150 },
    size: { width: 400, height: 600 },
    panels: [
        { id: 'pdata-panel', title: 'PData Panel', visible: true, order: 0, enabled: true, expanded: false },
        { id: 'devtools', title: 'DevTools', visible: true, order: 1, enabled: true, expanded: false },
        { id: 'dom-inspector', title: 'DOM Inspector', visible: true, order: 2, enabled: true, expanded: false },
        { id: 'css-files', title: 'CSS Files', visible: true, order: 3, enabled: true, expanded: false },
        { id: 'javascript-panel', title: 'JavaScript Info', visible: true, order: 4, enabled: true, expanded: false },
        { id: 'external-dependencies', title: 'External Dependencies', visible: true, order: 5, enabled: true, expanded: false }
    ],
    activePanel: 'pdata-panel',
    collapsedSections: []
};

// Load persisted state or use default
const loadInitialState = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const persistedState = localStorage.getItem('debug_panel_state');
            if (persistedState) {
                const parsed = JSON.parse(persistedState);
                console.log('[DebugPanel] Loaded persisted state:', parsed);
                return {
                    ...defaultState,
                    ...parsed
                };
            }
        }
    } catch (error) {
        console.warn('[DebugPanel] Failed to load persisted state:', error);
    }
    return defaultState;
};

const initialState = loadInitialState();

export const debugPanelSlice = createSlice({
    name: 'debugPanel',
    initialState,
    reducers: {
        /**
         * Toggles the visibility of the entire debug panel.
         * The persistence middleware will automatically save this change.
         */
        toggleVisibility: (state, action) => {
            state.visible = action.payload ?? !state.visible;
        },

        /**
         * Sets the position of the debug panel.
         * The persistence middleware will automatically save this change.
         */
        setPosition: (state, action) => {
            state.position = action.payload;
        },

        /**
         * Sets the size of the debug panel.
         * The persistence middleware will automatically save this change.
         */
        setSize: (state, action) => {
            state.size = action.payload;
        },

        /**
         * Sets the currently active (visible) panel tab.
         * The persistence middleware will automatically save this change.
         */
        setActivePanel: (state, action) => {
            state.activePanel = action.payload;
        },

        /**
         * Toggles the collapsed state of a section within the debug panel.
         * The persistence middleware will automatically save this change.
         */
        toggleSection: (state, action) => {
            const sectionId = action.payload;
            const index = state.collapsedSections.indexOf(sectionId);
            if (index >= 0) {
                state.collapsedSections.splice(index, 1);
            } else {
                state.collapsedSections.push(sectionId);
            }
        },

        /**
         * Adds a new panel to the debug dock.
         * Note: This is not persisted by default unless added to the middleware whitelist.
         */
        addPanel: (state, action) => {
            const panelExists = state.panels.some(p => p.id === action.payload.id);
            if (!panelExists) {
                state.panels.push(action.payload);
            }
        },

        /**
         * Sets the visibility of a specific panel within the debug dock.
         * Note: This is not persisted by default unless added to the middleware whitelist.
         */
        setPanelVisibility: (state, action) => {
            const { panelId, visible } = action.payload;
            const panel = state.panels.find(p => p.id === panelId);
            if (panel) {
                panel.visible = visible;
            }
        },
        
        /**
         * Toggles the expanded state of a specific panel.
         * The persistence middleware will automatically save this change.
         */
        togglePanelExpanded: (state, action) => {
            const panelId = action.payload;
            const panel = state.panels.find(p => p.id === panelId);
            if (panel) {
                panel.expanded = !panel.expanded;
            }
        },

        /**
         * Sets the expanded state of a specific panel.
         * The persistence middleware will automatically save this change.
         */
        setPanelExpanded: (state, action) => {
            const { panelId, expanded } = action.payload;
            const panel = state.panels.find(p => p.id === panelId);
            if (panel) {
                panel.expanded = expanded;
            }
        },

        /**
         * Reorders panels based on drag and drop.
         * The persistence middleware will automatically save this change.
         */
        reorderPanels: (state, action) => {
            const { fromIndex, toIndex } = action.payload;
            const panels = [...state.panels];
            const [movedPanel] = panels.splice(fromIndex, 1);
            panels.splice(toIndex, 0, movedPanel);
            
            // Update order values
            panels.forEach((panel, index) => {
                panel.order = index;
            });
            
            state.panels = panels;
        },

        /**
         * Updates the dock position when dragged.
         * The persistence middleware will automatically save this change.
         */
        updateDockPosition: (state, action) => {
            const { x, y } = action.payload;
            state.position = { x, y };
        },

        /**
         * Updates the dock size when resized.
         * The persistence middleware will automatically save this change.
         */
        updateDockSize: (state, action) => {
            const { width, height } = action.payload;
            state.size = { width, height };
        },

        /**
         * Resets the debug panel to its initial state.
         * The persistence middleware will automatically save the reset state.
         */
        resetDebugPanel: () => defaultState,
    },
});

export const {
    toggleVisibility,
    setPosition,
    setSize,
    setActivePanel,
    toggleSection,
    addPanel,
    setPanelVisibility,
    togglePanelExpanded,
    setPanelExpanded,
    reorderPanels,
    updateDockPosition,
    updateDockSize,
    resetDebugPanel,
} = debugPanelSlice.actions;

export const debugPanelReducer = debugPanelSlice.reducer;
export default debugPanelReducer;

/**
 * Load persisted debug panel state from localStorage
 */
export const loadPersistedDebugPanelState = () => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const persistedState = localStorage.getItem('debug_panel_state');
            if (persistedState) {
                const parsed = JSON.parse(persistedState);
                console.log('[DebugPanel] Loaded persisted state:', parsed);
                return {
                    ...initialState,
                    ...parsed
                };
            }
        }
    } catch (error) {
        console.warn('[DebugPanel] Failed to load persisted state:', error);
    }
    return initialState;
};

console.log('[DebugPanelSlice] ✅ Refactored debug panel slice ready.');
