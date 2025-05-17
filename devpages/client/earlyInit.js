// earlyInit.js - Runs VERY early to set initial state from localStorage
// Included synchronously in <head> to prevent FOUC (Flash Of Unstyled Content)

(function() {
    // Performance timestamp to measure initialization time
    const earlyInitStart = performance.now();
    
    // Store original console methods before any modifications
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
    };
    
    // Global timer registry - will persist even when logging is disabled
    window.__timingRegistry = window.__timingRegistry || {
        startTime: performance.now(),
        entries: [],
        addEntry: function(entry) {
            this.entries.unshift({
                ...entry,
                timestamp: entry.timestamp || performance.now()
            });
            
            // Keep only last 1000 entries
            if (this.entries.length > 1000) {
                this.entries = this.entries.slice(0, 1000);
            }
        },
        getEntries: function() {
            return [...this.entries];
        },
        clear: function() {
            this.entries = [];
            this.startTime = performance.now();
        }
    };
    
    // ADDED: Flags to track if logging is enabled
    let isLoggingEnabled = false;
    let isPerformanceLoggingEnabled = false;
    let isDetailedPerformanceLoggingEnabled = false;
    
    // Check if console logging should be enabled (default to disabled)
    const consoleLoggingEnabled = localStorage.getItem('consoleLoggingEnabled') === 'true' || 
                                window.location.search.includes('console_log');
    
    // Define global control functions first
    window.enableConsoleLogging = function(persist = false) {
        isLoggingEnabled = true; // Set flag
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.info = originalConsole.info;
        console.debug = originalConsole.debug;
        if (persist) localStorage.setItem('consoleLoggingEnabled', 'true');
        originalConsole.log('[CONSOLE] Logging enabled');
    };
    
    window.disableConsoleLogging = function(persist = false) {
        // Create empty function for suppressing all logging
        const noopFn = function() {};
        
        isLoggingEnabled = false; // Set flag
        
        // Disable log, info, debug completely
        console.log = noopFn;
        console.info = noopFn;
        console.debug = noopFn;
        
        // Let's keep warn and error functions to ensure critical issues are still shown
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        
        if (persist) localStorage.setItem('consoleLoggingEnabled', 'false');
        
        // Show one last message before disabling
        originalConsole.log('[CONSOLE] Logging disabled (this is the last message)');
    };
    
    // ADD: Improved performance logging function with timing history
    window.enablePerformanceLogging = function(detailed = false, persist = false) {
        isPerformanceLoggingEnabled = true;
        isDetailedPerformanceLoggingEnabled = detailed;
        
        if (persist) {
            localStorage.setItem('performanceLoggingEnabled', 'true');
            localStorage.setItem('detailedPerformanceLog', detailed ? 'true' : 'false');
        }
        
        if (isLoggingEnabled) {
            originalConsole.log('[CONSOLE] Performance timing enabled' + (detailed ? ' (detailed)' : ''));
        }
    };
    
    window.disablePerformanceLogging = function(persist = false) {
        isPerformanceLoggingEnabled = false;
        isDetailedPerformanceLoggingEnabled = false;
        
        if (persist) {
            localStorage.setItem('performanceLoggingEnabled', 'false');
            localStorage.setItem('detailedPerformanceLog', 'false');
        }
        
        if (isLoggingEnabled) {
            originalConsole.log('[CONSOLE] Performance timing disabled');
        }
    };
    
    // Add getter functions
    window.isConsoleLoggingEnabled = function() {
        return isLoggingEnabled;
    };
    
    window.isPerformanceLoggingEnabled = function() {
        return isPerformanceLoggingEnabled;
    };
    
    window.isDetailedPerformanceLogEnabled = function() {
        return isDetailedPerformanceLoggingEnabled;
    };
    
    // Timing history access
    window.getTimingHistory = function(options = {}) {
        return window.__timingRegistry.getEntries();
    };
    
    window.clearTimingHistory = function() {
        window.__timingRegistry.clear();
        return true;
    };
    
    // Apply the appropriate state based on configuration
    if (!consoleLoggingEnabled) {
        window.disableConsoleLogging(false);
    } else {
        window.enableConsoleLogging(false);
    }
    
    // Function for early init logs - respects logging flag
    function earlyLog(message, level = 'log') {
        if (!isLoggingEnabled) return; // Don't log if disabled
        
        const now = performance.now();
        const timeSinceStart = now - earlyInitStart;
        const entry = {
            type: 'earlyInit',
            label: message,
            timestamp: now,
            duration: timeSinceStart
        };
        window.__timingRegistry.addEntry(entry);
        
        // Format with timing info if enabled
        let formattedMessage = message;
        if (isPerformanceLoggingEnabled) {
            if (isDetailedPerformanceLoggingEnabled) {
                formattedMessage = `[+${timeSinceStart.toFixed(2)}ms] [EARLY INIT] ${message}`;
            } else {
                formattedMessage = `[+${timeSinceStart.toFixed(0)}ms] [EARLY INIT] ${message}`;
            }
        } else {
            formattedMessage = `[EARLY INIT] ${message}`;
        }
        
        if (level === 'error') {
            originalConsole.error(formattedMessage);
        } else if (level === 'warn') {
            originalConsole.warn(formattedMessage);
        } else {
            originalConsole.log(formattedMessage);
        }
    }
    
    // Regular early init code - using earlyLog instead of console.log
    earlyLog('Running...');
  
    try {
        // --- Log State ---
        // Keep setting --log-height CSS variable as it's used by log.css
        const logHeight = Math.max(80, parseInt(localStorage.getItem('logHeight'), 10) || 120);
        document.documentElement.style.setProperty('--log-height', `${logHeight}px`);
        earlyLog(`Log height set: ${logHeight}px`);
      
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
            earlyLog(`Error parsing authState: ${e}`, 'error');
            localStorage.removeItem('authState');
        }
      
        // Keep setting data-auth-state as CSS might rely on it
        document.documentElement.setAttribute('data-auth-state', authLoggedIn ? 'authenticated' : 'unauthenticated');
        earlyLog(`Auth state: ${authLoggedIn ? 'authenticated' : 'unauthenticated'}`);
      
    } catch (error) {
        earlyLog(`Critical error: ${error}`, 'error');
        // Set safe defaults if any error occurs
        document.documentElement.style.setProperty('--log-height', '120px');
        document.documentElement.setAttribute('data-auth-state', 'unauthenticated');
    }
  
    // Initialize performance logging based on localStorage
    const performanceLoggingEnabled = localStorage.getItem('performanceLoggingEnabled') === 'true';
    const detailedTimingEnabled = localStorage.getItem('detailedPerformanceLog') === 'true';
    
    if (performanceLoggingEnabled) {
        window.enablePerformanceLogging(detailedTimingEnabled);
    }
    
    // Record total init time in timing registry
    const earlyInitEnd = performance.now();
    window.__timingRegistry.addEntry({
        type: 'initialization',
        label: 'earlyInit.js',
        timestamp: earlyInitStart,
        duration: earlyInitEnd - earlyInitStart
    });
  
    earlyLog(`Complete. Total init time: ${(earlyInitEnd - earlyInitStart).toFixed(2)}ms`);
})();