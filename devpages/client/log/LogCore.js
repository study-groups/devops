/**
 * LogCore.js - Central logging hub with object-based API and legacy shim
 * Renamed from core.js and simplified by removing subtype functionality
 */
let logPanelInstance = null;

/* 0.  CONSTANTS & HELPERS ------------------------------------ */
export const LEVELS = Object.freeze(['DEBUG', 'INFO', 'WARN', 'ERROR']);

export const canonicalLevel = (raw = 'INFO') => {
    const u = String(raw).toUpperCase();
    if (u === 'WARNING') return 'WARN';
    return LEVELS.includes(u) ? u : 'INFO';
};
export const canonicalType  = (raw = 'GENERAL') =>
    String(raw).trim().toUpperCase();

/* 1.  LOG PANEL REGISTRATION --------------------------------- */
export function setLogPanelInstance(instance) {
    if (instance && typeof instance.addEntry === 'function') {
        logPanelInstance = instance;
    } else {
        console.error('[LogCore] Invalid LogPanel instance supplied');
        logPanelInstance = null;
    }
}

/* 2.  PRIMARY LOG FUNCTION ----------------------------------- */
export function log({ message,
                      source  = 'DEVPAGES',
                      level   = 'INFO',
                      type    = 'GENERAL',
                      action  = null,      // NEW: Support ACTION instead of subtype (005.5.md)
                      details = null,
                      ts      = Date.now(),
                      forceConsole = false,
                      component = null }) {

    const src = String(source).toUpperCase();
    const lvl = canonicalLevel(level);
    const typ = canonicalType(type);
    const act = action ? String(action).toUpperCase() : null;
    const comp = component ? String(component).toUpperCase() : null;

    const entry = { ts, message, source: src, level: lvl, type: typ, action: act, details, component: comp };

    // Always add to LogPanel if it exists
    if (logPanelInstance) {
        logPanelInstance.addEntry(entry);
    }
    
    // Console output with format: [SOURCE][COMPONENT][TYPE][ACTION] message [LEVEL] (005.5.md)
    const isConsoleEnabled = typeof window !== 'undefined' && 
                             typeof window.isConsoleLoggingEnabled === 'function' && 
                             window.isConsoleLoggingEnabled();
                             
    if (forceConsole || isConsoleEnabled) {
        let prefix = `[${src}]`;
        if (comp) {
            prefix += `[${comp}]`;
        }
        prefix += `[${typ}]`;
        if (act) {
            prefix += `[${act}]`;  // Add ACTION support (005.5.md)
        }
        
        const formattedMessage = `${prefix} ${message} [${lvl}]`;
        
        switch (lvl) {
            case 'DEBUG': console.debug(formattedMessage); break;
            case 'INFO':  console.info(formattedMessage);  break;
            case 'WARN':  console.warn(formattedMessage);  break;
            case 'ERROR': console.error(formattedMessage); break;
            default:      console.log(formattedMessage);
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
                                 levelOrSource = 'INFO',     // Could be level (old 3-param) or source (new 4-param)
                                 typeOrType    = 'GENERAL',  // Could be type (old 3-param) or type (new 4-param)
                                 level = null) {             // Level (new 4-param only)

    // Detect format based on number of arguments and content
    if (arguments.length <= 3 || 
        ['DEBUG', 'INFO', 'WARN', 'ERROR', 'WARNING'].includes(levelOrSource.toUpperCase())) {
        
        // OLD FORMAT: logMessage(message, level, type)
        const actualLevel = levelOrSource;
        const actualType = typeOrType;
        log({
            message,
            source: 'DEVPAGES',
            level: canonicalLevel(actualLevel),
            type: canonicalType(actualType)
        });
    } else {
        // NEW FORMAT: logMessage(message, source, type, level)
        log({
            message,
            source: levelOrSource || 'DEVPAGES',
            type: canonicalType(typeOrType),
            level: canonicalLevel(level)
        });
    }
}

/* expose legacy name so old imports keep working */
export { legacyPositional as globalLogMessageHandler };
if (typeof window !== 'undefined') {
    window.logMessage = legacyPositional;
} 