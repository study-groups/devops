/**
 * client/bootloader.js
 * Application bootloader with component manager integration
 * 
 * This system provides:
 * - Centralized component registration
 * - Dependency-aware initialization
 * - Robust error handling and recovery
 * - Integration with existing component managers
 * - Event-driven lifecycle management
 */

import { appStore } from './appState.js';
import { eventBus } from './eventBus.js';
import { authThunks } from './store/slices/authSlice.js';
import { logMessage } from './log/index.js';
import { componentManager } from './componentManager.js';

class BootLoader {
    constructor() {
        this.state = {
            isAuthenticated: false,
            authChecked: false,
            componentsRegistered: false,
            componentsInitialized: false,
        };
        
        this.lifecycleStages = [];
        this.services = {};
        this.componentRegistry = new Map();
        this.failedComponents = new Set();
        
        // Component definitions with dependencies and priorities
        this.componentDefinitions = [
            {
                name: 'authDisplay',
                priority: 1,
                required: true,
                targetElementId: 'auth-component-container',
                modulePath: './components/AuthDisplay.js',
                factoryFunction: 'createAuthDisplayComponent',
                dependencies: ['coreServices'],
                description: 'Authentication status display'
            },
            {
                name: 'pathManager', 
                priority: 2,
                required: true,
                targetElementId: 'context-manager-container',
                modulePath: './components/PathManagerComponent.js',
                factoryFunction: 'createPathManagerComponent',
                dependencies: ['coreServices', 'auth'],
                description: 'File path and context manager'
            },
            {
                name: 'viewControls',
                priority: 3,
                required: false,
                targetElementId: 'view-controls-container',
                modulePath: './components/ViewControls.js',
                factoryFunction: 'createViewControlsComponent', 
                dependencies: ['coreServices'],
                description: 'View mode controls'
            },
            {
                name: 'uiComponents',
                priority: 4,
                required: false,
                targetElementId: null, // No specific target element
                modulePath: './components/uiComponentsManager.js',
                factoryFunction: 'initializeUIComponents',
                dependencies: ['coreServices'],
                description: 'UI popup and modal components'
            }
        ];
        
        // Required DOM elements
        this.requiredDOMElements = this.componentDefinitions
            .filter(comp => comp.targetElementId)
            .map(comp => comp.targetElementId);
    }

    async boot() {
        try {
            this.lifecycleStages.push('boot:start');
            this.log('🚀 Starting application boot sequence');
            
            await this.waitDOMReady();
            this.lifecycleStages.push('boot:domReady');
            
            await this.verifyDOMElements();
            this.lifecycleStages.push('boot:domVerified');
            
            await this.initCoreServices();
            this.lifecycleStages.push('boot:coreServicesReady');
            
            await this.initAuth();
            this.lifecycleStages.push('boot:authReady');
            
            await this.registerComponents();
            this.lifecycleStages.push('boot:componentsRegistered');
            
            await this.initializeComponents();
            this.lifecycleStages.push('boot:componentsInitialized');
            
            await this.initEventListeners();
            this.lifecycleStages.push('boot:eventListenersReady');
            
            await this.finalize();
            this.lifecycleStages.push('boot:complete');
            
            this.log('✅ Boot sequence completed successfully');
        } catch (error) {
            this.log(`❌ Bootloader error: ${error.message}`, 'error');
            this.fail(error);
        }
    }

    async waitDOMReady() {
        this.log('📄 Waiting for DOM ready...');
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            this.log('📄 DOM already ready');
            return;
        }
        
        return new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', () => {
                this.log('📄 DOM ready event fired');
                resolve();
            }, { once: true });
        });
    }

    async verifyDOMElements() {
        this.log('🔍 Verifying required DOM elements...');
        const missing = [];
        const available = [];
        
        for (const elementId of this.requiredDOMElements) {
            const element = document.getElementById(elementId);
            if (!element) {
                missing.push(elementId);
            } else {
                available.push(elementId);
            }
        }
        
        this.log(`✅ Available DOM elements: ${available.join(', ')}`);
        
        if (missing.length > 0) {
            this.log(`⚠️ Missing DOM elements: ${missing.join(', ')}`, 'warn');
            // Don't fail completely - mark components as unavailable instead
            for (const elementId of missing) {
                const component = this.componentDefinitions.find(c => c.targetElementId === elementId);
                if (component) {
                    this.failedComponents.add(component.name);
                    this.log(`⚠️ Component ${component.name} will be skipped (missing DOM element)`, 'warn');
                }
            }
        }
        
        this.log('✅ DOM element verification completed');
    }

    async initCoreServices() {
        this.log('🔧 Initializing core services...');
        
        // Store references to core services
        this.services.appStore = appStore;
        this.services.eventBus = eventBus;
        
        // Import and initialize other core services
        const { appDispatch } = await import('./appDispatch.js');
        this.services.appDispatch = appDispatch;
        
        const { ConsoleLogManager } = await import('./log/ConsoleLogManager.js');
        this.services.consoleLogManager = new ConsoleLogManager().initialize().exposeToWindow();
        
        // Expose services globally for backward compatibility
        window.APP = window.APP || {};
        window.APP.services = this.services;
        window.APP.eventBus = eventBus;
        window.APP.store = appStore;
        
        // Initialize core settings and verify store state
        this.log('🔧 Loading initial settings...');
        try {
            const { settingsThunks } = await import('./store/slices/settingsSlice.js');
            await appStore.dispatch(settingsThunks.loadInitialSettings());
        } catch (error) {
            this.log(`⚠️ Settings initialization failed: ${error.message}`, 'warn');
        }
        
        // Verify store state
        const currentState = appStore.getState();
        this.log(`🔧 Store state available: ${Object.keys(currentState).join(', ')}`);
        
        this.log('✅ Core services initialized');
        eventBus.emit('core:servicesReady');
    }

    async initAuth() {
        this.log('🔐 Initializing authentication...');
        
        // Set up auth event listener for login requests
        eventBus.on('auth:loginRequested', async ({ username, password }) => {
            this.log(`🔐 Login requested for user: ${username}`);
            try {
                await appStore.dispatch(authThunks.login({ username, password }));
                // Refresh components after login
                this.refreshAuthenticatedComponents();
            } catch (error) {
                this.log(`🔐 Login failed: ${error.message}`, 'error');
            }
        });
        
        // Check authentication status with timeout and retry
        this.log('🔐 Checking authentication status...');
        let authResult = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries && !authResult?.success) {
            try {
                authResult = await appStore.dispatch(authThunks.checkAuth());
                break;
            } catch (error) {
                retryCount++;
                this.log(`🔐 Auth check attempt ${retryCount} failed: ${error.message}`, 'warn');
                if (retryCount < maxRetries) {
                    this.log(`🔐 Retrying auth check in 1 second...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        // Update bootloader state based on auth result
        const authState = appStore.getState().auth;
        this.state.isAuthenticated = authState.isAuthenticated || false;
        this.state.authChecked = true;
        
        if (this.state.isAuthenticated) {
            this.log(`✅ User authenticated: ${authState.user?.username}`);
            
            // Load available directories for PathManagerComponent
            this.log('📁 Loading available directories...');
            try {
                const { fileThunks } = await import('./thunks/fileThunks.js');
                await appStore.dispatch(fileThunks.loadTopLevelDirectories());
                this.log('📁 Directory listing loaded successfully');
            } catch (error) {
                this.log(`⚠️ Failed to load directories: ${error.message}`, 'warn');
            }
        } else {
            this.log('ℹ️ User not authenticated - will continue with limited functionality');
        }
        
        eventBus.emit('auth:statusChecked', { 
            isAuthenticated: this.state.isAuthenticated,
            user: authState.user 
        });
    }

    async registerComponents() {
        this.log('📋 Registering components with component manager...');
        
        for (const componentDef of this.componentDefinitions) {
            if (this.failedComponents.has(componentDef.name)) {
                this.log(`⏭️ Skipping registration of ${componentDef.name} (DOM element missing)`);
                continue;
            }
            
            try {
                // Create component manager compatible registration (simplified)
                const managedComponent = {
                    name: componentDef.name,
                    mount: () => this.mountManagedComponent(componentDef),
                    destroy: () => this.destroyManagedComponent(componentDef)
                };
                
                componentManager.register(managedComponent);
                this.log(`✅ Registered ${componentDef.name} with component manager`);
                
            } catch (error) {
                this.log(`❌ Failed to register ${componentDef.name}: ${error.message}`, 'error');
                if (componentDef.required) {
                    throw new Error(`Required component ${componentDef.name} registration failed: ${error.message}`);
                }
                this.failedComponents.add(componentDef.name);
            }
        }
        
        this.state.componentsRegistered = true;
        this.log('✅ Component registration completed');
    }

    async initializeComponents() {
        this.log('🧩 Initializing components via component manager...');
        
        try {
            // Use the component manager to initialize all registered components
            componentManager.init();
            this.state.componentsInitialized = true;
            this.log('✅ Components initialized successfully');
            
        } catch (error) {
            this.log(`❌ Component initialization failed: ${error.message}`, 'error');
            throw error;
        }
        
        eventBus.emit('components:ready');
    }

    async mountManagedComponent(componentDef) {
        this.log(`🔧 Mounting ${componentDef.name}...`);
        
        try {
            // Check dependencies with detailed logging
            this.log(`🔍 [${componentDef.name}] Checking dependencies: ${JSON.stringify(componentDef.dependencies)}`);
            if (!this.checkDependencies(componentDef.dependencies)) {
                const depStatus = this.getDependencyStatus();
                this.log(`❌ [${componentDef.name}] Dependencies not met. Status: ${JSON.stringify(depStatus)}`, 'error');
                throw new Error(`Dependencies not met for ${componentDef.name}. Status: ${JSON.stringify(depStatus)}`);
            }
            this.log(`✅ [${componentDef.name}] Dependencies satisfied`);
            
            // Import the component module with detailed logging
            this.log(`📦 [${componentDef.name}] Importing module: ${componentDef.modulePath}`);
            const module = await import(componentDef.modulePath);
            this.log(`✅ [${componentDef.name}] Module imported successfully`);
            
            const factory = module[componentDef.factoryFunction];
            
            if (!factory) {
                this.log(`❌ [${componentDef.name}] Available exports: ${Object.keys(module).join(', ')}`, 'error');
                throw new Error(`Factory function ${componentDef.factoryFunction} not found in ${componentDef.modulePath}`);
            }
            this.log(`✅ [${componentDef.name}] Factory function found: ${componentDef.factoryFunction}`);
            
            // Create and mount the component with detailed logging
            this.log(`🏗️ [${componentDef.name}] Creating component...`);
            let component;
            if (componentDef.targetElementId) {
                this.log(`🎯 [${componentDef.name}] Target element: ${componentDef.targetElementId}`);
                
                // Verify target element exists
                const targetElement = document.getElementById(componentDef.targetElementId);
                if (!targetElement) {
                    throw new Error(`Target element '${componentDef.targetElementId}' not found in DOM`);
                }
                this.log(`✅ [${componentDef.name}] Target element found`);
                
                component = factory(componentDef.targetElementId);
                this.log(`✅ [${componentDef.name}] Component factory called successfully`);
                
                if (component && typeof component.mount === 'function') {
                    this.log(`🔗 [${componentDef.name}] Mounting component...`);
                    const mountResult = component.mount();
                    this.log(`✅ [${componentDef.name}] Component mounted successfully`);
                    
                    // Store the component interface
                    this.componentRegistry.set(componentDef.name, mountResult || component);
                } else {
                    this.log(`⚠️ [${componentDef.name}] Component has no mount method or is null`, 'warn');
                }
            } else {
                // For components without target elements (like uiComponentsManager)
                this.log(`🔧 [${componentDef.name}] Creating component without target element...`);
                component = await factory();
                this.log(`✅ [${componentDef.name}] Component created successfully`);
            }
            
            // Store component reference
            this.componentRegistry.set(componentDef.name, component);
            
            this.log(`✅ ${componentDef.name} mounted successfully`);
            return component;
            
        } catch (error) {
            this.log(`❌ Failed to mount ${componentDef.name}: ${error.message}`, 'error');
            this.log(`❌ [${componentDef.name}] Error stack: ${error.stack}`, 'error');
            
            if (componentDef.required) {
                throw error;
            }
            this.failedComponents.add(componentDef.name);
            return null;
        }
    }

    async destroyManagedComponent(componentDef) {
        this.log(`🗑️ Destroying ${componentDef.name}...`);
        
        const component = this.componentRegistry.get(componentDef.name);
        if (component && typeof component.destroy === 'function') {
            try {
                component.destroy();
                this.componentRegistry.delete(componentDef.name);
                this.log(`✅ ${componentDef.name} destroyed`);
            } catch (error) {
                this.log(`❌ Failed to destroy ${componentDef.name}: ${error.message}`, 'error');
            }
        }
    }

    checkDependencies(dependencies) {
        for (const dep of dependencies || []) {
            switch (dep) {
                case 'coreServices':
                    if (!this.services.appStore || !this.services.eventBus) return false;
                    break;
                case 'auth':
                    if (!this.state.authChecked) return false;
                    break;
                default:
                    this.log(`⚠️ Unknown dependency: ${dep}`, 'warn');
            }
        }
        return true;
    }

    getDependencyStatus() {
        return {
            coreServices: {
                appStore: !!this.services.appStore,
                eventBus: !!this.services.eventBus,
                satisfied: !!(this.services.appStore && this.services.eventBus)
            },
            auth: {
                authChecked: !!this.state.authChecked,
                isAuthenticated: !!this.state.isAuthenticated,
                satisfied: !!this.state.authChecked
            }
        };
    }

    async refreshAuthenticatedComponents() {
        this.log('🔄 Refreshing components after auth change...');
        try {
            // Load directory data for PathManagerComponent
            this.log('📁 Loading top-level directories...');
            const { fileThunks } = await import('./thunks/fileThunks.js');
            await appStore.dispatch(fileThunks.loadTopLevelDirectories());
            this.log('✅ Top-level directories loaded');
            
            // Refresh all components
            componentManager.refreshAll();
        } catch (error) {
            this.log(`❌ Failed to refresh components: ${error.message}`, 'error');
        }
    }

    async initEventListeners() {
        this.log('📡 Setting up global event listeners...');
        
        // Set up navigation event listener - CRITICAL for PathManagerComponent navigation
        eventBus.on('navigate:pathname', async ({ pathname, isDirectory }) => {
            this.log(`📡 Navigate to pathname: '${pathname}' (${isDirectory ? 'directory' : 'file'})`);
            
            try {
                // Use the pathSlice thunk to fetch directory listing and update state
                const { fetchListingByPath } = await import('./store/slices/pathSlice.js');
                await appStore.dispatch(fetchListingByPath({ pathname, isDirectory }));
                this.log(`✅ Navigation completed to: '${pathname}'`);
            } catch (error) {
                this.log(`❌ Navigation failed: ${error.message}`, 'error');
            }
        });
        
        // Initialize keyboard shortcuts
        try {
            const { initKeyboardShortcuts } = await import('./keyboardShortcuts.js');
            initKeyboardShortcuts();
            this.log('⌨️ Keyboard shortcuts initialized');
        } catch (error) {
            this.log(`⚠️ Keyboard shortcuts failed to initialize: ${error.message}`, 'warn');
        }
        
        this.log('✅ Event listeners initialized');
    }

    async finalize() {
        this.log('🎯 Finalizing application startup...');
        
        // Hide splash screen if it exists
        const splashElement = document.getElementById('devpages-splash');
        if (splashElement) {
            splashElement.style.display = 'none';
            this.log('🎭 Splash screen hidden');
        }
        
        // Remove splash-active class from body
        document.body.classList.remove('splash-active');
        
        // Generate summary
        const successfulComponents = this.componentDefinitions.length - this.failedComponents.size;
        const totalComponents = this.componentDefinitions.length;
        
        this.log(`📊 Boot Summary:`);
        this.log(`   Components: ${successfulComponents}/${totalComponents} successful`);
        this.log(`   Authentication: ${this.state.isAuthenticated ? 'Yes' : 'No'}`);
        this.log(`   Failed components: ${this.failedComponents.size > 0 ? Array.from(this.failedComponents).join(', ') : 'None'}`);
        
        // Emit final ready events
        eventBus.emit('app:ready');
        eventBus.emit('boot:complete', {
            timestamp: Date.now(),
            stages: this.lifecycleStages,
            isAuthenticated: this.state.isAuthenticated,
            successfulComponents,
            totalComponents,
            failedComponents: Array.from(this.failedComponents)
        });
        
        // Set up cleanup handler
        window.APP_SHUTDOWN = () => this.shutdown();
        
        this.log('🎉 Application ready for use');
    }

    fail(error) {
        this.log(`💥 Critical boot failure: ${error.message}`, 'error');
        
        // Add failure CSS class for styling
        document.body.classList.add('boot-failed');
        
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'boot-error';
        errorDiv.innerHTML = `
            <h2>Application Failed to Start</h2>
            <p>Error: ${error.message}</p>
            <p>Please refresh the page to try again.</p>
            <details>
                <summary>Technical Details</summary>
                <pre>${error.stack || 'No stack trace available'}</pre>
                <p>Completed stages: ${this.lifecycleStages.join(' → ')}</p>
                <p>Failed components: ${Array.from(this.failedComponents).join(', ') || 'None'}</p>
                <p>Available DOM elements: ${this.requiredDOMElements.filter(id => document.getElementById(id)).join(', ')}</p>
            </details>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Emit failure event
        eventBus.emit('boot:failed', { 
            error: error.message, 
            stages: this.lifecycleStages,
            failedComponents: Array.from(this.failedComponents)
        });
    }

    shutdown() {
        this.log('🛑 Shutting down application...');
        
        // Use component manager to destroy all components
        componentManager.destroyAll();
        
        // Emit shutdown event
        eventBus.emit('app:shutdown');
        
        this.log('✅ Application shutdown complete');
    }

    log(message, level = 'info') {
        logMessage(`[BOOTLOADER] ${message}`, level, 'BOOT');
    }
}

// Create and export bootloader instance
export const bootloader = new BootLoader();

// Auto-start on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootloader.boot());
} else {
    // DOM already loaded, start immediately
    bootloader.boot();
}