/**
 * statekit-lite.js
 * Minimal, pre-toolkit snapshot of StateKit (no thunking, no createSlice)
 * Copied from statekit.js before any Redux Toolkit or thunking features were added
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

    function getState() {
        return state;
    }

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
        try {
            JSON.stringify(action);
        } catch (e) {
            throw new Error('Actions must be serializable');
        }
    }

    function dispatch(action) {
        validateAction(action);
        if (isDispatching) {
            throw new Error('Reducers may not dispatch actions');
        }
        try {
            isDispatching = true;
            const prevState = state;
            const newState = reducer(state, action);
            if (newState !== prevState) {
                console.debug('[StateKitLite] State updating DEBUG]', { action: action.type, prevState, newState });
                state = newState;
                listeners.forEach(listener => {
                    try {
                        listener(state, prevState, action);
                    } catch (error) {
                        console.error('[StateKitLite] Listener error:', error);
                    }
                });
            }
        } catch (error) {
            console.error('[StateKitLite] Reducer error:', error);
            throw error;
        } finally {
            isDispatching = false;
        }
    }

    function enhancedDispatch(action) {
        const chain = middleware.map(middleware => middleware({
            getState,
            dispatch: enhancedDispatch
        }));
        const composed = chain.reduce((a, b) => (...args) => a(b(...args)), dispatch);
        return composed(action);
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Expected the listener to be a function');
        }
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }

    enhancedDispatch({ type: '@@INIT' });
    console.log('[StateKitLite] New store created with initial state:', state);

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
        if (console.groupCollapsed) {
            console.groupCollapsed(`[StateKitLite] ${action.type}`);
        } else {
            console.group(`[StateKitLite] ${action.type}`);
        }
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