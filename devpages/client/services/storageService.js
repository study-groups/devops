/**
 * @module storageService
 * @description A centralized and versioned wrapper for window.localStorage.
 * This service ensures that all data saved to localStorage is namespaced,
 * versioned, and timestamped to prevent stale data issues after updates.
 *
 * It gracefully handles storage availability and parsing errors.
 */

let log;
const getLogger = () => {
    if (log) {
        return log;
    }
    if (window.APP && window.APP.services && window.APP.services.log && window.APP.services.log.createLogger) {
        log = window.APP.services.log.createLogger('StorageService');
        return log;
    }
    const dummyLogger = {
        debug: () => {},
        info: () => {},
        warn: (...args) => console.warn('[StorageService-early]', ...args),
        error: (...args) => console.error('[StorageService-early]', ...args),
    };
    return dummyLogger;
};

const STORAGE_PREFIX = 'devpages_';
const METADATA_VERSION = '1.1'; // Internal version for the wrapper format itself

let isStorageAvailable = false;
try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    isStorageAvailable = true;
} catch (e) {
    getLogger().warn('STORAGE_UNAVAILABLE', 'localStorage is not available. Persistence will be disabled.', e);
}

/**
 * Retrieves an item from localStorage, handling versioning and parsing.
 * @param {string} key - The key for the item (without prefix).
 * @returns {any | null} The parsed value or null if not found, invalid, or error.
 */
function getItem(key) {
    if (!isStorageAvailable) return null;

    const fullKey = `${STORAGE_PREFIX}${key}`;
    try {
        const storedValue = localStorage.getItem(fullKey);
        if (storedValue === null) {
            return null;
        }

        const parsed = JSON.parse(storedValue);

        if (typeof parsed !== 'object' || parsed === null || !parsed.hasOwnProperty('wrapperVersion')) {
             getLogger().warn('GET_ITEM_INVALID', `Item '${key}' has an invalid format. Discarding.`);
             localStorage.removeItem(fullKey);
             return null;
        }
        
        if (parsed.wrapperVersion !== METADATA_VERSION) {
            getLogger().warn('GET_ITEM_MISMATCH', `Item '${key}' has a mismatched wrapper version (got ${parsed.wrapperVersion}, expected ${METADATA_VERSION}). Discarding.`);
            localStorage.removeItem(fullKey);
            return null;
        }

        return parsed.payload;
    } catch (error) {
        getLogger().error('GET_ITEM_FAILED', `Failed to retrieve or parse item '${key}' from localStorage.`, error);
        localStorage.removeItem(fullKey); // Clean up corrupted data
        return null;
    }
}

/**
 * Saves an item to localStorage with versioning and metadata.
 * @param {string} key - The key for the item (without prefix).
 * @param {any} value - The value to be stored. Must be JSON-serializable.
 */
function setItem(key, value) {
    if (!isStorageAvailable) return;

    const fullKey = `${STORAGE_PREFIX}${key}`;
    try {
        const dataToStore = {
            wrapperVersion: METADATA_VERSION,
            timestamp: new Date().toISOString(),
            payload: value,
        };
        localStorage.setItem(fullKey, JSON.stringify(dataToStore));
    } catch (error) {
        getLogger().error('SET_ITEM_FAILED', `Failed to save item '${key}' to localStorage.`, error);
    }
}

/**
 * Removes an item from localStorage.
 * @param {string} key - The key for the item to remove (without prefix).
 */
function removeItem(key) {
    if (!isStorageAvailable) return;
    const fullKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(fullKey);
}

/**
 * Clears all items managed by this service (i.e., with the correct prefix).
 */
function clearAll() {
    if (!isStorageAvailable) return;

    Object.keys(localStorage)
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    getLogger().info('CLEAR_ALL', 'Cleared all managed localStorage items.');
}

export const storageService = {
    getItem,
    setItem,
    removeItem,
    clearAll,
};
