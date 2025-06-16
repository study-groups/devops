// bootstrap.js - Synchronous Application Initialization
import { logMessage } from '/client/log/index.js';
import '/client/log/LogCore.js';
import { ConsoleLogManager } from '/client/log/ConsoleLogManager.js';

// Reducer & State
import { mainReducer } from '/client/store/reducer.js';
import { setReducer, dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

// UI & Panel Managers
import { initializeUIComponents } from '/client/components/uiComponentsManager.js';
import { PanelUIManager } from '/client/panels/layout/PanelUIManager.js';
import { subscribeUIManager } from '/client/uiManager.js';

// UI Component Creators
import { createAuthDisplayComponent } from '/client/components/AuthDisplay.js';
import { createContextManagerComponent } from '/client/components/ContextManagerComponent.js';
import { createViewControlsComponent } from '/client/components/ViewControls.js';
import { createContentViewComponent } from '/client/components/ContentView.js';

// Feature Initializers
import { LogPanel } from '/client/log/LogPanel.js';
import { initAuth } from '/client/auth.js';
import { initializeFileManager } from '/client/filesystem/fileManager.js';
import { initializeSettingsPanel } from '/client/settings/settingsInitializer.js';
import { initKeyboardShortcuts } from '/client/keyboardShortcuts.js';
import { triggerActions } from '/client/actions.js';

// Publish Modal Integration - replaces ugly alerts with user-friendly modal
import { initializePublishModalIntegration } from '/client/components/PublishModalIntegration.js';

// Panel Registry for settings panels
import { panelRegistry } from '/client/settings/panelRegistry.js';

function logBootstrap(message, level = 'info') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, 'BOOTSTRAP');
    } else {
        console.log(`[BOOTSTRAP] ${message}`);
    }
}

function hideSplashScreen() {
    const splash = document.getElementById('devpages-splash');
    const body = document.body;
    
    if (splash && body) {
        // Remove splash-active class to show main content
        body.classList.remove('splash-active');
        
        // Hide splash with fade animation
        splash.classList.add('hidden');
        
        // Remove splash element after animation completes
        setTimeout(() => {
            if (splash.parentNode) {
                splash.parentNode.removeChild(splash);
            }
        }, 300);
        
        logBootstrap('Splash screen hidden, main interface visible');
    }
}

async function initializeApp() {
    try {
        logBootstrap('Starting synchronous application initialization...');

        // 1. Core Services
        new ConsoleLogManager().initialize().exposeToWindow();
        const { eventBus } = await import('/client/eventBus.js');
        window.eventBus = eventBus;
        setReducer(mainReducer);
        
        // Initialize panel states now that reducer is ready
        panelRegistry.initializeAllPanelStates();
        logBootstrap('Panel registry states initialized.');
        
        // Load designer theme system
        const designerStylesLink = document.createElement('link');
        designerStylesLink.rel = 'stylesheet';
        designerStylesLink.href = '/client/styles/designer-system.css';
        designerStylesLink.id = 'designer-system-styles';
        document.head.appendChild(designerStylesLink);
        logBootstrap('Designer theme system loaded.');
        
        // Expose triggerActions globally for publish button and other components
        window.triggerActions = triggerActions;
        
        logBootstrap('Core services (Logging, EventBus, Reducer, Actions) initialized.');

        // 2. Initialize Publish Modal Integration (must happen after triggerActions is exposed)
        initializePublishModalIntegration();
        logBootstrap('Publish modal integration initialized (replaces alert dialogs).');

        // 3. Foundational UI Managers
        await initializeUIComponents();
        logBootstrap('UI Component Manager (popups, etc.) initialized.');
        
        const panelUIManager = new PanelUIManager();
        await panelUIManager.initialize();
        window.panelUIManager = panelUIManager; // Expose globally if needed
        logBootstrap('Panel UI Manager (sidebars, frame) initialized.');

        // 4. Mount Static UI Components
        createAuthDisplayComponent('auth-component-container').mount();
        createContextManagerComponent('context-manager-container').mount();
        createViewControlsComponent('view-controls-container').mount();
        logBootstrap('Static header/control components mounted.');
        
        // 5. Mount Content View (which creates editor/preview containers)
        const contentView = createContentViewComponent('content-view-wrapper');
        contentView.mount();
        window.APP = { contentView };
        logBootstrap('Content View component mounted.');

        // 6. Initialize Other Feature Modules
        initializeSettingsPanel();
        initKeyboardShortcuts();
        await new LogPanel().initialize();
        initAuth();
        await initializeFileManager();
        logBootstrap('Remaining feature modules initialized.');

        // 7. Activate UI State Management & Sync
        subscribeUIManager();
        dispatch({ type: ActionTypes.UI_APPLY_INITIAL_STATE });
        logBootstrap('UIManager subscribed and initial state synced.');
        
        logBootstrap('Application initialization complete.');

        // Small delay to ensure all components are fully rendered before hiding splash
        setTimeout(() => {
            hideSplashScreen();
        }, 100);

    } catch (error) {
        console.error('Application initialization failed:', error);
        logBootstrap(`Initialization failed: ${error.message}`, 'error');
        
        // Hide splash screen even on error so user can see the interface
        hideSplashScreen();
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
} 