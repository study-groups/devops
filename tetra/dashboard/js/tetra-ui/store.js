/**
 * TetraUI Store - Simple reactive state management
 *
 * Usage:
 *   const store = TetraUI.Store.create(initialState, reducers);
 *   store.subscribe((state, prev) => { ... });
 *   store.dispatch('actionName', payload);
 *   store.getState();
 */

window.TetraUI = window.TetraUI || {};

TetraUI.Store = {
    /**
     * Create a new store
     * @param {Object} initialState
     * @param {Object} reducers - {actionName: (state, payload) => newState}
     */
    create: function(initialState, reducers) {
        var state = Object.assign({}, initialState);
        var subscribers = [];
        reducers = reducers || {};

        return {
            /**
             * Get current state
             */
            getState: function() {
                return Object.assign({}, state);
            },

            /**
             * Subscribe to state changes
             * @param {Function} callback - (newState, prevState) => void
             * @returns {Function} Unsubscribe function
             */
            subscribe: function(callback) {
                subscribers.push(callback);
                return function() {
                    subscribers = subscribers.filter(function(s) { return s !== callback; });
                };
            },

            /**
             * Dispatch an action
             * @param {string} action - Action name
             * @param {*} payload - Action payload
             */
            dispatch: function(action, payload) {
                var reducer = reducers[action];
                if (!reducer) {
                    console.warn('[Store] Unknown action:', action);
                    return;
                }

                var prevState = state;
                state = reducer(Object.assign({}, state), payload);

                // Notify subscribers
                for (var i = 0; i < subscribers.length; i++) {
                    subscribers[i](state, prevState);
                }
            },

            /**
             * Update state directly (for simple cases)
             * @param {Object} partial - Partial state to merge
             */
            setState: function(partial) {
                var prevState = state;
                state = Object.assign({}, state, partial);

                for (var i = 0; i < subscribers.length; i++) {
                    subscribers[i](state, prevState);
                }
            },

            /**
             * Reset to initial state
             */
            reset: function() {
                var prevState = state;
                state = Object.assign({}, initialState);

                for (var i = 0; i < subscribers.length; i++) {
                    subscribers[i](state, prevState);
                }
            }
        };
    }
};
