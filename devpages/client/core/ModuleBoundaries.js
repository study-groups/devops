/**
 * ModuleBoundaries.js - Module responsibility and boundary definitions
 * 
 * This module defines clear boundaries and responsibilities for different
 * parts of the application to prevent competing implementations.
 */

export const MODULE_BOUNDARIES = {
    // Core system modules
    core: {
        path: 'client/core/',
        responsibilities: [
            'Application initialization (AppInitializer)',
            'Event delegation (EventDelegationManager)', 
            'Module boundary enforcement',
            'System-wide utilities'
        ],
        owns: [
            'window.APP initialization',
            'Global event delegation',
            'Module registration'
        ],
        dependencies: [],
        exports: ['AppInitializer', 'EventDelegationManager', 'ModuleBoundaries']
    },

    // Authentication and user management
    auth: {
        path: 'client/auth/',
        responsibilities: [
            'User authentication',
            'Session management',
            'Permission checking',
            'Auth state management'
        ],
        owns: [
            'Auth Redux slice',
            'Login/logout flows',
            'User session data'
        ],
        dependencies: ['core', 'store'],
        exports: ['authSlice', 'authThunks', 'AuthDisplay']
    },

    // Redux store and state management
    store: {
        path: 'client/store/',
        responsibilities: [
            'Redux store configuration',
            'State persistence',
            'Middleware setup',
            'Action/reducer coordination'
        ],
        owns: [
            'Redux store instance',
            'All slices and reducers',
            'State persistence logic'
        ],
        dependencies: ['core'],
        exports: ['store', 'slices', 'reducers', 'middleware']
    },

    // Panel system
    panels: {
        path: 'client/panels/',
        responsibilities: [
            'Panel lifecycle management',
            'Panel registration and discovery',
            'Panel state persistence',
            'Panel UI coordination'
        ],
        owns: [
            'BasePanel class',
            'Panel registry',
            'Panel state management',
            'Panel reordering/drag-drop'
        ],
        dependencies: ['core', 'store', 'layout'],
        exports: ['BasePanel', 'PanelRegistry', 'PanelStateManager']
    },

    // Layout and workspace management
    layout: {
        path: 'client/layout/',
        responsibilities: [
            'Workspace layout management',
            'Sidebar and dock management',
            'Resizable components',
            'Z-index coordination'
        ],
        owns: [
            'WorkspaceManager',
            'Sidebar components',
            'Dock system',
            'Layout state'
        ],
        dependencies: ['core', 'store', 'utils'],
        exports: ['WorkspaceManager', 'Sidebar', 'DockManager']
    },

    // Utilities and helpers
    utils: {
        path: 'client/utils/',
        responsibilities: [
            'Shared utility functions',
            'Z-index management',
            'Keyboard shortcuts',
            'Debug utilities'
        ],
        owns: [
            'ZIndexManager',
            'KeyboardShortcutManager',
            'Debug utilities',
            'Common helpers'
        ],
        dependencies: ['core'],
        exports: ['ZIndexManager', 'KeyboardShortcutManager', 'debugUtils']
    },

    // Logging system
    logging: {
        path: 'client/log/',
        responsibilities: [
            'Application logging',
            'Console log management',
            'Log filtering and display',
            'Log persistence'
        ],
        owns: [
            'Log managers',
            'Log display components',
            'Log filtering logic'
        ],
        dependencies: ['core', 'store'],
        exports: ['LogManager', 'ConsoleLogManager', 'UnifiedLogging']
    },

    // Preview and rendering
    preview: {
        path: 'client/preview/',
        responsibilities: [
            'Content preview rendering',
            'Plugin system management',
            'Markdown processing',
            'Media handling'
        ],
        owns: [
            'Preview renderer',
            'Plugin loader',
            'Preview plugins'
        ],
        dependencies: ['core', 'store'],
        exports: ['PreviewRenderer', 'PluginManager', 'plugins']
    },

    // DOM inspection
    domInspector: {
        path: 'client/dom-inspector/',
        responsibilities: [
            'DOM element inspection',
            'Element highlighting',
            'CSS analysis',
            'DOM manipulation tools'
        ],
        owns: [
            'DOM inspector components',
            'Element picker',
            'CSS inspector'
        ],
        dependencies: ['core', 'panels', 'utils'],
        exports: ['DomInspector', 'ElementPicker', 'CssInspector']
    },

    // Settings and configuration
    settings: {
        path: 'client/settings/',
        responsibilities: [
            'Application settings management',
            'Settings UI components',
            'Settings persistence',
            'Configuration validation'
        ],
        owns: [
            'Settings panels',
            'Settings registry',
            'Settings persistence'
        ],
        dependencies: ['core', 'store', 'panels'],
        exports: ['SettingsRegistry', 'SettingsPanels']
    },

    // Debug system
    debug: {
        path: 'packages/devpages-debug/',
        responsibilities: [
            'Debug dock management',
            'Debug panels',
            'Development tools',
            'Debug state management'
        ],
        owns: [
            'DebugDock',
            'Debug panels',
            'Debug utilities'
        ],
        dependencies: ['core', 'panels', 'store'],
        exports: ['DebugDock', 'DebugPanelManager', 'debugPanels']
    },

    // Redux integration
    redux: {
        path: 'redux/',
        responsibilities: [
            'Redux-specific components',
            'Redux utilities',
            'State-connected components'
        ],
        owns: [
            'Redux-connected components',
            'Redux utilities'
        ],
        dependencies: ['core', 'store'],
        exports: ['reduxComponents', 'reduxUtils']
    }
};

/**
 * Module boundary enforcement utilities
 */
export class ModuleBoundaryEnforcer {
    constructor() {
        this.violations = [];
        this.warnings = [];
    }

    /**
     * Check if a module is allowed to import from another module
     * @param {string} fromModule - Module doing the importing
     * @param {string} toModule - Module being imported
     * @returns {boolean} Whether the import is allowed
     */
    isImportAllowed(fromModule, toModule) {
        const fromBoundary = MODULE_BOUNDARIES[fromModule];
        const toBoundary = MODULE_BOUNDARIES[toModule];
        
        if (!fromBoundary || !toBoundary) {
            this.warnings.push(`Unknown module in import: ${fromModule} -> ${toModule}`);
            return true; // Allow unknown modules for now
        }
        
        // Core can be imported by anyone
        if (toModule === 'core') {
            return true;
        }
        
        // Check if toModule is in fromModule's dependencies
        if (fromBoundary.dependencies.includes(toModule)) {
            return true;
        }
        
        // Self-imports are allowed
        if (fromModule === toModule) {
            return true;
        }
        
        this.violations.push({
            from: fromModule,
            to: toModule,
            reason: `${fromModule} is not allowed to import from ${toModule}`,
            suggestion: `Add ${toModule} to ${fromModule}'s dependencies or refactor`
        });
        
        return false;
    }

    /**
     * Check if a module is allowed to own a specific responsibility
     * @param {string} module - Module name
     * @param {string} responsibility - Responsibility to check
     * @returns {boolean} Whether the module can own this responsibility
     */
    canOwnResponsibility(module, responsibility) {
        const boundary = MODULE_BOUNDARIES[module];
        if (!boundary) return false;
        
        return boundary.owns.some(owned => 
            owned.toLowerCase().includes(responsibility.toLowerCase()) ||
            responsibility.toLowerCase().includes(owned.toLowerCase())
        );
    }

    /**
     * Find which module should own a specific responsibility
     * @param {string} responsibility - Responsibility to find owner for
     * @returns {string|null} Module that should own this responsibility
     */
    findResponsibilityOwner(responsibility) {
        for (const [moduleName, boundary] of Object.entries(MODULE_BOUNDARIES)) {
            if (this.canOwnResponsibility(moduleName, responsibility)) {
                return moduleName;
            }
        }
        return null;
    }

    /**
     * Validate module boundaries across the codebase
     * @returns {Object} Validation results
     */
    validateBoundaries() {
        console.log('[ModuleBoundaryEnforcer] 🔍 Validating module boundaries...');
        
        const results = {
            violations: [...this.violations],
            warnings: [...this.warnings],
            suggestions: []
        };
        
        // Check for common boundary violations
        this.checkCommonViolations(results);
        
        return results;
    }

    /**
     * Check for common boundary violations
     * @param {Object} results - Results object to populate
     */
    checkCommonViolations(results) {
        // Check for multiple modules owning the same responsibility
        const responsibilityOwners = new Map();
        
        for (const [moduleName, boundary] of Object.entries(MODULE_BOUNDARIES)) {
            for (const responsibility of boundary.owns) {
                if (!responsibilityOwners.has(responsibility)) {
                    responsibilityOwners.set(responsibility, []);
                }
                responsibilityOwners.get(responsibility).push(moduleName);
            }
        }
        
        for (const [responsibility, owners] of responsibilityOwners.entries()) {
            if (owners.length > 1) {
                results.violations.push({
                    type: 'multiple_owners',
                    responsibility,
                    owners,
                    reason: `Multiple modules claim ownership of: ${responsibility}`,
                    suggestion: `Consolidate ownership to a single module`
                });
            }
        }
        
        // Check for circular dependencies
        this.checkCircularDependencies(results);
    }

    /**
     * Check for circular dependencies between modules
     * @param {Object} results - Results object to populate
     */
    checkCircularDependencies(results) {
        const visited = new Set();
        const recursionStack = new Set();
        
        const hasCycle = (module, path = []) => {
            if (recursionStack.has(module)) {
                const cycleStart = path.indexOf(module);
                const cycle = path.slice(cycleStart).concat(module);
                results.violations.push({
                    type: 'circular_dependency',
                    cycle,
                    reason: `Circular dependency detected: ${cycle.join(' -> ')}`,
                    suggestion: 'Refactor to remove circular dependency'
                });
                return true;
            }
            
            if (visited.has(module)) {
                return false;
            }
            
            visited.add(module);
            recursionStack.add(module);
            
            const boundary = MODULE_BOUNDARIES[module];
            if (boundary) {
                for (const dependency of boundary.dependencies) {
                    if (hasCycle(dependency, [...path, module])) {
                        return true;
                    }
                }
            }
            
            recursionStack.delete(module);
            return false;
        };
        
        for (const module of Object.keys(MODULE_BOUNDARIES)) {
            hasCycle(module);
        }
    }

    /**
     * Generate a module dependency graph
     * @returns {Object} Dependency graph
     */
    generateDependencyGraph() {
        const graph = {
            nodes: [],
            edges: []
        };
        
        for (const [moduleName, boundary] of Object.entries(MODULE_BOUNDARIES)) {
            graph.nodes.push({
                id: moduleName,
                label: moduleName,
                path: boundary.path,
                responsibilities: boundary.responsibilities.length
            });
            
            for (const dependency of boundary.dependencies) {
                graph.edges.push({
                    from: moduleName,
                    to: dependency,
                    type: 'dependency'
                });
            }
        }
        
        return graph;
    }

    /**
     * Get recommendations for fixing boundary violations
     * @returns {Array} Array of recommendations
     */
    getRecommendations() {
        const recommendations = [];
        
        // Analyze violations and generate specific recommendations
        for (const violation of this.violations) {
            switch (violation.type) {
                case 'multiple_owners':
                    recommendations.push({
                        priority: 'high',
                        type: 'consolidate_ownership',
                        description: `Consolidate ${violation.responsibility} ownership`,
                        action: `Move all ${violation.responsibility} logic to a single module`,
                        modules: violation.owners
                    });
                    break;
                    
                case 'circular_dependency':
                    recommendations.push({
                        priority: 'critical',
                        type: 'break_cycle',
                        description: `Break circular dependency: ${violation.cycle.join(' -> ')}`,
                        action: 'Extract common functionality to a shared module or refactor dependencies',
                        modules: violation.cycle
                    });
                    break;
                    
                default:
                    recommendations.push({
                        priority: 'medium',
                        type: 'general',
                        description: violation.reason,
                        action: violation.suggestion
                    });
            }
        }
        
        return recommendations;
    }
}

// Create singleton instance
export const moduleBoundaryEnforcer = new ModuleBoundaryEnforcer();

// Export utilities for easy access
export const checkImport = (from, to) => moduleBoundaryEnforcer.isImportAllowed(from, to);
export const findOwner = (responsibility) => moduleBoundaryEnforcer.findResponsibilityOwner(responsibility);
export const validateAll = () => moduleBoundaryEnforcer.validateBoundaries();
