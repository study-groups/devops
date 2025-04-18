/**
 * appState.js
 * Centralized application state management using StateKit.
 */
import { createState } from './statekit/statekit.js';

// --- Initial Application State Structure ---
// Define the shape and default values of our application's state.
// Start with authentication-related state. We'll add more sections (UI, editor, files, etc.) later.
const initialState = {
    // Authentication Status
    auth: {
        isLoggedIn: false, // Is there a valid, non-expired token?
        user: null, // Holds user info like { username: '...' } when logged in
        token: null, // The actual JWT or session token
        tokenExpiresAt: null, // Timestamp (ms) when the token expires
        authChecked: false, // Has the initial check (e.g., from localStorage) been performed?
        isLoading: false, // Is an auth operation (login, logout, check) in progress?
        error: null, // Any authentication-related error message
    },

    // UI State (Example - we'll migrate uiState.js later)
    // ui: {
    //    logVisible: false,
    //    logHeight: 120,
    //    theme: 'dark',
    // },

    // Other top-level state sections can be added here as needed
    // files: { ... },
    // editor: { ... },
    // settings: { ... },
};

// --- Create the Central State Instance ---
// Instantiate the reactive state container with our initial structure.
// This `appState` object will be imported by other modules to access and update state.
export const appState = createState(initialState);

// --- Optional: Add Debugging Listener ---
// You can subscribe here to log all state changes for debugging purposes.
// appState.subscribe((newState, prevState) => {
//    console.log('[AppState Change]', { prevState, newState });
// });

console.log('[AppState] Central state initialized.');

// Note: The old AppStateManager class and its event listeners/dispatchers are removed.
// Modules previously relying on `app:stateChange` or specific states like `APP_STATES.LOGGED_IN`
// will need to be refactored to subscribe to `appState.auth.isLoggedIn`, `appState.auth.authChecked`, etc. 