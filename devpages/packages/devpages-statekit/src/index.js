/**
 * statekit.js
 * Core utility for creating a simple reactive state container.
 */

/**
 * Creates a simple reactive state container.
 *
 * @template T State object type.
 * @param [object Object](state: T, action: object) => T} reducer - The root reducer function.
 * @param {T} initialState The initial state object.
 * @param {Array<Function>} middleware - Array of middleware functions.
 * @returns {{
 *   getState: () => T;
 *   dispatch: (action: object) => void;
 *   subscribe: (listener: (newState: T, prevState: T, action?: object) => void) => () => void;
 * }}
 */
export function createStore(reducer, initialState, middleware = []) {
    let state = { ...initialState };
    const listeners = new Set();
    let isDispatching = false; // Prevent recursive dispatches

    /**
     * Returns the current state snapshot.
     * @returns {T}
     */
    function getState() {
        return state; // Return a copy? For now, direct reference for simplicity. Consider deep cloning if mutation is a risk.
    }

    /**
     * Validates an action object according to Redux conventions.
     * @param {object} action - The action to validate.
     * @throws {Error} If action is invalid.
     */
    function validateAction(action) {
        if (action === null || action === undefined) {
            throw new Error('Actions may not be null or undefined');
        }
        
        if (typeof action !== 'object') {
            throw new Error('Actions must be plain objects');
        }
        
        if (typeof action.type === 'undefined') {
            throw new Error('Actions may not have an undefined "type" property');
        }
        
        // Check for non-serializable values (Redux best practice)
        try {
            JSON.stringify(action);
        } catch (e) {
            throw new Error('Actions must be serializable');
        }
    }

    /**
     * Core dispatch function that bypasses middleware.
     * @param {object} action - The action object to dispatch.
     */
    function dispatch(action) {
        // Validate action (Redux-style)
        validateAction(action);
        
        // Prevent recursive dispatches (Redux-style)
        if (isDispatching) {
            throw new Error('Reducers may not dispatch actions');
        }
        
        try {
            isDispatching = true;
            const prevState = state; // Direct reference for comparison
            const newState = reducer(state, action);

            // The reducer should return a new object if the state has changed.
            // A simple identity check is the most efficient way to detect a change.
            if (newState !== prevState) {
                console.debug('[StateKit] State updating DEBUG]', { action: action.type, prevState, newState });
                state = newState; // Update the internal state
                // Notify listeners AFTER state is updated
                listeners.forEach(listener => {
                    try {
                        listener(state, prevState, action);
                    } catch (error) {
                        console.error('[StateKit] Listener error:', error);
                    }
                });
            }
        } catch (error) {
            console.error('[StateKit] Reducer error:', error);
            throw error;
        } finally {
            isDispatching = false;
        }
    }

    /**
     * Enhanced dispatch function that goes through middleware chain.
     * @param {object} action - The action object to dispatch.
     */
    function enhancedDispatch(action) {
        // Create middleware chain
        const chain = middleware.map(middleware => middleware({
            getState,
            dispatch: enhancedDispatch
        }));
        
        // Compose middleware chain
        const composed = chain.reduce((a, b) => (...args) => a(b(...args)));
        
        // Execute the chain with the final dispatch
        return composed(dispatch)(action);
    }

    /**
     * Subscribes a listener function to state changes.
     * @param {(newState: T, prevState: T, action?: object) => void} listener - Function to call when state changes.
     * @returns {() => void} An unsubscribe function.
     */
    function subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Expected the listener to be a function');
        }
        
        listeners.add(listener);
        // Return an unsubscribe function
        return () => {
            listeners.delete(listener);
        };
    }

    // Initialize state by dispatching a dummy action to run the reducer once
    enhancedDispatch({ type: '@@INIT' });
    console.log('[StateKit] New store created with initial state:', state);

    return { getState, dispatch: enhancedDispatch, subscribe };
}

/**
 * Creates a logger middleware (Redux-style).
 * @param {object} options - Logger options.
 * @returns {Function} Logger middleware.
 */
export function createLogger(options = {}) {
    const {
        collapsed = true,
        duration = false,
        timestamp = true,
        colors = true
    } = options;

    return ({ getState }) => next => action => {
        const prevState = getState();
        const startTime = Date.now();
        
        console.groupCollapsed ? 
            console.groupCollapsed(`[StateKit] ${action.type}`) : 
            console.group(`[StateKit] ${action.type}`);
        
        if (timestamp) {
            console.log('Time:', new Date().toISOString());
        }
        
        console.log('Prev State:', prevState);
        console.log('Action:', action);
        
        const result = next(action);
        
        const nextState = getState();
        const endTime = Date.now();
        
        if (duration) {
            console.log('Duration:', `${endTime - startTime}ms`);
        }
        
        console.log('Next State:', nextState);
        console.groupEnd();
        
        return result;
    };
}

/**
 * Creates a thunk middleware for handling async actions (Redux-style).
 * @returns {Function} Thunk middleware.
 */
export function createThunk() {
    return ({ dispatch, getState }) => next => action => {
        if (typeof action === 'function') {
            return action(dispatch, getState);
        }
        return next(action);
    };
}

// Export DevTools functionality
export { createDevTools, createConsolePanel, createDevToolsUI } from './devtools.js'; 