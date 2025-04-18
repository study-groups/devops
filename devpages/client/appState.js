/**
 * appState.js
 * Centralized application state management using StateKit.
 */
import { createState } from './statekit/statekit.js';

// --- LocalStorage Keys ---
const LS_VIEW_MODE_KEY = 'viewMode';
const LS_LOG_VISIBLE_KEY = 'logVisible';
const LS_LOG_HEIGHT_KEY = 'logHeight'; // Keep track of this too

// --- Helper to safely parse JSON from localStorage ---
function safeGetLocalStorage(key, defaultValue) {
    try {
        const storedValue = localStorage.getItem(key);
        if (storedValue === null) {
            // console.debug(`[AppState] localStorage key "${key}" not found, using default:`, defaultValue);
            return defaultValue;
        }
        // Only parse if it looks like JSON, otherwise treat as string/primitive
        if (storedValue.startsWith('{') || storedValue.startsWith('[')) {
             return JSON.parse(storedValue);
        }
        // Handle simple boolean strings explicitly
        if (storedValue === 'true') return true;
        if (storedValue === 'false') return false;
        // Handle numbers
        const num = parseFloat(storedValue);
        if (!isNaN(num)) return num;
        
        // Return as string if not parsed
        return storedValue;
    } catch (error) {
        console.warn(`[AppState] Error reading or parsing localStorage key "${key}". Using default.`, error);
        return defaultValue;
    }
}


// --- Initial Application State Structure ---
const initialState = {
    // Authentication Status
    auth: {
        isLoggedIn: false, 
        user: null, 
        token: null, 
        tokenExpiresAt: null, 
        authChecked: false, 
        isLoading: false, 
        error: null, 
    },

    // UI State (Now managed here, reads from localStorage)
    ui: {
       viewMode: safeGetLocalStorage(LS_VIEW_MODE_KEY, 'preview'), // Default to 'preview'
       logVisible: safeGetLocalStorage(LS_LOG_VISIBLE_KEY, false), // Default to false
       logHeight: safeGetLocalStorage(LS_LOG_HEIGHT_KEY, 120), // Default height
       // Add other UI states here if needed
    },

    // Other top-level state sections can be added here as needed
    // files: { ... },
    // editor: { ... },
    // settings: { ... },
};

// --- Create the Central State Instance ---
export const appState = createState(initialState);

// --- Persistence Subscriber ---
// Subscribe to state changes specifically to persist the UI slice.
appState.subscribe((newState, prevState) => {
    // Check if the UI slice *actually* changed to avoid unnecessary writes
    if (newState.ui !== prevState.ui) {
        // console.debug('[AppState Persistence] UI state changed, saving to localStorage:', newState.ui);
        try {
            // Persist relevant UI state items individually
            if (newState.ui.viewMode !== prevState.ui.viewMode) {
                localStorage.setItem(LS_VIEW_MODE_KEY, newState.ui.viewMode);
            }
            if (newState.ui.logVisible !== prevState.ui.logVisible) {
                 localStorage.setItem(LS_LOG_VISIBLE_KEY, newState.ui.logVisible.toString());
            }
            if (newState.ui.logHeight !== prevState.ui.logHeight) {
                 localStorage.setItem(LS_LOG_HEIGHT_KEY, newState.ui.logHeight.toString());
            }
        } catch (error) {
            console.error('[AppState Persistence] Failed to save UI state to localStorage:', error);
        }
    }
});


// --- Optional: Add Debugging Listener ---
// appState.subscribe((newState, prevState) => {
//    console.log('[AppState Change]', { prevState, newState });
// });

console.log('[AppState] Central state initialized with state:', appState.getState());

// Note: The old AppStateManager class and its event listeners/dispatchers are removed.
// Modules previously relying on `app:stateChange` or specific states like `APP_STATES.LOGGED_IN`
// will need to be refactored to subscribe to `appState.auth.isLoggedIn`, `appState.auth.authChecked`, etc.