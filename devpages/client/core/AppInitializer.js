/**
 * AppInitializer.js - Application initialization utilities
 * Provides centralized initialization and property management for the global APP namespace
 */

class AppInitializer {
    constructor() {
        this.initialized = false;
        this.properties = new Map();
        this.initializeGlobalNamespace();
    }

    initializeGlobalNamespace() {
        if (typeof window !== 'undefined' && !window.APP) {
            window.APP = {
                services: {},
                bootloader: {},
                debug: {},
                version: '1.0.0',
                initialized: new Date().toISOString()
            };
        }
        this.initialized = true;
    }

    setAppProperty(key, value) {
        if (typeof window !== 'undefined') {
            window.APP = window.APP || {};
            window.APP[key] = value;
            this.properties.set(key, value);
        }
    }

    getAppProperty(key) {
        if (typeof window !== 'undefined' && window.APP) {
            return window.APP[key];
        }
        return this.properties.get(key);
    }

    hasProperty(key) {
        return this.properties.has(key) || (typeof window !== 'undefined' && window.APP && key in window.APP);
    }

    getAllProperties() {
        return Array.from(this.properties.keys());
    }
}

// Create singleton instance
const appInitializer = new AppInitializer();

export { appInitializer };
export default appInitializer;
