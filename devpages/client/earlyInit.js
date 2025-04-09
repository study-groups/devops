// earlyInit.js - Runs VERY early to set initial state from localStorage
// Included synchronously in <head> to prevent FOUC (Flash Of Unstyled Content)

(function() {
    console.log('[EARLY INIT] Running...');
  
    try {
      // --- Log State ---
      // const logVisible = localStorage.getItem('logVisible') === 'true';
      // document.documentElement.setAttribute('data-log-visible', logVisible ? 'true' : 'false');
      
      // KEEP setting --log-height CSS variable as it's used by log.css
      const logHeight = Math.max(80, parseInt(localStorage.getItem('logHeight'), 10) || 120);
      document.documentElement.style.setProperty('--log-height', `${logHeight}px`);
      console.log(`[EARLY INIT] Log height set: ${logHeight}px`);
  
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
        console.error('[EARLY INIT] Error parsing authState:', e);
         localStorage.removeItem('authState');
      }
  
      // Keep setting data-auth-state as CSS might rely on it
      document.documentElement.setAttribute('data-auth-state', authLoggedIn ? 'authenticated' : 'unauthenticated');
      console.log(`[EARLY INIT] Auth state: ${authLoggedIn ? 'authenticated' : 'unauthenticated'}`);
  
    } catch (error) {
      console.error('[EARLY INIT] Critical error:', error);
      // Set safe defaults if any error occurs
      // document.documentElement.setAttribute('data-log-visible', 'false');
      document.documentElement.style.setProperty('--log-height', '120px');
      document.documentElement.setAttribute('data-auth-state', 'unauthenticated');
    }
  
    console.log('[EARLY INIT] Complete.');
  })();