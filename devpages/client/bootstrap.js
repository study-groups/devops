// bootstrap.js - Streamlined application initialization
import { createTimer } from '/client/utils.js';

// Global namespace to prevent multiple initializations
window.APP = window.APP || {};

// Simple console logging for early bootstrap phases
function logBootstrap(message, level = 'info', type = 'BOOTSTRAP') { // Default level to info
  const fullType = type;
  if (typeof window.logMessage === 'function') {
    // Pass message, level, and type
    window.logMessage(`${message}`,level, fullType);
  } else {
    console.log(`[${fullType}] ${message}`); // Fallback
  }
}
const bootstrapError = (message, error) => console.error(`[BOOTSTRAP ERROR] ${message}`, error);

// Helper function to safely create a timer
function safeCreateTimer(label) {
  try {
    return createTimer(label);
  } catch (e) {
    console.error(`[BOOTSTRAP] Failed to create timer for ${label}:`, e);
    return { 
      end: () => {}, 
      checkpoint: () => {},
      current: () => 0
    };
  }
}

// Create a timer for the entire bootstrap process
const TOTAL_BOOTSTRAP_TIMER = safeCreateTimer('TOTAL BOOTSTRAP TIME');

// ADDED: Import central state and messaging components
import { appStore } from '/client/appState.js';
import { dispatch, setReducer, ActionTypes } from '/client/messaging/messageQueue.js';
import eventBus from '/client/eventBus.js'; // Keep for now for non-state events
import { mainReducer } from '/client/store/reducer.js'; // Import the reducer
import { initAuth } from '/client/auth.js'; // <<< ADDED: Import initAuth

// --- ADD THIS IMPORT --- Ensure previewManager module loads and runs its setup
// import '/client/previewManager.js'; // No longer needed just for side-effects
import { initializePreviewManager } from '/client/previewManager.js'; // Import the new explicit initializer
// -----------------------

// --- Central State Reducer --- 
// REMOVE the mainReducer function definition from here

// Inject the imported reducer into the message queue system
setReducer(mainReducer);
logBootstrap('Main state reducer injected into message queue.', 'debug');

// Main application initialization function
async function initializeApp() {
  if (window.APP.initialized) {
    logBootstrap('Already initialized, skipping.');
    return;
  }
  window.APP.initialized = true; // Set flag immediately
  logBootstrap('===== STARTING APPLICATION BOOTSTRAP =====');

  try {
    // --- Phase 1: Logging --- 
    const logTimer = safeCreateTimer('Phase 1: Log System');
    logBootstrap('Phase 1: Initializing Log System with LogPanel...', 'debug');
    // MODIFIED: Import the LogPanel class directly from its file
    const { LogPanel } = await import('/client/log/LogPanel.js'); // Correct path
    if (!LogPanel) {
         throw new Error('LogPanel class not found in log system');
    }
    // Instantiate LogPanel
    const logPanelInstance = new LogPanel(); // Constructor takes optional container ID
    // Initialize it, targeting the container div
    await logPanelInstance.initialize(); // Initialize method exists on LogPanel instance
    // Make the instance globally accessible
    window.logPanel = logPanelInstance;
    // Set the global logMessage function to use the panel's addEntry method
    // Use bind to ensure 'this' context is correct when called globally
    window.logMessage = logPanelInstance.addEntry.bind(logPanelInstance); 
    
    logBootstrap('LogPanel initialized and logMessage registered globally.', 'debug');

    // *** ADD THIS: Initialize LogManager with FilterManager ***
    logBootstrap('Initializing LogManager with centralized filtering...', 'debug');
    try {
      // Import FilterManager and LogManager
      const FilterManager = await import('/client/settings/FilterManager.js');
      const { LogManager } = await import('/client/log/LogManager.js');
      
      // Load persisted filters
      const allFilters = FilterManager.default.loadAllFilters();
      logBootstrap(`Loaded filters: ${JSON.stringify(allFilters)}`, 'debug');
      
      // Set window.config for legacy code
      window.config = allFilters;
      
      // Create and initialize LogManager
      const logManager = new LogManager();
      logManager.initialize({ filterConfig: allFilters });
      
      // CRITICAL: Expose to window (this creates window.getDiscoveredTypes, window.setIncludeLevels, etc.)
      logManager.exposeToWindow();
      
      // Verify it worked
      logBootstrap(`LogManager exposed. Functions available: getDiscoveredTypes=${typeof window.getDiscoveredTypes}, setIncludeLevels=${typeof window.setIncludeLevels}`, 'debug');
      
    } catch (error) {
      logBootstrap(`Failed to initialize LogManager: ${error.message}`, 'error');
      console.error('[LOGMANAGER INIT ERROR]', error);
    }
    // *** END ADD ***

    logTimer.end();

    // --- Phase 1.5: Initialize Settings Panel System --- 
    const settingsTimer = safeCreateTimer('Phase 1.5: Settings Panel');
    // Moved earlier as it might influence UI/other setups
    logBootstrap('Initializing Settings Panel System...', 'debug');
    try {
      // We will create this file next
      const { initializeSettingsPanel } = await import('/client/settings/settingsInitializer.js'); 
      if (typeof initializeSettingsPanel === 'function') {
        await initializeSettingsPanel(); // Initialize the settings panel and store interactions
        logBootstrap('Settings Panel System initialized.', 'debug');
      } else {
          logBootstrap('settingsInitializer.js loaded but initializeSettingsPanel not found.', 'error');
      }
    } catch (error) {
      logBootstrap(`Failed to initialize Settings Panel System: ${error.message}`, 'error');
      console.error('[SETTINGS PANEL INIT ERROR]', error);
    }
    settingsTimer.end();

    // --- Initialize Deep Link Handler (Before Authentication) ---
    const deepLinkTimer = safeCreateTimer('Phase 2: Deep Link Handler');
    logBootstrap('Initializing Deep Link Handler...', 'info');
    try {
      const deepLinkModule = await import('/client/deepLink.js');
      if (typeof deepLinkModule.initDeepLinkHandler === 'function') {
        deepLinkModule.initDeepLinkHandler();
        logBootstrap('Deep Link Handler initialized.');
      } else {
        logBootstrap('Deep Link Handler module loaded but initDeepLinkHandler function not found.', 'warning');
      }
    } catch (error) {
      logBootstrap(`Failed to initialize Deep Link Handler: ${error.message}`, 'warning');
      console.error('[DEEP LINK ERROR]', error);
    }
    deepLinkTimer.end();

    // --- Initialize Authentication ---
    const authTimer = safeCreateTimer('Phase 3: Authentication');
    logBootstrap('Initializing Authentication System...', 'debug'); // Simplified log
    try {
        initAuth(); // <<< ADDED: Call initAuth directly
        logBootstrap('Authentication system initialization triggered.');
    } catch (authError) {
         // This catch block might be less relevant now if initAuth itself doesn't throw
         // but handles errors internally by updating appStore.auth.error.
         logBootstrap(`Authentication initialization failed: ${authError.message}`, 'error');
         // Optionally dispatch an error state if initAuth failed catastrophically
         // appStore.update(s => ({ ...s, auth: { ...s.auth, isInitializing: false, error: authError.message }}));
    }
    authTimer.end();

    // --- Phase 3.5: Initialize UI Components (Before UI Manager) ---
    const uiComponentsTimer = safeCreateTimer('Phase 3.5: UI Components');
    logBootstrap('Phase 3.5: Initializing UI Components (Popups, Modals, etc.)...', 'debug');
    try {
        const { initializeUIComponents } = await import('/client/components/uiComponentsManager.js');
        await initializeUIComponents();
        logBootstrap('UI Components initialized.', 'debug');
    } catch (error) {
        logBootstrap(`Failed to initialize UI Components: ${error.message}`, 'error');
        console.error('[UI COMPONENTS INIT ERROR]', error);
    }
    uiComponentsTimer.end();

    // --- Phase 4: Initialize Core UI Manager (Can now react to appStore.auth changes) ---
    const uiTimer = safeCreateTimer('Phase 4: UI Manager');
    logBootstrap('Phase 4: Initializing UI Manager via uiManager.js...', 'debug'); 
    try {
        // Import initializeUI from uiManager.js
        const { initializeUI } = await import('/client/uiManager.js'); 
        
        if (typeof initializeUI === 'function') {
            await initializeUI(); // Call the main UI initializer
            logBootstrap('uiManager.initializeUI() called successfully.', 'debug');
        } else {
            // This error means uiManager.js was loaded, but initializeUI wasn't found/exported
            throw new Error('initializeUI function not found in /client/uiManager.js');
        }
    } catch (error) {
        // This catch block will handle errors from importing uiManager.js OR errors from within initializeUI()
        logBootstrap(`Failed to initialize UI Manager: ${error.message}`, 'error');
        console.error('[UI Manager ERROR]', error); 
    }
    uiTimer.end();

    // --- Phase 5: Initialize File Manager (Depends on Auth and UI) ---
    // Now likely triggered by state changes in appStore.auth or appStore.ui
    const fileManagerTimer = safeCreateTimer('Phase 5: File Manager');
    logBootstrap('Phase 5: FileManager initialization delegated to state changes.', 'info');
    // May need an init function in fileManager.js to set up its subscriptions
    try {
        const { initializeFileManager } = await import('/client/filesystem/fileManager.js');
        if (typeof initializeFileManager === 'function') {
            initializeFileManager(); // Sets up listeners
            logBootstrap('FileManager listeners setup.', 'debug');
        } else {
             logBootstrap('FileManager module loaded, but initializeFileManager not found. Assuming listeners setup on import.', 'warning');
        }
    } catch(error) {
        logBootstrap(`Failed to setup FileManager listeners: ${error.message}`, 'error');
        console.error('[FILEMANAGER SETUP ERROR]', error);
    }
    fileManagerTimer.end();

    // --- Phase 6: Initialize Other Components/Modules ---
    const otherComponentsTimer = safeCreateTimer('Phase 6: Other Components');
    logBootstrap('Phase 6: Initializing Actions, Editor, Preview, etc...', 'debug');
    // These modules will also increasingly rely on dispatching actions and subscribing to appStore
    
    // Initialize Preview Manager (depends on #preview-container being ready from initializeUI)
    const previewTimer = safeCreateTimer('Phase 6.1: Preview Manager');
    logBootstrap('Initializing Preview Manager...', 'debug');
    try {
        await initializePreviewManager();
        logBootstrap('Preview Manager initialized.', 'debug');
    } catch (error) {
        logBootstrap(`Failed to initialize Preview Manager: ${error.message}`, 'error');
        console.error('[PREVIEW MANAGER INIT ERROR]', error);
    }
    previewTimer.end();

    // Actions (Listens for events from UI components, might dispatch actions)
    const actionsTimer = safeCreateTimer('Phase 6.2: Actions');
    try {
        const actionsModule = await import('/client/actions.js');
        if (typeof actionsModule.initializeActions === 'function') {
            actionsModule.initializeActions(); // May set up listeners/dispatchers
            logBootstrap('Action handlers initialized.', 'debug');
        } else {
             logBootstrap('actions.js loaded but initializeActions not found.', 'error');
        }
    } catch (error) {
        logBootstrap(`Failed to initialize Actions: ${error.message}`, 'error');
        console.error('[ACTIONS INIT ERROR]', error);
    }
    actionsTimer.end();
    
    // Editor (Will dispatch EDITOR_CONTENT_CHANGED, subscribe to file changes, etc.)
    const editorTimer = safeCreateTimer('Phase 6.3: Editor');
    try {
         const editorModule = await import('/client/editor.js');
         if (typeof editorModule.initializeEditor === 'function') {
             editorModule.initializeEditor(); // Initialize the editor, setup subscriptions/dispatchers
             logBootstrap('Editor initialized.', 'debug');
         } else {
             logBootstrap('editor.js loaded but initializeEditor not found.', 'error');
         }
     } catch (error) {
         logBootstrap(`Failed to initialize Editor: ${error.message}`, 'error');
         console.error('[EDITOR INIT ERROR]', error);
     }
     editorTimer.end();
     
    // DOM event listeners (May dispatch actions based on global events)
    try {
        const domEventsModule = await import('/client/domEvents.js');
        if (typeof domEventsModule.initializeDomEvents === 'function') {
             domEventsModule.initializeDomEvents();
             logBootstrap('DOM Event Listeners initialized.', 'debug');
        } else {
             logBootstrap('domEvents.js loaded but initializeDomEvents not found.', 'error');
        }
    } catch (error) {
        logBootstrap(`Failed to initialize DOM Event Listeners: ${error.message}`, 'error');
        console.error('[DOM EVENTS INIT ERROR]', error);
    }
    
    // CLI handler (Dispatches commands as actions? Subscribes to log panel input)
    try {
        const cliModule = await import('/client/cli/index.js');
        if (typeof cliModule.initializeCLI === 'function') {
            cliModule.initializeCLI();
            logBootstrap('CLI system initialized.', 'debug');
        } else {
            logBootstrap('cli/index.js loaded but initializeCLI not found.', 'error');
        }
    } catch(error) {
        logBootstrap(`Failed to initialize CLI: ${error.message}`, 'error');
        console.error('[CLI INIT ERROR]', error);
    }

    // Initialize keyboard shortcuts (Dispatches actions like SETTINGS_PANEL_TOGGLE)
    try {
        const shortcutsModule = await import('/client/keyboardShortcuts.js');
        if (typeof shortcutsModule.initKeyboardShortcuts === 'function') { 
            shortcutsModule.initKeyboardShortcuts(); // Setup listeners that dispatch actions
            logBootstrap('Keyboard shortcuts initialized.', 'debug');
        } else {
            logBootstrap('keyboardShortcuts.js loaded but initKeyboardShortcuts not found.', 'error'); 
        }
    } catch (error) {
        logBootstrap(`Failed to initialize Keyboard Shortcuts: ${error.message}`, 'error');
        console.error('[SHORTCUTS INIT ERROR]', error);
    }
    
    otherComponentsTimer.end();
    
    logBootstrap('===== APPLICATION BOOTSTRAP COMPLETE =====', 'info');
    
    // Final event indicating app structure is ready (modules should be listening to appStore now)
    eventBus.emit('app:ready');
    logBootstrap('app:ready event emitted.', 'info');

  } catch (error) {
    logBootstrap(`CRITICAL BOOTSTRAP ERROR: ${error.message}`, 'error');
    console.error('CRITICAL BOOTSTRAP ERROR', error);
    // Display a user-friendly error message on the page?
    document.body.innerHTML = `
<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">
  <h2>Application Failed to Load</h2>
  <p>A critical error occurred during startup. Please check the console for details or contact support.</p>
</div>`;
  } finally {
    TOTAL_BOOTSTRAP_TIMER.end();
    logBootstrap('===== APPLICATION BOOTSTRAP COMPLETE =====', 'info');
  }
}

// Start the initialization process
initializeApp().catch(error => {
    bootstrapError('Critical error during application initialization.', error);
    // Optionally display a user-friendly error message on the page
});

// --- DOM Ready Listener ---
if (document.readyState === 'loading') { 
  // If the DOM hasn't finished loading, wait for it
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOMContentLoaded has already fired, initialize immediately
  initializeApp();
} 

// Add a listener for appStore changes for debugging purposes (optional)
appStore.subscribe((newState, prevState) => {
  // console.debug('[AppState Change]', { prevState, newState }); // ❌ Comment out
  // Only log significant changes
  if (prevState.auth !== newState.auth) {
    console.log('[AppState] Auth changed');
  }
}); 

async function initializeUI() {
  // Load saved application state from localStorage
  try {
    const savedAppState = localStorage.getItem('devpages_app_state');
    if (savedAppState) {
      const parsedState = JSON.parse(savedAppState);
      
      // Apply UI states immediately
      if (parsedState.settingsPanel && parsedState.settingsPanel.visible) {
        document.getElementById('settings-panel').classList.add('visible');
        console.log('[Bootstrap] Restored settings panel visible state');
      }
      
      // Apply to appStore (assuming you have appStore.setInitialState or similar)
      appStore.update(state => ({
        ...state,
        settingsPanel: parsedState.settingsPanel || state.settingsPanel
      }));
    }
  } catch (e) {
    console.error('[Bootstrap] Error restoring app state:', e);
  }
} 

async function loadSettingsPanelState() {
  try {
    const savedState = localStorage.getItem('devpages_settings_panel_state');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      dispatch({ type: ActionTypes.SETTINGS_PANEL_SET_STATE, payload: parsed });
    }
  } catch (e) {
    console.error('[Bootstrap] Failed to load settings panel state:', e);
  }
}

// Call this right after initializing the settings panel
await loadSettingsPanelState(); 