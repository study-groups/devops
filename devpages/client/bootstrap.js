// bootstrap.js - Synchronous Application Initialization
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

// Feature Initializers
import { LogPanel } from '/client/log/LogPanel.js';
import { initAuth } from '/client/auth.js';
import { initializeFileManager } from '/client/filesystem/fileManager.js';
import { initializeSettingsPanel } from '/client/settings/core/settingsInitializer.js';
import { initializeDomInspector } from '/client/dom-inspector/domInspectorInitializer.js';
import { initKeyboardShortcuts } from '/client/keyboardShortcuts.js';
import { triggerActions } from '/client/actions.js';
import { initializeCLI } from '/client/cli/index.js';

// Publish Modal Integration - replaces ugly alerts with user-friendly modal
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
        
        // Early initialization for Dev Tools
        try {
            logBootstrap('Early Initializing DOM inspector...');
            const domInspectorInstance = initializeDomInspector();
            if (domInspectorInstance) {
                logBootstrap('DOM Inspector initialized successfully');
                console.log('[DOM INSPECTOR] Instance created and available at window.devPages.domInspector');
            } else {
                console.error('[DOM INSPECTOR] Initialization returned null/undefined');
            }
            
            logBootstrap('Early Initializing keyboard shortcuts...');
            initKeyboardShortcuts();
            logBootstrap('DOM Inspector and shortcuts initialized early.');
        } catch (error) {
            console.error('[BOOTSTRAP] Early dev tools initialization failed:', error);
            logBootstrap(`Early dev tools initialization failed: ${error.message}`, 'error');
            // Log the full stack trace for debugging
            console.error('[BOOTSTRAP] Full error details:', error.stack);
        }

        // ADDED: Ensure eventBus is available for immediate use
        if (!window.eventBus) {
            throw new Error('EventBus failed to initialize properly');
        }
        
        setReducer(mainReducer);
        
        // Panel states will be initialized after dynamic loading in SettingsPanel.loadPanels()
        logBootstrap('Reducer set, ready for dynamic panel loading.');
    
        
        // Expose triggerActions globally for publish button and other components
        window.triggerActions = triggerActions;
        
        logBootstrap('Core services (Logging, EventBus, Reducer, Actions) initialized.');

        // 2. Initialize Publish Modal Integration (must happen after triggerActions is exposed)
        initializePublishModalIntegration();
        logBootstrap('Publish modal integration initialized (replaces alert dialogs).');

        // 3. Foundational UI Managers
        await initializeUIComponents();
        logBootstrap('UI Component Manager (popups, etc.) initialized.');
        
        // Initialize workspace panel manager instead of old panel system
        const { workspacePanelManager } = await import('/client/layout/WorkspacePanelManager.js');
        window.workspacePanelManager = workspacePanelManager;
        logBootstrap('Workspace Panel Manager (three-panel layout) initialized.');

        // Initialize the panel system that manages editor, preview, etc.
        const { PanelUIManager } = await import('/client/panels/layout/PanelUIManager.js');
        const panelUIManager = new PanelUIManager();
        await panelUIManager.initialize();
        window.panelUIManager = panelUIManager; // Expose globally for access
        logBootstrap('Panel UI Manager (for editor, preview panels) initialized.');

        // 4. Mount Static UI Components
        createAuthDisplayComponent('auth-component-container').mount();
        createContextManagerComponent('context-manager-container').mount();
        createViewControlsComponent('view-controls-container').mount();
        new Editor(document.getElementById('editor-container'));
        logBootstrap('Static header/control components mounted.');
        
        // 5. Mount Content View (which creates preview container content)
        const previewContainer = document.querySelector('.preview-container');
        if (!previewContainer) {
            throw new Error('Preview container not found');
        }
        const contentView = createContentViewComponent(previewContainer);
        contentView.mount();
        window.APP = { contentView };
        logBootstrap('Content View component mounted to preview container.');

        // 6. Initialize Other Feature Modules
        try {
            logBootstrap('Initializing settings panel...');
            const settingsResult = await initializeSettingsPanel();
            logBootstrap(`Settings panel initialized. Result: ${!!settingsResult}`);
            logBootstrap(`window.devPages.settingsPanel exists: ${!!(window.devPages && window.devPages.settingsPanel)}`);
        } catch (error) {
            logBootstrap(`Settings panel initialization failed: ${error.message}`, 'error');
            console.error('[BOOTSTRAP] Settings panel error:', error);
        }
        
        await new LogPanel().initialize();
        
        // Initialize CLI after LogPanel to ensure CLI input elements exist
        try {
            logBootstrap('Initializing CLI...');
            await initializeCLI();
            logBootstrap('CLI initialized successfully.');
        } catch (error) {
            logBootstrap(`CLI initialization failed: ${error.message}`, 'error');
            console.error('[BOOTSTRAP] CLI initialization error:', error);
        }
        
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