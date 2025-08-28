/**
 * LogCore.js – Central Logging System
 * Provides unified logging functionality for console output only
 * Store integration is handled separately to avoid circular dispatch issues
 */

// Get a dedicated logger for this module
let logCoreLogger;
const getLogger = () => {
    if (logCoreLogger) {
        return logCoreLogger;
    }
    if (window.APP && window.APP.services && window.APP.services.log && window.APP.services.log.createLogger) {
        logCoreLogger = window.APP.services.log.createLogger('LogCore');
        return logCoreLogger;
    }
    const dummyLogger = {
        debug: () => {},
        info: () => {},
        warn: (...args) => console.warn('[LogCore-early]', ...args),
        error: (...args) => console.error('[LogCore-early]', ...args),
    };
    return dummyLogger;
};

// Legacy variable kept for backward compatibility
let logDisplayInstance = null;

// Rate limiting for excessive logging
const logRateLimit = {
    maxPerSecond: 50, // Allow max 50 logs per second
    logCounts: new Map(),
    
    shouldAllow: function(source, type, level) {
        const key = `${source}:${type}:${level}`;
        const now = Date.now();
        const secondWindow = Math.floor(now / 1000);
        
        if (!this.logCounts.has(key)) {
            this.logCounts.set(key, { count: 0, window: secondWindow });
        }
        
        const entry = this.logCounts.get(key);
        
        // Reset count if we're in a new second
        if (entry.window !== secondWindow) {
            entry.count = 0;
            entry.window = secondWindow;
        }
        
        // Check if we're over the limit
        if (entry.count >= this.maxPerSecond) {
            return false;
        }
        
        entry.count++;
        return true;
    }
};

// Global flag to suppress debug logging during initialization
let suppressDebugDuringInit = true;

// Auto-disable suppression after 10 seconds
setTimeout(() => {
    suppressDebugDuringInit = false;
    getLogger().info('DEBUG_LOGGING_ENABLED', 'Debug logging suppression disabled after initialization period');
}, 10000);

// Allow manual control
window.toggleLogSuppression = (enabled) => {
    suppressDebugDuringInit = enabled;
    getLogger().info('DEBUG_LOGGING_SUPPRESSION', `Debug logging suppression ${enabled ? 'enabled' : 'disabled'}`);
};

/* 0.  CONSTANTS & HELPERS ------------------------------------ */
export const LEVELS = Object.freeze(['DEBUG', 'INFO', 'WARN', 'ERROR']);

export const canonicalLevel = (raw = 'INFO') => {
    const u = String(raw).toUpperCase();
    if (u === 'WARNING') return 'WARN';
    return LEVELS.includes(u) ? u : 'INFO';
};

export const canonicalType = (raw = 'GENERAL') =>
    String(raw).trim().toUpperCase();

/* 1.  LOG PANEL REGISTRATION --------------------------------- */
/**
 * Sets the LogDisplay instance for the logging system.
 * This is called by the LogDisplay component when it mounts.
 * @param {object} instance - The LogDisplay instance.
 */
export function setLogDisplayInstance(instance) {
    logDisplayInstance = instance;
    if (instance) {
        getLogger().info('LOG_PANEL_INSTANCE_SET', 'LogDisplay instance set');
    } else {
        console.error('[LogCore] Invalid LogDisplay instance supplied');
    }
}

/* 2.  PRIMARY LOG FUNCTION ----------------------------------- */
export function log({ message,
                      source  = 'DEVPAGES',
                      level   = 'INFO',
                      type    = 'GENERAL',
                      action  = null,
                      details = null,
                      ts      = Date.now(),
                      forceConsole = false,
                      component = null }) {
    // Remove emojis from message
    const cleanMessage = message ? message.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim() : '';

    const src = String(source).toUpperCase();
    const lvl = canonicalLevel(level);
    const typ = canonicalType(type);
    const act = action ? String(action).toUpperCase() : null;
    const comp = component ? String(component).toUpperCase() : null;

    // Rate limit to prevent spam (unless forced)
    if (!forceConsole && !logRateLimit.shouldAllow(src, typ, lvl)) {
        return; // Drop the log entry silently
    }

    // Suppress debug logging during initialization (unless forced)
    if (!forceConsole && suppressDebugDuringInit && lvl === 'DEBUG') {
        return; // Drop debug logs during init
    }

    // Serialize details if it's an Error object to prevent Redux warnings
    let serializedDetails = details;
    if (details && details instanceof Error) {
        serializedDetails = {
            name: details.name,
            message: details.message,
            stack: details.stack,
            isError: true
        };
    }

    const entry = { 
        ts, 
        message: cleanMessage, 
        source: src, 
        level: lvl, 
        type: typ, 
        action: act, 
        details: serializedDetails, 
        component: comp 
    };

    // Add to LogDisplay if it exists (for UI display)
    if (logDisplayInstance) {
        logDisplayInstance.addEntry(entry);
    }

    // Console output with format: [SOURCE][COMPONENT][TYPE][ACTION] message [LEVEL]
    const isConsoleEnabled = typeof window !== 'undefined' && 
                             typeof window.APP.services.isConsoleLoggingEnabled === 'function' && 
                             window.APP.services.isConsoleLoggingEnabled();
                             
    if (forceConsole || isConsoleEnabled) {
        let prefix = `[${src}]`;
        if (comp) {
            prefix += `[${comp}]`;
        }
        prefix += `[${typ}]`;
        if (act) {
            prefix += `[${act}]`;
        }
        
        const formattedMessage = `${prefix} ${message} [${lvl}]`;
        
        switch (lvl) {
            case 'DEBUG': console.debug(formattedMessage, details); break;
            case 'INFO':  console.info(formattedMessage, details);  break;
            case 'WARN':  console.warn(formattedMessage, details);  break;
            case 'ERROR': console.error(formattedMessage, details); break;
            default:      console.log(formattedMessage, details);
        }
    }
}

/* 3.  CONVENIENCE HELPERS ----------------------------------- */
export const logDebug = (m, o = {}) => log({ ...o, message: m, level: 'DEBUG' });
export const logInfo  = (m, o = {}) => log({ ...o, message: m, level: 'INFO'  });
export const logWarn  = (m, o = {}) => log({ ...o, message: m, level: 'WARN'  });
export const logError = (m, o = {}) => log({ ...o, message: m, level: 'ERROR' });

/* 4.  CREATE LOGGER FACTORY --------------------------------- */
export function createLogger(moduleName) {
    const type = String(moduleName).toUpperCase();
    
    return {
        debug: (message, details) => log({ message, level: 'DEBUG', type, details }),
        info: (message, details) => log({ message, level: 'INFO', type, details }),
        warn: (message, details) => log({ message, level: 'WARN', type, details }),
        error: (message, details) => log({ message, level: 'ERROR', type, details })
    };
}

/* 5.  LEGACY POSITIONAL SHIM -------------------------------- */
export function legacyPositional(message,
                                 levelOrSource = 'INFO',
                                 typeOrType    = 'GENERAL',
                                 level = null) {

    try {
        if (typeof log !== 'function' || typeof canonicalLevel !== 'function' || typeof canonicalType !== 'function') {
            console.error('[LogCore] Core logging functions not available, falling back to console:', message);
            return;
        }

        if (arguments.length <= 3 || 
            ['DEBUG', 'INFO', 'WARN', 'ERROR', 'WARNING'].includes(levelOrSource.toUpperCase())) {
            
            const actualLevel = levelOrSource;
            const actualType = typeOrType;
            log({
                message,
                source: 'DEVPAGES',
                level: canonicalLevel(actualLevel),
                type: canonicalType(actualType)
            });
        } else {
            log({
                message,
                source: levelOrSource || 'DEVPAGES',
                type: canonicalType(typeOrType),
                level: canonicalLevel(level)
            });
        }
    } catch (error) {
        console.error('[LogCore] Error in legacyPositional:', error);
        console.error('[LogCore] Original message:', message);
    }
}

export { legacyPositional as globalLogMessageHandler }; 