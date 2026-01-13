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

import { configureStore } from '/node_modules/@reduxjs/toolkit/dist/redux-toolkit.browser.mjs';
import panelReducer from './store/slices/panelSlice.js';
import { storageService } from './services/storageService.js';
import { deepMerge } from './utils/deepMerge.js';
import { persistenceMiddleware } from './store/middleware/persistenceMiddleware.js';

// Reducers
import authReducer from './store/slices/authSlice.js';
import pathReducer from './store/slices/pathSlice.js';
import { settingsReducer } from './store/slices/settingsSlice.js';
import logReducer from './store/slices/logSlice.js';
import { uiReducer, uiInitialState } from './store/uiSlice.js';
import { contextSettingsReducer } from './store/slices/contextSettingsSlice.js';
import fileReducer from './store/slices/fileSlice.js';
import { previewReducer } from './store/slices/previewSlice.js';
import pluginReducer from './store/slices/pluginSlice.js';
import publishReducer from './store/slices/publishSlice.js';
import publishConfigReducer from './store/slices/publishConfigSlice.js';
import systemReducer from './store/slices/systemSlice.js';
import { commReducer } from './store/slices/commSlice.js';
import editorReducer from './store/slices/editorSlice.js';
import { imageReducer } from './store/slices/imageSlice.js';
import astReducer from './store/slices/astSlice.js';
import dataMountReducer from './store/slices/dataMountSlice.js';

// Middleware
import { reduxLogMiddleware } from './store/middleware/reduxLogMiddleware.js';

// EventBus store injection (breaks circular dependency)
import { setEventBusStore } from './eventBus.js';

// BasePanel store injection (breaks circular dependency)
import { setAppStore } from './panels/BasePanel.js';

// Thunks and Actions
import { authThunks } from './store/slices/authSlice.js';
import { pathThunks, pathSlice } from './store/slices/pathSlice.js';
import { settingsThunks } from './store/slices/settingsSlice.js';
import { initializePreviewSystem } from './store/slices/previewSlice.js';
import { pluginThunks } from './store/slices/pluginSlice.js';
import { initializeComponent } from './store/slices/systemSlice.js';
import { panelThunks } from './store/slices/panelSlice.js';
import { dataMountThunks } from './store/slices/dataMountSlice.js';

// --- Root Reducer Configuration ---
const rootReducer = {
    auth: authReducer,
    path: pathReducer,  // Consolidated v2 path slice with v1 compatibility
    settings: settingsReducer,
    log: logReducer,
    ui: uiReducer,
    contextSettings: contextSettingsReducer,
    file: fileReducer,
    preview: previewReducer,
    plugins: pluginReducer,
    publish: publishReducer,
    publishConfig: publishConfigReducer,
    panels: panelReducer,
    system: systemReducer,
    communications: commReducer,
    editor: editorReducer,
    image: imageReducer,
    ast: astReducer,
    dataMount: dataMountReducer,
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
        // Deep merge preserves nested defaults when persisted state is missing properties
        const result = persistedState ? deepMerge(defaultState, persistedState) : defaultState;

        if (key === 'ui') {
            console.log(`[AppState.safeLoadPersistedState] 🔍 LOADING '${key}':`, {
                'persistedState from localStorage': persistedState,
                'defaultState': defaultState,
                'merged result (deep)': result
            });
        }

        return result;
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
    // CRITICAL: Use actual slice initialState as defaults, not empty objects
    const loadedUI = safeLoadPersistedState('ui', preloadedState.ui || uiInitialState);
    console.log('[AppState.initializeStore] 🔍 LOADING UI STATE:', {
        'uiInitialState.logVisible': uiInitialState.logVisible,
        'preloadedState.ui': preloadedState.ui,
        'loadedUI': loadedUI,
        'loadedUI.logVisible': loadedUI?.logVisible
    });

    const initialState = {
        ...preloadedState,
        settings: safeLoadPersistedState('settings', preloadedState.settings || {}),
        panels: safeLoadPersistedState('panels', preloadedState.panels || {}),
        ui: loadedUI,
        publishConfig: safeLoadPersistedState('publishConfig', preloadedState.publishConfig || {}),
    };

    try {
        appStore = configureStore({
            reducer: rootReducer,
            preloadedState: initialState,
            middleware: (getDefaultMiddleware) =>
                getDefaultMiddleware()
                .concat(
                    reduxLogMiddleware,
                    persistenceMiddleware
                ),
            devTools: true,
        });

        dispatch = appStore.dispatch;

        // Inject store into eventBus (breaks circular dependency)
        setEventBusStore(appStore);

        // Inject store into BasePanel (breaks circular dependency)
        setAppStore(appStore);

        // Grouped thunks are now initialized here, after the store is created
        // This breaks the circular dependency race condition
        thunks = {
            auth: authThunks,
            path: { ...pathThunks, navigateToPath: pathSlice.actions.navigateToPath },
            settings: settingsThunks,
            preview: { initializePreviewSystem },
            plugins: pluginThunks,
            system: { initializeComponent },
            panels: panelThunks,
            dataMount: dataMountThunks,
        };

        console.log('[AppState] ✅ Central Redux store initialized.');

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

        // Inject store into eventBus (fallback path)
        setEventBusStore(appStore);

        // Inject store into BasePanel (fallback path)
        setAppStore(appStore);

        // Ensure thunks are available even in fallback path
        thunks = {
            auth: authThunks,
            path: { ...pathThunks, navigateToPath: pathSlice.actions.navigateToPath },
            settings: settingsThunks,
            preview: { initializePreviewSystem },
            plugins: pluginThunks,
            system: { initializeComponent },
            panels: panelThunks,
            dataMount: dataMountThunks,
        };

        return { appStore, dispatch };
    }
}

// Grouped thunks for easier access elsewhere
export let thunks = {};
