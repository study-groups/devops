/**
 * statekit.js
 * Core utility for creating a simple reactive state container.
 */

/**
 * Creates a simple reactive state container.
 *
 * @template T State object type.
 * @param {T} initialState The initial state object.
 * @returns {{
 *   getState: () => T;
 *   update: (updater: (currentState: T) => Partial<T> | T) => void;
 *   subscribe: (listener: (newState: T, prevState: T) => void) => () => void;
 * }}
 */
export function createState(initialState) {
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
     * Updates the state using an updater function and notifies listeners.
     * @param {(currentState: T) => Partial<T> | T} updater - Function that receives the current state
     *        and returns an object with the properties to update, or the completely new state object.
     */
    function update(updater) {
        const prevState = { ...state }; // Shallow copy for comparison
        const updates = updater(state);

        // Check if it's a partial update or a whole new state object
        let newState = state;
        if (updates !== state) { // Check if updater returned a new object identity
             // Check if it's truly partial or meant to replace entirely
             const isPartial = Object.keys(updates).some(key => !(key in state)) || Object.keys(updates).length < Object.keys(state).length;
             
             if(isPartial && typeof updates === 'object' && updates !== null && !Array.isArray(updates)) {
                // Apply partial updates
                newState = { ...state, ...updates };
             } else {
                 // Replace the state entirely if the updater returned a non-partial object
                 // (e.g., a primitive, array, or explicitly the full new state)
                 newState = updates;
             }
        }
        // else: updater mutated the state directly (not recommended, but handle)

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
            console.debug('[StateKit] State updating:', { prevState, newState });
            state = newState; // Update the internal state
            // Notify listeners AFTER state is updated
            listeners.forEach(listener => listener(state, prevState));
        } else {
             console.debug('[StateKit] Update called but state did not change.');
        }
    }

    /**
     * Subscribes a listener function to state changes.
     * @param {(newState: T, prevState: T) => void} listener - Function to call when state changes.
     * @returns {() => void} An unsubscribe function.
     */
    function subscribe(listener) {
        listeners.add(listener);
        // Return an unsubscribe function
        return () => {
            listeners.delete(listener);
        };
    }

    console.log('[StateKit] New state created with initial state:', state);

    return { getState, update, subscribe };
} 