/**
 * client/store/persistenceMiddleware.js
 * 
 * ARCHITECTURE BLUEPRINT: This middleware is the cornerstone of a stable and predictable Redux setup.
 * 
 * It follows a strict, professional pattern for managing side effects:
 * 1.  **Single Responsibility:** This middleware's ONLY job is to persist parts of the Redux state to localStorage.
 * 2.  **Decoupling:** Redux slices are completely UNAWARE of this middleware. They simply dispatch actions. This makes the slices pure, testable, and reusable.
 * 3.  **Declarative Whitelist:** We explicitly declare which actions should trigger persistence. There is no magic or hidden behavior.
 * 4.  **Error Handling:** All localStorage operations are wrapped in try/catch blocks to prevent crashes.
 */
import { storageService } from '/client/services/storageService.js';

const PERSISTENCE_KEY = 'app_state';
const STATE_VERSION = '3.0'; // Bump version to invalidate old, inconsistent state

// --- Declarative Whitelist of Actions to Persist ---
// Only actions included in this list will trigger a save to localStorage.
// This makes the persistence behavior explicit and predictable.
const persistActionWhitelist = [
    'panels/updateDock',
    'panels/addPanelToDock',
    'panels/updatePanelInDock',
    'debugPanel/toggleVisibility',
    'debugPanel/setPosition',
    'debugPanel/setSize',
    'debugPanel/setActivePanel',
    'debugPanel/toggleSection',
    'publish/updateSettings',
    'publish/setPublishMode',
    'plugins/updatePluginSettings',
    'plugins/setModuleLoaded',
    'ui/updateSetting',
    'ui/toggleLogVisibility',
    'UI_TOGGLE_LOG_VISIBILITY',
    'UI_TOGGLE_TEXT_VISIBILITY',
    'UI_TOGGLE_CONTEXT_MANAGER',
    'UI_TOGGLE_LOG_MENU'
];

// --- State Slices to Persist ---
// We only store a subset of the entire Redux state to avoid storing sensitive
// or unnecessary data (like connection status or temporary UI state).
const stateSlicesToPersist = ['panels', 'debugPanel', 'publish', 'plugins', 'settings', 'ui'];

/**
 * Loads the entire application state from localStorage.
 * This is called only once when the Redux store is initialized.
 */
export function loadState() {
    try {
        const state = storageService.getItem(PERSISTENCE_KEY);
        if (!state) {
            return undefined; // No state saved
        }
        
        if (state._version !== STATE_VERSION) {
            console.warn(`[Persistence] Discarding outdated state (v${state._version}). Expected v${STATE_VERSION}.`);
            return undefined; // Mismatched version
        }
        return state;
    } catch (err) {
        console.error('[Persistence] Failed to load state from localStorage:', err);
        return undefined;
    }
}

/**
 * Saves the relevant parts of the application state to localStorage.
 * This is called by the middleware whenever a whitelisted action is dispatched.
 * @param {object} state The entire Redux state object.
 */
function saveState(state) {
    try {
        const stateToSave = {
            _version: STATE_VERSION
        };
        for (const sliceName of stateSlicesToPersist) {
            if (state[sliceName]) {
                stateToSave[sliceName] = state[sliceName];
            }
        }
        storageService.setItem(PERSISTENCE_KEY, stateToSave);
    } catch (err) {
        console.error('[Persistence] Failed to save state to localStorage:', err);
    }
}

/**
 * The Redux persistence middleware itself.
 * It intercepts actions and, if an action is on the whitelist, it saves the new state.
 */
export const persistenceMiddleware = store => next => action => {
    // Let the action pass through to the reducers first
    const result = next(action);

    // If the action is in our whitelist, save the resulting state
    if (persistActionWhitelist.includes(action.type)) {
        const nextState = store.getState();
        saveState(nextState);
    }

    return result;
};

console.log('[Persistence] ✅ Robust persistence middleware initialized.');
