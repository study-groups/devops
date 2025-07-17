// bootstrap.js - Synchronous Application Initialization
import { logMessage } from '/client/log/index.js';
import '/client/log/LogCore.js';
import { ConsoleLogManager } from '/client/log/ConsoleLogManager.js';
import { eventBus } from '/client/eventBus.js';

// Window consolidation - must be imported early
import '/client/utils/windowConsolidation.js';

// Panel popup system - must be imported early for keyboard shortcuts
import '/client/utils/panelPopup.js';

// Reducer & State
import { mainReducer } from '/client/store/reducer.js';
import { dispatch, setReducer } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { appStore } from './appState.js';

// Make appStore available globally for DOM Inspector and other components
window.appStore = appStore;

// UI Manager for final subscription
import { subscribeUIManager } from '/client/uiManager.js';

// Publish Modal Integration
import { initializePublishModalIntegration } from '/client/components/PublishModalIntegration.js';

// Debug utilities (development only)
import '/client/debug-file-loading.js';

// Migration helper utilities
import '/client/utils/migrationHelper.js';

// CSS Performance monitoring
import '/client/utils/cssPerformanceMonitor.js';

// Load editor-specific styles asynchronously
const editorStylesLink = document.createElement('link');
editorStylesLink.rel = 'stylesheet';
editorStylesLink.href = '/client/styles/editor.css';
editorStylesLink.media = 'print';
editorStylesLink.onload = function() {
    this.media = 'all';
};
document.head.appendChild(editorStylesLink);

// ====================== INITIALIZATION METRICS ======================
const initMetrics = {
    start: 0,
    stages: {},
    events: {}
};

const performance = window.performance || {
    now: () => Date.now()
};

function recordMetric(stage, event, startTime) {
    const duration = performance.now() - startTime;
    if (!initMetrics.stages[stage]) initMetrics.stages[stage] = {};
    initMetrics.stages[stage][event] = duration;
    return performance.now();
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
    
    logBootstrap('hideSplashScreen called');
    logBootstrap(`Splash element found: ${!!splash}`);
    logBootstrap(`Body element found: ${!!body}`);
    
    if (splash && body) {
        logBootstrap('Removing splash-active class from body');
        body.classList.remove('splash-active');
        
        logBootstrap('Adding hidden class to splash');
        splash.classList.add('hidden');
        
        setTimeout(() => {
            if (splash.parentNode) {
                logBootstrap('Removing splash element from DOM');
                splash.parentNode.removeChild(splash);
            }
        }, 300);
        logBootstrap('Splash screen hidden, main interface visible');
    } else {
        logBootstrap('Splash screen elements not found!', 'error');
    }
}

// ====================== STAGE INITIALIZERS ======================
async function initCoreServices() {
    const start = performance.now();
    logBootstrap('Stage 1: Initializing Core Services...');
    
    // Initialize global console log manager
    const consoleLogManager = new ConsoleLogManager().initialize().exposeToWindow();
    window.consoleLogManager = consoleLogManager;
    window.eventBus = eventBus;
    setReducer(mainReducer);
    window.triggerActions = window.triggerActions || {};
    
    recordMetric('core', 'services', start);
    logBootstrap('Core Services (Logging, EventBus, Reducer) initialized');
    eventBus.emit('core:initialized');
    return performance.now();
}

let uiInfrastructureInitialized = false;
async function initUIInfrastructure() {
    if (uiInfrastructureInitialized) {
        console.warn('[Bootstrap] UI infrastructure already initialized, skipping.');
        return;
    }
    uiInfrastructureInitialized = true;

    const start = performance.now();
    logBootstrap('Stage 2: Initializing UI Infrastructure...');
    
    const { initializeUIComponents } = await import('/client/components/uiComponentsManager.js');
    await initializeUIComponents();

    // Initialize TopBar
    const { initializeTopBar } = await import('/client/components/topBar.js');
    initializeTopBar();

    // Initialize AuthDisplay
    const { initializeAuthDisplay } = await import('/client/components/AuthDisplay.js');
    initializeAuthDisplay();

    // Initialize EditorPanel in background
    const { EditorPanel } = await import('/client/panels/EditorPanel.js');
    const editorContainer = document.getElementById('editor-container');
    if (editorContainer) {
        const editorPanel = new EditorPanel();
        // Check if mount returns a Promise
        const mountResult = editorPanel.mount(editorContainer);
        if (mountResult && typeof mountResult.catch === 'function') {
            mountResult.catch(error => {
                logBootstrap(`Editor panel mount failed: ${error.message}`, 'error');
            });
        }
        window.editorPanel = editorPanel;
    } else {
        logBootstrap('Editor container (editor-container) not found!', 'error');
    }

    // Initialize WorkspaceLayoutManager in background
    const { WorkspaceLayoutManager } = await import('./layout/WorkspaceLayoutManager.js');
    const workspaceLayoutManager = new WorkspaceLayoutManager();
    window.workspaceLayoutManager = workspaceLayoutManager;
    // Check if initialize returns a Promise
    const initResult = workspaceLayoutManager.initialize();
    if (initResult && typeof initResult.catch === 'function') {
        initResult.catch(error => {
            logBootstrap(`Workspace layout manager initialization failed: ${error.message}`, 'error');
        });
    }
    
    // Initialize Panel System in background
    const { initializePanels } = await import('/client/settings/settingsInitializer.js');
    const { initializeDebugPanels } = await import('/packages/devpages-debug/debugPanelInitializer.js');
    const { SidebarManagerPanel: PanelManager } = await import('/client/panels/SidebarManagerPanel.js');
    const { loadInitialPanelState } = await import('/client/store/slices/panelSlice.js');
    const { PanelRenderer } = await import('/client/panels/PanelRenderer.js');
    const { DragDropManager } = await import('/client/panels/DragDropManager.js');
    
    logBootstrap('Initializing panels...');
    appStore.dispatch(loadInitialPanelState('sidebar'));
    
    // Initialize panels in background
    const panelsResult = initializePanels();
    if (panelsResult && typeof panelsResult.catch === 'function') {
        panelsResult.catch(error => {
            logBootstrap(`Panel initialization failed: ${error.message}`, 'error');
        });
    }
    
    const debugPanelsResult = initializeDebugPanels();
    if (debugPanelsResult && typeof debugPanelsResult.catch === 'function') {
        debugPanelsResult.catch(error => {
            logBootstrap(`Debug panel initialization failed: ${error.message}`, 'error');
        });
    }

    // Create the sidebar container programmatically
    const sidebarContainer = document.createElement('div');
    sidebarContainer.className = 'panel-manager';
    
    // Find the main sidebar container and append the new container to it
    const mainSidebarContainer = document.getElementById('sidebar-container');
    if (mainSidebarContainer) {
        mainSidebarContainer.appendChild(sidebarContainer);

        const panelRenderer = new PanelRenderer(sidebarContainer, 'sidebar');
        panelRenderer.start();

        const dragDropManager = new DragDropManager(sidebarContainer, 'sidebar');
        dragDropManager.start();
    } else {
        logBootstrap('Main sidebar container (#sidebar-container) not found!', 'error');
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
    eventBus.emit('ui:initialized');
    return performance.now();
}

async function initAuth() {
    const start = performance.now();
    logBootstrap('Auth: Starting authentication system...');
    
    // Use the NEW auth slice thunk instead of legacy auth
    const { authThunks } = await import('/client/store/slices/authSlice.js');
    const { appStore } = await import('/client/appState.js');
    const { eventBus } = await import('/client/eventBus.js');
    
    // Set up event listener for login requests from UI components
    if (!window.APP?.authLoginListenerAttached) {
        eventBus.on('auth:loginRequested', async ({ username, password }) => {
            logBootstrap(`[AUTH] Received auth:loginRequested for user: ${username}`);
            await appStore.dispatch(authThunks.login({ username, password }));
        });
        window.APP = window.APP || {};
        window.APP.authLoginListenerAttached = true;
        logBootstrap('[AUTH] Event listener for auth:loginRequested set up.');
    }
    
    // Dispatch the auth check thunk but don't wait for it
    appStore.dispatch(authThunks.checkAuth());
    
    // Don't wait for auth to be ready - let it happen in background
    // Components will handle auth state changes via subscriptions
    
    recordMetric('auth', 'initialization', start);
    logBootstrap('Authentication system started (non-blocking)');
    return performance.now();
}

async function initFeatures() {
    const start = performance.now();
    logBootstrap('Stage 3: Initializing Feature Modules...');
    
    // Initialize file manager in background (non-blocking)
    const { initializeFileManager } = await import('/client/filesystem/fileManager.js');
    const fileManagerResult = initializeFileManager();
    if (fileManagerResult && typeof fileManagerResult.catch === 'function') {
        fileManagerResult.catch(error => {
            logBootstrap(`File manager initialization failed: ${error.message}`, 'error');
        });
    }
    
    // Initialize keyboard shortcuts (synchronous)
    const { initKeyboardShortcuts } = await import('/client/keyboardShortcuts.js');
    initKeyboardShortcuts();
    
    // Load CLI module in background
    import('/client/cli/index.js').catch(error => {
        logBootstrap(`CLI module load failed: ${error.message}`, 'error');
    });
    
    // Initialize log panel in background
    const { LogPanel } = await import('/client/log/LogPanel.js');
    const logPanel = new LogPanel('log-container');
    const logPanelResult = logPanel.initialize();
    if (logPanelResult && typeof logPanelResult.catch === 'function') {
        logPanelResult.catch(error => {
            logBootstrap(`Log panel initialization failed: ${error.message}`, 'error');
        });
    }
    
    // DOM INSPECTOR: COMPLETELY DISABLED - Only loads when explicitly activated by user
    // This prevents any DOM inspector loading during app initialization
    
    recordMetric('features', 'modules', start);
    logBootstrap('Feature modules started (non-blocking)');
    eventBus.emit('features:initialized');
    return performance.now();
}

// ====================== MAIN INITIALIZATION ======================
async function initializeApp() {
    initMetrics.start = performance.now();
    logBootstrap('🚀 DevPages Application Initialization Started 🚀');

    try {
        await initCoreServices();
        await initUIInfrastructure();
        await initAuth();
        await initFeatures();

        // Subscribe the UI Manager to state updates after all UI is initialized
        subscribeUIManager(appStore);
        logBootstrap('UI Manager subscribed to state updates.');

        // Hide the splash screen to reveal the application
        hideSplashScreen();

        logBootstrap('✅ DevPages Application Initialized Successfully ✅');
        eventBus.emit('app:ready');

    } catch (error) {
        logBootstrap('🚨 CRITICAL INITIALIZATION FAILURE 🚨', 'error');
        logBootstrap(error.message, 'error');
        console.error('Bootstrap error:', error);
        
        // Hide splash even on error so user can see the error
        hideSplashScreen();
        
        const errorOverlay = document.createElement('div');
        errorOverlay.className = 'error-overlay';
        errorOverlay.innerHTML = '<div class="error-message">An error occurred during application initialization. Please try refreshing the page.</div>';
        document.body.appendChild(errorOverlay);
    }
}

// Start the application
try {
    initializeApp();
    
    appStore.subscribe(() => {
        const state = appStore.getState();
        // Handle state changes as needed
    });

} catch (error) {
    logBootstrap(`A critical error occurred during initialization: ${error.message}`, 'critical');
    console.error(error);
    const body = document.querySelector('body');
    if (body) {
        body.innerHTML = '<div class="critical-error-message">An error occurred while loading the application. Please try refreshing the page.</div>';
    }
} 