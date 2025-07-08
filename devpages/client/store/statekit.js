/**
 * statekit.js
 * Core utility for creating a simple reactive state container.
 */

/**
 * Creates a simple reactive state container.
 *
 * @template T State object type.
 * @param {(state: T, action: object) => T} reducer - The root reducer function.
 * @param {T} initialState The initial state object.
 * @returns {{
 *   getState: () => T;
 *   dispatch: (action: object) => void;
 *   subscribe: (listener: (newState: T, prevState: T, action?: object) => void) => () => void;
 * }}
 */
export function createStore(reducer, initialState) {
    let state = { ...initialState };
    const listeners = new Set();

    /**
     * Returns the current state snapshot.
     * @returns {T}
     */
    function getState() {
        return state; // Return a copy? For now, direct reference for simplicity. Consider deep cloning if mutation is a risk.
    }

    /**
     * Dispatches an action to the store, updating the state and notifying listeners.
     * @param {object} action - The action object to dispatch.
     */
    function dispatch(action) {
        const prevState = { ...state }; // Shallow copy for comparison
        const newState = reducer(prevState, action); // Pass current state and action to the reducer

        // Only update and notify if the state actually changed (shallow compare)
        let changed = false;
        if (newState !== prevState) { // Check object identity first
             // If identities differ, do a shallow key/value check
             const keys = new Set([...Object.keys(prevState), ...Object.keys(newState)]);
             for (const key of keys) {
                 if (prevState[key] !== newState[key]) {
                     changed = true;
                     break;
                 }
             }
        }


        if (changed) {
            console.debug('[StateKit] State updating:', { prevState, newState, action });
            state = newState; // Update the internal state
            // Notify listeners AFTER state is updated
            listeners.forEach(listener => listener(state, prevState, action)); // Pass action to listeners too
        } else {
             console.debug('[StateKit] Dispatch called but state did not change.', { action });
        }
    }

    /**
     * Subscribes a listener function to state changes.
     * @param {(newState: T, prevState: T, action?: object) => void} listener - Function to call when state changes.
     * @returns {() => void} An unsubscribe function.
     */
    function subscribe(listener) {
        listeners.add(listener);
        // Return an unsubscribe function
        return () => {
            listeners.delete(listener);
        };
    }

    // Initialize state by dispatching a dummy action to run the reducer once
    dispatch({ type: '@@INIT' });
    console.log('[StateKit] New store created with initial state:', state);

    return { getState, dispatch, subscribe };
} 