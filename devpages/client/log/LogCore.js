/**
 * LogCore.js – Central Logging System
 * Provides unified logging functionality for console output only
 * Store integration is handled separately to avoid circular dispatch issues
 */

import { logRateLimiter } from './LogRateLimiter.js';
import { logConsoleOutput } from './LogConsoleOutput.js';

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
                      source  = 'CLIENT',  // Changed default to CLIENT
                      level   = 'INFO',
                      type    = 'GENERAL',
                      module  = null,      // Added module parameter
                      action  = null,
                      details = null,
                      ts      = Date.now(),
                      forceConsole = false,
                      component = null }) {
    // Remove emojis from message
    const cleanMessage = message && typeof message === 'string' ? message.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim() : String(message || '');

    const src = String(source).toUpperCase();
    const lvl = canonicalLevel(level);
    const typ = canonicalType(type);
    const mod = module ? String(module).toUpperCase() : null;  // Added module processing
    const act = action ? String(action).toUpperCase() : null;
    const comp = component ? String(component).toUpperCase() : null;

    // Rate limit to prevent spam (unless forced)
    if (!forceConsole && !logRateLimiter.shouldAllow(src, typ, lvl)) {
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
        module: mod,    // Added module to entry
        action: act, 
        details: serializedDetails, 
        component: comp 
    };

    // Add to LogDisplay if it exists (for UI display)
    if (logDisplayInstance) {
        logDisplayInstance.addEntry(entry);
    }

    // Console output with format: [SOURCE][TYPE][MODULE][ACTION] message [LEVEL]
    logConsoleOutput.output(entry, forceConsole);
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