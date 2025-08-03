/**
 * client/appState.js
 * Centralized application state management using Redux
 */
import { authMiddleware } from './store/authMiddleware.js';
import { createStore, applyMiddleware, combineReducers, compose } from '/node_modules/redux/dist/redux.browser.mjs';
import { authReducer, authThunks } from './store/slices/authSlice.js';
import { pathReducer, pathThunks } from './store/slices/pathSlice.js';
import { settingsReducer, settingsThunks } from './store/slices/settingsSlice.js';
import { panelReducer, panelThunks } from './store/slices/panelSlice.js';
import { logReducer } from '/client/store/slices/logSlice.js';
import { domInspectorReducer } from './store/slices/domInspectorSlice.js';

const thunk = (store) => (next) => (action) =>
    typeof action === 'function' ? action(store.dispatch, store.getState) : next(action);

const rootReducer = combineReducers({
    auth: authReducer,
    path: pathReducer,
    settings: settingsReducer,
    panels: panelReducer,
    log: logReducer,
    domInspector: domInspectorReducer,
});

let appStore;
let dispatch;

function initializeStore(preloadedState = {}) {
    if (appStore) {
        console.warn('[AppState] Store already initialized.');
        return { appStore, dispatch };
    }

    const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    
    appStore = createStore(
        rootReducer,
        preloadedState,
        composeEnhancers(applyMiddleware(thunk, authMiddleware))
    );

    dispatch = appStore.dispatch;
    
    console.log('[AppState] Central Redux store initialized by Bootloader.');
    return { appStore, dispatch };
}

export { appStore, dispatch, initializeStore };

export const thunks = {
    auth: authThunks,
    path: pathThunks,
    settings: settingsThunks,
    panels: panelThunks,
};
