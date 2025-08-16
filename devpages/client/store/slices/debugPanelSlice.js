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

const initialState = {
    visible: false,
    position: { x: 150, y: 150 },
    size: { width: 500, height: 400 },
    panels: [
        { id: 'state', title: 'State Inspector', visible: true, order: 0, enabled: true },
        { id: 'dom-inspector', title: 'DOM Inspector', visible: true, order: 1, enabled: true },
        { id: 'external-dependencies', title: 'External Dependencies', visible: true, order: 2, enabled: true },
        { id: 'network', title: 'Network', visible: false, order: 3, enabled: false },
        { id: 'console', title: 'Console', visible: false, order: 4, enabled: false },
        { id: 'performance', title: 'Performance', visible: false, order: 5, enabled: false },
        { id: 'storage', title: 'Storage', visible: false, order: 6, enabled: false }
    ],
    activePanel: 'state',
    collapsedSections: ['state', 'dom-inspector', 'external-dependencies']
};

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
         * Resets the debug panel to its initial state.
         * The persistence middleware will automatically save the reset state.
         */
        resetDebugPanel: () => initialState,
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
    resetDebugPanel,
} = debugPanelSlice.actions;

export const debugPanelReducer = debugPanelSlice.reducer;
export default debugPanelReducer;

console.log('[DebugPanelSlice] ✅ Refactored debug panel slice ready.');
