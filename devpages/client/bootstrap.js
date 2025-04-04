// bootstrap.js - Streamlined application initialization

// Global namespace to prevent multiple initializations
window.APP = window.APP || {};

// Simple console logging for early bootstrap phases
const bootstrapLog = (message) => console.log(`[BOOTSTRAP] ${message}`);
const bootstrapError = (message, error) => console.error(`[BOOTSTRAP ERROR] ${message}`, error);

// Main application initialization function
async function initializeApp() {
  if (window.APP.initialized) {
    bootstrapLog('Already initialized, skipping.');
    return;
  }
  window.APP.initialized = true; // Set flag immediately
  bootstrapLog('===== STARTING APPLICATION BOOTSTRAP =====');

  try {
    // --- Phase 1: Logging --- 
    bootstrapLog('Phase 1: Initializing Log System with LogPanel...');
    // Import the LogPanel class
    const { LogPanel } = await import('/client/log/index.js');
    if (!LogPanel) {
         throw new Error('LogPanel class not found in log system');
    }
    // Instantiate LogPanel
    const logPanelInstance = new LogPanel();
    // Initialize it, targeting the container div
    await logPanelInstance.initialize('log-container'); 
    // Make the instance globally accessible
    window.logPanel = logPanelInstance;
    // Set the global logMessage function to use the panel's addEntry method
    // Use bind to ensure 'this' context is correct when called globally
    window.logMessage = logPanelInstance.addEntry.bind(logPanelInstance); 
    
    logMessage('[BOOTSTRAP] LogPanel initialized and logMessage registered globally.');

    // --- Phase 2: Authentication --- 
    logMessage('[BOOTSTRAP] Phase 2: Initializing Authentication...');
    const authModule = await import('/client/auth.js');
    if (typeof authModule.initAuth !== 'function') { // Check for the correct function
         throw new Error('Auth module failed to load or missing initAuth function');
    }
    authModule.initAuth(); // Initialize auth (this will check server status internally)
    logMessage('[BOOTSTRAP] Auth system initialization triggered.');

    // --- Phase 3: Core UI & Event Bus --- 
    logMessage('[BOOTSTRAP] Phase 3: Initializing UI Manager & Event Bus...');
    const eventBusModule = await import('/client/eventBus.js');
    // Assuming eventBus is exported as 'eventBus'
    window.eventBus = eventBusModule.eventBus; // Optional: Make global if needed

    const uiManagerModule = await import('/client/uiManager.js');
    // Assuming UIManager class is the default export
    if (typeof uiManagerModule.default?.initialize !== 'function') {
        throw new Error('UIManager failed to load or missing initialize function');
    }
    await uiManagerModule.default.initialize();
    logMessage('[BOOTSTRAP] UI Manager initialized.');

    // --- Phase 4: Editor & Preview --- 
    logMessage('[BOOTSTRAP] Phase 4: Initializing Editor & Preview...');
    try {
        const editorModule = await import('/client/editor.js');
        if (typeof editorModule.initializeEditor === 'function') {
            await editorModule.initializeEditor();
            logMessage('[BOOTSTRAP] Editor initialized.');
        } else {
             logMessage('[BOOTSTRAP WARNING] Editor module loaded but initializeEditor function not found.', 'warning');
        }
    } catch (err) {
        logMessage(`[BOOTSTRAP WARNING] Failed to load or initialize Editor: ${err.message}`, 'warning');
    }

    try {
        const previewModule = await import('/client/preview.js');
         if (typeof previewModule.initializePreview === 'function') {
            await previewModule.initializePreview();
            logMessage('[BOOTSTRAP] Preview initialized.');
        } else {
            logMessage('[BOOTSTRAP WARNING] Preview module loaded but initializePreview function not found.', 'warning');
        }
    } catch(err) {
        logMessage(`[BOOTSTRAP WARNING] Failed to load or initialize Preview: ${err.message}`, 'warning');
    }

    // --- Phase 5: File Manager --- 
    logMessage('[BOOTSTRAP] Phase 5: Initializing File Manager...');
    try {
        const fileManagerModule = await import('/client/fileManager.js');
        if (typeof fileManagerModule.initializeFileManager === 'function') {
            await fileManagerModule.initializeFileManager(); // Let fileManager check auth state internally
            logMessage('[BOOTSTRAP] File Manager initialization triggered.');
        } else {
            logMessage('[BOOTSTRAP ERROR] FileManager loaded but initializeFileManager function not found.', 'error');
        }
    } catch (err) {
         logMessage(`[BOOTSTRAP ERROR] Failed to load or initialize FileManager: ${err.message}`, 'error');
    }

    // --- Phase 6: Additional Components & Event Listeners --- 
    logMessage('[BOOTSTRAP] Phase 6: Initializing Additional Components...');
    // Use Promise.allSettled for non-critical components to allow them to fail independently
    await Promise.allSettled([
        import('/client/communityLink.js').then(m => m.initCommunityLink?.()),
        import('/client/cli/index.js').then(m => m.initializeCLI?.()),
        import('/client/domEvents.js').then(m => m.initializeDomEvents?.()),
        import('/client/actions.js').then(m => m.initializeActions?.()),
        import('/client/debug/index.js').then(() => {
            // The module handles its own global registration under window.dev now
             logMessage('[BOOTSTRAP] Debug module loaded (registers globally under window.dev if in dev mode).');
        }).catch(err => {
            logMessage(`[BOOTSTRAP WARNING] Failed to load debug module: ${err.message}`, 'warning');
        })
    ]);
    logMessage('[BOOTSTRAP] Additional components initialization attempted.');


    logMessage('[BOOTSTRAP] ===== APPLICATION INITIALIZATION COMPLETE =====');
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