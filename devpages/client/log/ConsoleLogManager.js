// When intercepting console.log(), route it through window.logMessage:

const interceptedLog = function(...args) {
    const message = args.join(' ');
    
    // Route through the central logging system
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, 'info', 'CONSOLE', 'LOG');
    }
    
    // Also call original console if needed
    originalConsole.log.apply(console, args);
};

const interceptedInfo = function(...args) {
    const message = args.join(' ');
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, 'info', 'CONSOLE', 'INFO');  
    }
    originalConsole.info.apply(console, args);
};

const interceptedDebug = function(...args) {
    const message = args.join(' ');
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, 'debug', 'CONSOLE', 'DEBUG');
    }
    originalConsole.debug.apply(console, args);
};

// etc for warn, error 