// /client/state.js
export function createState(initial = {}) {
  let current = { ...initial };
  const subscribers = new Set();

  function subscribe(fn) {
    subscribers.add(fn);
    // Immediately call the subscriber with the current state
    fn(current); 
    // Return an unsubscribe function
    return () => subscribers.delete(fn); 
  }

  function update(transform) {
    // Ensure transform is a function
    if (typeof transform !== 'function') {
        console.error('State update requires a transform function.');
        return;
    }
    const previous = current;
    const next = transform({ ...current }); // Pass a copy to prevent direct mutation
    // Only update and notify if the state actually changed (shallow comparison)
    if (next !== previous) { // Basic check, could be enhanced
        current = next;
        subscribers.forEach(fn => fn(current));
    }
  }

  function get() {
    // Return a copy to prevent external mutation
    return { ...current }; 
  }

  return { subscribe, update, get };
} 