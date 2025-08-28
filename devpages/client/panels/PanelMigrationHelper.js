/**
 * @file client/panels/PanelMigrationHelper.js
 * @description Utility to help migrate existing panels to ModernBasePanel
 */

import { ModernBasePanel } from '/client/panels/BasePanel.js';
import { BasePanel } from './BasePanel.js';

export class PanelMigrationHelper {
    constructor() {
        this.migrationLog = [];
        this.compatibilityShims = new Map();
    }
    
    /**
     * Migrate a legacy panel to ModernBasePanel
     * @param {class} LegacyPanelClass - The legacy panel class
     * @param {object} migrationConfig - Migration configuration
     * @returns {class} Modernized panel class
     */
    migratePanel(LegacyPanelClass, migrationConfig = {}) {
        const helper = this;
        
        class ModernizedPanel extends ModernBasePanel {
            constructor(options) {
                // Merge legacy options with modern defaults
                const modernOptions = {
                    ...migrationConfig.defaultOptions,
                    ...options,
                    id: options.id || LegacyPanelClass.name.toLowerCase().replace('panel', '')
                };
                
                super(modernOptions);
                
                // Create instance of legacy panel for method delegation
                this.legacyInstance = new LegacyPanelClass(options);
                
                // Set up compatibility shims
                helper.setupCompatibilityShims(this, this.legacyInstance, migrationConfig);
                
                helper.log(`Migrated panel: ${LegacyPanelClass.name} -> ModernizedPanel`);
            }
            
            /**
             * Use legacy render method if available, otherwise use modern structure
             */
            renderContent() {
                try {
                    // Try to use legacy render method
                    if (this.legacyInstance.render && typeof this.legacyInstance.render === 'function') {
                        const legacyElement = this.legacyInstance.render();
                        
                        // If legacy render returns an element, use it
                        if (legacyElement instanceof HTMLElement) {
                            return legacyElement;
                        }
                    }
                    
                    // Fallback to creating a wrapper for legacy content
                    return this.createLegacyWrapper();
                } catch (error) {
                    helper.error(`Failed to render legacy content for ${this.id}:`, error);
                    return this.createErrorContent(error);
                }
            }
            
            /**
             * Create wrapper for legacy panel content
             */
            createLegacyWrapper() {
                const wrapper = document.createElement('div');
                wrapper.className = 'legacy-panel-wrapper';
                wrapper.innerHTML = `
                    <div class="migration-notice">
                        <small>⚠️ Legacy panel - migration in progress</small>
                    </div>
                    <div class="legacy-content">
                        <p>Legacy panel: ${this.id}</p>
                        <p>Original class: ${this.legacyInstance.constructor.name}</p>
                    </div>
                `;
                return wrapper;
            }
            
            /**
             * Create error content for failed migrations
             */
            createErrorContent(error) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'migration-error';
                errorDiv.innerHTML = `
                    <h4>Migration Error</h4>
                    <p>Failed to migrate legacy panel: ${error.message}</p>
                    <details>
                        <summary>Error Details</summary>
                        <pre>${error.stack}</pre>
                    </details>
                `;
                return errorDiv;
            }
            
            /**
             * Enhanced lifecycle hooks that call legacy methods
             */
            async onMountComplete() {
                // Call legacy onMount if it exists
                if (this.legacyInstance.onMount && typeof this.legacyInstance.onMount === 'function') {
                    try {
                        await this.legacyInstance.onMount(this.container);
                    } catch (error) {
                        helper.warn(`Legacy onMount failed for ${this.id}:`, error);
                    }
                }
            }
            
            onUnmountStart() {
                // Call legacy onUnmount if it exists
                if (this.legacyInstance.onUnmount && typeof this.legacyInstance.onUnmount === 'function') {
                    try {
                        this.legacyInstance.onUnmount();
                    } catch (error) {
                        helper.warn(`Legacy onUnmount failed for ${this.id}:`, error);
                    }
                }
            }
            
            onStateChange(newState) {
                super.onStateChange(newState);
                
                // Forward to legacy instance if it has state change handling
                if (this.legacyInstance.onStateChange && typeof this.legacyInstance.onStateChange === 'function') {
                    try {
                        this.legacyInstance.onStateChange(newState);
                    } catch (error) {
                        helper.warn(`Legacy onStateChange failed for ${this.id}:`, error);
                    }
                }
            }
        }
        
        // Copy static properties from legacy class
        Object.getOwnPropertyNames(LegacyPanelClass).forEach(prop => {
            if (prop !== 'length' && prop !== 'name' && prop !== 'prototype') {
                ModernizedPanel[prop] = LegacyPanelClass[prop];
            }
        });
        
        return ModernizedPanel;
    }
    
    /**
     * Set up compatibility shims for legacy panel methods
     */
    setupCompatibilityShims(modernPanel, legacyInstance, config) {
        const shims = config.compatibilityShims || {};
        
        // Default shims for common legacy patterns
        const defaultShims = {
            // Legacy element property access
            get element() {
                return modernPanel.element;
            },
            set element(value) {
                modernPanel.element = value;
            },
            
            // Legacy store access
            get store() {
                return modernPanel.store;
            },
            
            // Legacy container access
            get container() {
                return modernPanel.container;
            }
        };
        
        // Apply shims to legacy instance
        Object.assign(legacyInstance, defaultShims, shims);
        
        // Forward method calls from modern panel to legacy instance
        const methodsToForward = config.forwardMethods || [];
        methodsToForward.forEach(methodName => {
            if (legacyInstance[methodName] && typeof legacyInstance[methodName] === 'function') {
                modernPanel[methodName] = (...args) => {
                    try {
                        return legacyInstance[methodName](...args);
                    } catch (error) {
                        this.error(`Forwarded method ${methodName} failed:`, error);
                        throw error;
                    }
                };
            }
        });
    }
    
    /**
     * Create migration configuration for common panel types
     */
    static createMigrationConfig(panelType) {
        const configs = {
            'file-browser': {
                defaultOptions: {
                    title: 'File Browser',
                    collapsible: true,
                    order: 1
                },
                forwardMethods: ['refresh', 'selectFile', 'expandFolder'],
                compatibilityShims: {
                    refreshFileList: function() {
                        return this.refresh?.();
                    }
                }
            },
            
            'context': {
                defaultOptions: {
                    title: 'Context',
                    collapsible: true,
                    order: 2
                },
                forwardMethods: ['updateContext', 'clearContext', 'addContextItem'],
                compatibilityShims: {
                    setContext: function(context) {
                        return this.updateContext?.(context);
                    }
                }
            },
            
            'settings': {
                defaultOptions: {
                    title: 'Settings',
                    collapsible: true,
                    order: 10
                },
                forwardMethods: ['saveSettings', 'loadSettings', 'resetSettings'],
                compatibilityShims: {
                    applySettings: function(settings) {
                        return this.saveSettings?.(settings);
                    }
                }
            },
            
            'debug': {
                defaultOptions: {
                    title: 'Debug Panel',
                    collapsible: true,
                    order: 20
                },
                forwardMethods: ['clearLog', 'addLogEntry', 'exportLog'],
                compatibilityShims: {
                    log: function(message) {
                        return this.addLogEntry?.({ message, level: 'info' });
                    }
                }
            }
        };
        
        return configs[panelType] || {};
    }
    
    /**
     * Batch migrate multiple panels
     */
    batchMigrate(panelClasses, globalConfig = {}) {
        const results = [];
        
        panelClasses.forEach(({ panelClass, config = {} }) => {
            try {
                const migrationConfig = {
                    ...globalConfig,
                    ...config
                };
                
                const ModernizedClass = this.migratePanel(panelClass, migrationConfig);
                
                results.push({
                    original: panelClass,
                    modernized: ModernizedClass,
                    success: true,
                    id: config.id || panelClass.name
                });
                
                this.log(`✅ Successfully migrated: ${panelClass.name}`);
            } catch (error) {
                results.push({
                    original: panelClass,
                    modernized: null,
                    success: false,
                    error: error,
                    id: config.id || panelClass.name
                });
                
                this.error(`❌ Failed to migrate: ${panelClass.name}`, error);
            }
        });
        
        return results;
    }
    
    /**
     * Generate migration report
     */
    generateMigrationReport() {
        return {
            timestamp: new Date().toISOString(),
            totalMigrations: this.migrationLog.length,
            log: [...this.migrationLog],
            recommendations: this.generateRecommendations()
        };
    }
    
    /**
     * Generate recommendations for manual migration steps
     */
    generateRecommendations() {
        return [
            'Review migrated panels for proper Redux integration',
            'Update panel registration to use modern configuration',
            'Test panel lifecycle methods (mount, unmount, state changes)',
            'Verify CSS styling with modern panel classes',
            'Update any direct DOM manipulation to use modern methods',
            'Consider removing legacy compatibility shims once migration is complete'
        ];
    }
    
    // Logging methods
    log(message) {
        const entry = { level: 'info', message, timestamp: Date.now() };
        this.migrationLog.push(entry);
        console.log(`[PanelMigration]`, message);
    }
    
    warn(message, ...args) {
        const entry = { level: 'warn', message, args, timestamp: Date.now() };
        this.migrationLog.push(entry);
        console.warn(`[PanelMigration]`, message, ...args);
    }
    
    error(message, ...args) {
        const entry = { level: 'error', message, args, timestamp: Date.now() };
        this.migrationLog.push(entry);
        console.error(`[PanelMigration]`, message, ...args);
    }
}

// Export singleton instance
export const panelMigrationHelper = new PanelMigrationHelper();
