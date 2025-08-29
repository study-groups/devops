/**
 * InitializationManager.js - Centralized initialization system
 * 
 * This manager coordinates the initialization of all system components,
 * reducing the 34 domains with multiple initializers found in the audit.
 * 
 * Features:
 * - Dependency-based initialization order
 * - Parallel initialization where possible
 * - Error handling and recovery
 * - Progress tracking
 * - Initialization hooks
 */

import { appInitializer } from './AppInitializer.js';

export class InitializationManager {
    constructor() {
        this.modules = new Map();
        this.initialized = new Set();
        this.failed = new Set();
        this.initializing = new Set();
        this.hooks = new Map();
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            timeoutMs: 30000,
            parallelInit: true
        };
        
        // Track initialization progress
        this.progress = {
            total: 0,
            completed: 0,
            failed: 0,
            current: null
        };
        
        this.setupDefaultModules();
    }

    /**
     * Register a module for initialization
     * @param {string} name - Module name
     * @param {Object} config - Module configuration
     */
    registerModule(name, config) {
        const moduleConfig = {
            name,
            dependencies: config.dependencies || [],
            priority: config.priority || 0,
            required: config.required !== false,
            timeout: config.timeout || this.config.timeoutMs,
            retries: 0,
            maxRetries: config.maxRetries || this.config.maxRetries,
            initializer: config.initializer,
            cleanup: config.cleanup,
            healthCheck: config.healthCheck,
            domain: config.domain || 'core',
            description: config.description || name,
            ...config
        };

        this.modules.set(name, moduleConfig);
        
        console.log(`[InitManager] Registered module: ${name} (domain: ${moduleConfig.domain})`);
        return this;
    }

    /**
     * Initialize all registered modules
     */
    async initialize() {
        console.log('[InitManager] 🚀 Starting centralized initialization...');
        
        this.progress.total = this.modules.size;
        this.progress.completed = 0;
        this.progress.failed = 0;

        // Clear previous state
        this.initialized.clear();
        this.failed.clear();
        this.initializing.clear();

        // Get initialization order
        const initOrder = this.calculateInitializationOrder();
        console.log('[InitManager] Initialization order:', initOrder.map(batch => batch.map(m => m.name)));

        // Initialize in batches (parallel within batch, sequential between batches)
        for (const batch of initOrder) {
            await this.initializeBatch(batch);
        }

        // Final health check
        await this.performHealthChecks();

        const summary = this.getInitializationSummary();
        console.log('[InitManager] ✅ Initialization complete:', summary);

        return summary;
    }

    /**
     * Initialize a batch of modules in parallel
     * @param {Array} batch - Modules to initialize
     */
    async initializeBatch(batch) {
        if (batch.length === 0) return;

        console.log(`[InitManager] Initializing batch: ${batch.map(m => m.name).join(', ')}`);

        const promises = batch.map(module => this.initializeModule(module));
        
        if (this.config.parallelInit) {
            // Wait for all modules in batch to complete
            await Promise.allSettled(promises);
        } else {
            // Sequential initialization within batch
            for (const promise of promises) {
                await promise.catch(() => {}); // Continue even if one fails
            }
        }
    }

    /**
     * Initialize a single module
     * @param {Object} module - Module configuration
     */
    async initializeModule(module) {
        if (this.initialized.has(module.name) || this.initializing.has(module.name)) {
            return;
        }

        this.initializing.add(module.name);
        this.progress.current = module.name;

        try {
            console.log(`[InitManager] Initializing ${module.name}...`);
            
            // Run pre-initialization hooks
            await this.runHooks('before', module.name);

            // Initialize with timeout
            const result = await this.withTimeout(
                this.runInitializer(module),
                module.timeout
            );

            // Mark as initialized
            this.initialized.add(module.name);
            this.initializing.delete(module.name);
            this.progress.completed++;

            // Register with AppInitializer if specified
            if (result && module.registerAs) {
                if (module.registerAs.type === 'service') {
                    appInitializer.registerService(module.registerAs.name, result, module.registerAs.options);
                } else if (module.registerAs.type === 'component') {
                    appInitializer.registerComponent(module.registerAs.name, result, module.registerAs.options);
                }
            }

            // Run post-initialization hooks
            await this.runHooks('after', module.name);

            console.log(`[InitManager] ✅ ${module.name} initialized successfully`);
            return result;

        } catch (error) {
            console.error(`[InitManager] ❌ Failed to initialize ${module.name}:`, error);
            
            this.initializing.delete(module.name);
            module.retries++;

            // Retry if configured
            if (module.retries < module.maxRetries) {
                console.log(`[InitManager] Retrying ${module.name} (${module.retries}/${module.maxRetries})`);
                await this.delay(this.config.retryDelay);
                return this.initializeModule(module);
            }

            // Mark as failed
            this.failed.add(module.name);
            this.progress.failed++;

            // If required module fails, this is critical
            if (module.required) {
                throw new Error(`Required module ${module.name} failed to initialize: ${error.message}`);
            }
        }
    }

    /**
     * Run the module's initializer function
     * @param {Object} module - Module configuration
     */
    async runInitializer(module) {
        if (typeof module.initializer === 'function') {
            return await module.initializer();
        } else if (typeof module.initializer === 'string') {
            // Dynamic import
            const moduleExport = await import(module.initializer);
            const initFn = moduleExport.default || moduleExport.initialize || moduleExport.init;
            if (typeof initFn === 'function') {
                return await initFn();
            }
        } else if (module.initializer?.module && module.initializer?.function) {
            // Import specific function from module
            const moduleExport = await import(module.initializer.module);
            const initFn = moduleExport[module.initializer.function];
            if (typeof initFn === 'function') {
                return await initFn();
            }
        }
        
        throw new Error(`Invalid initializer configuration for ${module.name}`);
    }

    /**
     * Calculate initialization order based on dependencies
     */
    calculateInitializationOrder() {
        const modules = Array.from(this.modules.values());
        const batches = [];
        const processed = new Set();

        while (processed.size < modules.length) {
            const batch = [];
            
            // Find modules whose dependencies are satisfied
            for (const module of modules) {
                if (processed.has(module.name)) continue;
                
                const dependenciesSatisfied = module.dependencies.every(dep => 
                    processed.has(dep) || !this.modules.has(dep)
                );
                
                if (dependenciesSatisfied) {
                    batch.push(module);
                }
            }

            if (batch.length === 0) {
                // Circular dependency or missing dependency
                const remaining = modules.filter(m => !processed.has(m.name));
                console.warn('[InitManager] Circular or missing dependencies detected:', 
                    remaining.map(m => ({ name: m.name, deps: m.dependencies })));
                
                // Add remaining modules to batch (they'll fail if dependencies are truly missing)
                batch.push(...remaining);
            }

            // Sort batch by priority (higher priority first)
            batch.sort((a, b) => b.priority - a.priority);
            
            batches.push(batch);
            batch.forEach(module => processed.add(module.name));
        }

        return batches;
    }

    /**
     * Perform health checks on initialized modules
     */
    async performHealthChecks() {
        console.log('[InitManager] Performing health checks...');
        
        const healthResults = new Map();
        
        for (const [name, module] of this.modules.entries()) {
            if (!this.initialized.has(name) || !module.healthCheck) continue;
            
            try {
                const healthy = await module.healthCheck();
                healthResults.set(name, healthy);
                
                if (!healthy) {
                    console.warn(`[InitManager] Health check failed for ${name}`);
                }
            } catch (error) {
                console.error(`[InitManager] Health check error for ${name}:`, error);
                healthResults.set(name, false);
            }
        }
        
        return healthResults;
    }

    /**
     * Add initialization hook
     * @param {string} phase - 'before' or 'after'
     * @param {string} moduleName - Module name or '*' for all
     * @param {Function} callback - Hook callback
     */
    addHook(phase, moduleName, callback) {
        const key = `${phase}:${moduleName}`;
        if (!this.hooks.has(key)) {
            this.hooks.set(key, []);
        }
        this.hooks.get(key).push(callback);
    }

    /**
     * Run hooks for a module
     * @param {string} phase - 'before' or 'after'
     * @param {string} moduleName - Module name
     */
    async runHooks(phase, moduleName) {
        // Run global hooks
        const globalHooks = this.hooks.get(`${phase}:*`) || [];
        const moduleHooks = this.hooks.get(`${phase}:${moduleName}`) || [];
        
        for (const hook of [...globalHooks, ...moduleHooks]) {
            try {
                await hook(moduleName, phase);
            } catch (error) {
                console.error(`[InitManager] Hook error (${phase}:${moduleName}):`, error);
            }
        }
    }

    /**
     * Get initialization summary
     */
    getInitializationSummary() {
        return {
            total: this.progress.total,
            completed: this.progress.completed,
            failed: this.progress.failed,
            success: this.progress.failed === 0,
            initialized: Array.from(this.initialized),
            failed: Array.from(this.failed),
            domains: this.getDomainsStatus()
        };
    }

    /**
     * Get status by domain
     */
    getDomainsStatus() {
        const domains = new Map();
        
        for (const [name, module] of this.modules.entries()) {
            if (!domains.has(module.domain)) {
                domains.set(module.domain, { total: 0, completed: 0, failed: 0 });
            }
            
            const domainStats = domains.get(module.domain);
            domainStats.total++;
            
            if (this.initialized.has(name)) {
                domainStats.completed++;
            } else if (this.failed.has(name)) {
                domainStats.failed++;
            }
        }
        
        return Object.fromEntries(domains);
    }

    /**
     * Setup default system modules
     */
    setupDefaultModules() {
        // Core logging system
        this.registerModule('logging', {
            domain: 'core',
            priority: 100,
            required: true,
            dependencies: [],
            initializer: '/client/log/UnifiedLogging.js',
            description: 'Unified logging system'
        });

        // Event bus
        this.registerModule('eventBus', {
            domain: 'core',
            priority: 90,
            required: true,
            dependencies: ['logging'],
            initializer: () => import('/client/eventBus.js').then(m => m.eventBus),
            registerAs: { type: 'service', name: 'eventBus' },
            description: 'Global event bus'
        });

        // Authentication system
        this.registerModule('auth', {
            domain: 'auth',
            priority: 80,
            required: true,
            dependencies: ['logging', 'eventBus'],
            initializer: {
                module: '/client/auth.js',
                function: 'initAuth'
            },
            description: 'Authentication system'
        });

        // Settings system
        this.registerModule('settings', {
            domain: 'settings',
            priority: 70,
            required: false,
            dependencies: ['logging'],
            initializer: '/client/settings/core/settingsInitializer.js',
            description: 'Settings management'
        });

        // Preview system
        this.registerModule('preview', {
            domain: 'preview',
            priority: 30,
            required: false,
            dependencies: ['logging'],
            initializer: '/client/preview/index.js',
            description: 'Content preview system'
        });
    }

    /**
     * Utility: Run function with timeout
     */
    async withTimeout(promise, timeoutMs) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Initialization timeout')), timeoutMs)
            )
        ]);
    }

    /**
     * Utility: Delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup all modules
     */
    async cleanup() {
        console.log('[InitManager] Cleaning up modules...');
        
        const cleanupPromises = [];
        
        for (const [name, module] of this.modules.entries()) {
            if (this.initialized.has(name) && module.cleanup) {
                cleanupPromises.push(
                    module.cleanup().catch(error => 
                        console.error(`[InitManager] Cleanup error for ${name}:`, error)
                    )
                );
            }
        }
        
        await Promise.allSettled(cleanupPromises);
        
        this.initialized.clear();
        this.failed.clear();
        this.initializing.clear();
    }
}

// Create singleton instance
export const initializationManager = new InitializationManager();
export default initializationManager;
