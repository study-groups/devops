// bootstrap.js - Synchronous Application Initialization
import { logMessage } from '/client/log/index.js';
import '/client/log/LogCore.js';
import { ConsoleLogManager } from '/client/log/ConsoleLogManager.js';
import { eventBus } from '/client/eventBus.js';

// Window consolidation - must be imported early
import '/client/utils/windowConsolidation.js';

// Reducer & State
import { mainReducer } from '/client/store/reducer.js';
import { dispatch, setReducer } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { appStore } from './appState.js';

// UI Manager for final subscription
import { subscribeUIManager } from '/client/uiManager.js';

// Publish Modal Integration
import { initializePublishModalIntegration } from '/client/components/PublishModalIntegration.js';

// Debug utilities (development only)
import '/client/settings/utils/debug-panels.js';
import '/client/debug-file-loading.js';

// Migration helper utilities
import '/client/utils/migrationHelper.js';

// Load editor-specific styles
const editorStylesLink = document.createElement('link');
editorStylesLink.rel = 'stylesheet';
editorStylesLink.href = '/client/styles/editor.css';
document.head.appendChild(editorStylesLink);

// ====================== INITIALIZATION METRICS ======================
const initMetrics = {
    start: 0,
    stages: {},
    events: {}
};

// Use browser's built-in performance API
const performance = window.performance || {
    now: () => Date.now()
};

function recordMetric(stage, event, startTime) {
    const duration = performance.now() - startTime;
    if (!initMetrics.stages[stage]) initMetrics.stages[stage] = {};
    initMetrics.stages[stage][event] = duration;
    return performance.now();
}

function logMetrics() {
    console.log('[BOOTSTRAP METRICS]');
    console.table(initMetrics.stages);
    logBootstrap('Initialization Metrics:');
    for (const [stage, events] of Object.entries(initMetrics.stages)) {
        logBootstrap(`Stage: ${stage}`);
        for (const [event, duration] of Object.entries(events)) {
            logBootstrap(`  ${event}: ${duration.toFixed(2)}ms`);
        }
    }
}

function logBootstrap(message, level = 'info') {
    if (typeof window.logMessage === 'function') {
        logMessage(message, level, 'BOOTSTRAP');
    } else {
        console.log(`[BOOTSTRAP] ${message}`);
    }
}

function hideSplashScreen() {
    const splash = document.getElementById('devpages-splash');
    const body = document.body;
    
    if (splash && body) {
        body.classList.remove('splash-active');
        splash.classList.add('hidden');
        setTimeout(() => {
            if (splash.parentNode) {
                splash.parentNode.removeChild(splash);
            }
        }, 300);
        logBootstrap('Splash screen hidden, main interface visible');
    }
}

// ====================== STAGE INITIALIZERS ======================
async function initCoreServices() {
    const start = performance.now();
    logBootstrap('Stage 1: Initializing Core Services...');
    
    new ConsoleLogManager().initialize().exposeToWindow();
    window.eventBus = eventBus;
    setReducer(mainReducer);
    window.triggerActions = window.triggerActions || {};
    
    recordMetric('core', 'services', start);
    logBootstrap('Core Services (Logging, EventBus, Reducer) initialized');
    eventBus.emit('core:initialized');
    return performance.now();
}

async function initUIInfrastructure() {
    const start = performance.now();
    console.warn('[Bootstrap] initUIInfrastructure called - START');
    logBootstrap('Stage 2: Initializing UI Infrastructure...');
    
    const { initializeUIComponents } = await import('/client/components/uiComponentsManager.js');
    await initializeUIComponents();

    // Initialize TopBar
    const { initializeTopBar } = await import('/client/components/topBar.js');
    initializeTopBar();

    // Initialize AuthDisplay
    const { initializeAuthDisplay } = await import('/client/components/AuthDisplay.js');
    initializeAuthDisplay();

    // Initialize EditorPanel
    const { EditorPanel } = await import('/client/panels/types/EditorPanel.js');
    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
        const editorPanel = new EditorPanel();
        await editorPanel.mount(editorContainer);
        window.editorPanel = editorPanel;
    } else {
        logBootstrap('Editor container (editor-container) not found!', 'error');
    }

    // Initialize WorkspaceLayoutManager
    const { workspaceLayoutManager } = await import('/client/layout/WorkspaceLayoutManager.js');
    window.workspaceLayoutManager = workspaceLayoutManager;
    await workspaceLayoutManager.initialize();
    
    // Initialize Panel System
    console.warn('[Bootstrap] About to initialize panel system...');
    const { initializePanels } = await import('/client/settings/settingsInitializer.js');
    const { PanelManager } = await import('/client/panels/core/PanelManager.js');
    
    logBootstrap('Initializing panels...');
    console.warn('[Bootstrap] Calling initializePanels()...');
    initializePanels(); // Register all panels

    const sidebarContainer = document.querySelector('.panel-manager');
    if (sidebarContainer) {
        logBootstrap('Creating and initializing PanelManager...');
        console.warn('[Bootstrap] Found sidebar container:', sidebarContainer);
        console.warn('[Bootstrap] Existing panel manager:', window.panelManager);
        console.warn('[Bootstrap] Sidebar container children:', sidebarContainer.children.length);
        
        // Clean up any existing panel manager
        if (window.panelManager) {
            console.warn('[Bootstrap] Cleaning up existing panel manager');
            if (typeof window.panelManager.destroy === 'function') {
                window.panelManager.destroy();
            }
        }
        
        console.warn('[Bootstrap] Creating new PanelManager...');
        const panelManager = new PanelManager(sidebarContainer, 'sidebar');
        console.warn('[Bootstrap] Calling panelManager.init()...');
        panelManager.init();
        window.panelManager = panelManager; // Global access for debugging
        logBootstrap('PanelManager initialized successfully');
    } else {
        logBootstrap('Sidebar container (.panel-manager) not found!', 'error');
    }
    
    // Initialize KeyboardShortcutManager
    const { KeyboardShortcutManager } = await import('/client/keyboard/KeyboardShortcutManager.js');
    const keyboardShortcutManager = new KeyboardShortcutManager();
    keyboardShortcutManager.initialize();

    // Mount static components
    const { createContextManagerComponent } = await import('/client/components/ContextManagerComponent.js');
    const { createViewControlsComponent } = await import('/client/components/ViewControls.js');
    
    createContextManagerComponent('context-manager-container').mount();
    createViewControlsComponent('view-controls-container').mount();
    
    recordMetric('ui', 'infrastructure', start);
    logBootstrap('UI Infrastructure initialized');
    console.warn('[Bootstrap] initUIInfrastructure completed - END');
    eventBus.emit('ui:initialized');
    return performance.now();
}

async function initAuth() {
    const start = performance.now();
    logBootstrap('Auth: Starting authentication system...');
    
    const { initAuth } = await import('/client/auth.js');
    initAuth();
    
    // Wait for auth ready
    await waitForAuthReady();
    
    recordMetric('auth', 'initialization', start);
    logBootstrap('Authentication system ready');
    return performance.now();
}

async function initFeatures() {
    const start = performance.now();
    logBootstrap('Stage 3: Initializing Feature Modules...');
    
    // Initialize file manager
    const { initializeFileManager } = await import('/client/filesystem/fileManager.js');
    await initializeFileManager();
    
    // Import and initialize feature modules
    const { initializeDomInspector } = await import('/client/dom-inspector/domInspectorInitializer.js');
    await initializeDomInspector();
    
    await import('/client/settings/core/settingsInitializer.js');
    await import('/client/keyboardShortcuts.js');
    await import('/client/cli/index.js');
    
    // Initialize LogPanel
    const { LogPanel } = await import('/client/log/LogPanel.js');
    const logPanel = new LogPanel('log-container');
    await logPanel.initialize();

    // PreviewPanel is now managed by WorkspaceLayoutManager
    // No need to create duplicate instance here
    
    recordMetric('features', 'modules', start);
    logBootstrap('Feature modules loaded');
    eventBus.emit('features:initialized');
    return performance.now();
}

// ====================== AUTH READY HELPER ======================
async function waitForAuthReady() {
    const start = performance.now();
    return new Promise((resolve) => {
        let unsubscribe = null;
        
        const check = () => {
            const state = window.appStore?.getState();
            if (state?.auth && state.auth.isInitializing === false) {
                recordMetric('auth', 'ready_check', start);
                resolve();
                if (unsubscribe) unsubscribe();
            }
        };
        
        check();
        
        if (window.appStore) {
            unsubscribe = window.appStore.subscribe((newState, prev) => {
                if (newState.auth !== prev.auth) {
                    check();
                }
            });
        }
    });
}

// ====================== MAIN INITIALIZATION FLOW ======================
let bootstrapCallCount = 0;
let isBootstrapping = false;
let bootstrapCompleted = false;

async function initializeApp() {
    bootstrapCallCount++;
    console.warn(`[Bootstrap] initializeApp called - COUNT: ${bootstrapCallCount}`);
    
    if (bootstrapCallCount > 1) {
        console.error(`[Bootstrap] WARNING: initializeApp called ${bootstrapCallCount} times!`);
        
        // Prevent duplicate initialization
        if (isBootstrapping) {
            console.error('[Bootstrap] Already bootstrapping, ignoring duplicate call');
            return;
        }
        
        if (bootstrapCompleted) {
            console.error('[Bootstrap] Bootstrap already completed, ignoring duplicate call');
            return;
        }
    }
    
    isBootstrapping = true;
    initMetrics.start = performance.now();
    logBootstrap('Starting application bootstrap...');
    
    try {
        // Core services first
        await initCoreServices();
        
        // UI infrastructure
        await initUIInfrastructure();
        
        // Authentication
        await initAuth();
        
        // Features
        await initFeatures();
        
        // Finalization
        logMetrics();
        logBootstrap('Bootstrap completed successfully');
        eventBus.emit('app:ready');
        
        // Final UI sync
        initializePublishModalIntegration();
        subscribeUIManager();
        dispatch({ type: ActionTypes.UI_APPLY_INITIAL_STATE });
        logBootstrap('UIManager subscribed and final state synced');
        
        // Hide splash screen
        hideSplashScreen();
        
        bootstrapCompleted = true;
        
    } catch (error) {
        logBootstrap(`Bootstrap failed: ${error.message}`, 'error');
        console.error('Application bootstrap failed:', error);
        eventBus.emit('app:failed', error);
        hideSplashScreen();
    } finally {
        isBootstrapping = false;
    }
}

// Start when DOM is ready
console.warn('[Bootstrap] Setting up DOM ready listeners...');
if (document.readyState === 'loading') {
    console.warn('[Bootstrap] DOM still loading, adding event listener');
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    console.warn('[Bootstrap] DOM already ready, calling initializeApp immediately');
    initializeApp();
}