import { eventBus } from '/client/eventBus.js';

/**
 * @file UIManager.js
 * @description Manages the lifecycle of UI components in a data-driven way.
 * Components register themselves, and the UIManager handles initialization, refresh, and destruction.
 */

class ComponentManager {
    constructor() {
        this.components = new Map(); // Use a Map to store by name for easier access
        this.isInitialized = false;
    }

    /**
     * Registers a UI component with the manager.
     * @param {object} component - The component to register.
     * @param {string} component.name - The unique name of the component.
     * @param {function} component.init - The one-time setup function for the component.
     * @param {function} component.refresh - The function to call for a soft refresh.
     * @param {function} component.destroy - The function to clean up the component.
     */
    register(component) {
        if (!component || !component.name || typeof component.init !== 'function' || typeof component.refresh !== 'function' || typeof component.destroy !== 'function') {
            console.error('[UIManager] Attempted to register a component with an invalid API.', component);
            return;
        }
        if (this.components.has(component.name)) {
            console.warn(`[UIManager] A component with the name "${component.name}" is already registered. Overwriting.`);
        }
        
        this.components.set(component.name, component);
        console.log(`[UIManager] Registered component: ${component.name}`);

        // If the UI has already been initialized, initialize this new component immediately.
        if (this.isInitialized) {
            this.initComponent(component);
        }
    }
    
    /**
     * Safely calls the init method for a single component.
     * @param {object} component 
     */
    initComponent(component) {
        try {
            component.init();
        } catch (error) {
            console.error(`[UIManager] Error initializing component ${component.name}:`, error);
        }
    }

    /**
     * Initializes all registered components. This should be called once on app startup.
     */
    init() {
        if (this.isInitialized) return;

        console.log('[UIManager] Initializing all components...');
        this.components.forEach(component => this.initComponent(component));

        this.isInitialized = true;
        console.log('[UIManager] All components initialized.');
        
        // Listen for the global refresh event to re-initialize everything.
        eventBus.on('ui:refresh', () => this.refreshAll());
    }
    
    /**
     * Re-initializes (refreshes) all registered components.
     */
    refreshAll() {
        console.log('[UIManager] Refreshing all components...');
        this.components.forEach(component => {
            try {
                component.refresh(); // Call the specific refresh method
            } catch (error) {
                console.error(`[UIManager] Error refreshing component ${component.name}:`, error);
            }
        });
        console.log('[UIManager] All components refreshed.');
    }

    /**
     * Destroys all registered components, running their cleanup functions.
     */
    destroyAll() {
        console.log('[UIManager] Destroying all components...');
        this.components.forEach(component => {
            try {
                component.destroy();
            } catch (error) {
                console.error(`[UIManager] Error destroying component ${component.name}:`, error);
            }
        });
        this.components.clear();
        this.isInitialized = false;
        console.log('[UIManager] All components destroyed.');
    }
}

export const UIManager = new ComponentManager(); 