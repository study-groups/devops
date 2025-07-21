/**
 * client/bootloader.js - Redux System Bootloader
 * 
 * This bootloader follows a phase-based pattern for clarity and maintainability.
 * It initializes systems in a strict, ordered sequence, using Redux for state management.
 * 
 * Phases:
 * 1. Pre-Initialization: Setup environment, global config, logging.
 * 2. Core Initialization: Create core services (e.g., Redux store).
 * 3. Secondary Initialization: Initialize features that depend on core services.
 * 4. Finalization: Signal readiness, hide splash screen, etc.
 */

import './log/UnifiedLogging.js'; // Import for side effects: initializes window.APP.services.log
import { createStore, applyMiddleware, combineReducers, compose } from '/node_modules/redux/dist/redux.browser.mjs';
import { eventBus } from './eventBus.js';
import { componentManager } from './componentManager.js';
import { showFatalError } from './utils/uiError.js';
import { panelDefinitions as staticPanelDefinitions } from './panels/panelRegistry.js';
import { workspaceLayoutService } from './layout/WorkspaceLayoutManager.js';
import { panelStateService } from './panels/PanelStateManager.js';
import { createGlobalFetch } from './services/fetcher.js';

// Define log variable, but do not initialize it yet.
let log;

// --- Unified Component & Panel Definitions ---

const coreComponentDefinitions = [
    { name: 'authDisplay', type: 'component', priority: 1, required: true, targetElementId: 'auth-component-container', modulePath: './components/AuthDisplay.js', factoryFunction: 'initializeAuthDisplay', dependencies: ['coreServices'], description: 'Authentication status display' },
    { name: 'pathManager', type: 'component', priority: 2, required: true, targetElementId: 'context-manager-container', modulePath: './components/PathManagerComponent.js', factoryFunction: 'createPathManagerComponent', dependencies: ['coreServices', 'auth'], description: 'File path and context manager' },
    { name: 'viewControls', type: 'component', priority: 3, required: false, targetElementId: 'view-controls-container', modulePath: './components/ViewControls.js', factoryFunction: 'createViewControlsComponent', dependencies: ['coreServices'], description: 'View mode controls' },
    { name: 'uiComponents', type: 'service', priority: 4, required: true, modulePath: './components/uiComponentsManager.js', factoryFunction: 'initializeUIComponents', dependencies: ['coreServices'], description: 'UI popup and modal components' }
];

const panelComponentDefinitions = staticPanelDefinitions.map(p => ({
    ...p,
    name: p.name,
    type: 'panel',
    priority: 10, // Panels load after core components
    required: p.isDefault,
    modulePath: `./panels/${p.name}.js`, // Assuming a convention
    factoryFunction: p.name,
    dependencies: ['coreServices', 'auth'],
    description: p.title
}));

const componentDefinitions = [...coreComponentDefinitions, ...panelComponentDefinitions];

const requiredDOMElements = componentDefinitions
    .filter(comp => comp.targetElementId)
    .map(comp => comp.targetElementId);

let lifecycleStages = [];
let services = {};
let componentRegistry = new Map();
let failedComponents = new Set();
let bootState = {
    isAuthenticated: false,
    authChecked: false,
};
let bootErrors = [];

// =============================================================================
// INITIALIZATION PHASES
// =============================================================================

/**
 * Phase 1: Pre-Initialization
 * Sets up the global environment, logging, and application shell.
 */
async function bootPreInit() {
    // Phase 1: Pre-Initialization - Setup global APP namespace
    window.APP = window.APP || {};
    window.APP.services = window.APP.services || {};
    window.APP.eventBus = eventBus;
    window.APP.services.eventBus = eventBus;
    
    // The logger is now initialized by the UnifiedLogging.js import.
    // We just need to create the logger instance for this module.
    log = window.APP.services.log.createLogger('BOOT', 'Bootloader');
    
    log.info('PHASE_1', '🚀 Phase 1: Pre-Initialization');

    window.APP.bootloader = {
        start: async () => {
            log.info('START', '[REDUX-BOOT] Starting via APP.bootloader.start()...');
            return initializeReduxSystem();
        },
        instance: null,
        isReady: () => !!systemAPIs,
        type: 'redux'
    };
}

/**
 * Phase 2: Core Initialization
 * Creates the Redux store.
 */
async function bootCore() {
    log.info('PHASE_2', '📦 Phase 2: Core Initialization - Creating Redux store...');

    const authSlice = await import('./store/slices/authSlice.js');
    const pathSlice = await import('./store/slices/pathSlice.js');
    const settingsSlice = await import('./store/slices/settingsSlice.js');
    const panelSlice = await import('./store/slices/panelSlice.js');
    const domInspectorSlice = await import('./store/slices/domInspectorSlice.js');
    
    const rootReducer = combineReducers({
        auth: authSlice.authReducer,
        path: pathSlice.pathReducer,
        settings: settingsSlice.settingsReducer,
        panels: panelSlice.panelReducer,
        domInspector: domInspectorSlice.domInspectorReducer
    });
    
    const thunkMiddleware = (store) => (next) => (action) => {
        if (typeof action === 'function') {
            return action(store.dispatch, store.getState);
        }
        return next(action);
    };

    let preloadedState = {};
    try {
        const savedSettings = localStorage.getItem('devpages-settings');
        if (savedSettings) {
            preloadedState.settings = JSON.parse(savedSettings);
            log.info('LOAD_SETTINGS_SUCCESS', '📦 Loaded saved settings from localStorage');
        }
    } catch (error) {
        log.warn('LOAD_SETTINGS_FAILED', '⚠️ Failed to load saved settings, using defaults', error);
    }
    
    const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
    const store = createStore(
        rootReducer,
        preloadedState,
        composeEnhancers(applyMiddleware(thunkMiddleware))
    );
    
    if (!preloadedState.settings) {
        store.dispatch(settingsSlice.settingsThunks.loadInitialSettings());
    }

    window.APP.store = store;
    window.APP.services.store = store;
    window.APP.redux = { store, dispatch: store.dispatch, getState: store.getState };
    log.info('STORE_EXPOSED', '🌍 Store exposed globally on window.APP');
    
    const actions = { auth: authSlice, path: pathSlice, settings: settingsSlice, panels: panelSlice };
    return { store, actions };
}

/**
 * Phase 3: Secondary Initialization
 * Initializes systems that depend on the core services.
 */
async function bootSecondary({ store, actions }) {
    log.info('PHASE_3', '🔧 Phase 3: Secondary Initialization');
    
    services.appStore = store;
    services.eventBus = eventBus;
    services.panelState = panelStateService;
    services.workspaceLayout = workspaceLayoutService;

    const { appDispatch } = await import('./appDispatch.js');
    services.appDispatch = appDispatch;

    const { ConsoleLogManager } = await import('./log/ConsoleLogManager.js');
    services.consoleLogManager = new ConsoleLogManager().initialize().exposeToWindow();

    // --- Dependency Injection for Services ---
    const globalFetchLogger = window.APP.services.log.createLogger('API', 'globalFetch');
    window.APP.services.globalFetch = createGlobalFetch(globalFetchLogger);
    log.info('SERVICE_INJECTED', 'Injected logger into globalFetch service.');


    await initializeAuthSystem(store, actions);
    await initializeComponentSystem(store);
    await initializeEventListeners(store, actions);

    // Initialize layout manager after components are ready
    workspaceLayoutService.initialize();
}

/**
 * Phase 4: Finalization
 * Completes the boot process and signals readiness.
 */
async function bootFinalize() {
    log.info('PHASE_4', '🎯 Phase 4: Finalization');
    
    const splashElement = document.getElementById('devpages-splash');
    if (splashElement) {
        splashElement.style.display = 'none';
        log.info('SPLASH_HIDDEN', '🎭 Splash screen hidden');
    }
    document.body.classList.remove('splash-active');
    
    const successfulComponents = componentDefinitions.length - failedComponents.size;
    log.info('SUMMARY', `📊 Boot Summary: ${successfulComponents}/${componentDefinitions.length} components successful. Auth: ${bootState.isAuthenticated ? 'Yes' : 'No'}`);
    
    eventBus.emit('app:ready');
    window.APP_SHUTDOWN = () => shutdown();

    // --- Global Error Handling ---
    window.onerror = (message, source, lineno, colno, error) => {
        showFatalError(error || new Error(message), 'window.onerror');
        return true; // Prevent default browser error handling
    };
    window.addEventListener('unhandledrejection', event => {
        showFatalError(event.reason, 'unhandledrejection');
        event.preventDefault(); // Prevent default browser error handling
    });

    log.info('APP_READY', '🎉 Application ready for use');
}


// =============================================================================
// SYSTEM ORCHESTRATION & HELPERS
// =============================================================================

let systemAPIs = null;
let initializationPromise = null;

async function initializeReduxSystem() {
    if (initializationPromise) return initializationPromise;
    if (systemAPIs) return systemAPIs;

    initializationPromise = (async () => {
        try {
            lifecycleStages.push('boot:start');
            await bootPreInit();
            
            const coreAPIs = await bootCore();
            lifecycleStages.push('boot:coreServicesReady');
            
            await bootSecondary(coreAPIs);
            lifecycleStages.push('boot:secondarySystemsReady');
            
            await bootFinalize();
            lifecycleStages.push('boot:complete');
            
            systemAPIs = {
                store: coreAPIs.store,
                isReady: () => true,
                getStore: () => coreAPIs.store,
            };
            
            if (window.APP?.bootloader) {
                window.APP.bootloader.instance = { getSystemAPIs: () => systemAPIs };
            }
            
            log.info('SUCCESS', '✅ Redux system initialization completed successfully');
            return systemAPIs;
            
        } catch (error) {
            // In case of a critical failure, our first priority is to show the user
            // a helpful error screen. The `fail` function is self-contained and has no dependencies.
            fail(error);

            // Our second priority is to attempt to log the error. This might fail if the
            // logger itself or its dependencies are the cause of the issue, so we wrap it.
            try {
                if (log) {
                    log.error('CRITICAL_FAILURE', `💥 Critical initialization failure: ${error.message}`, error);
                } else {
                    console.error('💥 Critical boot failure (logger not available):', error);
                }
            } catch (loggingError) {
                console.error('💥 Logger failed during critical error handling:', loggingError);
            }

            throw error; // Re-throw the original error to ensure it's not swallowed
        }
    })();
    
    return initializationPromise;
}

// --- Initialization Sub-systems ---

async function initializeAuthSystem(store, actions) {
    log.info('INIT', '🔐 Initializing authentication...');
    const { authThunks } = actions.auth;

    await store.dispatch(authThunks.checkAuth());
    const authState = store.getState().auth;
    
    bootState.isAuthenticated = authState.isAuthenticated || false;
    bootState.authChecked = true;
    
    if (bootState.isAuthenticated) {
        log.info('AUTHENTICATED', `✅ User authenticated: ${authState.user?.username}`);
        const { fileThunks } = await import('./thunks/fileThunks.js');
        store.dispatch(fileThunks.loadTopLevelDirectories());
    } else {
        log.info('NOT_AUTHENTICATED', 'ℹ️ User not authenticated');
    }
}

async function initializeComponentSystem(store) {
    await waitDOMReady();
    await verifyDOMElements();
    await registerComponents(store);
    await initializeComponents(store);
}

async function initializeEventListeners(store, actions) {
    log.info('INIT', '📡 Setting up global event listeners...');
    const { pathThunks } = actions.path;

    eventBus.on('navigate:pathname', async ({ pathname, isDirectory }) => {
        log.info('NAVIGATE', `📡 Navigate to pathname: '${pathname}'`);
        store.dispatch(pathThunks.fetchListingByPath({ pathname, isDirectory }));
    });
    
    const { initKeyboardShortcuts } = await import('./keyboardShortcuts.js');
    initKeyboardShortcuts();
    log.info('KEYBOARD_SHORTCUTS', '⌨️ Keyboard shortcuts initialized');
}

// --- Component Management Helpers (adapted from original class) ---

function waitDOMReady() {
    log.info('DOM', 'WAIT_READY', '📄 Waiting for DOM ready...');
    if (document.readyState === 'complete' || document.readyState === 'interactive') return Promise.resolve();
    return new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

function verifyDOMElements() {
    log.info('DOM', 'VERIFY_ELEMENTS', '🔍 Verifying required DOM elements...');
    const missing = requiredDOMElements.filter(id => !document.getElementById(id));
    if (missing.length > 0) {
        log.warn('MISSING_ELEMENTS', `⚠️ Missing DOM elements: ${missing.join(', ')}`);
        missing.forEach(elementId => {
            const component = componentDefinitions.find(c => c.targetElementId === elementId);
            if (component) {
                failedComponents.add(component.name);
                log.warn('SKIPPED', `⚠️ Component ${component.name} will be skipped`);
            }
        });
    }
}

async function registerComponents(store) {
    log.info('REGISTERING', '📋 Registering components...');
    for (const def of componentDefinitions) {
        if (failedComponents.has(def.name)) continue;
        try {
            componentManager.register({
                name: def.name,
                mount: () => mountManagedComponent(def, store),
                destroy: () => destroyManagedComponent(def)
            });
            log.info('REGISTERED', `✅ Registered ${def.name}`);
        } catch (error) {
            log.error('REGISTER_FAILED', `❌ Failed to register ${def.name}: ${error.message}`, error);
            if (def.required) throw error;
            failedComponents.add(def.name);
        }
    }
}

function initializeComponents(store) {
    log.info('INITIALIZING', '🧩 Initializing components...');
    try {
        componentManager.init();
    } catch (error) {
        log.error('INIT_FAILED', `❌ Component initialization failed: ${error.message}`, error);
        throw error;
    }
}

async function mountManagedComponent(componentDef, store) {
    log.info('MOUNTING', `🔧 Mounting ${componentDef.name}...`);
    try {
        if (!checkDependencies(componentDef.dependencies)) {
            throw new Error(`Dependencies not met for ${componentDef.name}.`);
        }
        const module = await import(componentDef.modulePath);
        const factory = module[componentDef.factoryFunction];
        if (!factory) throw new Error(`Factory ${componentDef.factoryFunction} not found in ${componentDef.modulePath}.`);
        
        let component;

        if (componentDef.type === 'panel') {
            const PanelClass = factory;
            component = new PanelClass();
            panelStateService.registerPanel(componentDef.id, component);
            // Panels might not have a traditional mount, they are managed by the layout
            log.info('PANEL_REGISTERED', `✅ ${componentDef.name} panel registered.`);
        } else if (componentDef.targetElementId) {
            const targetElement = document.getElementById(componentDef.targetElementId);
            if (!targetElement) throw new Error(`Target element '${componentDef.targetElementId}' not found.`);
            
            const instance = factory(componentDef.targetElementId);
            if (instance && typeof instance.mount === 'function') {
                const mountResult = instance.mount();
                componentRegistry.set(componentDef.name, mountResult || instance);
                component = mountResult || instance;
            } else {
                component = instance;
            }
        } else {
            component = await factory();
        }
        
        if (component) {
            componentRegistry.set(componentDef.name, component);
            log.info('MOUNTED', `✅ ${componentDef.name} mounted.`);
        }

        return component;
    } catch (error) {
        log.error('MOUNT_FAILED', `❌ Failed to mount ${componentDef.name}: ${error.message}`, error);
        failedComponents.add(componentDef.name);
        if (componentDef.required) {
            fail(error); // Directly trigger the boot failure UI
            throw error; // Re-throw to halt execution
        }
        return null;
    }
}

function destroyManagedComponent(componentDef) {
    log.info('DESTROYING', `🗑️ Destroying ${componentDef.name}...`);
    const component = componentRegistry.get(componentDef.name);
    if (component && typeof component.destroy === 'function') {
        try {
            component.destroy();
            componentRegistry.delete(componentDef.name);
        } catch (error) {
            log.error('DESTROY_FAILED', `❌ Failed to destroy ${componentDef.name}: ${error.message}`, error);
        }
    }
}

function checkDependencies(dependencies) {
    for (const dep of dependencies || []) {
        if (dep === 'coreServices' && (!services.appStore || !services.eventBus)) return false;
        if (dep === 'auth' && !bootState.authChecked) return false;
    }
    return true;
}

// --- Shutdown and Failure ---

function shutdown() {
    log.info('SHUTDOWN', '🛑 Shutting down application...');
    componentManager.destroyAll();
    eventBus.emit('app:shutdown');
    log.info('SHUTDOWN_COMPLETE', '✅ Application shutdown complete');
}

function fail(error) {
    bootErrors.push(error);

    document.body.classList.add('boot-failed');
    let errorDiv = document.querySelector('.boot-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'boot-error';
        document.body.appendChild(errorDiv);
    }

    const completedStages = lifecycleStages.join(' → ');
    const failedComponentsList = Array.from(failedComponents).join(', ') || 'None';

    const errorsHtml = bootErrors.map(e => `
        <p><strong>Error:</strong> ${e.message}</p>
        <details>
            <summary style="cursor: pointer; font-weight: bold;">Technical Details</summary>
            <pre style="white-space: pre-wrap; word-wrap: break-word; background: #2b2b2b; color: #f2f2f2; padding: 15px; border-radius: 5px; margin-top: 10px;">${e.stack || 'No stack trace available'}</pre>
        </details>
    `).join('');

    errorDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #555; margin-bottom: 10px;">
            <h2 style="margin: 0; color: #ff4d4d;">Application Failed to Start (${bootErrors.length} error${bootErrors.length > 1 ? 's' : ''})</h2>
            <button id="copy-error-btn" style="padding: 8px 12px; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 4px;">Copy All Details</button>
        </div>
        ${errorsHtml}
        <hr>
        <p><strong>Completed stages:</strong> ${completedStages}</p>
        <p><strong>Failed components:</strong> ${failedComponentsList}</p>
    `;

    const copyBtn = document.getElementById('copy-error-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const allErrorDetails = bootErrors.map(e => `
Error: ${e.message}
Stack: ${e.stack || 'No stack trace available'}
            `.trim()).join('\n\n---\n\n');

            const fullReport = `
${allErrorDetails}

Completed stages: ${completedStages}
Failed components: ${failedComponentsList}
            `.trim();

            navigator.clipboard.writeText(fullReport).then(() => {
                copyBtn.textContent = 'Copied!';
                copyBtn.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy All Details';
                    copyBtn.style.backgroundColor = '#007bff';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy error to clipboard:', err);
                copyBtn.textContent = 'Failed!';
                copyBtn.style.backgroundColor = '#dc3545';
            });
        });
    }

    eventBus.emit('boot:failed', { errors: bootErrors.map(e => e.message), stages: lifecycleStages });
}

// =============================================================================
// AUTO-START
// =============================================================================

// Export for explicit initialization
export const bootloader = {
    initialize: initializeReduxSystem,
    getStore: () => systemAPIs?.store,
    getSystemAPIs: () => systemAPIs
};

// Auto-start on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReduxSystem);
} else {
    initializeReduxSystem();
}