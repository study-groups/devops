/**
 * Simple Pub/Sub Store
 * Lightweight state management with subscriptions
 */

export function createStore(initialState = {}) {
  let state = { ...initialState };
  const subscribers = new Set();
  const keySubscribers = new Map();

  /**
   * Get current state or specific key
   */
  function get(key) {
    if (key === undefined) return { ...state };
    return state[key];
  }

  /**
   * Set state (partial update)
   */
  function set(updates) {
    const changes = [];

    for (const [key, value] of Object.entries(updates)) {
      if (state[key] !== value) {
        const oldValue = state[key];
        state[key] = value;
        changes.push({ key, value, oldValue });

        // Notify key-specific subscribers
        if (keySubscribers.has(key)) {
          keySubscribers.get(key).forEach(fn => fn(value, oldValue, key));
        }
      }
    }

    // Notify global subscribers
    if (changes.length > 0) {
      subscribers.forEach(fn => fn(changes, state));
    }

    return changes;
  }

  /**
   * Subscribe to all state changes
   * Returns unsubscribe function
   */
  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  /**
   * Subscribe to specific key changes
   * Returns unsubscribe function
   */
  function subscribeKey(key, fn) {
    if (!keySubscribers.has(key)) {
      keySubscribers.set(key, new Set());
    }
    keySubscribers.get(key).add(fn);
    return () => keySubscribers.get(key).delete(fn);
  }

  /**
   * Reset state to initial values
   */
  function reset() {
    const oldState = state;
    state = { ...initialState };
    subscribers.forEach(fn => fn([{ key: '*', value: state, oldValue: oldState }], state));
  }

  return {
    get,
    set,
    subscribe,
    subscribeKey,
    reset,
    // For debugging
    get state() { return { ...state }; }
  };
}

// Register with namespace when available
if (typeof window !== 'undefined' && window.PJA) {
  window.PJA.createStore = createStore;
}
