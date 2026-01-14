/**
 * Simple state management store
 */

const state = {
    currentUser: null,
    jwtToken: localStorage.getItem('pbase_token'),
    authCredentials: null,
    currentS3Prefix: '',
};

const listeners = new Set();

export const store = {
    get(key) {
        return state[key];
    },

    set(key, value) {
        state[key] = value;
        this.notify();
    },

    update(updates) {
        Object.assign(state, updates);
        this.notify();
    },

    subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },

    notify() {
        listeners.forEach(fn => fn(state));
    },

    // Auth helpers
    isAuthenticated() {
        return state.currentUser && state.currentUser.username !== 'anonymous';
    },

    hasPermission(perm) {
        return state.currentUser?.permissions?.[perm] ?? false;
    },

    clearAuth() {
        state.currentUser = null;
        state.jwtToken = null;
        state.authCredentials = null;
        localStorage.removeItem('pbase_token');
        this.notify();
    },

    setToken(token) {
        state.jwtToken = token;
        if (token) {
            localStorage.setItem('pbase_token', token);
        } else {
            localStorage.removeItem('pbase_token');
        }
    },
};
