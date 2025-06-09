/* ----------------------------------------------------------------
   Central logging hub – object-based API with legacy shim
---------------------------------------------------------------- */
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
                      subtype = null,
                      details = null,
                      ts      = Date.now(),
                      forceConsole = false,
                      component = null }) {

    const src = String(source).toUpperCase();
    const lvl = canonicalLevel(level);
    const typ = canonicalType(type);
    const sub = subtype ? String(subtype).toUpperCase() : null;
    const comp = component ? String(component).toUpperCase() : null;

    const entry = { ts, message, source: src, level: lvl, type: typ, subtype: sub, details, component: comp };

    // Always add to LogPanel if it exists
    if (logPanelInstance) {
        logPanelInstance.addEntry(entry);
    }
    
    // Console output with new format: [SOURCE][COMPONENT][TYPE][SUBTYPE][ACTION] message [LEVEL]
    const isConsoleEnabled = typeof window !== 'undefined' && 
                             typeof window.isConsoleLoggingEnabled === 'function' && 
                             window.isConsoleLoggingEnabled();
                             
    if (forceConsole || isConsoleEnabled) {
        let prefix = `[${src}]`;
        if (comp) {
            prefix += `[${comp}]`;
        }
        prefix += `[${typ}]`;
        if (sub) {
            prefix += `[${sub}]`;
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

/* 4.  LEGACY POSITIONAL SHIM -------------------------------- */
export function legacyPositional(message,
                                 levelOrSource = 'INFO',     // Could be level (old 3-param) or source (new 5-param)
                                 typeOrType    = 'GENERAL',  // Could be type (old 3-param) or type (new 5-param)
                                 subtypeOrLevel = null,      // Could be subtype (new) or undefined (old)
                                 level = null) {             // Level (new 5-param only)

    // Detect format based on number of arguments and content
    if (arguments.length <= 3 || 
        (arguments.length === 4 && subtypeOrLevel === null) ||
        ['DEBUG', 'INFO', 'WARN', 'ERROR', 'WARNING'].includes(levelOrSource.toUpperCase())) {
        
        // OLD FORMAT: logMessage(message, level, type)
        const actualLevel = levelOrSource;
        const actualType = typeOrType;
        log({
            message,
            source: 'DEVPAGES',
            level: canonicalLevel(actualLevel),
            type: canonicalType(actualType),
            subtype: null
        });
    } else {
        // NEW FORMAT: logMessage(message, source, type, subtype, level)
        log({
            message,
            source: levelOrSource || 'DEVPAGES',
            type: canonicalType(typeOrType),
            subtype: subtypeOrLevel,
            level: canonicalLevel(level)
        });
    }
}

/* expose legacy name so old imports keep working */
export { legacyPositional as globalLogMessageHandler };
if (typeof window !== 'undefined') {
    window.logMessage = legacyPositional;
}
