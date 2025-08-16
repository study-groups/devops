/**
 * @file publishSlice.js
 * @description Publish slice using Redux Toolkit createSlice pattern.
 *
 * ARCHITECTURE BLUEPRINT: This slice follows the clean, refactored Redux pattern.
 * 1.  **Pure Reducers:** All reducers are pure functions that only modify the state.
 * 2.  **No Side Effects:** There are NO calls to `localStorage` or other APIs inside the slice.
 * 3.  **Centralized Persistence:** State persistence is handled declaratively by the `persistenceMiddleware`.
 *     Actions that should trigger a save are added to the middleware's whitelist.
 * 4.  **Consistent Naming:** Actions follow a clear `verbNoun` pattern.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    mode: 'local',
    bundleCss: true,
    minifyOutput: false,
    includeSourceMaps: false,
    publishDirectory: '',
    remoteEndpoint: '',
    authToken: '',
    lastPublishTime: null,
    isPublishing: false,
    publishHistory: [],
};

const publishSlice = createSlice({
    name: 'publish',
    initialState,
    reducers: {
        /**
         * Updates multiple publish settings at once.
         * The persistence middleware will automatically save this change.
         */
        updateSettings: (state, action) => {
            Object.assign(state, action.payload);
        },
        
        /**
         * Sets the publish mode ('local' or 'remote').
         * The persistence middleware will automatically save this change.
         */
        setPublishMode: (state, action) => {
            const mode = action.payload;
            if (['local', 'remote'].includes(mode)) {
                state.mode = mode;
            }
        },

        // --- Publishing Process State ---

        /**
         * Initiates the publishing process, setting the `isPublishing` flag.
         * This state is temporary and is NOT persisted.
         */
        startPublishing: (state) => {
            state.isPublishing = true;
        },

        /**
         * Finalizes the publishing process, updating history and resetting flags.
         * The `lastPublishTime` and `publishHistory` are persisted by the middleware.
         */
        finishPublishing: (state, action) => {
            state.isPublishing = false;
            state.lastPublishTime = new Date().toISOString();
            
            const publishEntry = {
                timestamp: state.lastPublishTime,
                mode: state.mode,
                success: action.payload?.success || false,
                error: action.payload?.error || null,
                filesCount: action.payload?.filesCount || 0
            };
            
            state.publishHistory.unshift(publishEntry);
            
            // Keep only the last 10 entries
            if (state.publishHistory.length > 10) {
                state.publishHistory.pop();
            }
        },

        /**
         * Clears the entire publish history.
         * The persistence middleware will automatically save this change.
         */
        clearHistory: (state) => {
            state.publishHistory = [];
        },

        /**
         * Resets all settings to their default values.
         * The persistence middleware will automatically save this change.
         */
        resetSettings: (state) => {
            // Re-assign state to the initial default values
            Object.assign(state, initialState);
        }
    }
});

export const {
    updateSettings,
    setPublishMode,
    startPublishing,
    finishPublishing,
    clearHistory,
    resetSettings
} = publishSlice.actions;

export const publishReducer = publishSlice.reducer;
export default publishReducer; // Default export for combineReducers

console.log('[PublishSlice] ✅ Refactored publish slice ready.');
