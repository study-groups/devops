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
                      level   = 'INFO',
                      type    = 'GENERAL',
                      subtype = null,
                      details = null,
                      ts      = Date.now() }) {

    const lvl = canonicalLevel(level);
    const typ = canonicalType(type);
    const sub = subtype ? String(subtype).toUpperCase() : null;

    const entry = { ts, message, level: lvl, type: typ, subtype: sub, details };

    if (logPanelInstance) {
        logPanelInstance.addEntry(entry);   // new path
    } else {
        console.log(`[${lvl}] [${typ}${sub ? ':' + sub : ''}] ${message}`,
                    details ?? '');
    }
}

/* 3.  CONVENIENCE HELPERS ----------------------------------- */
export const logDebug = (m, o = {}) => log({ ...o, message: m, level: 'DEBUG' });
export const logInfo  = (m, o = {}) => log({ ...o, message: m, level: 'INFO'  });
export const logWarn  = (m, o = {}) => log({ ...o, message: m, level: 'WARN'  });
export const logError = (m, o = {}) => log({ ...o, message: m, level: 'ERROR' });

/* 4.  LEGACY POSITIONAL SHIM -------------------------------- */
export function legacyPositional(message,
                                 maybeLevel = 'INFO',
                                 maybeType  = 'GENERAL') {
    log({
        message,
        level : canonicalLevel(maybeLevel),
        type  : canonicalType(maybeType)
    });
}

/* expose legacy name so old imports keep working */
export { legacyPositional as globalLogMessageHandler };
if (typeof window !== 'undefined') {
    window.logMessage = legacyPositional;
}
