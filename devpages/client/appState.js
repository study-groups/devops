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

import { createStore, applyMiddleware, combineReducers, compose } from '/node_modules/redux/dist/redux.browser.mjs';
import { authMiddleware } from '/client/store/authMiddleware.js';
import { persistenceMiddleware, loadState } from '/client/store/persistenceMiddleware.js';
import { apiSlice } from '/client/store/apiSlice.js';

// --- Slice Reducers ---
import { authReducer, authThunks } from '/client/store/slices/authSlice.js';
import { pathReducer, pathThunks } from '/client/store/slices/pathSlice.js';
import { settingsReducer, settingsThunks } from '/client/store/slices/settingsSlice.js';
import { panelReducer } from '/client/store/slices/panelSlice.js';
import { logReducer } from '/client/store/slices/logSlice.js';
import { domInspectorReducer } from '/client/store/slices/domInspectorSlice.js';
import { uiReducer, uiThunks } from '/client/store/uiSlice.js';
import { fileReducer } from '/client/store/reducers/fileReducer.js';
import { previewSlice, initializePreviewSystem } from '/client/store/slices/previewSlice.js';
import debugPanelReducer from '/client/store/slices/debugPanelSlice.js';
import pluginReducer, { pluginThunks } from '/client/store/slices/pluginSlice.js';
import publishReducer from '/client/store/slices/publishSlice.js';
import systemReducer, { initializeComponent } from '/client/store/slices/systemSlice.js';
import { commReducer } from '/client/store/slices/commSlice.js';

// --- Custom Thunk Middleware ---
// Provides a clean way to handle async logic in Redux.
const thunk = store => next => action =>
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
    file: fileReducer,
    preview: previewSlice.reducer,
    debugPanel: debugPanelReducer,
    plugins: pluginReducer,
    publish: publishReducer,
    system: systemReducer,
    communications: commReducer,
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
function initializeStore() {
    if (appStore) {
        console.warn('[AppState] Store already initialized.');
        return { appStore, dispatch };
    }

    const preloadedState = loadState(); // CORRECT: Load persisted state
    const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    
    // CORRECT: Apply the new, robust persistence middleware + RTK Query middleware
    const middlewares = [thunk, authMiddleware, persistenceMiddleware, apiSlice.middleware];

    appStore = createStore(
        rootReducer,
        preloadedState,
        composeEnhancers(applyMiddleware(...middlewares))
    );

    dispatch = appStore.dispatch;
    
    console.log('[AppState] ✅ Central Redux store initialized with robust persistence.');
    return { appStore, dispatch };
}

// --- Exports ---
export { appStore, dispatch, initializeStore };

// Grouped thunks for easier access elsewhere
export const thunks = {
    auth: authThunks,
    path: pathThunks,
    settings: settingsThunks,
    // panelThunks removed as they are no longer used
    ui: uiThunks,
    preview: { initializePreviewSystem },
    plugins: pluginThunks,
    system: { initializeComponent },
};
