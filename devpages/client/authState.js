import { createState } from './state.js';

// Define the initial shape and default values for authentication state
const initialAuthState = {
  isAuthenticated: false,
  username: null,
  error: null, // To store login error messages
  isChecking: true, // Flag to indicate if initial auth check is in progress
};

// Create the reactive state instance
export const authState = createState(initialAuthState);

// Optional: Add a simple logger for debugging state changes
authState.subscribe(state => {
    // Avoid logging during the very initial state setting if desired
    if (!state.isChecking) { 
        console.log('[AuthState DEBUG] State changed:', state);
    }
}); 