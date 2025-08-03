/**
 * @fileoverview DEPRECATED - Application bootstrap (v2).
 * 
 * ⚠️ WARNING: This file has been replaced by bootloader.js
 * This is kept for reference only - DO NOT USE
 * 
 * The new bootloader.js provides:
 * - Cleaner lifecycle messaging
 * - Better integration with existing appStore, eventBus, and appDispatch
 * - Improved error handling and debugging
 * - Simplified component initialization
 * 
 * This file handles the staged, robust initialization of the application,
 * improving encapsulation, DOM safety, and testability.
 */

import { LifecycleEvents } from '/client/lifecycle/events.js';
import { lifecycleManager } from '/client/lifecycle/LifecycleManager.js';

class AppBootstrapper {
  constructor(domDependencies) {
    this.domDependencies = domDependencies;
    
    // Encapsulated services and managers
    this.services = {};
    this.managers = {};
    this.components = {};
    
    // State and metrics
    this.currentState = 'pending';
    this.initMetrics = {
      start: performance.now(),
      stages: {},
      events: {}
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[BootstrapV2] [${timestamp}] [${level.toUpperCase()}]: ${message}`);
  }

  recordMetric(stage, event, startTime) {
    const duration = performance.now() - startTime;
    if (!this.initMetrics.stages[stage]) {
      this.initMetrics.stages[stage] = {};
    }
    this.initMetrics.stages[stage][event] = duration;
    this.log(`Metric: [${stage}.${event}] took ${duration.toFixed(2)}ms`);
  }

  async run() {
    this.log('🚀 DevPages Application Initialization Started (v2) 🚀');
    lifecycleManager.emit(LifecycleEvents.BOOTSTRAP_START);
    
    const stages = [
      this.initCoreServices,
      this.verifyDom,
      this.initAuth,
      this.initUIInfrastructure,
      this.initFeatures,
      this.finalize,
    ];

    try {
      for (const stage of stages) {
        const stageName = stage.name.replace('bound ', '');
        this.currentState = `initializing:${stageName}`;
        this.log(`Executing stage: ${stageName}`);
        const stageStartTime = performance.now();
        
        await stage.call(this);
        
        this.recordMetric('bootstrap', stageName, stageStartTime);
        this.log(`Stage ${stageName} completed.`);
      }
      this.currentState = 'initialized';
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  handleInitializationError(error) {
    this.currentState = 'failed';
    this.log(`🚨 CRITICAL INITIALIZATION FAILURE 🚨`, 'error');
    this.log(error.message, 'error');
    console.error('Bootstrap error:', error);
    this.hideSplashScreen(); // Show error message

    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'error-overlay';
    errorOverlay.innerHTML = `<div class="error-message">An error occurred during application initialization. Please try refreshing the page. Details: ${error.message}</div>`;
    document.body.appendChild(errorOverlay);
  }

  hideSplashScreen() {
    const splash = document.getElementById('devpages-splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.parentNode?.removeChild(splash), 300);
    }
    document.body.classList.remove('splash-active');
  }

  // ====================== STAGES ======================

  async initCoreServices() {
    this.log('Initializing core services...');
    
    try {
        this.log('Importing appState...');
        const { appStore, dispatch, settingsThunks } = await import('/client/appState.js');
        this.log('Importing ConsoleLogManager...');
        const { ConsoleLogManager } = await import('/client/log/ConsoleLogManager.js');
        this.log('Importing eventBus...');
        const { eventBus } = await import('/client/eventBus.js');
        this.log('Importing messageQueue...');
        const { setReducer } = await import('/client/messaging/messageQueue.js');
        this.log('Importing mainReducer...');
        const { mainReducer } = await import('/client/store/reducer.js');
        
        this.services.appStore = appStore;
        this.services.eventBus = eventBus;

        this.services.consoleLogManager = new ConsoleLogManager().initialize().exposeToWindow();
        setReducer(mainReducer);
        dispatch(settingsThunks.loadInitialSettings());

        // Initialize lifecycle manager with the main eventBus
        lifecycleManager.setEventBus(this.services.eventBus);
        
        // Expose services on window.APP following established pattern
        window.APP = window.APP || {};
        window.APP.eventBus = this.services.eventBus;
        window.APP.lifecycle = lifecycleManager;
        window.APP.store = this.services.appStore;
        
        this.services.eventBus.emit('core:initialized');
        this.log('Core services initialized.');
        lifecycleManager.emit(LifecycleEvents.BOOTSTRAP_CORE_SERVICES_READY);
    } catch (e) {
        this.log(`Error in initCoreServices: ${e.message}`, 'error');
        throw e;
    }
  }
  
  async verifyDom() {
    this.log('Verifying DOM dependencies...');
    for (const id of this.domDependencies) {
        if (!document.getElementById(id)) {
            throw new Error(`Critical DOM element #${id} not found. Halting initialization.`);
        }
    }
    this.log('All DOM dependencies verified.');
    lifecycleManager.emit(LifecycleEvents.BOOTSTRAP_DOM_VERIFIED);
  }

  async initUIInfrastructure() {
    this.log('Initializing UI infrastructure...');

    const { componentManager } = await import('/client/componentManager.js');
    this.managers.componentManager = componentManager;

    const promises = [
        import('/client/components/uiComponentsManager.js').then(m => m.initializeUIComponents()).catch(e => this.log(`uiComponentsManager failed: ${e.message}`, 'error')),
        import('/client/components/topBar.js').then(m => m.initializeTopBar()).catch(e => this.log(`topBar failed: ${e.message}`, 'error')),
        import('/client/components/AuthDisplay.js').then(m => m.initializeAuthDisplay()).catch(e => this.log(`AuthDisplay failed: ${e.message}`, 'error')),
        import('/client/settings/settingsInitializer.js').then(m => m.initializePanels()).catch(e => this.log(`settingsInitializer failed: ${e.message}`, 'error')),
        import('/packages/devpages-debug/debugPanelInitializer.js').then(m => m.initializeDebugPanels()).catch(e => this.log(`debugPanelInitializer failed: ${e.message}`, 'error')),
    ];

    const editorContainer = document.getElementById('editor-container');
    const { EditorPanel } = await import('/client/panels/EditorPanel.js');
    this.components.editorPanel = new EditorPanel();
    await this.components.editorPanel.mount(editorContainer);

    const { WorkspaceLayoutManager } = await import('/client/layout/WorkspaceLayoutManager.js');
    this.managers.workspaceLayoutManager = new WorkspaceLayoutManager();
    await this.managers.workspaceLayoutManager.initialize();

    const { loadInitialPanelState } = await import('/client/store/slices/panelSlice.js');
    this.services.appStore.dispatch(loadInitialPanelState('sidebar'));

    const { PanelRenderer } = await import('/client/panels/PanelRenderer.js');
    const { DragDropManager } = await import('/client/panels/DragDropManager.js');
    const sidebarContainer = document.getElementById('sidebar-container');
    const panelManagerContainer = document.createElement('div');
    panelManagerContainer.className = 'panel-manager';
    sidebarContainer.appendChild(panelManagerContainer);
    new PanelRenderer(panelManagerContainer, 'sidebar').start();
    new DragDropManager(panelManagerContainer, 'sidebar').start();
    
    const { KeyboardShortcutManager } = await import('/client/keyboard/KeyboardShortcutManager.js');
    this.managers.keyboardShortcutManager = new KeyboardShortcutManager().initialize();

    const { createPathManagerComponent } = await import('/client/components/PathManagerComponent.js');
    this.components.pathManager = createPathManagerComponent('context-manager-container');
    this.components.pathManager.mount();

    const { createViewControlsComponent } = await import('/client/components/ViewControls.js');
    this.components.viewControls = createViewControlsComponent('view-controls-container');
    this.components.viewControls.mount();
    
    await Promise.all(promises);

    this.managers.componentManager.init();
    
    const { subscribeUIManager } = await import('/client/uiStateReactor.js');
    subscribeUIManager();

    this.log('UI infrastructure initialized.');
    this.services.eventBus.emit('ui:initialized');
    lifecycleManager.emit(LifecycleEvents.BOOTSTRAP_UI_INFRASTRUCTURE_READY);
  }

  async initAuth() {
    this.log('Initializing authentication...');
    const { authThunks } = await import('/client/store/slices/authSlice.js');
    
    this.authLoginListener = ({ username, password }) => {
        this.log(`[AUTH] Received auth:loginRequested for user: ${username}`);
        this.services.appStore.dispatch(authThunks.login({ username, password }));
    };
    
    this.services.eventBus.on('auth:loginRequested', this.authLoginListener);
    
    const authResult = await this.services.appStore.dispatch(authThunks.checkAuth());
    
    // Verify auth state is properly set
    const authState = this.services.appStore.getState().auth;
    this.log(`Authentication check completed. Authenticated: ${authState.isAuthenticated}, User: ${authState.user?.username || 'none'}`);
    
    if (!authState.isAuthenticated) {
      this.log('User is not authenticated. Some features may not work properly.', 'warn');
    }
    
    lifecycleManager.emit(LifecycleEvents.BOOTSTRAP_AUTH_READY);
    lifecycleManager.emit(LifecycleEvents.UI_SAFE_TO_API_CALL);
  }

  async initFeatures() {
    this.log('Initializing feature modules...');
    
    const promises = [
        import('/client/cli/index.js').catch(error => {
            this.log(`CLI module load failed: ${error.message}`, 'error');
        }),
        import('/client/log/LogPanel.js').then(async ({ LogPanel }) => {
            const logPanel = new LogPanel('log-container');
            await logPanel.initialize();
            this.components.logPanel = logPanel;
        })
    ];
    
    await Promise.all(promises);

    this.log('Feature modules initialized.');
    this.services.eventBus.emit('features:initialized');
    lifecycleManager.emit(LifecycleEvents.BOOTSTRAP_FEATURES_READY);
  }

  async finalize() {
    this.log('Finalizing application...');
    this.hideSplashScreen();
    this.log('✅ DevPages Application Initialized Successfully ✅');
    
    lifecycleManager.emit(LifecycleEvents.BOOTSTRAP_COMPLETE);
    lifecycleManager.emit(LifecycleEvents.APP_READY);
    
    if(this.services.eventBus) {
        this.services.eventBus.emit('app:ready');
    }
    
    // Non-critical debug tools
    import('/client/debug-file-loading.js').catch(e => this.log('debug-file-loading failed', 'warn'));
    import('/client/utils/cssPerformanceMonitor.js').catch(e => this.log('cssPerformanceMonitor failed', 'warn'));
  }
  
  async shutdown() {
    this.log('Shutting down application...');
    
    // Unsubscribe UI reactor to prevent state updates on a torn-down UI
    if (this.services.uiStateReactor) {
        this.services.uiStateReactor.unsubscribe();
        this.log('UI State Reactor unsubscribed.');
    }
    
    // Destroy all UI components
    if (this.managers.componentManager) {
        this.managers.componentManager.destroyAll();
        this.log('All UI components destroyed.');
    }
    
    // Clear all event bus listeners
    if (this.services.eventBus) {
        this.services.eventBus.off('auth:loginRequested', this.authLoginListener);
        this.log('Auth listener removed.');
        this.services.eventBus.clearAll();
        this.log('Event bus cleared.');
    }
    
    this.log('Application shutdown complete.');
  }
}

// ====================== EXECUTION ======================
// DISABLED: Old bootstrap system disabled to prevent conflicts with new bootloader.js
// The new bootloader.js system is now the primary initialization method
/*
document.addEventListener('DOMContentLoaded', () => {

  const bootstrapper = new AppBootstrapper(domDependencies);
  
  // Expose a controlled shutdown method on the window
  window.APP_SHUTDOWN = () => bootstrapper.shutdown();
  
  bootstrapper.run();
});
*/ 