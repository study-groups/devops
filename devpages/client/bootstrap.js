// bootstrap.js - Synchronous Application Initialization
import { AppInitializer } from './AppInitializer.js';
import { logMessage } from '/client/log/index.js';
import '/client/log/LogCore.js';
import { ConsoleLogManager } from '/client/log/ConsoleLogManager.js';

// Window consolidation - must be imported early
import '/client/utils/windowConsolidation.js';

// Reducer & State
import { mainReducer } from '/client/store/reducer.js';
import { dispatch, setReducer } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { appStore } from './appState.js';

// UI & Panel Managers
import { initializeUIComponents } from '/client/components/uiComponentsManager.js';
import { subscribeUIManager } from '/client/uiManager.js';

// UI Component Creators
import { createAuthDisplayComponent } from '/client/components/AuthDisplay.js';
import { createContextManagerComponent } from '/client/components/ContextManagerComponent.js';
import { createViewControlsComponent } from '/client/components/ViewControls.js';
import { createContentViewComponent } from '/client/components/ContentView.js';
import { Editor } from '/client/components/Editor.js';

// Feature Initializers - These are now dynamically imported by AppInitializer
// We might keep some key imports if they are needed for event listeners here.

// Publish Modal Integration
import { initializePublishModalIntegration } from '/client/components/PublishModalIntegration.js';

// Debug utilities (development only)
import '/client/settings/utils/debug-panels.js';

// Migration helper utilities
import '/client/utils/migrationHelper.js';

// Load editor-specific styles
const editorStylesLink = document.createElement('link');
editorStylesLink.rel = 'stylesheet';
editorStylesLink.href = '/client/styles/editor.css';
document.head.appendChild(editorStylesLink);

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

async function initializeApp() {
    // The new AppInitializer handles the entire startup sequence.
    const initializer = new AppInitializer();

    // Listen for the final events from the initializer.
    window.eventBus.on('app:ready', () => {
        logBootstrap('Application initialization complete.');
        
        // Final UI sync after all components are initialized
        new Editor(document.getElementById('editor-container')); // Editor needs to be initialized after its container is created
        initializePublishModalIntegration();
        subscribeUIManager();
        dispatch({ type: ActionTypes.UI_APPLY_INITIAL_STATE });
        logBootstrap('UIManager subscribed and final state synced.');
        
        // Hide splash screen on successful initialization
        setTimeout(() => hideSplashScreen(), 100);
    });

    window.eventBus.on('app:failed', (error) => {
        logBootstrap(`Initialization failed: ${error.message}`, 'error');
        // Still hide splash screen to show any potential error messages in the UI
        hideSplashScreen();
    });

    // Start the initialization process.
    await initializer.start();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // We need to ensure eventBus is ready before we call initializeApp
    import('/client/eventBus.js').then(({ eventBus }) => {
        window.eventBus = eventBus;
        initializeApp();
    }).catch(err => {
        console.error("Failed to load eventBus, cannot start application.", err);
    });
} 