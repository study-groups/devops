import { eventBus } from '/client/eventBus.js';

/**
 * @file componentManager.js
 * @description Manages the lifecycle of UI components in a data-driven way.
 * Components register themselves, and the manager handles initialization, refresh, and destruction.
 */

class LifecycleManager {
    constructor() {
        this.components = new Map(); // Use a Map to store by name for easier access
        this.isInitialized = false;
    }

    /**
     * Registers a UI component with the manager.
     * @param {object} component - The component to register.
     * @param {string} component.name - The unique name of the component.
     * @param {function} component.mount - The mount function for the component.
     * @param {function} component.destroy - The function to clean up the component.
     */
    register(component) {
        if (!component || !component.name || typeof component.mount !== 'function' || typeof component.destroy !== 'function') {
            console.error('[ComponentManager] Attempted to register a component with an invalid API.', component);
            return;
        }
        if (this.components.has(component.name)) {
            console.warn(`[ComponentManager] A component with the name "${component.name}" is already registered. Overwriting.`);
        }
        
        this.components.set(component.name, component);
        console.log(`[ComponentManager] Registered component: ${component.name}`);

        // If the UI has already been initialized, mount this new component immediately.
        if (this.isInitialized) {
            this.mountComponent(component);
        }
    }
    
    /**
     * Safely calls the mount method for a single component.
     * @param {object} component 
     */
    mountComponent(component) {
        console.log(`[ComponentManager] Starting mount of component: ${component.name}`);
        try {
            // Just call mount() - the old ContextManagerComponent pattern
            if (typeof component.mount === 'function') {
                component.mount();
                console.log(`[ComponentManager] ✅ Successfully mounted component: ${component.name}`);
            } else {
                console.warn(`[ComponentManager] ⚠️ Component ${component.name} has no mount method`);
            }
        } catch (error) {
            console.error(`[ComponentManager] ❌ Error mounting component ${component.name}:`, error);
            console.error(`[ComponentManager] ❌ Error stack for ${component.name}:`, error.stack);
        }
    }

    /**
     * Initializes all registered components. This should be called once on app startup.
     */
    init() {
        if (this.isInitialized) return;

        console.log('[ComponentManager] Initializing all components...');
        console.log(`[ComponentManager] Total components to initialize: ${this.components.size}`);
        
        let initCount = 0;
        this.components.forEach(component => {
            initCount++;
            console.log(`[ComponentManager] Initializing component ${initCount}/${this.components.size}: ${component.name}`);
            this.mountComponent(component);
        });

        this.isInitialized = true;
        console.log('[ComponentManager] All components initialized.');
        
        // Listen for the global refresh event to re-initialize everything.
        eventBus.on('ui:refresh', () => this.refreshAll());
    }
    
    /**
     * Re-initializes (refreshes) all registered components.
     */
    refreshAll() {
        console.log('[ComponentManager] Refreshing all components...');
        this.components.forEach(component => {
            try {
                // The refresh logic is now handled by the component itself or its mount method
                // If the component has a refresh method, call it.
                if (typeof component.refresh === 'function') {
                    component.refresh();
                } else {
                    // If no refresh method, just re-mount to ensure it's up-to-date
                    this.mountComponent(component);
                }
            } catch (error) {
                console.error(`[ComponentManager] Error refreshing component ${component.name}:`, error);
            }
        });
        console.log('[ComponentManager] All components refreshed.');
    }

    /**
     * Destroys all registered components, running their cleanup functions.
     */
    destroyAll() {
        console.log('[ComponentManager] Destroying all components...');
        this.components.forEach(component => {
            try {
                component.destroy();
            } catch (error) {
                console.error(`[ComponentManager] Error destroying component ${component.name}:`, error);
            }
        });
        this.components.clear();
        this.isInitialized = false;
        console.log('[ComponentManager] All components destroyed.');
    }
}

export const componentManager = new LifecycleManager(); 