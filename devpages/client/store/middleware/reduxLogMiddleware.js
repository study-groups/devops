/**
 * @file reduxLogMiddleware.js
 * @description Middleware for logging Redux actions using the UnifiedLogging system.
 * It includes aggregation to prevent flooding the console with repetitive actions.
 */

// Debug flag - persisted to localStorage, controls whether Redux actions are logged
let DEBUG_REDUX_LOG = localStorage.getItem('ReduxLog.debug') !== 'false'; // Default ON for backwards compat

// Expose debug toggle globally with persistence
window.ReduxLog = window.ReduxLog || {};
Object.defineProperty(window.ReduxLog, 'debug', {
    get: () => DEBUG_REDUX_LOG,
    set: (v) => {
        DEBUG_REDUX_LOG = !!v;
        localStorage.setItem('ReduxLog.debug', DEBUG_REDUX_LOG);
        console.log(`[ReduxLog] Debug mode: ${DEBUG_REDUX_LOG ? 'ON' : 'OFF'}`);
    }
});

// Register with Console Tools registry (deferred to ensure registry is loaded)
setTimeout(() => {
    if (window.consoleTools) {
        window.consoleTools.register({
            name: 'ReduxLog',
            description: 'Control Redux action dispatch logging',
            icon: '🔄',
            toggle: () => { window.ReduxLog.debug = !window.ReduxLog.debug; },
            isEnabled: () => DEBUG_REDUX_LOG,
            commands: [
                { name: 'on', fn: () => { window.ReduxLog.debug = true; }, description: 'Enable Redux logging' },
                { name: 'off', fn: () => { window.ReduxLog.debug = false; }, description: 'Disable Redux logging' },
                { name: 'status', fn: () => console.log(`ReduxLog debug: ${DEBUG_REDUX_LOG ? 'ON' : 'OFF'}`), description: 'Show current state' }
            ]
        });
    }
}, 100);

// The global logger will be initialized lazily to avoid race conditions during boot.
let log;

function getLogger() {
    if (!log) {
        // Create logger with proper parameters for UnifiedLogging compatibility
        log = window.APP.services.log.createLogger('REDUX', 'CLIENT');
    }
    return log;
}

/**
 * Extracts the slice name from a Redux action type.
 * @param {string} actionType - The Redux action type (e.g., 'ui/toggleSidebar')
 * @returns {string} The slice name (e.g., 'UI')
 */
function extractSliceName(actionType) {
    if (!actionType || typeof actionType !== 'string') {
        return 'UNKNOWN';
    }
    
    // Split by '/' and take the first part as the slice name
    const parts = actionType.split('/');
    const sliceName = parts[0];
    
    // Convert to uppercase and handle special cases
    if (!sliceName) {
        return 'ROOT';
    }
    
    return sliceName.toUpperCase();
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
    // Reduce API call noise during startup
    'api/executeQuery/pending',
    'api/executeQuery/fulfilled',
    'authApi/executeQuery/pending', 
    'authApi/executeQuery/fulfilled',
    'pathApi/executeQuery/pending',
    'pathApi/executeQuery/fulfilled',
];

/**
 * Creates a clean, readable summary from a Redux action.
 * @param {object} action - The complete Redux action.
 * @returns {string} A formatted action description.
 */
function formatReduxAction(action) {
    const { type, payload } = action;
    
    // Handle async thunks first (they can apply to any domain)
    if (type.includes('/pending') || type.includes('/fulfilled') || type.includes('/rejected')) {
        return formatAsyncThunkAction(type, payload);
    }
    
    // Extract meaningful info based on action domain
    if (type.includes('panels/')) {
        return formatPanelAction(type, payload);
    }
    
    if (type.includes('file/')) {
        return formatFileAction(type, payload);
    }
    
    if (type.includes('ui/')) {
        return formatUIAction(type, payload);
    }
    
    if (type.includes('auth/')) {
        return formatAuthAction(type, payload);
    }
    
    if (type.includes('api/') || type.includes('Api')) {
        return formatApiAction(type, payload);
    }
    
    // Default formatting for other actions
    return formatDefaultAction(type, payload);
}

function formatAsyncThunkAction(type, payload) {
    // Parse the base action and state
    const isPending = type.includes('/pending');
    const isFulfilled = type.includes('/fulfilled');
    const isRejected = type.includes('/rejected');
    
    const baseAction = type.replace(/\/(pending|fulfilled|rejected)$/, '');
    const domain = baseAction.split('/')[0] || 'unknown';
    const action = baseAction.split('/').slice(1).join('/').replace(/([A-Z])/g, ' $1').trim();
    
    // Domain-specific formatting
    if (domain.includes('file')) {
        const path = payload?.meta?.arg?.path || payload?.meta?.arg || '';
        if (isPending) return `⏳ Loading file: ${path}`;
        if (isFulfilled) return `📄 File loaded: ${path}`;
        if (isRejected) return `❌ File load failed: ${path}`;
    }
    
    if (domain.includes('auth')) {
        if (isPending) return `🔐 Authenticating...`;
        if (isFulfilled) return `✅ Authentication successful`;
        if (isRejected) return `❌ Authentication failed: ${payload?.error?.message || 'Unknown error'}`;
    }
    
    if (domain.includes('api')) {
        const endpoint = payload?.meta?.arg?.url || payload?.meta?.arg?.endpoint || '';
        if (isPending) return `🌐 API call: ${endpoint}`;
        if (isFulfilled) return `✅ API success: ${endpoint}`;
        if (isRejected) return `❌ API failed: ${endpoint}`;
    }
    
    // Generic async thunk formatting
    if (isPending) return `⏳ ${action || domain} starting...`;
    if (isFulfilled) return `✅ ${action || domain} completed`;
    if (isRejected) return `❌ ${action || domain} failed: ${payload?.error?.message || 'Unknown error'}`;
    
    return `⚡ ${action || domain}`;
}

function formatAuthAction(type, payload) {
    const action = type.split('/')[1];
    
    switch (action) {
        case 'login':
            return `🔐 Login attempt: ${payload?.username || 'unknown user'}`;
        case 'logout':
            return `🚪 User logout`;
        case 'checkAuth':
            return `🔍 Checking authentication status`;
        default:
            return `🔐 Auth ${action}`;
    }
}

function formatApiAction(type, payload) {
    const action = type.split('/')[1];
    const endpoint = payload?.endpoint || payload?.url || '';
    
    switch (action) {
        case 'request':
            return `🌐 API Request: ${endpoint}`;
        case 'success':
            return `✅ API Success: ${endpoint}`;
        case 'error':
            return `❌ API Error: ${endpoint}`;
        default:
            return `🌐 API ${action}: ${endpoint}`;
    }
}

function formatPanelAction(type, payload) {
    const action = type.split('/')[1];
    
    switch (action) {
        case 'createPanel':
            return `📋 Create Panel: ${payload?.title || payload?.id || 'unknown'} (${payload?.type || 'generic'})`;
        case 'updatePanel':
            return `🔄 Update Panel: ${payload?.id || 'unknown'}`;
        case 'removePanel':
            return `❌ Remove Panel: ${payload?.id || 'unknown'}`;
        case 'activatePanel':
            return `✅ Activate Panel: ${payload?.id || 'unknown'}`;
        default:
            return `🎛️ Panel ${action}: ${payload?.id || ''}`;
    }
}

function formatFileAction(type, payload) {
    const action = type.split('/')[1];
    
    switch (action) {
        case 'loadFile':
            return `📄 Load File: ${payload?.path || 'unknown'}`;
        case 'saveFile':
            return `💾 Save File: ${payload?.path || 'unknown'}`;
        case 'createFile':
            return `➕ Create File: ${payload?.path || 'unknown'}`;
        default:
            return `📁 File ${action}: ${payload?.path || ''}`;
    }
}

function formatUIAction(type, payload) {
    const action = type.split('/')[1];
    
    switch (action) {
        case 'toggleSidebar':
            return `🔀 Toggle Sidebar: ${payload?.visible ? 'show' : 'hide'}`;
        case 'setActiveView':
            return `👁️ Switch View: ${payload?.view || 'unknown'}`;
        default:
            return `🎨 UI ${action}`;
    }
}

function formatDefaultAction(type, payload) {
    // Clean up the action type for display
    const cleanType = type.replace(/^.*\//, '').replace(/([A-Z])/g, ' $1').trim();
    
    // Add key info if available
    if (payload && typeof payload === 'object') {
        const keyInfo = extractKeyInfo(payload);
        return keyInfo ? `⚡ ${cleanType}: ${keyInfo}` : `⚡ ${cleanType}`;
    }
    
    return `⚡ ${cleanType}`;
}

function extractKeyInfo(payload) {
    // Extract the most important piece of info from payload
    const priorityKeys = ['id', 'name', 'title', 'path', 'type', 'action'];
    
    for (const key of priorityKeys) {
        if (payload[key] && typeof payload[key] === 'string') {
            return payload[key];
        }
    }
    
    return null;
}

/**
 * Logs the aggregated count of the last repeated action if it exceeded the threshold.
 */
function flushLastAction() {
    if (repeatCount > 2) {
        const badgeCount = repeatCount - 2;
        const sliceName = extractSliceName(lastActionType);
        
        // Use LogCore directly for consistent format
        import('../../log/LogCore.js').then(({ log: logCore }) => {
            logCore({
                message: `🔄 Repeated ${badgeCount} more times`,
                source: 'CLIENT',
                type: 'REDUX',
                module: sliceName,
                action: 'REPEAT_COUNT',
                level: 'INFO',
                details: { aggregated: true, count: badgeCount, actionType: lastActionType },
                forceConsole: false
            });
        }).catch(() => {
            // Fallback to existing logger if LogCore unavailable
            getLogger().info('REPEAT_COUNT', `🔄 Repeated ${badgeCount} more times`, { aggregated: true, count: badgeCount, actionType: lastActionType });
        });
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
    // Skip logging if debug mode is disabled
    if (!DEBUG_REDUX_LOG) {
        return next(action);
    }

    if (typeof action === 'object' && action.type && !ignoreList.includes(action.type)) {
        
        const sanitized = sanitizeAction(action);
        
        if (action.type !== lastActionType) {
            // A new action has arrived. Flush the count of the previous one.
            flushLastAction();
            
            // Start a new sequence for this action.
            lastActionType = action.type;
            repeatCount = 1;

            const message = formatReduxAction(action);
            const sliceName = extractSliceName(action.type);
            
            // Use LogCore directly for proper SOURCE|TYPE|MODULE|ACTION format
            import('../../log/LogCore.js').then(({ log: logCore }) => {
                logCore({
                    message,
                    source: 'CLIENT',
                    type: 'REDUX',
                    module: sliceName,
                    action: 'DISPATCH',
                    level: 'INFO',
                    details: sanitized,
                    forceConsole: false
                });
            }).catch(() => {
                // Fallback to existing logger if LogCore unavailable
                getLogger().info('DISPATCH', message, sanitized);
            });

        } else {
            // It's a repeated action.
            repeatCount++;

            if (repeatCount <= 2) {
                const message = formatReduxAction(action);
                const sliceName = extractSliceName(action.type);
                
                // Use LogCore directly for proper SOURCE|TYPE|MODULE|ACTION format
                import('../../log/LogCore.js').then(({ log: logCore }) => {
                    logCore({
                        message,
                        source: 'CLIENT',
                        type: 'REDUX',
                        module: sliceName,
                        action: 'DISPATCH',
                        level: 'INFO',
                        details: sanitized,
                        forceConsole: false
                    });
                }).catch(() => {
                    // Fallback to existing logger if LogCore unavailable
                    getLogger().info('DISPATCH', message, sanitized);
                });
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
