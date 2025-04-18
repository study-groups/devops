// bootstrap.js - Streamlined application initialization

// Global namespace to prevent multiple initializations
window.APP = window.APP || {};

// Simple console logging for early bootstrap phases
const logBootstrap = (message, subtype, level="info") => {
  const type = 'BOOTSTRAP';
  const fullType = subtype ? `${type}_${subtype}` : type;
  console.log(`[${fullType}] ${message}`); // Log to console
  if (typeof window.logMessage === 'function') {
    window.logMessage(`${message}`,level, fullType);
  }
};
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
    logBootstrap('Phase 1: Initializing Log System with LogPanel...',"IMPORT");
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
    
    
    logBootstrap('LogPanel initialized and logMessage registered globally.',"IMPORT");

    // --- Initialize Deep Link Handler (Before Authentication) ---
    logBootstrap('Initializing Deep Link Handler...');
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

    // --- Phase 2: Authentication --- 
    logBootstrap('Phase 2: Initializing Authentication...');
    const authModule = await import('/client/auth.js');
    if (typeof authModule.initAuth !== 'function') { // Check for the correct function
         throw new Error('Auth module failed to load or missing initAuth function');
    }
    authModule.initAuth(); // Initialize auth (this will check server status internally)
    logBootstrap('[Auth system initialization triggered.',"AUTH");

    // --- Phase 2.5: Auth Display Component --- 
    logBootstrap('Phase 2.5: Initializing AuthDisplay Component...',"AUTH_DISPLAY");
    try {
        const { createAuthDisplayComponent } = await import('/client/components/AuthDisplay.js');
        const authDisplay = createAuthDisplayComponent('auth-component-container'); // Target the new div
        authDisplay.mount(); // Just call mount
        window.APP = window.APP || {}; // Ensure APP namespace exists
        window.APP.authDisplayComponent = authDisplay; // Optional: make accessible for debugging
        logBootstrap('AuthDisplay Component Mounted.');
    } catch (err) {
        logBootstrap(`Failed to initialize AuthDisplay Component: ${err.message}`, "AUTH_DISPLAY", 'error');
        // Decide if this is critical and should halt bootstrap
        throw err; // Re-throw to halt if critical
    }

    // --- Phase 3: Core UI & Event Bus --- 
    logBootstrap('Phase 3: Initializing UI Manager & Event Bus...');
    const eventBusModule = await import('/client/eventBus.js');
    // Assuming eventBus is exported as 'eventBus'
    window.eventBus = eventBusModule.eventBus; // Optional: Make global if needed

    const uiManagerModule = await import('/client/uiManager.js');
    // Assuming UIManager class is the default export
    if (typeof uiManagerModule.default?.initialize !== 'function') {
        throw new Error('UIManager failed to load or missing initialize function');
    }
    await uiManagerModule.default.initialize();
    logBootstrap('UI Manager initialized.');

    // --- Phase 4: Editor & Preview --- 
    logBootstrap('Phase 4: Initializing ContentView, Editor & Preview...');
    try {
        // Initialize the ContentView component first, which creates the containers
        const { createContentViewComponent } = await import('/client/components/ContentView.js');
        const contentView = createContentViewComponent('content-view-wrapper');
        const mounted = contentView.mount();
        if (!mounted) {
            throw new Error('ContentViewComponent failed to mount.');
        }
        window.APP = window.APP || {}; // Ensure APP namespace exists
        window.APP.contentView = contentView; // Optional: for debugging
        logBootstrap('ContentViewComponent Mounted.');

    } catch (err) {
        logBootstrap(`Failed to initialize ContentViewComponent: ${err.message}`, 'error');
        // Decide if this is critical and should halt bootstrap
        throw err; // Re-throw to halt if critical
    }

    try {
        const editorModule = await import('/client/editor.js');
        if (typeof editorModule.initializeEditor === 'function') {
            await editorModule.initializeEditor();
            logBootstrap('Editor initialized.');
        } else {
            logBootstrap('Editor module loaded but initializeEditor function not found.', 'warning');
        }
    } catch (err) {
        logBootstrap(`Failed to load or initialize Editor: ${err.message}`, 'warning');
    }

    try {
        const previewModule = await import('/client/preview.js');
         if (typeof previewModule.initializePreview === 'function') {
            await previewModule.initializePreview();
            logBootstrap('Preview initialized.');
        } else {
            logBootstrap('Preview module loaded but initializePreview function not found.', 'warning');
        }
    } catch(err) {
        logBootstrap(`Failed to load or initialize Preview: ${err.message}`, 'warning');
    }

    // --- Phase 5: File Manager --- 
    logMessage('[BOOTSTRAP] Phase 5: Initializing File Manager...');
    // REMOVED: Redundant initialization. uiManager.js handles this based on auth state. -> REINSTATE this
    try {
        const fileManagerModule = await import('/client/fileManager.js');
        // Assuming initializeFileManager is a named export now or default export
        let fmInitializer = fileManagerModule.initializeFileManager || fileManagerModule.default?.initializeFileManager;
        if (typeof fmInitializer === 'function') {
            await fmInitializer(); // Let fileManager check auth state internally
            logMessage('[BOOTSTRAP] File Manager initialization triggered.');
        } else {
            logMessage('[BOOTSTRAP ERROR] FileManager loaded but initializeFileManager function not found.', 'error');
        }
    } catch (err) {
         logMessage(`[BOOTSTRAP ERROR] Failed to load or initialize FileManager: ${err.message}`, 'error');
    }

    // --- Phase 6: Additional Components & Event Listeners --- 
    logMessage('Phase 6: Initializing Additional Components...');
    logMessage('communityLink, cli, vieweControls');
    // Use Promise.allSettled for non-critical components to allow them to fail independently
    await Promise.allSettled([
        import('/client/communityLink.js').then(m => m.initCommunityLink?.()),
        import('/client/cli/index.js').then(m => m.initializeCLI?.()),
        import('/client/components/ViewControls.js').then(m => {
            logBootstrap('ViewControls.js module loaded successfully.','debug'); 
            if (typeof m.createViewControlsComponent === 'function') {
                logBootstrap('Found createViewControlsComponent function. Creating and mounting...', 'debug'); 
                const viewControls = m.createViewControlsComponent('view-controls-container');
                viewControls.mount();
                window.APP.viewControlsComponent = viewControls; // Optional debug access
            } else {
                logBootstrap('ERROR: createViewControlsComponent function NOT FOUND in loaded ViewControls.js module!', 'error'); 
            }
        }).catch(err => {
            logBootstrap(`Failed to load ViewControls.js: ${err.message}`, 'error');
        }),
        import('/client/domEvents.js').then(m => {
            logBootstrap('domEvents.js module loaded successfully.', 'debug'); 
            if (typeof m.initializeDomEvents === 'function') {
                logBootstrap('[DEBUG bootstrap.js] Found initializeDomEvents function. Calling it...','debug'); 
                m.initializeDomEvents(); // Call it directly
            } else {
                logBootstrap('[DEBUG bootstrap.js] ERROR: initializeDomEvents function NOT FOUND in loaded domEvents.js module!', 'error'); 
            }
        }).catch(err => {
            // Add catch for the domEvents import specifically
            logBootstrap('ERROR loading domEvents.js module:', 'error'); 
            logBootstrap(`Failed to load domEvents.js: ${err.message}`, 'error');
        }), 
        import('/client/actions.js').then(m => {
            console.log('[DEBUG bootstrap.js] actions.js module loaded successfully.');
             if (typeof m.initializeActions === 'function') {
                 logBootstrap('Found initializeActions function. Calling it...');
                 m.initializeActions();
             } else {
                logBootstrap('initializeActions function NOT FOUND in loaded actions.js module!','error');
             }
        }).catch(err => {
            logBootstrap('ERROR loading actions.js module:', 'error');
            logBootstrap(`Failed to load actions.js: ${err.message}`, 'error');
        }),
        import('/client/debug/index.js').then(() => {
            // The module handles its own global registration under window.dev now
            logBootstrap('Debug module loaded (registers globally under window.dev if in dev mode).');
        }).catch(err => {
            logBootstrap(`Failed to load debug module: ${err.message}`, 'warning');
        })
    ]);
    logBootstrap('Additional components initialization attempted.');

    // --- Phase 7: Initialize Context Manager --- ADDED NEW PHASE
    logBootstrap('Phase 7: Initializing ContextManager Component...');
    try {
        const { createContextManagerComponent } = await import('/client/components/ContextManagerComponent.js');
        const contextManager = createContextManagerComponent('context-manager-container');
        contextManager.mount();
        window.APP.contextManagerComponent = contextManager; // Optional debug access
        logBootstrap('ContextManager Component Mounted.');
    } catch (err) {
        logMessage(`Failed to initialize ContextManager Component: ${err.message}`, 'error');
        // Optionally re-throw if this component is critical
        // throw err;
    }
    // --- END NEW PHASE ---


    logBootstrap('===== APPLICATION INITIALIZATION COMPLETE =====');
    window.eventBus?.emit('app:ready'); // Emit ready event if eventBus exists
    
  } catch (error) {
    bootstrapError('Critical error during bootstrap initialization:', error);
    
    // Display a prominent error message on the page
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed; top:0; left:0; right:0; background:rgba(200,0,0,0.9); color:white; padding:15px; font-family:sans-serif; z-index:9999; text-align:center; border-bottom: 2px solid black;';
    errorDiv.innerHTML = `
      <strong style="font-size: 1.2em;">Initialization Error!</strong> <br>
      ${error.message || 'Unknown error'}
      <br> Check the console (F12) for more details.
      <button onclick="window.location.reload()" style="margin-left:15px; padding: 5px 10px; border: 1px solid white; background: #555; color: white; cursor: pointer;">Reload</button>
    `;
    document.body.appendChild(errorDiv);
  }
}

// Start the initialization process
initializeApp(); 