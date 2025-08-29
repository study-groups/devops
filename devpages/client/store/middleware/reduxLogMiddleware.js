/**
 * @file reduxLogMiddleware.js
 * @description Middleware for logging Redux actions using the UnifiedLogging system.
 * It includes aggregation to prevent flooding the console with repetitive actions.
 */

// The global logger will be initialized lazily to avoid race conditions during boot.
let log;

function getLogger() {
    if (!log) {
        log = window.APP.services.log.createLogger('REDUX', 'ACTION');
    }
    return log;
}

/**
 * Recursively clones an action object and removes non-serializable values.
 * @param {object} action - The Redux action.
 * @returns {object} A sanitized, serializable action.
 */
function sanitizeAction(action) {
    const sanitized = {};
    for (const key in action) {
        if (Object.prototype.hasOwnProperty.call(action, key)) {
            const value = action[key];
            if (value instanceof Request || value instanceof Response) {
                // Omit Request/Response objects
                continue;
            }
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Recurse into nested objects
                sanitized[key] = sanitizeAction(value);
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
}


// --- Aggregation Logic ---
let lastActionType = null;
let repeatCount = 0;
let aggregationTimer = null;
// --- Configuration ---
const FLUSH_DELAY = 2000; // After 2s of silence, flush the last count
const ignoreList = [
    'log/addEntry', // Prevents recursive logging
];

/**
 * Creates a concise summary from a Redux action payload.
 * @param {object} payload - The action's payload.
 * @returns {string} A readable summary string.
 */
function createSummary(payload) {
    if (!payload) return '';
    if (typeof payload !== 'object') return ` - ${String(payload)}`;

    const keys = Object.keys(payload);
    if (keys.length === 0) return '';
    
    // Create a summary of the payload's top-level keys
    let summary = keys.slice(0, 3).map(key => {
        const value = payload[key];
        if (typeof value === 'object' && value !== null) return key;
        return `${key}: ${String(value)}`;
    }).join(', ');

    if (keys.length > 3) summary += ', ...';
    
    return ` - { ${summary} }`;
}

/**
 * Logs the aggregated count of the last repeated action if it exceeded the threshold.
 */
function flushLastAction() {
    if (repeatCount > 2) {
        const badgeCount = repeatCount - 2;
        getLogger().info(lastActionType, `... and ${badgeCount} more`, { aggregated: true, count: badgeCount });
    }
    lastActionType = null;
    repeatCount = 0;
    if (aggregationTimer) {
        clearTimeout(aggregationTimer);
        aggregationTimer = null;
    }
}

/**
 * A Redux middleware that logs actions and aggregates repetitive ones.
 */
export const reduxLogMiddleware = store => next => action => {
    if (typeof action === 'object' && action.type && !ignoreList.includes(action.type)) {
        
        const sanitized = sanitizeAction(action);
        
        if (action.type !== lastActionType) {
            // A new action has arrived. Flush the count of the previous one.
            flushLastAction();
            
            // Start a new sequence for this action.
            lastActionType = action.type;
            repeatCount = 1;

            const message = `Action: ${action.type}${createSummary(action.payload)}`;
            getLogger().info(action.type, message, sanitized);

        } else {
            // It's a repeated action.
            repeatCount++;

            if (repeatCount <= 2) {
                const message = `Action: ${action.type}${createSummary(action.payload)}`;
                getLogger().info(action.type, message, sanitized);
            }
            // For repeats > 2, we stay silent and wait for flushLastAction to be called.
        }

        // Always reset the flush timer on a new action.
        if (aggregationTimer) {
            clearTimeout(aggregationTimer);
        }
        aggregationTimer = setTimeout(flushLastAction, FLUSH_DELAY);
    }

    // Pass the action to the next middleware in the chain.
    return next(action);
};
