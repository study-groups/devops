/**
 * client/messaging/messageQueue.js
 * Centralized action dispatcher and state management integration.
 */

import { ActionTypes } from './actionTypes.js';
import { appStore } from '/client/appState.js';

const log = window.APP.services.log.createLogger('MessageQueue');

// No longer needed as appStore.dispatch handles the reducer call
// let currentReducer = null;

/**
 * Set the reducer function for the message queue.
 * This is typically called once during application initialization.
 * @param {Function} reducer - The root reducer function.
 */
export const setReducer = (reducer) => {
    // currentReducer = reducer; // No longer needed
    log.debug('MESSAGE_QUEUE', 'SET_REDUCER', 'Reducer set in messageQueue (via appStore direct dispatch)');
};

/**
 * Dispatches an action to the central application store.
 * This is the primary way to trigger state changes in the application.
 * @param {object} action - The action object to dispatch.
 */
export const dispatch = (action) => {
    // The appStore itself has a dispatch method that applies its reducer
    // and updates its internal state. We route all actions through this.
    if (appStore && typeof appStore.dispatch === 'function') {
        // Removed logMessage from dispatch to prevent recursion
        // log.debug('MESSAGE_QUEUE', 'DISPATCH', `Dispatching action to appStore: ${action.type}`, { action });
        appStore.dispatch(action);
    } else {
        // Removed logMessage to prevent any potential recursion
        // log.error('MESSAGE_QUEUE', 'DISPATCH_ERROR', 'Cannot dispatch action: appStore or appStore.dispatch not available.', { action });
        console.error('AppStore not ready for dispatch:', appStore, action);
    }
};

// Re-export ActionTypes for convenience so other modules can import it from here
// without creating circular dependencies, now that ActionTypes is in its own file.
export { ActionTypes };
