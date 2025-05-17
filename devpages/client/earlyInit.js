// earlyInit.js - Runs VERY early to set initial state from localStorage
// Included synchronously in <head> to prevent FOUC (Flash Of Unstyled Content)

(function() {
    const earlyInitStart = performance.now();
    
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };
    // Expose this pristine original console for other scripts
    window.__earlyOriginalConsole = originalConsole;
    
    window.__timingRegistry = window.__timingRegistry || {
        startTime: performance.now(),
        entries: [],
        addEntry: function(entry) {
            this.entries.unshift({
                ...entry,
                timestamp: entry.timestamp || performance.now()
            });
            if (this.entries.length > 1000) {
                this.entries = this.entries.slice(0, 1000);
            }
        },
        getEntries: function() { return [...this.entries]; },
        clear: function() { this.entries = []; this.startTime = performance.now(); }
    };
    
    let earlyLoggingIsEnabled = false; // Internal flag for earlyInit.js
    
    // Determine initial logging state for earlyInit
    const clmStorageValue = localStorage.getItem('consoleLoggingEnabled');
    const enableByStorage = clmStorageValue === 'true';
    const enableByUrlParam = window.location.search.includes('console_log=true') || window.location.search.match(/[?&]cl=1(&|$)/); // support console_log=true or cl=1
    const disableByUrlParam = window.location.search.includes('console_log=false') || window.location.search.match(/[?&]cl=0(&|$)/); // support console_log=false or cl=0

    if (disableByUrlParam) {
        earlyLoggingIsEnabled = false;
        window.__initialConsoleLoggingEnabledByEarlyInit = false; // Signal to ConsoleLogManager
        if (clmStorageValue !== 'false') { // If disabling via URL, update storage for CLM
             localStorage.setItem('consoleLoggingEnabled', 'false');
        }
    } else if (enableByUrlParam) {
        earlyLoggingIsEnabled = true;
        window.__initialConsoleLoggingEnabledByEarlyInit = true; // Signal to ConsoleLogManager
        if (clmStorageValue !== 'true') { // If enabling via URL, update storage for CLM
            localStorage.setItem('consoleLoggingEnabled', 'true');
        }
    } else if (clmStorageValue !== null) { // No URL param, use storage if set
        earlyLoggingIsEnabled = enableByStorage;
        window.__initialConsoleLoggingEnabledByEarlyInit = enableByStorage; // Signal based on storage
    } else { // No URL param and no storage value, default to false
        earlyLoggingIsEnabled = false;
        window.__initialConsoleLoggingEnabledByEarlyInit = false; // Signal default
        // localStorage.setItem('consoleLoggingEnabled', 'false'); // Optionally set default in storage for CLM
    }

    // Apply early console patching based on earlyLoggingIsEnabled
    if (!earlyLoggingIsEnabled) {
        const noopFn = function() {};
        console.log = noopFn;
        console.info = noopFn;
        console.debug = noopFn;
        // Keep warn and error from originalConsole for critical early issues
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        originalConsole.log('[EARLY_INIT] Logging is DISABLED for early phase (log, info, debug are no-op). Criticals (warn, error) remain.');
    } else {
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.info = originalConsole.info;
        console.debug = originalConsole.debug;
        originalConsole.log('[EARLY_INIT] Logging is ENABLED for early phase.');
    }
    
    // Timing history access (kept as they are utility, not state management for console on/off)
    window.getTimingHistory = function(options = {}) { return window.__timingRegistry.getEntries(); };
    window.clearTimingHistory = function() { window.__timingRegistry.clear(); return true; };
    
    function earlyLog(message, level = 'log') {
        // This function now respects the earlyLoggingIsEnabled state directly
        if (!earlyLoggingIsEnabled && (level === 'log' || level === 'info' || level === 'debug') ) return; 
        
        const now = performance.now();
        const timeSinceStart = now - earlyInitStart;
        const entry = { type: 'earlyInit', label: message, timestamp: now, duration: timeSinceStart };
        window.__timingRegistry.addEntry(entry);
        
        let formattedMessage = `[EARLY_INIT] ${message}`;
        
        if (level === 'error') {
            originalConsole.error(formattedMessage);
        } else if (level === 'warn') {
            originalConsole.warn(formattedMessage);
        } else if (level === 'info' && earlyLoggingIsEnabled) {
            originalConsole.info(formattedMessage);
        } else if (level === 'debug' && earlyLoggingIsEnabled) {
            originalConsole.debug(formattedMessage);
        } else if (earlyLoggingIsEnabled) { // Default to log
            originalConsole.log(formattedMessage);
        }
    }
    
    earlyLog('Running...');
  
    try {
        const logHeight = Math.max(80, parseInt(localStorage.getItem('logHeight'), 10) || 120);
        document.documentElement.style.setProperty('--log-height', `${logHeight}px`);
        earlyLog(`Log height set: ${logHeight}px`);
      
        let authLoggedIn = false;
        try {
            const authStateRaw = localStorage.getItem('authState'); 
            if (authStateRaw) {
                const authState = JSON.parse(authStateRaw);
                if (authState && authState.isAuthenticated) { 
                    authLoggedIn = true;
                }
            }
        } catch (e) {
            earlyLog(`Error parsing authState: ${e.message}`, 'error'); // Use e.message
            localStorage.removeItem('authState');
        }
      
        document.documentElement.setAttribute('data-auth-state', authLoggedIn ? 'authenticated' : 'unauthenticated');
        earlyLog(`Auth state: ${authLoggedIn ? 'authenticated' : 'unauthenticated'}`);
      
    } catch (error) {
        earlyLog(`Critical error: ${error.message}`, 'error'); // Use error.message
        document.documentElement.style.setProperty('--log-height', '120px');
        document.documentElement.setAttribute('data-auth-state', 'unauthenticated');
    }
  
    const earlyInitEnd = performance.now();
    window.__timingRegistry.addEntry({
        type: 'initialization',
        label: 'earlyInit.js',
        timestamp: earlyInitStart,
        duration: earlyInitEnd - earlyInitStart
    });
  
    earlyLog(`Complete. Total init time: ${(earlyInitEnd - earlyInitStart).toFixed(2)}ms. Signaled CLM: ${window.__initialConsoleLoggingEnabledByEarlyInit}`);
})();