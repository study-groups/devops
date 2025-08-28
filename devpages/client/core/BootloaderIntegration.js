/**
 * BootloaderIntegration.js - Integration layer for InitializationManager
 * 
 * This module provides a bridge between the existing bootloader and the new
 * centralized initialization system, allowing gradual migration.
 */

import { initializationManager } from './InitializationManager.js';
import { appInitializer } from './AppInitializer.js';

export class BootloaderIntegration {
    constructor() {
        this.legacyMode = true; // Start in legacy mode for compatibility
        this.migrationPhase = 0; // Track migration progress
    }

    /**
     * Initialize the integration layer
     */
    async initialize() {
        console.log('[BootloaderIntegration] Initializing integration layer...');
        
        // Register additional modules that weren't in the default set
        this.registerAdditionalModules();
        
        // Set up hooks for monitoring
        this.setupMonitoringHooks();
        
        // If not in legacy mode, use centralized initialization
        if (!this.legacyMode) {
            return await initializationManager.initialize();
        }
        
        console.log('[BootloaderIntegration] Running in legacy compatibility mode');
        return { legacy: true };
    }

    /**
     * Register additional modules discovered from the audit
     */
    registerAdditionalModules() {
        // Image handling
        initializationManager.registerModule('imageHandling', {
            domain: 'image',
            priority: 30,
            required: false,
            dependencies: ['logging', 'eventBus'],
            initializer: async () => {
                const imageEvents = await import('/client/image/imageEvents.js');
                const imageIndex = await import('/client/image/imageIndex.js');
                return { imageEvents, imageIndex };
            },
            description: 'Image handling system'
        });

        // Layout management
        initializationManager.registerModule('layout', {
            domain: 'layout',
            priority: 40,
            required: false,
            dependencies: ['logging'],
            initializer: async () => {
                const sidebar = await import('/client/layout/Sidebar.js');
                const workspaceManager = await import('/client/layout/WorkspaceManager.js');
                const resizable = await import('/client/layout/resizable.js');
                return { sidebar, workspaceManager, resizable };
            },
            description: 'Layout management system'
        });

        // Dock system
        initializationManager.registerModule('docks', {
            domain: 'docks',
            priority: 35,
            required: false,
            dependencies: ['logging', 'layout'],
            initializer: async () => {
                const baseDock = await import('/client/layout/docks/BaseDock.js');
                const debugDock = await import('/client/layout/docks/DebugDock.js');
                const dockManager = await import('/client/layout/docks/dockManager.js');
                return { baseDock, debugDock, dockManager };
            },
            description: 'Dock management system'
        });

        // Plugin system
        initializationManager.registerModule('plugins', {
            domain: 'plugins',
            priority: 25,
            required: false,
            dependencies: ['logging', 'preview'],
            initializer: async () => {
                const pluginManager = await import('/client/preview/PluginManager.js');
                const pluginLoader = await import('/client/preview/plugins/PluginLoader.js');
                return { pluginManager, pluginLoader };
            },
            description: 'Plugin system'
        });

        // Redux store management
        initializationManager.registerModule('reduxStore', {
            domain: 'store',
            priority: 85,
            required: true,
            dependencies: ['logging'],
            initializer: async () => {
                // This will be handled by the existing bootloader
                return window.APP.services.store;
            },
            healthCheck: () => !!window.APP.services.store,
            description: 'Redux store'
        });

        // Utils initialization
        initializationManager.registerModule('utils', {
            domain: 'utils',
            priority: 20,
            required: false,
            dependencies: ['logging'],
            initializer: async () => {
                const debugUtils = await import('/client/utils/debugUtils.js');
                const zIndexManager = await import('/client/utils/ZIndexManager.js');
                const keyboardShortcutManager = await import('/client/utils/KeyboardShortcutManager.js');
                return { debugUtils, zIndexManager, keyboardShortcutManager };
            },
            description: 'Utility modules'
        });

        // CLI system
        initializationManager.registerModule('cli', {
            domain: 'cli',
            priority: 15,
            required: false,
            dependencies: ['logging', 'eventBus'],
            initializer: async () => {
                const cliEvents = await import('/client/cli/cliEvents.js');
                const cliIndex = await import('/client/cli/index.js');
                return { cliEvents, cliIndex };
            },
            description: 'CLI system'
        });

        // Code analysis
        initializationManager.registerModule('codeAnalysis', {
            domain: 'code',
            priority: 10,
            required: false,
            dependencies: ['logging'],
            initializer: async () => {
                const astParser = await import('/client/code/ast-parser.js');
                const functionOverview = await import('/client/code/function-overview-component.js');
                return { astParser, functionOverview };
            },
            description: 'Code analysis tools'
        });

        // Testing framework
        initializationManager.registerModule('testing', {
            domain: 'tests',
            priority: 5,
            required: false,
            dependencies: ['logging', 'panels'],
            initializer: async () => {
                const testFramework = await import('/client/tests/PanelTestFramework.js');
                return { testFramework };
            },
            description: 'Testing framework'
        });
    }

    /**
     * Set up monitoring hooks
     */
    setupMonitoringHooks() {
        // Monitor initialization progress
        initializationManager.addHook('after', '*', (moduleName, phase) => {
            console.log(`[BootloaderIntegration] Module ${moduleName} completed ${phase} phase`);
        });

        // Track failures
        initializationManager.addHook('before', '*', (moduleName, phase) => {
            if (phase === 'retry') {
                console.warn(`[BootloaderIntegration] Retrying module ${moduleName}`);
            }
        });
    }

    /**
     * Enable centralized initialization (migration phase 1)
     */
    enableCentralizedInit() {
        this.legacyMode = false;
        this.migrationPhase = 1;
        console.log('[BootloaderIntegration] Enabled centralized initialization');
    }

    /**
     * Get initialization status for all domains
     */
    getDomainStatus() {
        if (this.legacyMode) {
            return { legacy: true, message: 'Running in legacy mode' };
        }
        
        return initializationManager.getDomainsStatus();
    }

    /**
     * Get detailed initialization report
     */
    getInitializationReport() {
        if (this.legacyMode) {
            return {
                mode: 'legacy',
                phase: this.migrationPhase,
                recommendations: [
                    'Consider enabling centralized initialization',
                    'Run domain consolidation analysis',
                    'Test individual module initialization'
                ]
            };
        }
        
        return {
            mode: 'centralized',
            phase: this.migrationPhase,
            ...initializationManager.getInitializationSummary()
        };
    }

    /**
     * Migrate specific domain to centralized initialization
     */
    async migrateDomain(domainName) {
        console.log(`[BootloaderIntegration] Migrating domain: ${domainName}`);
        
        // Get modules in domain
        const domainModules = Array.from(initializationManager.modules.values())
            .filter(module => module.domain === domainName);
        
        if (domainModules.length === 0) {
            console.warn(`[BootloaderIntegration] No modules found for domain: ${domainName}`);
            return false;
        }
        
        // Initialize domain modules
        for (const module of domainModules) {
            try {
                await initializationManager.initializeModule(module);
                console.log(`[BootloaderIntegration] ✅ Migrated ${module.name}`);
            } catch (error) {
                console.error(`[BootloaderIntegration] ❌ Failed to migrate ${module.name}:`, error);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Rollback to legacy initialization for a domain
     */
    rollbackDomain(domainName) {
        console.log(`[BootloaderIntegration] Rolling back domain: ${domainName}`);
        
        // This would involve cleanup and re-initialization using legacy methods
        // Implementation depends on specific domain requirements
        
        return true;
    }

    /**
     * Generate migration plan
     */
    generateMigrationPlan() {
        const domains = initializationManager.getDomainsStatus();
        const plan = {
            currentPhase: this.migrationPhase,
            totalDomains: Object.keys(domains).length,
            migrationSteps: [
                {
                    phase: 1,
                    description: 'Enable centralized initialization alongside legacy',
                    domains: ['core', 'logging'],
                    risk: 'low'
                },
                {
                    phase: 2,
                    description: 'Migrate authentication and settings',
                    domains: ['auth', 'settings'],
                    risk: 'medium'
                },
                {
                    phase: 3,
                    description: 'Migrate UI and layout systems',
                    domains: ['ui', 'layout', 'panels'],
                    risk: 'medium'
                },
                {
                    phase: 4,
                    description: 'Migrate specialized systems',
                    domains: ['preview', 'plugins', 'debug'],
                    risk: 'low'
                },
                {
                    phase: 5,
                    description: 'Complete migration and remove legacy code',
                    domains: ['*'],
                    risk: 'high'
                }
            ]
        };
        
        return plan;
    }
}

// Create singleton instance
export const bootloaderIntegration = new BootloaderIntegration();
export default bootloaderIntegration;
