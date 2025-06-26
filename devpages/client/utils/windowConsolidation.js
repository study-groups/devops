/**
 * Window Library Consolidation Script
 * Consolidates all window.* libraries under window.devpages
 * Provides backward compatibility with deprecation warnings
 */

class DevPagesConsolidator {
    constructor() {
        this.deprecationWarnings = new Set();
        this.migrationMap = new Map();
        this.initialize();
    }

    initialize() {
        // Initialize the main devpages namespace
        if (!window.devpages) {
            window.devpages = {
                version: '1.0.0',
                initialized: new Date().toISOString(),
                
                // Core Systems
                panels: {},
                
                // Code Management
                code: {},
                
                // UI & Components
                ui: {},
                
                // Settings & Configuration
                settings: {},
                
                // Utilities
                utils: {},
                
                // CLI
                cli: {},
                
                // Handlers
                handlers: {},
                
                // Internal
                _internal: {
                    migrationMap: this.migrationMap,
                    getDeprecationWarnings: () => Array.from(this.deprecationWarnings)
                }
            };
        }

        this.setupMigrationMap();
        this.createBackwardCompatibilityLayer();
        
        console.log('[DevPages] Window consolidation initialized');
    }

    setupMigrationMap() {
        // Define the migration mapping from old globals to new paths
        this.migrationMap.set('panelManager', 'devpages.panels.manager');
        this.migrationMap.set('panelUIManager', 'devpages.panels.uiManager');
        this.migrationMap.set('iconsPanel', 'devpages.panels.icons');
        this.migrationMap.set('iconUtils', 'devpages.utils.icons');
        
        this.migrationMap.set('CodeManager', 'devpages.code.Manager');
        this.migrationMap.set('codeManager', 'devpages.code.manager');
        this.migrationMap.set('enhancedCodeSidebar', 'devpages.code.sidebar');
        this.migrationMap.set('codeSidebar', 'devpages.code.legacySidebar');
        this.migrationMap.set('fileList', 'devpages.code.fileList');
        this.migrationMap.set('functionOverview', 'devpages.code.functionOverview');
        this.migrationMap.set('DevPagesAstParser', 'devpages.code.astParser');
        
        this.migrationMap.set('uiComponents', 'devpages.ui.components');
        this.migrationMap.set('devHelpers', 'devpages.ui.helpers');
        
        this.migrationMap.set('settingsRegistry', 'devpages.settings.registry');
        this.migrationMap.set('panelRegistry', 'devpages.settings.panelRegistry');
        this.migrationMap.set('settingsSectionRegistry', 'devpages.settings.registry');
        this.migrationMap.set('previewSettingsPanel', 'devpages.settings.preview');
        
        this.migrationMap.set('pubsub', 'devpages.utils.pubsub');
        this.migrationMap.set('importModule', 'devpages.utils.modules.importModule');
        this.migrationMap.set('importAlias', 'devpages.utils.modules.importAlias');
        this.migrationMap.set('getTimingHistory', 'devpages.utils.timing.getHistory');
        this.migrationMap.set('clearTimingHistory', 'devpages.utils.timing.clearHistory');
        
        this.migrationMap.set('CLI_COMMANDS', 'devpages.cli.commands');
        
        this.migrationMap.set('handleImageDelete', 'devpages.handlers.imageDelete');
        this.migrationMap.set('handleLogin', 'devpages.handlers.login');
        this.migrationMap.set('handleLogout', 'devpages.handlers.logout');
        this.migrationMap.set('updateMarkdownPreview', 'devpages.handlers.updatePreview');
        this.migrationMap.set('testSettingsPanel', 'devpages.utils.testing.settingsPanel');
        this.migrationMap.set('debugInitSettings', 'devpages.utils.testing.debugInitSettings');
    }

    createBackwardCompatibilityLayer() {
        // Create getters/setters for backward compatibility with deprecation warnings
        this.migrationMap.forEach((newPath, oldName) => {
            this.createCompatibilityProperty(oldName, newPath);
        });
    }

    createCompatibilityProperty(oldName, newPath) {
        // Skip if property already exists and is not a function
        if (window.hasOwnProperty(oldName) && typeof window[oldName] !== 'function') {
            return;
        }

        Object.defineProperty(window, oldName, {
            get: () => {
                this.showDeprecationWarning(oldName, newPath);
                return this.getNestedProperty(window, newPath);
            },
            set: (value) => {
                this.showDeprecationWarning(oldName, newPath);
                this.setNestedProperty(window, newPath, value);
            },
            configurable: true,
            enumerable: false
        });
    }

    showDeprecationWarning(oldName, newPath) {
        const warning = `window.${oldName} is deprecated. Use window.${newPath} instead.`;
        
        if (!this.deprecationWarnings.has(warning)) {
            console.warn(`[DEPRECATED] ${warning}`);
            this.deprecationWarnings.add(warning);
        }
    }

    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    // Migration helper methods
    migrate(oldName, value) {
        const newPath = this.migrationMap.get(oldName);
        if (newPath) {
            this.setNestedProperty(window, newPath, value);
            console.log(`[DevPages] Migrated window.${oldName} to window.${newPath}`);
        } else {
            console.warn(`[DevPages] No migration path found for window.${oldName}`);
        }
    }

    // Utility methods for the new structure
    register(category, name, value) {
        if (!window.devpages[category]) {
            window.devpages[category] = {};
        }
        window.devpages[category][name] = value;
        console.log(`[DevPages] Registered ${category}.${name}`);
    }

    // Get migration status
    getMigrationStatus() {
        const status = {
            totalMappings: this.migrationMap.size,
            migratedCount: 0,
            pendingMigrations: [],
            deprecationWarnings: Array.from(this.deprecationWarnings)
        };

        this.migrationMap.forEach((newPath, oldName) => {
            const newValue = this.getNestedProperty(window, newPath);
            const oldValue = window[oldName];
            
            if (newValue !== undefined) {
                status.migratedCount++;
            } else {
                status.pendingMigrations.push({ oldName, newPath });
            }
        });

        return status;
    }

    // Clean up old globals (call this after migration is complete)
    cleanupOldGlobals() {
        console.log('[DevPages] Cleaning up old global variables...');
        
        this.migrationMap.forEach((newPath, oldName) => {
            if (window.hasOwnProperty(oldName)) {
                delete window[oldName];
                console.log(`[DevPages] Removed window.${oldName}`);
            }
        });
        
        console.log('[DevPages] Cleanup complete');
    }
}

// Initialize the consolidator
const devpagesConsolidator = new DevPagesConsolidator();

// Make consolidator available globally for debugging
window.devpages._internal.consolidator = devpagesConsolidator;

// Export for module usage
export default devpagesConsolidator; 