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

import { configureStore } from '/client/vendor/scripts/redux-toolkit.mjs';
import { storageService } from '/client/services/storageService.js';

// Reducers
import authReducer from './store/slices/authSlice.js';
import pathReducer from './store/slices/pathSlice.js';
import { settingsReducer } from './store/slices/settingsSlice.js';
import panelReducer from './store/slices/panelSlice.js';
import logReducer from './store/slices/logSlice.js';
import { domInspectorReducer } from './store/slices/domInspectorSlice.js';
import { uiReducer } from './store/uiSlice.js';
import { contextSettingsReducer } from './store/slices/contextSettingsSlice.js';
import fileReducer from './store/slices/fileSlice.js';
import { previewReducer } from './store/slices/previewSlice.js';
import debugPanelReducer from './store/slices/debugPanelSlice.js';
import pluginReducer from './store/slices/pluginSlice.js';
import publishReducer from './store/slices/publishSlice.js';
import systemReducer from './store/slices/systemSlice.js';
import { commReducer } from './store/slices/commSlice.js';
import editorReducer from './store/slices/editorSlice.js';
import panelSizesReducer from './redux/panelSizes.js';

// Middleware
import { reduxLogMiddleware } from './store/middleware/reduxLogMiddleware.js';
import panelPersistenceMiddleware from './store/middleware/panelPersistenceMiddleware.js';
import panelSizesPersistenceMiddleware from './store/middleware/panelSizesPersistenceMiddleware.js';
import { apiSlice } from './store/apiSlice.js';

// Thunks and Actions
import { authThunks } from './store/slices/authSlice.js';
import { pathThunks, pathSlice } from './store/slices/pathSlice.js';
import { settingsThunks } from './store/slices/settingsSlice.js';
import { initializePreviewSystem } from './store/slices/previewSlice.js';
import { pluginThunks } from './store/slices/pluginSlice.js';
import { initializeComponent } from './store/slices/systemSlice.js';

// --- Root Reducer Configuration ---
const rootReducer = {
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
};

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
        debugPanel: safeLoadPersistedState('debug_panel_state', preloadedState.debugPanel || {}),
        // Add more slice-specific state loading as needed
    };

    try {
        appStore = configureStore({
            reducer: rootReducer,
            preloadedState: initialState,
            middleware: (getDefaultMiddleware) =>
                getDefaultMiddleware({
                    serializableCheck: {
                        ignoredActions: [apiSlice.util.resetApiState.type],
                    },
                })
                .concat(
                    panelPersistenceMiddleware,
                    panelSizesPersistenceMiddleware,
                    apiSlice.middleware,
                    reduxLogMiddleware
                ),
            devTools: true,
        });

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
            import('./core/AppInitializer.js').then(module => {
                module.default.setAppProperty("store", appStore);
            }).catch(console.error);
        }

        return { appStore, dispatch };
    } catch (error) {
        console.error('[AppState] ❌ Failed to initialize Redux store:', error);
        
        // Fallback store creation with minimal configuration
        appStore = configureStore({
            reducer: rootReducer,
            devTools: true,
        });
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
