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
        
        isDispatching = true;
        const prevState = state; // Direct reference for comparison
        const newState = reducer(state, action);

        // The reducer should return a new object if the state has changed.
        // A simple identity check is the most efficient way to detect a change.
        if (newState !== prevState) {
            // Skip debug logging for log entry actions to reduce noise
            if (action.type !== 'log/addEntry' && action.type !== 'LOG_ADD_ENTRY') {
                console.debug('[StateKit] State updating DEBUG]', { action: action.type, prevState, newState });
            }
            state = newState; // Update the internal state
            // Notify listeners AFTER state is updated
            listeners.forEach(listener => {
                // Let listener errors bubble up for easier debugging
                listener(state, prevState, action);
            });
        }
        isDispatching = false;
    }

    // Create a placeholder dispatch that will be replaced after middleware setup
    let enhancedDispatch = (action) => {
        throw new Error('Dispatch called before store initialization complete');
    };

    // Create middleware chain with proper store API
    const middlewareAPI = {
        getState,
        dispatch: (action) => enhancedDispatch(action)  // Wrapper avoids circular reference
    };

    // Debug middleware API
    console.debug('[StateKit] Creating middleware chain with API:', {
        hasGetState: typeof middlewareAPI.getState === 'function',
        hasDispatch: typeof middlewareAPI.dispatch === 'function',
        middlewareCount: middleware.length,
        middlewareAPI: middlewareAPI
    });

    // Debug middleware array
    middleware.forEach((middlewareFunc, index) => {
        console.debug(`[StateKit] Middleware ${index}:`, {
            isFunction: typeof middlewareFunc === 'function',
            name: middlewareFunc?.name || 'anonymous',
            middlewareFunc: middlewareFunc
        });
    });

    const chain = middleware.map((middlewareFunc, index) => {
        console.debug(`[StateKit] Initializing middleware ${index}:`, middlewareFunc.name || 'anonymous');
        const result = middlewareFunc(middlewareAPI);
        console.debug(`[StateKit] Middleware ${index} returned:`, typeof result);
        return result;
    });
    
    // Compose middleware chain (right to left, like Redux)
    const composed = chain.reduceRight((next, middlewareNext) => middlewareNext(next), dispatch);

    /**
     * Enhanced dispatch function that goes through middleware chain.
     * @param {object} action - The action object to dispatch.
     */
    enhancedDispatch = function(action) {
        // If no middleware, use the core dispatch directly
        if (middleware.length === 0) {
            return dispatch(action);
        }
        
        // Execute the composed chain
        return composed(action);
    };

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
        colors = true,
        excludeActions = [] // Array of action types to exclude from logging
    } = options;

    return ({ getState }) => next => action => {
        // Skip logging for excluded action types
        if (excludeActions.includes(action.type)) {
            return next(action);
        }

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

/**
 * Creates an async thunk action creator (Redux Toolkit-style).
 * @param {string} type - The action type prefix.
 * @param {Function} payloadCreator - The async function that returns the payload.
 * @returns {Function} Thunk action creator.
 */
export function createAsyncThunk(type, payloadCreator) {
    return (arg) => async (dispatch, getState) => {
        const requestId = Math.random().toString(36).substr(2, 9);
        
        // Dispatch pending action
        dispatch({
            type: `${type}/pending`,
            meta: { requestId, arg }
        });

        try {
            // Call the payload creator with the argument and thunk API
            const result = await payloadCreator(arg, { dispatch, getState, requestId });
            
            // Dispatch fulfilled action
            dispatch({
                type: `${type}/fulfilled`,
                payload: result,
                meta: { requestId, arg }
            });

            return { payload: result, meta: { requestId, arg } };
        } catch (error) {
            // Dispatch rejected action
            dispatch({
                type: `${type}/rejected`,
                error: error.message,
                meta: { requestId, arg, rejectedWithValue: false }
            });

            throw error;
        }
    };
}

// Export DevpagesTools functionality
export { 
    createDevpagesTools,
    createDevpagesConsolePanel,
    createDevpagesToolsUI
} from './devpagestools.js';
export { createSlice } from './createSlice.js'; 