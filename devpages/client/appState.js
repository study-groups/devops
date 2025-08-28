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

import { createStore, combineReducers, compose, applyMiddleware } from 'redux';
import { storageService } from '/client/services/storageService.js';

// Reducers
import authReducer from '/client/store/slices/authSlice.js';
import pathReducer from '/client/store/slices/pathSlice.js';
import { settingsReducer } from '/client/store/slices/settingsSlice.js';
import panelReducer from '/client/store/slices/panelSlice.js';
import logReducer from '/client/store/slices/logSlice.js';
import { domInspectorReducer } from '/client/store/slices/domInspectorSlice.js';
import { uiReducer } from '/client/store/uiSlice.js';
import { contextSettingsReducer } from '/client/store/slices/contextSettingsSlice.js';
import fileReducer from '/client/store/slices/fileSlice.js';
import { previewReducer } from '/client/store/slices/previewSlice.js';
import debugPanelReducer from '/client/store/slices/debugPanelSlice.js';
import pluginReducer from '/client/store/slices/pluginSlice.js';
import publishReducer from '/client/store/slices/publishSlice.js';
import systemReducer from '/client/store/slices/systemSlice.js';
import { commReducer } from '/client/store/slices/commSlice.js';
import editorReducer from './store/slices/editorSlice.js';
import panelSizesReducer from './redux/panelSizes.js';

// Middleware
import { reduxLogMiddleware } from '/client/store/middleware/reduxLogMiddleware.js';
import panelPersistenceMiddleware from '/client/store/middleware/panelPersistenceMiddleware.js';
import panelSizesPersistenceMiddleware from '/client/store/middleware/panelSizesPersistenceMiddleware.js';
import { apiSlice } from '/client/store/apiSlice.js';

// Thunks and Actions
import { authThunks } from '/client/store/slices/authSlice.js';
import { pathThunks, pathSlice } from '/client/store/slices/pathSlice.js';
import { settingsThunks } from '/client/store/slices/settingsSlice.js';
import { initializePreviewSystem } from '/client/store/slices/previewSlice.js';
import { pluginThunks } from '/client/store/slices/pluginSlice.js';
import { initializeComponent } from '/client/store/slices/systemSlice.js';

// Middleware and Thunk Imports
const thunkMiddleware = store => next => action =>
    typeof action === 'function' ? action(store.dispatch, store.getState) : next(action);

// --- Root Reducer ---
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
    panelSizes: panelSizesReducer,
    // RTK Query API slice
    [apiSlice.reducerPath]: apiSlice.reducer
});

// --- Store Singleton ---
let appStore;
let dispatch;

// --- Exports ---
export { appStore, dispatch, initializeStore };

/**
 * Safely load persisted state from storage
 * @param {string} key - Storage key to retrieve
 * @param {object} defaultState - Default state if retrieval fails
 * @returns {object} Loaded or default state
 */
function safeLoadPersistedState(key, defaultState = {}) {
    try {
        const persistedState = storageService.getItem(key);
        return persistedState ? { ...defaultState, ...persistedState } : defaultState;
    } catch (error) {
        console.warn(`[AppState] Failed to load persisted state for ${key}:`, error);
        return defaultState;
    }
}

/**
 * Initializes the Redux store. This function should only be called once.
 * It loads the persisted state from localStorage and applies all middleware.
 */
function initializeStore(preloadedState = {}) {
    if (appStore) {
        console.warn('[AppState] Store already initialized.');
        return { appStore, dispatch };
    }

    // Comprehensive state loading with fallback
    const initialState = {
        ...preloadedState,
        settings: safeLoadPersistedState('settings', preloadedState.settings || {}),
        panels: safeLoadPersistedState('panel_state', preloadedState.panels || {}),
        panelSizes: safeLoadPersistedState('panel_sizes', preloadedState.panelSizes || {}),
        // Add more slice-specific state loading as needed
    };

    // Use provided preloadedState or undefined
    const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    
    // CORRECT: Apply the new, robust persistence middleware + RTK Query middleware
    const middlewares = [
        thunkMiddleware, 
        panelPersistenceMiddleware, 
        panelSizesPersistenceMiddleware,
        apiSlice.middleware, 
        reduxLogMiddleware
    ].filter(Boolean);

    try {
        appStore = createStore(
            rootReducer,
            initialState,
            composeEnhancers(applyMiddleware(...middlewares))
        );

        dispatch = appStore.dispatch;
        
        // Initialize the Dock Manager after the store is created
        // dockManager.initialize(); // This line was removed as per the new_code, as dockManager is no longer imported.

        // Grouped thunks are now initialized here, after the store is created
        // This breaks the circular dependency race condition
        thunks = {
            auth: authThunks,
            path: { ...pathThunks, navigateToPath: pathSlice.actions.navigateToPath },
            settings: settingsThunks,
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
    } catch (error) {
        console.error('[AppState] ❌ Failed to initialize Redux store:', error);
        
        // Fallback store creation with minimal configuration
        appStore = createStore(rootReducer);
        dispatch = appStore.dispatch;
        // Ensure thunks are available even in fallback path
        thunks = {
            auth: authThunks,
            path: { ...pathThunks, navigateToPath: pathSlice.actions.navigateToPath },
            settings: settingsThunks,
            preview: { initializePreviewSystem },
            plugins: pluginThunks,
            system: { initializeComponent },
        };

        return { appStore, dispatch };
    }
}

// Grouped thunks for easier access elsewhere
export let thunks = {};
