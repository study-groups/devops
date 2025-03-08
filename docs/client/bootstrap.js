// bootstrap.js - Minimal script to control initialization sequence

// Create global namespace to control initialization
window.APP = {
  initialized: false,
  initializing: false,
  initFailed: false
};

// Simple logging fallback
function logSafe(message) {
  console.log(message);
  try {
    // Try to log to the UI if available
    if (window.logMessage) {
      window.logMessage(message);
    }
  } catch (e) {
    // Ignore errors
  }
}

// Safe import with error handling
async function safeImport(path) {
  try {
    logSafe(`[BOOTSTRAP] Loading: ${path}`);
    return await import(path);
  } catch (error) {
    logSafe(`[BOOTSTRAP] Failed to load ${path}: ${error.message}`);
    console.error(`[BOOTSTRAP] Import error for ${path}:`, error);
    return { __ERROR__: true };
  }
}

// Initialize the application in the correct sequence
async function initializeApp() {
  if (window.APP.initialized || window.APP.initializing) {
    console.log('[BOOTSTRAP] Already initialized or initializing, skipping');
    return;
  }

  window.APP.initializing = true;
  logSafe('[BOOTSTRAP] ===== STARTING APPLICATION BOOTSTRAP =====');

  try {
    // 1. Import core modules first
    const logSystem = await safeImport('/client/log/index.js');
    const { logMessage, initLogVisibility, ensureLogButtonsConnected } = logSystem;
    
    // Make log function available globally for other modules
    window.logMessage = logMessage;
    
    // Initialize log system first
    initLogVisibility();
    logMessage('[BOOTSTRAP] Log system initialized');

    // 2. Import auth manager and restore login state
    const authManager = await safeImport('/client/authManager.js');
    const isLoggedIn = await authManager.restoreLoginState();
    logMessage(`[BOOTSTRAP] Login state restored: ${isLoggedIn ? 'logged in' : 'logged out'}`);

    // 3. Import and initialize UI manager
    const uiManager = await safeImport('/client/uiManager.js');
    await uiManager.initializeUI();
    logMessage('[BOOTSTRAP] UI system initialized');
    
    // Explicitly ensure log buttons are connected after UI initialization
    ensureLogButtonsConnected();
    logMessage('[BOOTSTRAP] Log buttons connected');

    // 4. Import and initialize auth module
    const auth = await safeImport('/client/auth.js');
    await auth.initializeAuth();
    logMessage('[BOOTSTRAP] Auth system initialized');

    // 5. Import and initialize editor
    const editor = await safeImport('/client/editor.js');
    await editor.initializeEditor();
    logMessage('[BOOTSTRAP] Editor initialized');

    // 6. Initialize file manager if logged in
    if (isLoggedIn) {
      const fileManager = await safeImport('/client/fileManager.js');
      await fileManager.initializeFileManager();
      logMessage('[BOOTSTRAP] File manager initialized for logged in user');
    }
    
    // 7. Additional modules
    const communityLink = await safeImport('/client/components/communityLink.js');
    await communityLink.initCommunityLink();
    
    // Mark initialization as complete
    window.APP.initializing = false;
    window.APP.initialized = true;
    logMessage('[BOOTSTRAP] ===== APPLICATION INITIALIZATION COMPLETE =====');
    
  } catch (error) {
    window.APP.initFailed = true;
    window.APP.initializing = false;
    console.error('[BOOTSTRAP] Fatal initialization error:', error);
    logSafe(`[BOOTSTRAP] Fatal error: ${error.message}`);
    
    // Add a visible error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed; top:0; left:0; right:0; background:rgba(255,0,0,0.8); color:white; padding:10px; font-family:sans-serif; z-index:9999;';
    errorDiv.innerHTML = `
      <strong>Initialization Error:</strong> ${error.message}
      <button onclick="window.location.reload()" style="margin-left:15px; padding:3px 8px;">Reload</button>
    `;
    document.body.appendChild(errorDiv);
  }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded, initialize immediately
  initializeApp();
} 