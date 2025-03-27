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
  console.log('[BOOTSTRAP] Loading:', path);
  try {
    const module = await import(path);
    console.log('[BOOTSTRAP] Successfully loaded:', path);
    return module;
  } catch (error) {
    console.error('[BOOTSTRAP] Failed to load ' + path + ':', error.message);
    // Show error on page for easier debugging
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = 'color: red; background: #ffeeee; padding: 10px; margin: 10px 0; border: 1px solid red; font-family: monospace;';
    errorMsg.innerText = `[Module Load Error] ${path}: ${error.message}`;
    document.body.prepend(errorMsg);
    
    // Return an error object that can be checked
    return { __ERROR__: true, message: error.message, path, originalError: error };
  }
}

// Initialize the application in the correct sequence
async function initializeApp() {
  if (window.APP.initialized || window.APP.initializing) {
    console.log('[BOOTSTRAP] Already initialized or initializing, skipping');
    return;
  }

  window.APP.initializing = true;
  // Use console.log for earliest possible logging before logSafe might be ready
  console.log('[BOOTSTRAP] ===== STARTING APPLICATION BOOTSTRAP =====');

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
    // 1. Import core modules first
    console.log('[BOOTSTRAP] Attempting to import log system...'); // Log before import
    const logSystem = await safeImport('/client/log/index.js');

    // --- Add Detailed Debugging ---
    console.log('[BOOTSTRAP DEBUG] Result of safeImport("/client/log/index.js"):', logSystem);

    if (!logSystem || logSystem.__ERROR__) {
        console.error('[BOOTSTRAP CRITICAL] Log system import failed!', 
                     logSystem?.__ERROR__ ? `Error: ${logSystem.message}` : 'Import returned null/undefined');
        // Cannot proceed without log system - show user-friendly error
        document.body.innerHTML = '<div style="color:red;padding:20px;">'+
            '<h2>Critical Error</h2>'+
            '<p>The application failed to load core components. Please try clearing your cache and reloading.</p>'+
            '<button onclick="location.reload(true)">Reload Page</button>'+
            '</div>';
        return;
    }

    console.log('[BOOTSTRAP DEBUG] Keys found in imported logSystem:', Object.keys(logSystem));
    console.log('[BOOTSTRAP DEBUG] typeof logSystem.initLogVisibility:', typeof logSystem.initLogVisibility);
    console.log('[BOOTSTRAP DEBUG] Value of logSystem.initLogVisibility:', logSystem.initLogVisibility);
    // --- End Detailed Debugging ---

    // Explicit check BEFORE destructuring
    if (typeof logSystem.initLogVisibility !== 'function') {
        console.error('[BOOTSTRAP CRITICAL] initLogVisibility is NOT a function within the imported logSystem module!');
        // Log the error using console.error as logMessage might not be available
        // Optionally stop execution if this is critical
        // return;
    }
    if (typeof logSystem.logMessage !== 'function') {
        console.error('[BOOTSTRAP CRITICAL] logMessage is NOT a function within the imported logSystem module!');
        // Use console.log as fallback
        window.logMessage = console.log;
    } else {
         window.logMessage = logSystem.logMessage;
         logMessage('[BOOTSTRAP] logMessage function registered globally.');
    }

    // Destructure AFTER checks
    const { initLogVisibility, ensureLogButtonsConnected } = logSystem; // logMessage already handled

    // Initialize log system first - only if the function exists and is valid
    if (typeof initLogVisibility === 'function') {
        try {
            logMessage('[BOOTSTRAP] Calling initLogVisibility...');
            initLogVisibility();
            logMessage('[BOOTSTRAP] Log system visibility initialized successfully.');
        } catch (logInitError) {
            console.error('[BOOTSTRAP ERROR] Error occurred during initLogVisibility execution:', logInitError);
            logMessage(`[BOOTSTRAP ERROR] Log init failed: ${logInitError.message}`);
        }
    } else {
         logMessage('[BOOTSTRAP WARNING] Skipping log visibility initialization because initLogVisibility is not a function.');
    }

    // 2. Import auth manager and restore login state
    logMessage('[BOOTSTRAP] Importing auth manager...');
    const authManager = await safeImport('/client/authManager.js');

    // --- Add Detailed Debugging for authManager ---
    console.log('[BOOTSTRAP DEBUG] Result of safeImport("/client/authManager.js"):', authManager);
    if (!authManager || typeof authManager.restoreLoginState !== 'function') {
        console.error('[BOOTSTRAP CRITICAL] authManager import failed or restoreLoginState is not a function!');
        logMessage('[BOOTSTRAP CRITICAL] Cannot restore login state.');
        // Decide how to proceed - maybe assume logged out?
        // return; // Or stop execution
    } else {
        logMessage('[BOOTSTRAP] authManager imported successfully.');
    }
    // --- End Detailed Debugging ---

    const isLoggedIn = await authManager.restoreLoginState();
    logMessage(`[BOOTSTRAP] Login state restored: ${isLoggedIn ? 'logged in' : 'logged out'}`);

    // Add this to ensure file manager is initialized
    if (isLoggedIn) {
        try {
            const fileManager = await import('./fileManager/index.js');
            await fileManager.initializeFileManager();
            logMessage('[BOOTSTRAP] Explicitly initialized file manager after login state restored');
        } catch (error) {
            logMessage(`[BOOTSTRAP ERROR] Failed to initialize file manager: ${error.message}`);
        }
    }

    // Add this line to properly update the event bus auth state
    if (isLoggedIn) {
        const { eventBus } = await safeImport('./eventBus.js');
        const { authState } = await safeImport('./auth.js');
        
        eventBus.setAuthState({
            isAuthenticated: true,
            username: authState.username,
            token: authState.hashedPassword || 'authenticated'
        });
        logMessage('[BOOTSTRAP] Updated eventBus auth state with login information');
    }

    // 3. Import and initialize UI manager
    logMessage('[BOOTSTRAP] Importing UI manager...');
    const uiManager = await safeImport('/client/uiManager.js');
    // ... (add similar checks for uiManager if needed) ...
    await uiManager.initializeUI();
    logMessage('[BOOTSTRAP] UI system initialized');

    // Explicitly ensure log buttons are connected after UI initialization
    // Check if function exists before calling
    if (typeof ensureLogButtonsConnected === 'function') {
        ensureLogButtonsConnected();
        logMessage('[BOOTSTRAP] Log buttons connection ensured.');
    } else {
        logMessage('[BOOTSTRAP WARNING] ensureLogButtonsConnected function not found in logSystem.');
    }


    // 4. Import and initialize auth module
    logMessage('[BOOTSTRAP] Importing auth module...');
    const auth = await safeImport('/client/auth.js');

    // --- Add Detailed Debugging for auth ---
    console.log('[BOOTSTRAP DEBUG] Result of safeImport("/client/auth.js"):', auth);
    if (!auth || typeof auth.initializeAuth !== 'function') {
        console.error('[BOOTSTRAP CRITICAL] auth module import failed or initializeAuth is not a function!');
        logMessage('[BOOTSTRAP CRITICAL] Cannot initialize auth system.');
        // Decide how to proceed
        // return;
    } else {
        logMessage('[BOOTSTRAP] auth module imported successfully.');
    }
    // --- End Detailed Debugging ---

    await auth.initializeAuth();
    logMessage('[BOOTSTRAP] Auth system initialized');

    // 5. Import and initialize editor
    logMessage('[BOOTSTRAP] Importing editor...');
    const editor = await import('./editor.js').catch(err => {
        console.warn("Failed to import editor module:", err);
        return { 
            initializeEditor: () => Promise.resolve(true),
            setContent: (content) => {
                const textarea = document.querySelector('#md-editor textarea');
                if (textarea) textarea.value = content || '';
                return true;
            },
            getContent: () => {
                const textarea = document.querySelector('#md-editor textarea');
                return textarea ? textarea.value : '';
            }
        };
    });

    // Check if the function exists before calling it
    if (typeof editor.initializeEditor === 'function') {
        await editor.initializeEditor().catch(err => {
            console.warn("Editor initialization failed:", err);
        });
    } else {
        console.warn("initializeEditor function not found on editor module");
    }

    // 6. Initialize file manager if logged in
    if (isLoggedIn) {
      logMessage('[BOOTSTRAP] Importing file manager...');
      try {
        // Use dynamic import to avoid errors - import from the correct path
        const fileManager = await import('./fileManager/index.js');
        
        // Check if the function exists before calling
        if (typeof fileManager.initializeFileManager === 'function') {
          const success = await fileManager.initializeFileManager();
          if (success) {
            logMessage('[BOOTSTRAP] File manager initialized for logged in user');
          } else {
            // If initial init fails, try force initializing
            if (typeof fileManager.refreshFileManager === 'function') {
              logMessage('[BOOTSTRAP] Directory selector not populated, retrying file manager initialization');
              await fileManager.refreshFileManager();
            }
          }
        } else {
          logMessage('[BOOTSTRAP ERROR] initializeFileManager function not found');
        }
      } catch (importError) {
        logMessage(`[BOOTSTRAP] Failed to import file manager module: ${importError.message}`);
        
        // Fallback to diagnose and fix directory issues
        try {
          logMessage('[BOOTSTRAP] Attempting to fix directory selector as fallback');
          
          // Try to at least populate the directory selector with the username
          const dirSelect = document.getElementById('dir-select');
          const authState = JSON.parse(localStorage.getItem('authState') || '{}');
          
          if (dirSelect && authState.isLoggedIn && authState.username) {
            if (!Array.from(dirSelect.options).some(opt => opt.value === authState.username)) {
              const option = document.createElement('option');
              option.value = authState.username;
              option.textContent = authState.username;
              dirSelect.appendChild(option);
              logMessage(`[BOOTSTRAP] Added user directory option: ${authState.username}`);
            }
            
            // Don't force username selection if there's already a selected directory
            if (!dirSelect.value) {
              dirSelect.value = authState.username;
              logMessage(`[BOOTSTRAP] Set directory selector to: ${authState.username}`);
              dirSelect.dispatchEvent(new Event('change'));
            } else {
              logMessage(`[BOOTSTRAP] Directory already selected: ${dirSelect.value}, not changing to username`);
            }
          }
        } catch (error) {
          logMessage(`[BOOTSTRAP] Fallback directory fix failed: ${error.message}`);
        }
      }
    }

    // 7. Additional modules
    try {
      const { initCommunityLink } = await safeImport('./communityLink.js');
      await initCommunityLink();
      logMessage('[BOOTSTRAP] Community link initialized');
    } catch (error) {
      logMessage(`[BOOTSTRAP] Failed to initialize community link: ${error.message}`);
      
      // Fallback initialization
      try {
        const communityLinkBtn = document.getElementById('community-link-btn');
        if (communityLinkBtn && !communityLinkBtn._initialized) {
          communityLinkBtn.addEventListener('click', async function() {
            const authStateStr = localStorage.getItem('authState');
            if (!authStateStr) {
              alert('Please log in to share with the community');
              return;
            }
            
            const authState = JSON.parse(authStateStr);
            if (!authState.isLoggedIn) {
              alert('Please log in to share with the community');
              return;
            }
            
            const fileSelect = document.getElementById('file-select');
            if (!fileSelect?.value) {
              alert('Please select a file to share');
              return;
            }
            
            const editor = document.querySelector('#md-editor textarea');
            if (!editor) {
              alert('Editor not found');
              return;
            }
            
            if (confirm(`Share "${fileSelect.value}" with the community?`)) {
              try {
                const response = await fetch('/api/files/save', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Basic ${btoa(`${authState.username}:${authState.hashedPassword}`)}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    name: fileSelect.value,
                    dir: 'Community_Files',
                    content: editor.value
                  })
                });
                
                if (response.ok) {
                  alert('Successfully shared with the community!');
                } else {
                  const text = await response.text();
                  alert(`Error sharing file: ${response.status} - ${text}`);
                }
              } catch (error) {
                alert(`Error sharing file: ${error.message}`);
              }
            }
          });
          
          communityLinkBtn._initialized = true;
          logMessage('[BOOTSTRAP] Added fallback community link handler');
        }
      } catch (fallbackError) {
        logMessage(`[BOOTSTRAP] Fallback community link initialization failed: ${fallbackError.message}`);
      }
    }

    // 8. Import and initialize the CLI component
    logMessage('[BOOTSTRAP] Importing CLI component...');
    try {
        const cliModule = await safeImport('/client/cli/index.js');
        if (cliModule && typeof cliModule.initializeCLI === 'function') {
            await cliModule.initializeCLI();
            logMessage('[BOOTSTRAP] CLI component initialized successfully');
        } else {
            console.error('[BOOTSTRAP] CLI module loaded but initializeCLI not found');
            logMessage('[BOOTSTRAP] Failed to initialize CLI component: missing initialization function');
        }
    } catch (error) {
        console.error('[BOOTSTRAP] Failed to load CLI component:', error);
        logMessage('[BOOTSTRAP] Failed to load CLI component: ' + error.message);
    }

    // Mark initialization as complete
    window.APP.initializing = false;
    window.APP.initialized = true;
    logMessage('[BOOTSTRAP] ===== APPLICATION INITIALIZATION COMPLETE =====');
    
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
    window.APP.initializing = false;
    window.APP.initialized = true;
    console.log('[BOOTSTRAP] ===== APPLICATION BOOTSTRAP COMPLETE =====');
  }
}

// Define APP object if it doesn't exist
window.APP = window.APP || {};

// Start the initialization
initializeApp();

// Import core modules
import { logMessage } from './log/index.js';
import { eventBus } from './eventBus.js';
import { initializeActions } from './actions.js';
import { initializeDomEvents } from './domEvents.js';

// Bootstrap the application
async function bootstrap() {
    console.log('[BOOTSTRAP] Application bootstrap started');
    
    try {
        // Initialize early connectivity functions (connectGlobalFunctions)
        initializeDomEvents();
        
        // Initialize action handlers
        initializeActions();
        
        // Initialize UI components and other modules
        // ...
        
        console.log('[BOOTSTRAP] Application bootstrap completed');
    } catch (error) {
        console.error('[BOOTSTRAP ERROR]', error);
    }
}

// Start bootstrap process immediately
bootstrap();

// Also initialize on DOM content loaded for safety
document.addEventListener('DOMContentLoaded', () => {
    logMessage('[DOM] Content loaded, ensuring event system is initialized');
    
    // Dispatch an application:ready event
    eventBus.emit('application:ready');
}); 