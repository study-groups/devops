// earlyInit.js - Runs VERY early to set initial state from localStorage
// Included synchronously in <head> to prevent FOUC (Flash Of Unstyled Content)

(function() {
    // Store original console methods before any modifications
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };
    
    // Check if console logging should be enabled (default to disabled)
    const consoleLoggingEnabled = localStorage.getItem('consoleLoggingEnabled') === 'true' || 
                                window.location.search.includes('console_log');
    
    // Define global control functions first
    window.enableConsoleLogging = function(persist = false) {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.info = originalConsole.info;
        console.debug = originalConsole.debug;
        if (persist) localStorage.setItem('consoleLoggingEnabled', 'true');
        originalConsole.log('[CONSOLE] Logging enabled');
    };
    
    window.disableConsoleLogging = function(persist = false) {
        console.log = function() {};
        console.info = function() {};
        console.debug = function() {};
        // Still keep errors and warnings
        // console.warn = function() {};
        // console.error = function() {};
        if (persist) localStorage.setItem('consoleLoggingEnabled', 'false');
        originalConsole.log('[CONSOLE] Logging disabled (this is the last message)');
    };
    
    // Apply the appropriate state based on configuration
    if (!consoleLoggingEnabled) {
        window.disableConsoleLogging(false);
    } else {
        originalConsole.log('[EARLY INIT] Console logging is enabled');
    }
    
    // Regular early init code
    originalConsole.log('[EARLY INIT] Running...');
  
    try {
      // --- Log State ---
      // const logVisible = localStorage.getItem('logVisible') === 'true';
      // document.documentElement.setAttribute('data-log-visible', logVisible ? 'true' : 'false');
      
      // KEEP setting --log-height CSS variable as it's used by log.css
      const logHeight = Math.max(80, parseInt(localStorage.getItem('logHeight'), 10) || 120);
      document.documentElement.style.setProperty('--log-height', `${logHeight}px`);
      originalConsole.log(`[EARLY INIT] Log height set: ${logHeight}px`);
  
      // --- Auth State ---
      let authLoggedIn = false;
      try {
        // Safely parse auth state
        const authStateRaw = localStorage.getItem('authState'); 
        if (authStateRaw) {
          const authState = JSON.parse(authStateRaw);
          // Use the primary indicator from the authState object
          if (authState && authState.isAuthenticated) { 
              authLoggedIn = true;
          }
        }
      } catch (e) {
        originalConsole.error('[EARLY INIT] Error parsing authState:', e);
        localStorage.removeItem('authState');
      }
  
      // Keep setting data-auth-state as CSS might rely on it
      document.documentElement.setAttribute('data-auth-state', authLoggedIn ? 'authenticated' : 'unauthenticated');
      originalConsole.log(`[EARLY INIT] Auth state: ${authLoggedIn ? 'authenticated' : 'unauthenticated'}`);
  
    } catch (error) {
      originalConsole.error('[EARLY INIT] Critical error:', error);
      // Set safe defaults if any error occurs
      // document.documentElement.setAttribute('data-log-visible', 'false');
      document.documentElement.style.setProperty('--log-height', '120px');
      document.documentElement.setAttribute('data-auth-state', 'unauthenticated');
    }
  
    originalConsole.log('[EARLY INIT] Complete.');
})();