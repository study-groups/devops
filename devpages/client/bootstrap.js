// bootstrap.js - Minimal script to control initialization sequence

// Create global namespace to control initialization
window.APP = {
  initialized: false,
  initializing: false,
  initFailed: false
};

// Simple logging fallback / global access
window.logMessage = console.log; // Fallback
function logSafe(message) {
  console.log(message);
  try {
    // Try to log to the UI if available
    window.logMessage(message); // Use the potentially updated global function
  } catch (e) {
    // Ignore errors
  }
}

// Safe import with error handling
async function safeImport(path) {
  logSafe(`[BOOTSTRAP] Loading: ${path}`);
  try {
    // Assume path is a correct absolute URL path like /client/...
    const module = await import(path);
    logSafe(`[BOOTSTRAP] Successfully loaded: ${path}`);
    return module;
  } catch (error) {
    console.error(`[BOOTSTRAP] Failed to load ${path}:`, error.message);
    // Show error on page for easier debugging
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = 'color: red; background: #ffeeee; padding: 10px; margin: 10px 0; border: 1px solid red; font-family: monospace;';
    errorMsg.innerText = `[Module Load Error] ${path}: ${error.message}`;
    document.body.prepend(errorMsg);
    
    // Return an error object that can be checked
    return { __ERROR__: true, message: error.message, path, originalError: error };
  }
}

// Global Debug/Info Functions (Moved from appInit.js)
function registerGlobalFunctions() {
    // Avoid registering if already done (e.g., during HMR)
    if (window.debugUI) return;
    
    // Import debug functions dynamically using absolute paths
    safeImport('./debug.js').then(debugModule => {
        if (debugModule && !debugModule.__ERROR__) {
            window.debugUI = debugModule.debugUI;
            window.testApiEndpoints = debugModule.testApiEndpoints;
            window.debugFileOperations = debugModule.debugFileOperations;
            window.debugApiResponses = debugModule.debugApiResponses;
            window.testFileLoading = debugModule.testFileLoading;
        }
    }).catch(e => console.error('Failed to load debug module', e));

    safeImport('/client/fileSystemState.js').then(fsStateModule => {
        if(fsStateModule && !fsStateModule.__ERROR__) {
           window.debugFileSystemState = fsStateModule.debugFileSystemState; // Assuming debug func is there
        }
    }).catch(e => console.error('Failed to load fsState module for debug', e));
    
    window.showAppInfo = showAppInfo;
    
    // Basic app config (Consider moving to a dedicated config.js)
    window.APP_CONFIG = {
        name: 'DevPages', // Replace with actual name if available
        version: '1.0.0', // Replace with actual version if available
        buildDate: new Date().toISOString().split('T')[0]
    };
    
    logSafe('[BOOTSTRAP] Global functions registered');
}

function showAppInfo() {
    const config = window.APP_CONFIG || {};
    logSafe('\n=== APPLICATION INFORMATION ===');
    logSafe(`Name: ${config.name || 'N/A'}`);
    logSafe(`Version: ${config.version || 'N/A'}`);
    logSafe(`Build Date: ${config.buildDate || 'N/A'}`);
    logSafe('================================');
}
// --- End Global Functions ---


// Initialize the application in the correct sequence
async function initializeApp() {
  if (window.APP.initialized || window.APP.initializing) {
    logSafe('[BOOTSTRAP] Already initialized or initializing, skipping');
    return;
  }

  window.APP.initializing = true;
  logSafe('[BOOTSTRAP] ===== STARTING APPLICATION BOOTSTRAP =====');

  // Clean sensitive URL parameters if present
  try {
    const url = new URL(window.location.href);
    let cleaned = false;
    
    if (url.searchParams.has('username') || url.searchParams.has('password')) {
      const authState = JSON.parse(localStorage.getItem('authState') || '{}');
      
      if (authState && authState.isLoggedIn) {
        url.searchParams.delete('username');
        url.searchParams.delete('password');
        window.history.replaceState({}, document.title, url.toString());
        logMessage('[BOOTSTRAP] Removed sensitive parameters from URL');
        cleaned = true;
      }
    }
    
    // If we didn't clean it yet and we should
    if (!cleaned && (url.searchParams.has('username') || url.searchParams.has('password'))) {
      // Schedule cleaning after auth check
      setTimeout(() => {
        const authState = JSON.parse(localStorage.getItem('authState') || '{}');
        if (authState && authState.isLoggedIn) {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('username');
          currentUrl.searchParams.delete('password');
          window.history.replaceState({}, document.title, currentUrl.toString());
          logMessage('[BOOTSTRAP] Removed sensitive parameters from URL after delay');
        }
      }, 2000); // Give auth system time to process
    }
  } catch (e) {
    console.error('[BOOTSTRAP] Error cleaning URL:', e);
  }

  try {
    // --- Phase 1: Logging --- 
    logSafe('[BOOTSTRAP] Phase 1: Initializing Log System...');
    const logSystem = await safeImport('/client/log/index.js');
    if (!logSystem || logSystem.__ERROR__) throw new Error('Log system failed to load');
    
    // Set global logMessage ASAP
    if (typeof logSystem.logMessage === 'function') {
         window.logMessage = logSystem.logMessage;
         logMessage('[BOOTSTRAP] logMessage registered globally.'); // Use the function now
    } else {
         throw new Error('logMessage function not found in log system');
    }
    const { initLogVisibility, ensureLogButtonsConnected } = logSystem;
    if (typeof initLogVisibility === 'function') {
        initLogVisibility();
        logMessage('[BOOTSTRAP] Log visibility initialized.');
    } else {
        logMessage('[BOOTSTRAP WARNING] initLogVisibility not found.', 'warning');
    }
    registerGlobalFunctions(); // Register debug functions

    // --- Phase 2: Authentication --- 
    logMessage('[BOOTSTRAP] Phase 2: Initializing Authentication...');
    const authModule = await safeImport('/client/auth.js');
    if (!authModule || authModule.__ERROR__ || typeof authModule.restoreLoginState !== 'function' || typeof authModule.initAuth !== 'function') {
         throw new Error('Auth module failed to load or missing required functions');
    }
    const { initAuth, restoreLoginState } = authModule;
    initAuth(); // Initialize listeners etc.
    const isLoggedIn = await restoreLoginState(); // Restore state
    logMessage(`[BOOTSTRAP] Login state restored: ${isLoggedIn ? 'logged in' : 'logged out'}`);

    // --- Phase 3: Core UI & Event Bus --- 
    logMessage('[BOOTSTRAP] Phase 3: Initializing UI Manager & Event Bus...');
    const eventBusModule = await safeImport('/client/eventBus.js');
    if (!eventBusModule || eventBusModule.__ERROR__) throw new Error('EventBus failed to load');
    // Make eventBus globally accessible if needed, or pass it around
    // window.eventBus = eventBusModule.eventBus;

    const uiManagerModule = await safeImport('/client/uiManager.js');
     if (!uiManagerModule || uiManagerModule.__ERROR__ || typeof uiManagerModule.default?.initialize !== 'function') {
        throw new Error('UIManager failed to load or missing initialize function');
    }
    await uiManagerModule.default.initialize(); // Use default export
    logMessage('[BOOTSTRAP] UI Manager initialized.');

    // Ensure log buttons connected after UI init
    if (typeof ensureLogButtonsConnected === 'function') {
        ensureLogButtonsConnected();
        logMessage('[BOOTSTRAP] Log buttons connection ensured.');
    }

    // --- Phase 4: Editor & Preview --- 
    logMessage('[BOOTSTRAP] Phase 4: Initializing Editor & Preview...');
    const editorModule = await safeImport('/client/editor.js');
    if (editorModule && !editorModule.__ERROR__ && typeof editorModule.initializeEditor === 'function') {
        await editorModule.initializeEditor();
        logMessage('[BOOTSTRAP] Editor initialized.');
    } else {
        logMessage('[BOOTSTRAP WARNING] Editor failed to load or initialize.', 'warning');
    }
    
    const previewModule = await safeImport('/client/preview.js');
     if (previewModule && !previewModule.__ERROR__ && typeof previewModule.initializePreview === 'function') {
        await previewModule.initializePreview();
        logMessage('[BOOTSTRAP] Preview initialized.');
    } else {
        logMessage('[BOOTSTRAP WARNING] Preview failed to load or initialize.', 'warning');
    }

    // --- Phase 5: File Manager --- 
    logMessage('[BOOTSTRAP] Phase 5: Initializing File Manager...');
    // Only init if logged in? Or let fileManager handle auth state check?
    // Let fileManager handle it for robustness.
    const fileManagerModule = await safeImport('/client/fileManager.js');
    if (fileManagerModule && !fileManagerModule.__ERROR__ && typeof fileManagerModule.initializeFileManager === 'function') {
        await fileManagerModule.initializeFileManager();
        logMessage('[BOOTSTRAP] File Manager initialization triggered.');
    } else {
         logMessage('[BOOTSTRAP ERROR] FileManager failed to load or initialize.', 'error');
    }

    // --- Phase 6: Additional Components --- 
    logMessage('[BOOTSTRAP] Phase 6: Initializing Additional Components...');
    const communityLinkModule = await safeImport('/client/communityLink.js');
    if (communityLinkModule && !communityLinkModule.__ERROR__ && typeof communityLinkModule.initCommunityLink === 'function') {
        await communityLinkModule.initCommunityLink();
        logMessage('[BOOTSTRAP] Community Link initialized.');
    } else {
         logMessage('[BOOTSTRAP WARNING] Community Link failed to load or initialize.', 'warning');
    }
    
    const cliModule = await safeImport('/client/cli/index.js');
    if (cliModule && !cliModule.__ERROR__ && typeof cliModule.initializeCLI === 'function') {
        await cliModule.initializeCLI();
        logMessage('[BOOTSTRAP] CLI initialized.');
    } else {
         logMessage('[BOOTSTRAP WARNING] CLI failed to load or initialize.', 'warning');
    }
    
    // Initialize DOM event listeners, actions etc. AFTER core modules are ready
    const domEventsModule = await safeImport('/client/domEvents.js');
    if(domEventsModule && !domEventsModule.__ERROR__ && typeof domEventsModule.initializeDomEvents === 'function') {
        domEventsModule.initializeDomEvents();
        logMessage('[BOOTSTRAP] DOM Events Initialized.');
    } else {
        logMessage('[BOOTSTRAP WARNING] DOM Events failed to load or initialize.', 'warning');
    }
    
    const actionsModule = await safeImport('/client/actions.js');
     if(actionsModule && !actionsModule.__ERROR__ && typeof actionsModule.initializeActions === 'function') {
        actionsModule.initializeActions();
        logMessage('[BOOTSTRAP] Actions Initialized.');
    } else {
        logMessage('[BOOTSTRAP WARNING] Actions failed to load or initialize.', 'warning');
    }

    // Mark initialization as complete
    window.APP.initializing = false;
    window.APP.initialized = true;
    logMessage('[BOOTSTRAP] ===== APPLICATION INITIALIZATION COMPLETE =====');
    eventBusModule.eventBus.emit('app:ready'); // Emit ready event
    
  } catch (error) {
    window.APP.initFailed = true;
    window.APP.initializing = false;
    console.error('[BOOTSTRAP CRITICAL] Uncaught error during bootstrap initialization:', error);
    logSafe(`[BOOTSTRAP] Fatal error: ${error.message}`);
    
    // Add a visible error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed; top:0; left:0; right:0; background:rgba(255,0,0,0.8); color:white; padding:10px; font-family:sans-serif; z-index:9999;';
    errorDiv.innerHTML = `
      <strong>Initialization Error:</strong> ${error.message}
      <button onclick="window.location.reload()" style="margin-left:15px; padding:3px 8px;">Reload</button>
    `;
    document.body.appendChild(errorDiv);
  } finally {
     window.APP.initializing = false; // Ensure flag is always reset
     // Do not set initialized = true in finally, only on success
  }
}

// Define APP object if it doesn't exist
window.APP = window.APP || {};

// Start the initialization
initializeApp();

// Remove the duplicated bootstrap() function and its call
// Remove the duplicated DOMContentLoaded listener
// Remove duplicated imports at the end 