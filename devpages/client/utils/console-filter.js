/**
 * Console Filter - Global verbose logging control
 *
 * Wraps console.log to filter out bracketed [Module] messages
 * when verbose mode is disabled.
 *
 * Usage:
 *   window.verbose = true   // Enable all logging
 *   window.verbose = false  // Filter bracketed messages (default)
 */
(function() {
    'use strict';

    // Load setting from localStorage, default to false (quiet)
    let VERBOSE = localStorage.getItem('console.verbose') === 'true';

    // Store original console methods
    const originalLog = console.log.bind(console);
    const originalInfo = console.info.bind(console);
    const originalDebug = console.debug.bind(console);
    const originalWarn = console.warn.bind(console);

    // Patterns to filter:
    // - [ThemeInitializer] or [CLIENT][REDUX] - bracketed prefixes
    // - THUNK INIT_START, PLUGIN INIT_ALL - ALL_CAPS prefixes
    // - Logger created, Module loaded - common boot messages
    const FILTER_PATTERNS = [
        /^\[[\w-]+\]/,                          // [Bracketed] prefixes
        /^[A-Z_]{4,}\s+[A-Z_]{2,}/,            // ALL_CAPS PREFIX MESSAGES
        /^(Logger created|Module loaded)/i,    // Common boot messages
        /^Panel\s/,                                 // Panel state/debug messages
        /^(✅|🔍|🧹|⏳)/,                       // Emoji-prefixed status messages
        /^Available functions:/,                // Debug utilities
        /^\s+APP\.debug\./,                     // Debug utility listings
        /^Error tracker/,                       // Error tracker init messages
    ];

    function shouldFilter(args) {
        if (VERBOSE) return false;
        if (args.length === 0) return false;

        let first = args[0];
        if (typeof first !== 'string') return false;

        // Strip %c style prefixes (e.g., "%c[Module]%c message" -> "[Module] message")
        const stripped = first.replace(/%c/g, '').trim();

        return FILTER_PATTERNS.some(pattern => pattern.test(stripped));
    }

    // Wrap console.log
    console.log = function(...args) {
        if (!shouldFilter(args)) {
            originalLog(...args);
        }
    };

    // Wrap console.info
    console.info = function(...args) {
        if (!shouldFilter(args)) {
            originalInfo(...args);
        }
    };

    // Wrap console.debug
    console.debug = function(...args) {
        if (!shouldFilter(args)) {
            originalDebug(...args);
        }
    };

    // Wrap console.warn (for unified logging system warnings)
    console.warn = function(...args) {
        if (!shouldFilter(args)) {
            originalWarn(...args);
        }
    };

    // Expose control globally with persistence
    Object.defineProperty(window, 'verbose', {
        get: () => VERBOSE,
        set: (v) => {
            VERBOSE = !!v;
            localStorage.setItem('console.verbose', VERBOSE);
            originalLog(`[ConsoleFilter] Verbose mode: ${VERBOSE ? 'ON (all logs)' : 'OFF (filtered)'}`);
        },
        configurable: true
    });

    // Register with Console Tools if available (deferred)
    setTimeout(() => {
        if (window.consoleTools) {
            window.consoleTools.register({
                name: 'verbose',
                description: 'Control all [bracketed] console logging',
                icon: '🔊',
                toggle: () => { window.verbose = !window.verbose; },
                isEnabled: () => VERBOSE,
                commands: [
                    { name: 'on', fn: () => { window.verbose = true; }, description: 'Show all logs' },
                    { name: 'off', fn: () => { window.verbose = false; }, description: 'Filter [bracketed] logs' },
                    { name: 'status', fn: () => originalLog(`Verbose: ${VERBOSE ? 'ON' : 'OFF'}`), description: 'Show current state' }
                ]
            });
        }
    }, 100);

    // Startup message (always show)
    originalLog(`[ConsoleFilter] Loaded. Verbose: ${VERBOSE ? 'ON' : 'OFF'}. Toggle: window.verbose = true/false`);
})();
