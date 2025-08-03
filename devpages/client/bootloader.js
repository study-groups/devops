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
import { eventBus } from './eventBus.js';
import { componentManager } from './componentManager.js';
import { showFatalError } from './utils/uiError.js';
import { panelDefinitions as staticPanelDefinitions } from './panels/panelRegistry.js';
import { WorkspaceZone } from './layout/WorkspaceZone.js';
import { workspaceLayoutService } from './layout/WorkspaceLayoutManager.js';
import { panelStateService } from './panels/PanelStateManager.js';
import { createGlobalFetch } from './services/fetcher.js';
import { initializeStore, thunks as appThunks } from './appState.js';

// Define log variable, but do not initialize it yet.
let log;

// --- Unified Component & Panel Definitions ---

const allComponentDefinitions = [
    // Core Components
    { name: 'authDisplay', type: 'component', priority: 1, required: true, targetElementId: 'auth-component-container', modulePath: './components/AuthDisplay.js', factoryFunction: 'initializeAuthDisplay', dependencies: ['coreServices'], description: 'Authentication status display' },
    { name: 'pathManager', type: 'component', priority: 2, required: true, targetElementId: 'context-manager-container', modulePath: './components/PathManagerComponent.js', factoryFunction: 'createPathManagerComponent', dependencies: ['coreServices', 'auth'], description: 'File path and context manager' },
    { name: 'viewControls', type: 'component', priority: 3, required: false, targetElementId: 'view-controls-container', modulePath: './components/ViewControls.js', factoryFunction: 'createViewControlsComponent', dependencies: ['coreServices'], description: 'View mode controls' },
    { name: 'uiComponents', type: 'service', priority: 4, required: true, modulePath: './components/uiComponentsManager.js', factoryFunction: 'initializeUIComponents', dependencies: ['coreServices'], description: 'UI popup and modal components' },
    // Panel Components
    ...staticPanelDefinitions.map(p => ({
        ...p,
        type: 'panel',
        priority: 10, // Panels load after core components
        required: p.isDefault,
        factory: p.factory,
        dependencies: ['coreServices', 'auth'],
        description: p.title
    }))
];

const requiredDOMElements = allComponentDefinitions
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

async function bootPreInit() {
    window.APP = window.APP || {};
    window.APP.services = window.APP.services || {};
    window.APP.eventBus = eventBus;
    window.APP.services.eventBus = eventBus;
    log = window.APP.services.log.createLogger('BOOT', 'Bootloader');
    log.info('PHASE_1', '🚀 Phase 1: Pre-Initialization');
    window.APP.bootloader = {
        start: () => initializeReduxSystem(),
        instance: null,
        isReady: () => !!systemAPIs,
        type: 'redux'
    };
}

async function bootCore() {
    log.info('PHASE_2', '📦 Phase 2: Core Initialization - Creating Redux store...');
    let preloadedState = {};
    try {
        const savedSettings = localStorage.getItem('devpages-settings');
        if (savedSettings) {
            preloadedState.settings = JSON.parse(savedSettings);
        }
    } catch (error) {
        log.warn('LOAD_SETTINGS_FAILED', '⚠️ Failed to load saved settings, using defaults', error);
    }
    const { appStore, dispatch } = initializeStore(preloadedState);
    if (!preloadedState.settings) {
        dispatch(appThunks.settings.loadInitialSettings());
    }
    window.APP.store = appStore;
    window.APP.services.store = appStore;
    window.APP.redux = { store: appStore, dispatch, getState: appStore.getState };
    log.info('STORE_EXPOSED', '🌍 Store exposed globally on window.APP');
    return { store: appStore, actions: appThunks };
}

async function bootSecondary({ store, actions }) {
    log.info('PHASE_3', '🔧 Phase 3: Secondary Initialization');
    services.appStore = store;
    services.eventBus = eventBus;
    services.panelState = panelStateService;
    services.panelState.initialize(store); // Initialize with the store
    services.workspaceLayout = workspaceLayoutService;
    const { appDispatch } = await import('./appDispatch.js');
    services.appDispatch = appDispatch;
    const { ConsoleLogManager } = await import('./log/ConsoleLogManager.js');
    services.consoleLogManager = new ConsoleLogManager().initialize().exposeToWindow();
    const globalFetchLogger = window.APP.services.log.createLogger('API', 'globalFetch');
    window.APP.services.globalFetch = createGlobalFetch(globalFetchLogger);
    log.info('SERVICE_INJECTED', 'Injected logger into globalFetch service.');

    // --- Staged Component Initialization ---
    const preAuthComponents = allComponentDefinitions.filter(c => !(c.dependencies || []).includes('auth'));
    const postAuthComponents = allComponentDefinitions.filter(c => (c.dependencies || []).includes('auth'));

    // 1. Initialize components that DON'T need auth
    log.info('INIT_COMPONENTS_PRE_AUTH', '🧩 Initializing pre-authentication components...');
    await initializeComponentSystem(store, preAuthComponents);

    // 2. Initialize auth system
    await initializeAuthSystem(store, actions);

    // 2.5. Load essential data now that we are authenticated
    if (store.getState().auth.isAuthenticated) {
        log.info('DATA_FETCH_PRE_UI', '🚀 Fetching initial data post-authentication...');
        await store.dispatch(actions.path.fetchListingByPath({ pathname: '/', isDirectory: true }));
        log.info('DATA_FETCH_COMPLETE', '✅ Initial data fetched.');
    }

    // 3. Initialize components that DO need auth
    log.info('INIT_COMPONENTS_POST_AUTH', '🧩 Initializing post-authentication components...');
    await initializeComponentSystem(store, postAuthComponents);
    
    await initializeEventListeners(store, actions);
    
    try {
        const { initializePanelSystem } = await import('/redux/panels.js');
        await initializePanelSystem(store);
        log.info('PANEL_SYSTEM_READY', '🎛️ Redux panel system initialized successfully');
    } catch (error) {
        log.error('PANEL_SYSTEM_FAILED', '❌ Failed to initialize Redux panel system:', error);
    }

    workspaceLayoutService.initialize();
    window.APP.services.workspaceLayoutManager = workspaceLayoutService;

    // Initialize Workspace Zones for on-demand panel rendering
    const zoneIds = ['workspace-zone-left', 'workspace-zone-main', 'workspace-zone-right'];
    for (const zoneId of zoneIds) {
        const zone = new WorkspaceZone(zoneId);
        zone.initialize();
    }
}

async function bootFinalize() {
    log.info('PHASE_4', '🎯 Phase 4: Finalization');
    const splashElement = document.getElementById('devpages-splash');
    if (splashElement) {
        splashElement.style.display = 'none';
    }
    document.body.classList.remove('splash-active');
    const successfulComponents = allComponentDefinitions.length - failedComponents.size;
    log.info('SUMMARY', `📊 Boot Summary: ${successfulComponents}/${allComponentDefinitions.length} components successful. Auth: ${bootState.isAuthenticated ? 'Yes' : 'No'}`);
    eventBus.emit('app:ready');
    window.APP_SHUTDOWN = () => shutdown();
    window.onerror = (message, source, lineno, colno, error) => {
        showFatalError(error || new Error(message), 'window.onerror');
        return true;
    };
    window.addEventListener('unhandledrejection', event => {
        showFatalError(event.reason, 'unhandledrejection');
        event.preventDefault();
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
            fail(error);
            try {
                if (log) {
                    log.error('CRITICAL_FAILURE', `💥 Critical initialization failure: ${error.message}`, error);
                } else {
                    console.error('💥 Critical boot failure (logger not available):', error);
                }
            } catch (loggingError) {
                console.error('💥 Logger failed during critical error handling:', loggingError);
            }
            throw error;
        }
    })();
    return initializationPromise;
}

async function initializeAuthSystem(store, actions) {
    log.info('INIT', '🔐 Initializing authentication...');
    const { auth } = actions;
    await store.dispatch(auth.checkAuth());
    const authState = store.getState().auth;
    bootState.isAuthenticated = authState.isAuthenticated || false;
    bootState.authChecked = true;
    if (bootState.isAuthenticated) {
        log.info('AUTHENTICATED', `✅ User authenticated: ${authState.user?.username}`);
    } else {
        log.info('NOT_AUTHENTICATED', 'ℹ️ User not authenticated');
    }
}

async function initializeComponentSystem(store, componentDefs) {
    await waitDOMReady();
    await verifyDOMElements(componentDefs);
    await registerComponents(store, componentDefs);
    await initializeComponents(store, componentDefs);
}

async function initializeEventListeners(store, actions) {
    log.info('INIT', '📡 Setting up global event listeners...');
    const { path } = actions;
    eventBus.on('navigate:pathname', async ({ pathname, isDirectory }) => {
        log.info('NAVIGATE', `📡 Navigate to pathname: '${pathname}'`);
        store.dispatch(path.fetchListingByPath({ pathname, isDirectory }));
    });
    const { initKeyboardShortcuts } = await import('./keyboardShortcuts.js');
    initKeyboardShortcuts();
    log.info('KEYBOARD_SHORTCUTS', '⌨️ Keyboard shortcuts initialized');
}

function waitDOMReady() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') return Promise.resolve();
    return new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

function verifyDOMElements(componentDefs) {
    log.info('DOM', 'VERIFY_ELEMENTS', '🔍 Verifying required DOM elements...');
    const missing = componentDefs
        .filter(c => c.targetElementId && !document.getElementById(c.targetElementId))
        .map(c => c.targetElementId);

    if (missing.length > 0) {
        log.warn('MISSING_ELEMENTS', `⚠️ Missing DOM elements: ${missing.join(', ')}`);
        missing.forEach(elementId => {
            const component = componentDefs.find(c => c.targetElementId === elementId);
            if (component) {
                failedComponents.add(component.name);
                log.warn('SKIPPED', `⚠️ Component ${component.name} will be skipped`);
            }
        });
    }
}

async function registerComponents(store, componentDefs) {
    log.info('REGISTERING', `📋 Registering ${componentDefs.length} components...`);
    for (const def of componentDefs) {
        if (failedComponents.has(def.name)) continue;
        try {
            // The isRegistered check was removed as it's buggy and redundant.
            // The componentManager itself handles re-registration warnings.
            componentManager.register({
                name: def.name,
                mount: () => mountManagedComponent(def, store),
                destroy: () => destroyManagedComponent(def)
            });
        } catch (error) {
            log.error('REGISTER_FAILED', `❌ Failed to register ${def.name}: ${error.message}`, error);
            if (def.required) throw error;
            failedComponents.add(def.name);
        }
    }
}

function initializeComponents(store, componentDefs) {
    log.info('INITIALIZING', `🧩 Initializing ${componentDefs.length} components...`);
    try {
        const componentNames = componentDefs.map(c => c.name);
        componentManager.init(componentNames);
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
        let component;
        if (componentDef.type === 'panel') {
            // For panels, we just register their definition for on-demand loading
            panelStateService.registerPanel(componentDef.id, {
                id: componentDef.id,
                title: componentDef.title,
                factory: componentDef.factory,
                defaultZone: componentDef.defaultZone,
            });
            component = { name: componentDef.name, type: 'panel-definition' };
        } else if (componentDef.targetElementId) {
            const module = await import(componentDef.modulePath);
            const factory = module[componentDef.factoryFunction];
            if (!factory) throw new Error(`Factory ${componentDef.factoryFunction} not found in ${componentDef.modulePath}.`);
            const targetElement = document.getElementById(componentDef.targetElementId);
if (!targetElement) throw new Error(`Target element '${componentDef.targetElementId}' not found.`);
            const instance = factory(componentDef.targetElementId);
            if (instance && typeof instance.mount === 'function') {
                const mountResult = instance.mount();
                component = mountResult || instance;
            } else {
                component = instance;
            }
        } else {
            const module = await import(componentDef.modulePath);
            const factory = module[componentDef.factoryFunction];
            if (!factory) throw new Error(`Factory ${componentDef.factoryFunction} not found in ${componentDef.modulePath}.`);
            component = await factory();

            // If the factory returns a service object, attach it to the global namespace
            if (componentDef.type === 'service' && component) {
                window.APP.services[componentDef.name] = component;
            }
        }
        if (component) {
            componentRegistry.set(componentDef.name, component);
        }
        return component;
    } catch (error) {
        log.error('MOUNT_FAILED', `❌ Failed to mount ${componentDef.name}: ${error.message}`, error);
        failedComponents.add(componentDef.name);
        if (componentDef.required) {
            fail(error);
            throw error;
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


export const bootloader = {
    initialize: initializeReduxSystem,
    getStore: () => systemAPIs?.store,
    getSystemAPIs: () => systemAPIs
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReduxSystem);
} else {
    initializeReduxSystem();
}
