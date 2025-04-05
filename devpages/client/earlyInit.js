// earlyInit.js - Runs VERY early to set initial state from localStorage
// Included synchronously in <head> to prevent FOUC (Flash Of Unstyled Content)

(function() {
    console.log('[EARLY INIT] Running...');
  
    try {
      // --- Log State ---
      const logVisible = localStorage.getItem('logVisible') === 'true';
      // Use a reasonable default and min height
      const logHeight = Math.max(80, parseInt(localStorage.getItem('logHeight'), 10) || 120);
  
      document.documentElement.setAttribute('data-log-visible', logVisible ? 'true' : 'false');
      document.documentElement.style.setProperty('--log-height', `${logHeight}px`);
      console.log(`[EARLY INIT] Log state: visible=${logVisible}, height=${logHeight}px`);
  
      // --- Auth State ---
      let authLoggedIn = false;
      try {
        // Safely parse auth state
        const authStateRaw = localStorage.getItem('authState'); // Using the key from auth.js refactor attempt
        if (authStateRaw) {
          const authState = JSON.parse(authStateRaw);
          // Check for username as the indicator (aligns with server-driven state)
          // If the simplified auth state is ever saved, this might need adjustment
          if (authState && authState.username && authState.current === 'authenticated') { // Check state too
              authLoggedIn = true;
          }
        }
      } catch (e) {
        console.error('[EARLY INIT] Error parsing authState:', e);
        // Proceed assuming logged out if parsing fails or key doesn't exist
        // Clear potentially invalid state
         localStorage.removeItem('authState');
      }
  
      document.documentElement.setAttribute('data-auth-state', authLoggedIn ? 'authenticated' : 'unauthenticated');
      console.log(`[EARLY INIT] Auth state: ${authLoggedIn ? 'authenticated' : 'unauthenticated'}`);
  
    } catch (error) {
      console.error('[EARLY INIT] Critical error:', error);
      // Set safe defaults if any error occurs
      document.documentElement.setAttribute('data-log-visible', 'false');
      document.documentElement.style.setProperty('--log-height', '120px');
      document.documentElement.setAttribute('data-auth-state', 'unauthenticated');
    }
  
    console.log('[EARLY INIT] Complete.');
  })();