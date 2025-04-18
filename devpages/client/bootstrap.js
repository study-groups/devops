// bootstrap.js - Streamlined application initialization

// Global namespace to prevent multiple initializations
window.APP = window.APP || {};

import { eventBus } from '/client/eventBus.js'; // ADDED: Import eventBus

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

    // --- Initialize Deep Link Handler (Before Authentication) ---
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

    // --- Initialize Authentication ---
    logBootstrap('Initializing Authentication System...', 'debug');
    try {
      const authModule = await import('/client/auth.js');
      // CORRECTED: Use default export
      if (typeof authModule.default?.initAuth === 'function') { 
        await authModule.default.initAuth(); // Call function from default export
        logBootstrap('Authentication system initialized.', 'debug');
      } else {
        logBootstrap('Authentication module loaded but initAuth function not found on default export.', 'error'); // Updated error message
      }
    } catch (error) {
      logBootstrap(`Failed to initialize Authentication: ${error.message}`, 'error');
      console.error('[AUTH INIT ERROR]', error);
    }

    // --- Phase 4: Initialize Core UI Manager --- 
    logBootstrap('Phase 4: Initializing UI Manager...', 'debug');
    try {
        // MODIFIED: Import the named export initializeUI
        const { initializeUI } = await import('/client/uiManager.js'); 
        if (typeof initializeUI === 'function') {
             await initializeUI(); // Call the correct initialization function
             logBootstrap('UI Manager initialized via initializeUI().', 'debug');
        } else {
             throw new Error('initializeUI function not found in uiManager.js');
        }
    } catch (error) {
        logBootstrap(`Failed to initialize UI Manager: ${error.message}`, 'error');
        console.error('[UI Manager ERROR]', error);
    }

    // --- Phase 5: Initialize File Manager (Depends on Auth and UI) --- 
    // Moved AFTER UI Manager initialization, but initialization is now triggered
    // by auth state changes handled within uiManager/handleAppStateChange.
    // No explicit call needed here anymore.
    logBootstrap('Phase 5: FileManager initialization delegated to state changes.', 'info');

    // --- Phase 6: Initialize Other Components/Modules ---
    logBootstrap('Phase 6: Initializing Actions, Editor, Preview, etc...', 'debug');
    // Actions (Listens for events from UI components)
    try {
        const actionsModule = await import('/client/actions.js');
        if (typeof actionsModule.initializeActions === 'function') {
            actionsModule.initializeActions();
            logBootstrap('Action handlers initialized.', 'debug');
        } else {
             logBootstrap('actions.js loaded but initializeActions not found.', 'error');
        }
    } catch (error) {
        logBootstrap(`Failed to initialize Actions: ${error.message}`, 'error');
        console.error('[ACTIONS INIT ERROR]', error);
    }
    
    // Editor 
    try {
         const editorModule = await import('/client/editor.js');
         if (typeof editorModule.initializeEditor === 'function') {
             editorModule.initializeEditor(); // Initialize the editor
             logBootstrap('Editor initialized.', 'debug');
         } else {
             logBootstrap('editor.js loaded but initializeEditor not found.', 'error');
         }
     } catch (error) {
         logBootstrap(`Failed to initialize Editor: ${error.message}`, 'error');
         console.error('[EDITOR INIT ERROR]', error);
     }
     
    // Preview Manager (Depends on Editor)
    try {
        const previewManagerModule = await import('/client/previewManager.js');
        if (typeof previewManagerModule.initializePreview === 'function') {
            await previewManagerModule.initializePreview();
            logBootstrap('Preview Manager initialized.', 'debug');
        } else {
             logBootstrap('previewManager.js loaded but initializePreview not found.', 'error');
        }
    } catch (error) {
        logBootstrap(`Failed to initialize Preview Manager: ${error.message}`, 'error');
        console.error('[PREVIEW INIT ERROR]', error);
    }
    
    // Initialize DOM event listeners (e.g., global click handler)
    try {
        const domEventsModule = await import('/client/domEvents.js');
        // CORRECTED: Check for initializeDomEvents (was already correct)
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
    
    // Initialize CLI handler (attaches to log panel input)
    try {
        const cliModule = await import('/client/cli/index.js');
        // CORRECTED: Use initializeCLI
        if (typeof cliModule.initializeCLI === 'function') { 
            cliModule.initializeCLI();
            logBootstrap('CLI system initialized.', 'debug');
        } else {
            logBootstrap('cli/index.js loaded but initializeCLI not found.', 'error'); // Updated error message
        }
    } catch(error) {
        logBootstrap(`Failed to initialize CLI: ${error.message}`, 'error');
        console.error('[CLI INIT ERROR]', error);
    }

    // Initialize keyboard shortcuts
    try {
        const shortcutsModule = await import('/client/keyboardShortcuts.js');
        if (typeof shortcutsModule.initKeyboardShortcuts === 'function') {
            shortcutsModule.initKeyboardShortcuts();
            logBootstrap('Keyboard shortcuts initialized.', 'debug');
        } else {
            logBootstrap('keyboardShortcuts.js loaded but initKeyboardShortcuts not found.', 'error');
        }
    } catch (error) {
        logBootstrap(`Failed to initialize Keyboard Shortcuts: ${error.message}`, 'error');
        console.error('[SHORTCUTS INIT ERROR]', error);
    }
    
    logBootstrap('===== APPLICATION BOOTSTRAP COMPLETE =====', 'info');
    
    // Final event indicating app is ready
    eventBus.emit('app:ready');

  } catch (error) {
    logBootstrap(`CRITICAL BOOTSTRAP ERROR: ${error.message}`, 'error');
    console.error('CRITICAL BOOTSTRAP ERROR', error);
    // Display a user-friendly error message on the page?
    document.body.innerHTML = `
<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">
  <h2>Application Failed to Load</h2>
  <p>A critical error occurred during startup. Please check the console for details or contact support.</p>
</div>`;
  }
}

// Start the initialization process
initializeApp(); 

// --- DOM Ready Listener ---
if (document.readyState === 'loading') { 
  // If the DOM hasn't finished loading, wait for it
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOMContentLoaded has already fired, initialize immediately
  initializeApp();
} 