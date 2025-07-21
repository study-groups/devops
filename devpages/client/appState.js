/**
 * client/appState.js
 * Centralized application state management using Redux
 */
import { createStore, applyMiddleware, combineReducers, compose } from '/node_modules/redux/dist/redux.browser.mjs';
import { authReducer, authThunks } from './store/slices/authSlice.js';
import { pathReducer, pathThunks } from './store/slices/pathSlice.js';
import { settingsReducer, settingsThunks } from './store/slices/settingsSlice.js';
import { panelReducer, panelThunks } from './store/slices/panelSlice.js';
import { logReducer } from '/client/store/slices/logSlice.js';
import { domInspectorReducer } from './store/slices/domInspectorSlice.js';
// Import other legacy reducers if needed
import { mainReducer } from '/client/store/reducer.js';

// --- Thunk Middleware ---
const thunk = (store) => (next) => (action) =>
    typeof action === 'function' ? action(store.dispatch, store.getState) : next(action);

// --- Root Reducer ---
const rootReducer = combineReducers({
    auth: authReducer,
    path: pathReducer,
    settings: settingsReducer,
    panels: panelReducer,
    log: logReducer,
    domInspector: domInspectorReducer,
    // Add other legacy reducers here
    // main: mainReducer 
});


// --- Store Creation ---
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
export const appStore = createStore(
    rootReducer,
    composeEnhancers(applyMiddleware(thunk))
);

export const dispatch = appStore.dispatch;

// Export thunks for easy access
export const thunks = {
    auth: authThunks,
    path: pathThunks,
    settings: settingsThunks,
    panels: panelThunks,
};

console.log('[AppState] Central Redux store initialized.'); 