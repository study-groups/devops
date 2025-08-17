/**
 * client/bootloader.js - Redux System Bootloader
 * Cache bust: 2024-08-05-01
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
import { showFatalError } from './utils/uiError.js';
import { panelDefinitions as staticPanelDefinitions } from './panels/panelRegistry.js';
import { simplifiedWorkspaceManager } from './layout/SimplifiedWorkspaceManager.js';
import { createGlobalFetch } from './services/fetcher.js';
import { initializeStore, thunks as appThunks, actions as appActions } from './appState.js';
import { startInitialization, setComponentLoading, setComponentReady, setComponentError } from './store/slices/systemSlice.js';
import { initializeKeyboardShortcuts } from './keyboardShortcuts.js';
import { pathThunks } from './store/slices/pathSlice.js';

// Define log variable, but do not initialize it yet.
let log;

// --- Unified Component & Panel Definitions ---

const allComponentDefinitions = [
    // Core Components
    { name: 'authDisplay', type: 'component', priority: 1, required: true, targetElementId: 'auth-component-container', modulePath: '/client/components/AuthDisplay.js', factoryFunction: 'initializeAuthDisplay', dependencies: ['coreServices'], description: 'Authentication status display' },
    { name: 'pathManager', type: 'component', priority: 2, required: true, targetElementId: 'context-manager-container', modulePath: '/client/components/PathManagerComponent.js', factoryFunction: 'createPathManagerComponent', dependencies: ['coreServices', 'auth'], description: 'File path and context manager' },
    { name: 'viewControls', type: 'component', priority: 3, required: false, targetElementId: 'view-controls-container', modulePath: '/client/components/ViewControls.js', factoryFunction: 'createViewControlsComponent', dependencies: ['coreServices'], description: 'View mode controls' },
    { name: 'contextSettingsPopup', type: 'service', priority: 4, required: true, modulePath: '/client/components/ContextSettingsPopupComponent.js', factoryFunction: 'initializeContextSettingsPopup', dependencies: ['coreServices'], description: 'Context settings popup component' },
    { name: 'resizableManager', type: 'service', priority: 5, required: true, modulePath: '/client/layout/resizable.js', factoryFunction: 'initializeResizableManager', dependencies: ['coreServices'], description: 'Manages resizable panels' },
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
    
    // CRITICAL FIX: Set global dispatch for enhanced reducer utils
    const { setGlobalDispatch } = await import('/client/store/reducers/enhancedReducerUtils.js');
    setGlobalDispatch(dispatch);
    log.info('GLOBAL_DISPATCH', '✅ Global dispatch set for enhanced reducer utils');
    
    if (!preloadedState.settings) {
        dispatch(appThunks.settings.loadInitialSettings());
    }
    // Store available via services for any remaining legacy code
    window.APP.services.store = appStore;
    if (!window.APP.bootloader) window.APP.bootloader = {};
    
    // Initialize system coordination
    dispatch(startInitialization());
    window.APP.bootloader.phase = 'initializing';
    log.info('SYSTEM_COORDINATION', '✅ System coordination initialized');
    
    log.info('STORE_INITIALIZED', '✅ Redux store initialized and available via direct imports');
    return { store: appStore, actions: appThunks };
}

async function bootSecondary({ store, actions }) {
    log.info('PHASE_3', '🔧 Phase 3: Secondary Initialization');
    services.appStore = store;
    services.eventBus = eventBus;

    const { appDispatch } = await import('./appDispatch.js');
    services.appDispatch = appDispatch;
    const { ConsoleLogManager } = await import('./log/ConsoleLogManager.js');
    services.consoleLogManager = new ConsoleLogManager().initialize().exposeToWindow();
    
    // Ensure the logger is ready before creating services that depend on it
    if (!window.APP.services.log) {
        throw new Error("Logging service not available on window.APP.services.log");
    }
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
    // Wait for auth to be checked before proceeding
    const authState = store.getState().auth;
    if (authState.authChecked && authState.isAuthenticated) {
        log.info('DATA_FETCH_PRE_UI', '🚀 Fetching initial data post-authentication...');
        
        // Load top-level directories for file browser and path manager
                    store.dispatch(setComponentLoading({ component: 'fileSystem' }));
        try {
            await store.dispatch(actions.path.loadTopLevelDirectories());
            store.dispatch(setComponentReady({ component: 'fileSystem' }));
            log.info('FILE_SYSTEM_INIT', '✅ File system directories loaded.');
        } catch (error) {
            store.dispatch(setComponentError({ component: 'fileSystem', error: error.message }));
            log.error('FILE_SYSTEM_INIT_FAILED', `❌ Failed to load file system: ${error.message}`, error);
        }
        
        // Load root directory listing - REMOVED, as it's redundant with loadTopLevelDirectories
        // await store.dispatch(actions.path.fetchListingByPath({ pathname: '/', isDirectory: true }));
        log.info('DATA_FETCH_COMPLETE', '✅ Initial data fetched.');
        
    }

    // 3. Initialize components that DO need auth
    log.info('INIT_COMPONENTS_POST_AUTH', '🧩 Initializing post-authentication components...');
    await initializeComponentSystem(store, postAuthComponents);
    
    
    // PANEL_REGISTRATION: Register missing panels before SimplifiedWorkspaceManager initialization
    try {
        // Temporarily disable panel registration fix
        // log.info('PANEL_REGISTRATION', '📋 Registering missing panels for proper sidebar display...');
        // // Note: registerMissingPanels() is called automatically on import
    } catch (error) {
        log.warn('PANEL_REGISTRATION_FAILED', '⚠️ Failed to register missing panels:', error);
    }

    // SIMPLIFIED: Initialize SimplifiedWorkspaceManager only
    try {
        await simplifiedWorkspaceManager.initialize();

        window.APP.services.simplifiedWorkspaceManager = simplifiedWorkspaceManager;
        log.info('WORKSPACE_INIT', '✅ SimplifiedWorkspaceManager initialized - All panels working');
        log.info('WORKSPACE_HIERARCHY', '🎖️ Clean system: SimplifiedWorkspaceManager only');
        
        // Initialize Sidebar Visibility Controller
        const { sidebarVisibilityController } = await import('/client/layout/SidebarVisibilityController.js');
        sidebarVisibilityController.initialize();
        log.info('SIDEBAR_CONTROLLER', '✅ Sidebar visibility controller initialized');
        
    } catch (error) {
        log.error('WORKSPACE_INIT_FAILED', '❌ Workspace initialization failed:', error);
        throw error;
    }

    console.log('[BOOTLOADER] About to initialize log display...');
    
    // Initialize Log Display - FULL FEATURED APPROACH
    try {
        // Use the existing log-container from HTML
        const logContainer = document.getElementById('log-container');
        if (logContainer) {
            console.log('[BOOTLOADER] Found log-container, attempting to create LogDisplay...');
            
            // Import and create the full-featured LogDisplay
            const { LogDisplay } = await import('/client/log/LogDisplay.js');
            console.log('[BOOTLOADER] LogDisplay imported successfully');
            
            // Create the log display instance
            const logDisplay = new LogDisplay({
                id: 'log-display',
                title: 'Log Display',
                store: store
            });
            console.log('[BOOTLOADER] LogDisplay instance created');
            
            // Mount the log display directly in the container
            // The LogDisplay will create its own internal structure
            logDisplay.onMount(logContainer);
            console.log('[BOOTLOADER] LogDisplay mounted directly in log-container');
            
            log.info('LOG_DISPLAY_INIT', '✅ Full-featured log display created and ready');
        } else {
            log.error('LOG_DISPLAY_INIT', '❌ log-container not found in DOM');
        }
    } catch (error) {
        console.error('[BOOTLOADER] Log display initialization error:', error);
        log.error('LOG_DISPLAY_INIT', '❌ Failed to initialize log display:', error);
    }

    // Initialize keyboard shortcuts
    try {
        initializeKeyboardShortcuts();
        log.info('KEYBOARD_SHORTCUTS_INIT', '✅ Keyboard shortcuts initialized');
    } catch (error) {
        log.error('KEYBOARD_SHORTCUTS_INIT_FAILED', '❌ Keyboard shortcuts initialization failed:', error);
    }

    // Initialize debug panels now that SimplifiedWorkspaceManager is ready
    if (bootState.isAuthenticated) {
        try {
            const { initializeDebugPanels } = await import('/packages/devpages-debug/index.js');
            await initializeDebugPanels();
            log.info('DEBUG_PANELS_INIT', '🔧 Debug panels initialized successfully');
        } catch (error) {
            log.error('DEBUG_PANELS_INIT_FAILED', `❌ Failed to initialize debug panels: ${error.message}`, error);
        }
    }

    // SAFETY: Override window.APP.panels with safe stub to prevent Redux conflicts
    try {
        await import('./fix-window-panels.js');
        log.info('PANELS_STUB', '✅ window.APP.panels replaced with safe stub');
    } catch (error) {
        log.warn('PANELS_STUB_FAILED', '⚠️ Failed to load panels stub:', error);
    }

    // Initialize Panel Testing Framework in development
    // Browser-safe environment detection (instead of process.env.NODE_ENV)
    const isProduction = window.location.hostname.includes('pixeljamarcade.com') && 
                        !window.location.hostname.includes('qa.') && 
                        !window.location.hostname.includes('dev.');
    if (!isProduction) {
        try {
            const { panelTestFramework } = await import('./tests/PanelTestFramework.js');
            panelTestFramework.initialize(window.APP.services.simplifiedWorkspaceManager);
            
            // Auto-run health check
            setTimeout(() => {
                console.log('\n🧪 Auto-running Panel Health Check...');
                panelTestFramework.quickHealthCheck();
            }, 2000);
            
            // Make test functions available via APP namespace
            window.APP.testing = {
                runPanelTests: () => panelTestFramework.runAllTests(),
                panelHealthCheck: () => panelTestFramework.quickHealthCheck(),
                framework: panelTestFramework
            };
            
            console.log('[Bootloader] Panel testing framework initialized. Use APP.testing.runPanelTests() or APP.testing.panelHealthCheck() in console.');
        } catch (error) {
            console.warn('[Bootloader] Failed to initialize panel testing framework:', error);
        }
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
    // Mark system as fully ready
    window.APP.bootloader.phase = 'ready';
    
    // Handle deep linking from URL
    const urlParams = new URLSearchParams(window.location.search);
    const pathname = urlParams.get('pathname');
    if (pathname) {
        log.info('DEEP_LINK', `Found deep link pathname: ${pathname}`);
        // Heuristic to determine if the path is a file or directory
        const isDirectory = !/.+\.[^/]+$/.test(pathname);
        
        // Small delay to ensure all components are ready for the event
        setTimeout(() => {
            const { store } = systemAPIs;
            store.dispatch(pathThunks.navigateToPath({ pathname, isDirectory }));
        }, 100);
    }
    
    // Initialize clean panels auto-loader
    try {
        log.info('CLEAN_PANELS', '🧹 Initializing clean panels auto-loader...');
        const { cleanPanelAutoLoader } = await import('./panels/auto-load-clean-panels.js');
        await cleanPanelAutoLoader.initialize();
        log.info('CLEAN_PANELS', '✅ Clean panels auto-loaded successfully');
    } catch (error) {
        log.warn('CLEAN_PANELS_FAILED', '⚠️ Failed to auto-load clean panels:', error);
        // Don't fail the entire boot process for this
    }
    
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
    
    // Use the new RTK Query-based auth initialization
    await store.dispatch(auth.initializeAuth());
    
    // Wait for authentication to be fully checked
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    while (attempts < maxAttempts) {
        const authState = store.getState().auth;
        if (authState.authChecked) {
            bootState.isAuthenticated = authState.isAuthenticated || false;
            bootState.authChecked = true;
            if (bootState.isAuthenticated) {
                log.info('AUTHENTICATED', `✅ User authenticated: ${authState.user?.username}`);
            } else {
                log.info('NOT_AUTHENTICATED', 'ℹ️ User not authenticated');
            }
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
        attempts++;
    }
    
    log.warn('AUTH_TIMEOUT', '⚠️ Authentication initialization timed out');
    bootState.isAuthenticated = false;
    bootState.authChecked = true;
}

async function initializeComponentSystem(store, componentDefs) {
    await waitDOMReady();
    await verifyDOMElements(componentDefs);
    await registerComponents(store, componentDefs);
    await initializeComponents(store, componentDefs);
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
            // Store component definition for direct mounting
            componentRegistry.set(def.name, {
                definition: def,
                store: store,
                mounted: false
            });
            log.info('REGISTERED', `✅ Registered component: ${def.name}`);
        } catch (error) {
            log.error('REGISTER_FAILED', `❌ Failed to register ${def.name}: ${error.message}`, error);
            if (def.required) throw error;
            failedComponents.add(def.name);
        }
    }
}

async function initializeComponents(store, componentDefs) {
    log.info('INITIALIZING', `🧩 Initializing ${componentDefs.length} components...`);
    try {
        // Mount components directly instead of using componentManager
        for (const def of componentDefs) {
            if (failedComponents.has(def.name)) continue;
            
            const registryEntry = componentRegistry.get(def.name);
            if (registryEntry && !registryEntry.mounted) {
                await mountManagedComponent(def, store);
            }
        }
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
            // This is now handled by SimplifiedWorkspaceManager
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
                log.info(`SERVICE_ATTACHED`, `Attached ${componentDef.name} service to window.APP.services.`);
            }
        }
        if (component) {
            // Update the registry entry with the mounted instance
            const registryEntry = componentRegistry.get(componentDef.name);
            if (registryEntry) {
                registryEntry.instance = component;
                registryEntry.mounted = true;
            }
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
    
    // Clean up mounted components
    for (const [name, entry] of componentRegistry) {
        if (entry.mounted) {
            try {
                // Call destroy if component has one
                if (entry.instance && typeof entry.instance.destroy === 'function') {
                    entry.instance.destroy();
                }
                entry.mounted = false;
                log.info('DESTROYED', `✅ Destroyed component: ${name}`);
            } catch (error) {
                log.error('DESTROY_FAILED', `❌ Failed to destroy component ${name}:`, error);
            }
        }
    }
    
    componentRegistry.clear();
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
