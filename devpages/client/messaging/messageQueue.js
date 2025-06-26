/**
 * client/messaging/messageQueue.js
 * Centralized action dispatcher and state management integration.
 */

import { ActionTypes } from './actionTypes.js';

// --- State ---
let currentReducer = null;

// --- Configuration ---
export function setReducer(reducer) {
    if (typeof reducer !== 'function') {
        console.error('setReducer expects a function, got:', typeof reducer);
        return;
    }
    currentReducer = reducer;
    console.log('[MessageQueue] Reducer set successfully');
}

// --- Dispatcher ---
// The `dispatch` function is the single point of entry for all actions.
export function dispatch(action) {
    if (!action.type) {
        console.error('Action must have a type property.', action);
        return;
    }
    
    if (!currentReducer) {
        console.error('No reducer set. Call setReducer() first.', action);
        return;
    }
    
    // Call the configured reducer
    currentReducer(action);
}

// Re-export ActionTypes for convenience so other modules can import it from here
// without creating circular dependencies, now that ActionTypes is in its own file.
export { ActionTypes };
