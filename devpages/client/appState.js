/**
 * client/appState.js
 * Centralized application state management using Redux.
 *
 * ARCHITECTURE BLUEPRINT: This file sets up the single source of truth for the application's state.
 * It combines all the individual slice reducers and applies the necessary middleware.
 *
 * Key Responsibilities:
 * 1.  **Combine Reducers:** Merges all slice reducers into a single root reducer.
 * 2.  **Apply Middleware:** Integrates essential middleware like thunks for async actions,
 *     authentication, and our robust persistence layer.
 * 3.  **Load Initial State:** Uses the `loadState` function from our persistence middleware
 *     to rehydrate the store from localStorage on application startup.
 * 4.  **Export Store:** Exports a singleton `appStore` instance for use throughout the application.
 */

import { createStore, applyMiddleware, combineReducers, compose } from 'redux';
import { authMiddleware } from '/client/store/authMiddleware.js';
import { apiSlice } from '/client/store/apiSlice.js';
import panelPersistenceMiddleware from '/client/store/middleware/panelPersistenceMiddleware.js';
import { dockManager } from '/client/layout/docks/dockManager.js';

// --- Slice Reducers ---
import authReducer, { authThunks } from '/client/store/slices/authSlice.js';
import pathReducer, { pathThunks, pathSlice } from '/client/store/slices/pathSlice.js';
import { settingsReducer, settingsThunks } from '/client/store/slices/settingsSlice.js';
import { panelReducer } from '/client/store/slices/panelSlice.js';
import { logReducer } from '/client/store/slices/logSlice.js';
import { domInspectorReducer } from '/client/store/slices/domInspectorSlice.js';
import { uiReducer } from '/client/store/uiSlice.js';
import { fileReducer } from '/client/store/slices/fileSlice.js';
import { contextSettingsReducer } from '/client/store/slices/contextSettingsSlice.js';
import { previewReducer, initializePreviewSystem } from '/client/store/slices/previewSlice.js';
import debugPanelReducer from '/client/store/slices/debugPanelSlice.js';
import pluginReducer, { pluginThunks } from '/client/store/slices/pluginSlice.js';
import publishReducer from '/client/store/slices/publishSlice.js';
import systemReducer, { initializeComponent } from '/client/store/slices/systemSlice.js';
import { commReducer } from '/client/store/slices/commSlice.js';
import { editorReducer } from './store/slices/editorSlice.js';

// --- Custom Thunk Middleware ---
// Provides a clean way to handle async logic in Redux.
const thunkMiddleware = store => next => action =>
    typeof action === 'function' ? action(store.dispatch, store.getState) : next(action);

// --- Root Reducer ---
// Combines all individual slice reducers into one.
const rootReducer = combineReducers({
    auth: authReducer,
    path: pathReducer,
    settings: settingsReducer,
    panels: panelReducer,
    log: logReducer,
    domInspector: domInspectorReducer,
    ui: uiReducer,
    contextSettings: contextSettingsReducer,
    file: fileReducer,
    preview: previewReducer,
    debugPanel: debugPanelReducer,
    plugins: pluginReducer,
    publish: publishReducer,
    system: systemReducer,
    communications: commReducer,
    editor: editorReducer,
    // RTK Query API slice
    [apiSlice.reducerPath]: apiSlice.reducer
});

// --- Store Singleton ---
let appStore;
let dispatch;

/**
 * Initializes the Redux store. This function should only be called once.
 * It loads the persisted state from localStorage and applies all middleware.
 */
function initializeStore(preloadedState = undefined) {
    if (appStore) {
        console.warn('[AppState] Store already initialized.');
        return { appStore, dispatch };
    }

    // Use provided preloadedState or undefined
    const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    
    // CORRECT: Apply the new, robust persistence middleware + RTK Query middleware
    const middlewares = [thunkMiddleware, authMiddleware, panelPersistenceMiddleware, apiSlice.middleware];

    appStore = createStore(
        rootReducer,
        preloadedState,
        composeEnhancers(applyMiddleware(...middlewares))
    );

    dispatch = appStore.dispatch;
    
    // Initialize the Dock Manager after the store is created
    dockManager.initialize();

    // Grouped thunks are now initialized here, after the store is created
    // This breaks the circular dependency race condition
    thunks = {
        auth: authThunks,
        path: { ...pathThunks, navigateToPath: pathSlice.actions.navigateToPath },
        settings: settingsThunks,
        // ui: removed - using direct actions now
        preview: { initializePreviewSystem },
        plugins: pluginThunks,
        system: { initializeComponent },
    };
    
    console.log('[AppState] ✅ Central Redux store initialized with robust persistence.');

    // Expose the store to the window for debugging and easy access
    if (typeof window !== 'undefined') {
        window.APP = window.APP || {};
        window.APP.store = appStore;
    }

    return { appStore, dispatch };
}

// --- Exports ---
export { appStore, dispatch, initializeStore };

export const actions = {
    path: pathSlice.actions,
};

// Grouped thunks for easier access elsewhere
export let thunks = {};
