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
        if (typeof window !== 'undefined') {
            // Always ensure APP exists
            window.APP = window.APP || {};
            
            // Only set up core if it doesn't exist yet
            if (!window.APP.core) {
                const versionMeta = document.querySelector('meta[name="app-version"]');
                const appVersion = versionMeta ? versionMeta.getAttribute('content') : '0.0.0-dev';

                // Set up core namespace
                window.APP.core = {
                    getVersion: () => appVersion
                };
                
                // Set up other namespaces if they don't exist
                window.APP.services = window.APP.services || {};
                window.APP.bootloader = window.APP.bootloader || {};
                window.APP.debug = window.APP.debug || {};
                
                // Set version and initialized timestamp
                window.APP.version = appVersion;
                window.APP.initialized = window.APP.initialized || new Date().toISOString();
            }
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

// Create singleton instance and ensure immediate initialization
const appInitializer = new AppInitializer();

// Force immediate initialization to ensure APP.core is available
if (typeof window !== 'undefined' && !window.APP?.core) {
    appInitializer.initializeGlobalNamespace();
}

export { appInitializer };
export default appInitializer;
