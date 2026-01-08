/**
 * ServiceRegistry.js - Unified service initialization and dependency management
 *
 * Consolidates ServiceInitializer and InitializationManager into a single system:
 * - Dependency-aware service initialization
 * - Automatic initialization ordering
 * - Service health checks
 * - Singleton access via window.APP.services
 *
 * @example
 * // Register services with dependencies
 * serviceRegistry.register('store', {
 *   factory: () => initializeStore(),
 *   dependencies: []
 * });
 *
 * serviceRegistry.register('eventBus', {
 *   factory: () => eventBus,
 *   dependencies: ['store']
 * });
 *
 * // Initialize all services in dependency order
 * await serviceRegistry.initializeAll();
 */

class ServiceRegistry {
    constructor() {
        // Service configurations: Map<name, { factory, dependencies, required, timeout }>
        this.services = new Map();

        // Initialized service instances
        this.instances = new Map();

        // Initialization state
        this.initializing = new Set();
        this.initialized = new Set();
        this.failed = new Set();

        // Health check functions
        this.healthChecks = new Map();

        // Ensure window.APP.services exists
        if (typeof window !== 'undefined') {
            window.APP = window.APP || {};
            window.APP.services = window.APP.services || {};
        }
    }

    /**
     * Register a service with its factory and dependencies
     *
     * @param {string} name - Service name
     * @param {Object} config - Service configuration
     * @param {Function} config.factory - Factory function returning service instance (can be async)
     * @param {string[]} [config.dependencies=[]] - Names of services this depends on
     * @param {boolean} [config.required=true] - If true, initialization failure throws
     * @param {number} [config.timeout=30000] - Initialization timeout in ms
     * @param {Function} [config.healthCheck] - Optional health check function
     */
    register(name, config) {
        if (!name || typeof name !== 'string') {
            throw new Error('Service name must be a non-empty string');
        }
        if (!config.factory || typeof config.factory !== 'function') {
            throw new Error(`Service ${name}: factory must be a function`);
        }

        this.services.set(name, {
            factory: config.factory,
            dependencies: config.dependencies || [],
            required: config.required !== false,
            timeout: config.timeout || 30000
        });

        if (config.healthCheck) {
            this.healthChecks.set(name, config.healthCheck);
        }

        console.log(`[ServiceRegistry] Registered: ${name}`, {
            dependencies: config.dependencies || [],
            required: config.required !== false
        });
    }

    /**
     * Initialize a single service (and its dependencies)
     *
     * @param {string} name - Service name
     * @returns {Promise<any>} Service instance
     */
    async initialize(name) {
        // Already initialized
        if (this.initialized.has(name)) {
            return this.get(name);
        }

        // Already failed
        if (this.failed.has(name)) {
            throw new Error(`Service ${name} previously failed to initialize`);
        }

        // Circular dependency check
        if (this.initializing.has(name)) {
            throw new Error(`Circular dependency detected for service: ${name}`);
        }

        const config = this.services.get(name);
        if (!config) {
            throw new Error(`Service not registered: ${name}`);
        }

        this.initializing.add(name);

        try {
            // Initialize dependencies first
            for (const dep of config.dependencies) {
                if (!this.initialized.has(dep)) {
                    await this.initialize(dep);
                }
            }

            // Initialize this service with timeout
            const service = await this._initializeWithTimeout(name, config);

            // Store instance
            this.instances.set(name, service);
            this.initialized.add(name);

            // Register in window.APP.services
            if (typeof window !== 'undefined') {
                window.APP.services[name] = service;
            }

            console.log(`[ServiceRegistry] Initialized: ${name}`);
            return service;

        } catch (error) {
            this.failed.add(name);
            console.error(`[ServiceRegistry] Failed to initialize ${name}:`, error);

            if (config.required) {
                throw error;
            }
            return null;

        } finally {
            this.initializing.delete(name);
        }
    }

    /**
     * @private
     */
    async _initializeWithTimeout(name, config) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Service ${name} initialization timed out after ${config.timeout}ms`));
            }, config.timeout);

            Promise.resolve(config.factory())
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Initialize all registered services in dependency order
     *
     * @returns {Promise<void>}
     */
    async initializeAll() {
        const order = this._calculateOrder();
        console.log(`[ServiceRegistry] Initializing ${order.length} services:`, order);

        for (const name of order) {
            await this.initialize(name);
        }

        console.log('[ServiceRegistry] All services initialized');
    }

    /**
     * Calculate initialization order using topological sort
     * @private
     */
    _calculateOrder() {
        const visited = new Set();
        const order = [];

        const visit = (name) => {
            if (visited.has(name)) return;
            visited.add(name);

            const config = this.services.get(name);
            if (!config) return;

            for (const dep of config.dependencies) {
                visit(dep);
            }

            order.push(name);
        };

        for (const name of this.services.keys()) {
            visit(name);
        }

        return order;
    }

    /**
     * Get an initialized service instance
     *
     * @param {string} name - Service name
     * @returns {any} Service instance or undefined
     */
    get(name) {
        return this.instances.get(name) || window.APP?.services?.[name];
    }

    /**
     * Check if a service is initialized
     *
     * @param {string} name - Service name
     * @returns {boolean}
     */
    isInitialized(name) {
        return this.initialized.has(name);
    }

    /**
     * Check if a service is registered
     *
     * @param {string} name - Service name
     * @returns {boolean}
     */
    isRegistered(name) {
        return this.services.has(name);
    }

    /**
     * Run health checks on all services
     *
     * @returns {Promise<Object>} Health check results { healthy: string[], unhealthy: string[] }
     */
    async checkHealth() {
        const results = { healthy: [], unhealthy: [] };

        for (const [name, check] of this.healthChecks) {
            try {
                const healthy = await check(this.get(name));
                if (healthy) {
                    results.healthy.push(name);
                } else {
                    results.unhealthy.push(name);
                }
            } catch (error) {
                console.error(`[ServiceRegistry] Health check failed for ${name}:`, error);
                results.unhealthy.push(name);
            }
        }

        return results;
    }

    /**
     * Wait for a service to be initialized
     *
     * @param {string} name - Service name
     * @param {number} [timeout=5000] - Timeout in ms
     * @returns {Promise<any>} Service instance
     */
    async waitFor(name, timeout = 5000) {
        if (this.initialized.has(name)) {
            return this.get(name);
        }

        const start = Date.now();
        while (!this.initialized.has(name)) {
            if (Date.now() - start > timeout) {
                throw new Error(`Timeout waiting for service: ${name}`);
            }
            await new Promise(r => setTimeout(r, 50));
        }

        return this.get(name);
    }

    /**
     * Wait for multiple services to be initialized
     *
     * @param {string[]} names - Service names
     * @param {number} [timeout=5000] - Timeout in ms
     * @returns {Promise<Object>} Map of service name to instance
     */
    async waitForAll(names, timeout = 5000) {
        const results = {};
        await Promise.all(
            names.map(async name => {
                results[name] = await this.waitFor(name, timeout);
            })
        );
        return results;
    }

    /**
     * Get debug information about the registry
     *
     * @returns {Object} Debug info
     */
    getDebugInfo() {
        return {
            registered: Array.from(this.services.keys()),
            initialized: Array.from(this.initialized),
            failed: Array.from(this.failed),
            initializing: Array.from(this.initializing),
            dependencyGraph: Object.fromEntries(
                Array.from(this.services.entries()).map(([name, config]) => [
                    name,
                    config.dependencies
                ])
            )
        };
    }

    /**
     * Reset the registry (for testing)
     */
    reset() {
        this.services.clear();
        this.instances.clear();
        this.initializing.clear();
        this.initialized.clear();
        this.failed.clear();
        this.healthChecks.clear();

        if (typeof window !== 'undefined') {
            window.APP.services = {};
        }
    }
}

// Export singleton instance
export const serviceRegistry = new ServiceRegistry();

// Also export class for testing
export { ServiceRegistry };
