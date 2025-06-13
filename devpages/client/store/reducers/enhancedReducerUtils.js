/**
 * Enhanced Reducer Utilities for DevPages
 * Provides unified state persistence through the reducer pattern
 * Eliminates multiple localStorage access patterns
 */

import { logMessage } from '/client/log/index.js';

const logger = {
    debug: (msg, data) => logMessage(msg, 'debug', 'REDUCER_UTILS', data),
    warn: (msg, data) => logMessage(msg, 'warn', 'REDUCER_UTILS', data),
    error: (msg, data) => logMessage(msg, 'error', 'REDUCER_UTILS', data)
};

// Global dispatch function - will be set by the store
let globalDispatch = null;

/**
 * Set the global dispatch function
 * This should be called once during app initialization
 * @param {Function} dispatch - The dispatch function from the store
 */
export const setGlobalDispatch = (dispatch) => {
    globalDispatch = dispatch;
    logger.debug('Global dispatch function set');
};

/**
 * Enhanced helper to load state from localStorage with validation
 * @param {string} key - localStorage key
 * @param {*} defaultValue - Default value if key doesn't exist or is invalid
 * @param {Function} validator - Optional function to validate loaded data
 * @returns {*} Retrieved value or default
 */
export const loadFromStorage = (key, defaultValue, validator = null) => {
    try {
        const storedValue = localStorage.getItem(key);
        if (storedValue === null) return defaultValue;
        
        const parsedValue = JSON.parse(storedValue);
        
        if (validator && !validator(parsedValue)) {
            logger.warn(`Loaded value for ${key} failed validation, using default.`);
            return defaultValue;
        }
        
        return parsedValue;
    } catch (e) {
        logger.error(`Error loading ${key} from localStorage:`, e);
        return defaultValue;
    }
};

/**
 * Enhanced persister that handles errors gracefully
 * @param {string} key - localStorage key
 * @param {Function} selector - Function to select data from state
 * @returns {Function} Persistence function that can be called with state
 */
export const createPersister = (key, selector) => {
    return (state) => {
        try {
            const dataToStore = selector(state);
            localStorage.setItem(key, JSON.stringify(dataToStore));
            return true;
        } catch (e) {
            logger.error(`Failed to persist ${key} to localStorage:`, e);
            return false;
        }
    };
};

/**
 * Create a reducer with automatic persistence
 * @param {object} initialState - Initial state (loaded from localStorage if available)
 * @param {object} actionHandlers - Map of action types to handler functions
 * @param {object} persistenceConfig - Configuration for automatic persistence
 * @returns {Function} Reducer function
 */
export const createPersistedReducer = (initialState, actionHandlers, persistenceConfig = {}) => {
    const {
        stateKey,           // localStorage key for the entire state slice
        persistOnActions,   // Array of action types that trigger persistence
        persistSelectors,   // Object mapping localStorage keys to state selectors
        debounceMs = 300   // Debounce persistence calls
    } = persistenceConfig;

    // Create debounced persistence functions
    const debouncedPersist = debounce((state) => {
        if (stateKey) {
            // Persist entire state slice
            try {
                localStorage.setItem(stateKey, JSON.stringify(state));
                logger.debug(`Persisted state slice: ${stateKey}`);
            } catch (e) {
                logger.error(`Failed to persist state slice ${stateKey}:`, e);
            }
        }

        if (persistSelectors) {
            // Persist specific parts of state
            Object.entries(persistSelectors).forEach(([key, selector]) => {
                try {
                    const data = selector(state);
                    localStorage.setItem(key, JSON.stringify(data));
                    logger.debug(`Persisted state part: ${key}`);
                } catch (e) {
                    logger.error(`Failed to persist state part ${key}:`, e);
                }
            });
        }
    }, debounceMs);

    return (state = initialState, action) => {
        const handler = actionHandlers[action.type];
        if (!handler) return state;

        const newState = handler(state, action);
        
        // Auto-persist if configured
        if (persistOnActions && persistOnActions.includes(action.type)) {
            debouncedPersist(newState);
        }

        return newState;
    };
};

/**
 * Create bound action creators that automatically dispatch
 * @param {object} actionCreators - Map of action creator functions
 * @returns {object} Bound action creators
 */
export const createBoundActions = (actionCreators) => {
    const boundActions = {};
    
    Object.entries(actionCreators).forEach(([key, actionCreator]) => {
        boundActions[key] = (...args) => {
            if (!globalDispatch) {
                logger.error(`Cannot dispatch ${key}: global dispatch not set. Call setGlobalDispatch() first.`);
                return;
            }
            
            const action = actionCreator(...args);
            return globalDispatch(action);
        };
    });
    
    return boundActions;
};

/**
 * Create a state slice with automatic persistence and bound actions
 * @param {string} sliceName - Name of the state slice
 * @param {object} config - Configuration object
 * @returns {object} Reducer, actions, and bound actions
 */
export const createStateSlice = (sliceName, config) => {
    const {
        initialState,
        reducers,
        persistenceConfig = {}
    } = config;

    // Load initial state from localStorage if configured
    let loadedInitialState = initialState;
    if (persistenceConfig.stateKey) {
        try {
            const stored = localStorage.getItem(persistenceConfig.stateKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                loadedInitialState = { ...initialState, ...parsed };
                logger.debug(`Loaded initial state for ${sliceName} from localStorage`);
            }
        } catch (e) {
            logger.error(`Failed to load initial state for ${sliceName}:`, e);
        }
    }

    // Create action types
    const actionTypes = {};
    Object.keys(reducers).forEach(key => {
        actionTypes[key] = `${sliceName.toUpperCase()}_${key.toUpperCase()}`;
    });

    // Create action handlers map
    const actionHandlers = {};
    Object.entries(reducers).forEach(([key, reducer]) => {
        actionHandlers[actionTypes[key]] = reducer;
    });

    // Create the reducer
    const reducer = createPersistedReducer(
        loadedInitialState,
        actionHandlers,
        persistenceConfig
    );

    // Create action creators
    const actions = {};
    Object.keys(reducers).forEach(key => {
        actions[key] = (payload) => ({
            type: actionTypes[key],
            payload
        });
    });

    // Create bound actions that automatically dispatch
    const boundActions = createBoundActions(actions);

    return {
        reducer,
        actions,
        boundActions,
        actionTypes
    };
};

/**
 * Utility to create a simple toggle persister with bound actions
 * @param {string} key - localStorage key
 * @param {boolean} defaultValue - Default value
 * @returns {object} Toggle utilities with bound actions
 */
export const createToggleSlice = (key, defaultValue = false) => {
    const initialState = loadFromStorage(key, defaultValue);
    
    const slice = createStateSlice(key, {
        initialState: { value: initialState },
        reducers: {
            toggle: (state) => {
                const newValue = !state.value;
                return { value: newValue };
            },
            set: (state, action) => {
                return { value: action.payload };
            }
        },
        persistenceConfig: {
            stateKey: key,
            persistOnActions: [`${key.toUpperCase()}_TOGGLE`, `${key.toUpperCase()}_SET`]
        }
    });

    // Add convenience methods
    slice.toggle = slice.boundActions.toggle;
    slice.set = slice.boundActions.set;
    slice.getValue = () => {
        // This would need access to the store - we'll handle this differently
        return loadFromStorage(key, defaultValue);
    };

    return slice;
};

/**
 * Utility to create a settings slice with validation and bound actions
 * @param {string} sliceName - Name of the settings slice
 * @param {object} defaultSettings - Default settings object
 * @param {object} schema - Validation schema
 * @returns {object} Settings slice utilities with bound actions
 */
export const createSettingsSlice = (sliceName, defaultSettings, schema = null) => {
    const stateKey = `devpages_${sliceName}_settings`;
    
    // Load and validate initial state
    let initialState = defaultSettings;
    try {
        const stored = localStorage.getItem(stateKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (schema && !validateSettings(parsed, schema)) {
                logger.warn(`Invalid stored settings for ${sliceName}, using defaults`);
            } else {
                initialState = { ...defaultSettings, ...parsed };
            }
        }
    } catch (e) {
        logger.error(`Failed to load settings for ${sliceName}:`, e);
    }

    const slice = createStateSlice(sliceName, {
        initialState,
        reducers: {
            updateSetting: (state, action) => {
                const { key, value } = action.payload;
                return { ...state, [key]: value };
            },
            updateSettings: (state, action) => {
                return { ...state, ...action.payload };
            },
            resetSettings: () => {
                return { ...defaultSettings };
            },
            updateNestedSetting: (state, action) => {
                const { path, value } = action.payload;
                const newState = { ...state };
                setNestedProperty(newState, path, value);
                return newState;
            }
        },
        persistenceConfig: {
            stateKey,
            persistOnActions: [
                `${sliceName.toUpperCase()}_UPDATE_SETTING`,
                `${sliceName.toUpperCase()}_UPDATE_SETTINGS`,
                `${sliceName.toUpperCase()}_RESET_SETTINGS`,
                `${sliceName.toUpperCase()}_UPDATE_NESTED_SETTING`
            ]
        }
    });

    // Add convenience methods with cleaner API
    slice.update = slice.boundActions.updateSettings;
    slice.set = (key, value) => slice.boundActions.updateSetting({ key, value });
    slice.setNested = (path, value) => slice.boundActions.updateNestedSetting({ path, value });
    slice.reset = slice.boundActions.resetSettings;

    return slice;
};

/**
 * Create a fluent API for state management
 * @param {string} sliceName - Name of the state slice
 * @param {object} initialState - Initial state
 * @returns {object} Fluent API
 */
export const createFluentSlice = (sliceName, initialState) => {
    const slice = createStateSlice(sliceName, {
        initialState,
        reducers: {
            set: (state, action) => ({ ...state, ...action.payload }),
            update: (state, action) => {
                const { path, value } = action.payload;
                const newState = { ...state };
                setNestedProperty(newState, path, value);
                return newState;
            },
            reset: () => ({ ...initialState })
        },
        persistenceConfig: {
            stateKey: `devpages_${sliceName}`,
            persistOnActions: [
                `${sliceName.toUpperCase()}_SET`,
                `${sliceName.toUpperCase()}_UPDATE`,
                `${sliceName.toUpperCase()}_RESET`
            ]
        }
    });

    // Create fluent API
    const api = {
        // Direct property setters
        ...Object.keys(initialState).reduce((acc, key) => {
            acc[key] = (value) => {
                slice.boundActions.update({ path: key, value });
                return api; // Return for chaining
            };
            return acc;
        }, {}),

        // Bulk operations
        set: (updates) => {
            slice.boundActions.set(updates);
            return api;
        },

        update: (path, value) => {
            slice.boundActions.update({ path, value });
            return api;
        },

        reset: () => {
            slice.boundActions.reset();
            return api;
        }
    };

    return { ...slice, api };
};

/**
 * Validate settings against schema
 * @param {object} settings - Settings to validate
 * @param {object} schema - Validation schema
 * @returns {boolean} Validation result
 */
function validateSettings(settings, schema) {
    if (typeof settings !== 'object' || settings === null) {
        return false;
    }

    for (const [key, expectedType] of Object.entries(schema)) {
        if (typeof expectedType === 'string') {
            if (typeof settings[key] !== expectedType) {
                return false;
            }
        } else if (typeof expectedType === 'object' && expectedType.type) {
            if (typeof settings[key] !== expectedType.type) {
                return false;
            }
            if (expectedType.required && settings[key] === undefined) {
                return false;
            }
        }
    }
    
    return true;
}

/**
 * Set nested property using dot notation
 * @param {object} obj - Object to modify
 * @param {string} path - Dot-notation path
 * @param {*} value - Value to set
 */
function setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Migration utilities for state schema changes
 */
export const migrationUtils = {
    /**
     * Apply migrations to state
     * @param {object} state - State to migrate
     * @param {object} migrations - Migration functions
     * @param {number} currentVersion - Current version
     * @returns {object} Migrated state
     */
    applyMigrations(state, migrations, currentVersion) {
        const stateVersion = state._version || 1;
        
        if (stateVersion < currentVersion) {
            logger.debug(`Migrating state from v${stateVersion} to v${currentVersion}`);
            
            for (let v = stateVersion; v < currentVersion; v++) {
                const migrationKey = `${v}_to_${v + 1}`;
                if (migrations[migrationKey]) {
                    state = migrations[migrationKey](state);
                    logger.debug(`Applied migration: ${migrationKey}`);
                }
            }
            
            state._version = currentVersion;
        }
        
        return state;
    },

    /**
     * Create a migration-aware state slice
     * @param {string} sliceName - Name of the slice
     * @param {object} config - Configuration with migrations
     * @returns {object} State slice with migration support
     */
    createMigratableSlice(sliceName, config) {
        const { migrations, version, ...restConfig } = config;
        
        // Override initial state loading to apply migrations
        const originalStateKey = restConfig.persistenceConfig?.stateKey;
        if (originalStateKey && migrations && version) {
            try {
                const stored = localStorage.getItem(originalStateKey);
                if (stored) {
                    let parsed = JSON.parse(stored);
                    parsed = this.applyMigrations(parsed, migrations, version);
                    restConfig.initialState = { ...restConfig.initialState, ...parsed };
                }
            } catch (e) {
                logger.error(`Failed to load and migrate state for ${sliceName}:`, e);
            }
        }
        
        return createStateSlice(sliceName, restConfig);
    }
};

/**
 * Cleanup utilities for localStorage management
 */
export const cleanupUtils = {
    /**
     * Clean up old localStorage entries
     * @param {string} prefix - Key prefix to clean
     * @param {number} maxAge - Max age in milliseconds
     * @returns {number} Number of entries cleaned
     */
    cleanupOldEntries(prefix = 'devpages', maxAge = 30 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data._lastSaved && (now - data._lastSaved) > maxAge) {
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    // Invalid JSON, mark for removal
                    keysToRemove.push(key);
                }
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            logger.debug(`Cleaned up old state: ${key}`);
        });
        
        return keysToRemove.length;
    },

    /**
     * Clear all DevPages localStorage entries
     * @param {string} prefix - Key prefix to clear
     */
    clearAllDevPagesState(prefix = 'devpages') {
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        logger.debug(`Cleared ${keysToRemove.length} DevPages state entries`);
        return keysToRemove.length;
    }
}; 