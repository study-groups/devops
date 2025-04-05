// uiState.js - Manages UI state variables and persistence

// Constants for localStorage keys
const VIEW_MODE_KEY = 'viewMode';
const SIDEBAR_VISIBLE_KEY = 'sidebarVisible';

// Default state values
const DEFAULT_VIEW_MODE = 'split'; // 'code', 'preview', 'split'
const DEFAULT_SIDEBAR_VISIBLE = true;

// The reactive state object (Ensure this is the only definition)
const uiState = {
    viewMode: DEFAULT_VIEW_MODE,
    sidebarVisible: DEFAULT_SIDEBAR_VISIBLE,
    // Add other UI state variables here as needed
};

/**
 * Initialize the UI state by loading from localStorage.
 */
export function initializeUIState() {
    const savedViewMode = localStorage.getItem(VIEW_MODE_KEY);
    const savedSidebarVisible = localStorage.getItem(SIDEBAR_VISIBLE_KEY);

    uiState.viewMode = savedViewMode || DEFAULT_VIEW_MODE;
    uiState.sidebarVisible = savedSidebarVisible !== null ? savedSidebarVisible === 'true' : DEFAULT_SIDEBAR_VISIBLE;

    // Log initial state using window.logMessage if available
    const logFunc = typeof window.logMessage === 'function' ? window.logMessage : console.log;
    logFunc(`[UI STATE] Initialized: ViewMode=${uiState.viewMode}, SidebarVisible=${uiState.sidebarVisible}`);
}

/**
 * Get the current value of a UI state variable.
 * @param {string} key - The state key (e.g., 'viewMode').
 * @returns {*} The current value of the state variable.
 */
export function getUIState(key) {
    return uiState[key];
}

/**
 * Set the value of a UI state variable and save to localStorage.
 * @param {string} key - The state key (e.g., 'viewMode').
 * @param {*} value - The new value.
 */
export function setUIState(key, value) {
    if (uiState.hasOwnProperty(key)) {
        if (uiState[key] !== value) {
            uiState[key] = value;
            saveUIState(key, value);

            // Log state change using window.logMessage if available
            const logFunc = typeof window.logMessage === 'function' ? window.logMessage : console.log;
            logFunc(`[UI STATE] Changed: ${key}=${value}`);
            
            // Optional: Emit an event for specific state changes if needed
            // import { eventBus } from './eventBus.js'; // Import locally if needed
            // eventBus.emit(`uiState:${key}Changed`, value);
        } else {
            // Optional: Log if value hasn't changed
             const logFunc = typeof window.logMessage === 'function' ? window.logMessage : console.log;
             logFunc(`[UI STATE] State unchanged: ${key} already set to ${value}`);
        }
    } else {
        console.warn(`[UI STATE] Attempted to set unknown state key: ${key}`);
    }
}

/**
 * Save a specific UI state variable to localStorage.
 * @param {string} key - The state key.
 * @param {*} value - The value to save.
 */
function saveUIState(key, value) {
    try {
        let storageValue;
        // Ensure boolean values are stored as strings 'true' or 'false'
        if (typeof value === 'boolean') {
            storageValue = String(value);
        } else {
            storageValue = value;
        }

        // Determine the correct localStorage key
        let storageKey = '';
        if (key === 'viewMode') {
            storageKey = VIEW_MODE_KEY;
        } else if (key === 'sidebarVisible') {
            storageKey = SIDEBAR_VISIBLE_KEY;
        } // Add other keys here
        
        if (storageKey) {
            localStorage.setItem(storageKey, storageValue);
        } else {
            console.warn(`[UI STATE] No localStorage key defined for state key: ${key}`);
        }
    } catch (error) {
        console.error(`[UI STATE] Failed to save state key '${key}' to localStorage:`, error);
    }
}

// Initialize on load
initializeUIState(); 