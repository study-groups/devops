// log/state.js - Log visibility state management
import { logMessage } from './LogCore.js';

// Track how the toggle was initiated
let toggleSource = '';

// Add a flag to track if we're interacting with a split
export let interactingWithSplit = false;

// Add a flag to track view changes
export let recentViewChange = false;

// Add initialization tracking
let initialized = false;

// Log state module with a single source of truth
export const logState = {
    visible: false, // Default to hidden
    height: 120,    // Default value
    _suppressLogging: false,
    
    toggle() {
        this.visible = !this.visible;
        this.saveState();
        this.updateUI();
        console.log('[LOG DEBUG] Log toggled, new state:', this.visible);
        
        if (!this._suppressLogging) {
            this._suppressLogging = true;
            logMessage(`[LOG] Log ${this.visible ? 'shown' : 'hidden'}`);
            this._suppressLogging = false;
        }
        
        return this.visible;
    },
    
    setVisible(visible) {
        if (this.visible !== visible) {
            this.visible = visible;
            this.saveState();
            this.updateUI();
            console.log('[LOG DEBUG] Log visibility set to:', visible);
            
            if (!this._suppressLogging) {
                this._suppressLogging = true;
                logMessage(`[LOG] Log ${this.visible ? 'shown' : 'hidden'}`);
                this._suppressLogging = false;
            }
        }
        return this.visible;
    },
    
    setHeight(height) {
        this.height = Math.max(80, height);
        this.saveState();
        this.updateUI();
    },
    
    updateUI() {
        const logContainer = document.getElementById('log-container');
        if (!logContainer) {
            console.log('[LOG] Log container not found during updateUI');
            return;
        }
        
        // Update the data attribute on both the log container and the HTML element
        logContainer.setAttribute('data-log-visible', this.visible ? 'true' : 'false');
        document.documentElement.setAttribute('data-log-visible', this.visible ? 'true' : 'false');
        
        // Always update the CSS variable for height, regardless of visibility
        document.documentElement.style.setProperty('--log-height', `${this.height}px`);
        
        if (this.visible) {
            logContainer.style.display = 'flex';
            logContainer.style.opacity = '1';
            logContainer.style.height = `${this.height}px`;
            logContainer.style.visibility = 'visible';
            logContainer.classList.remove('log-hiding');
            logContainer.classList.add('log-showing');
            
            // Main container no longer needs log classes
            
            // Update log button state
            const logButton = document.getElementById('log-btn');
            if (logButton) {
                logButton.classList.add('active');
            }
        } else {
            // Immediately hide from flow
            logContainer.style.display = 'none';
            logContainer.style.opacity = '0';
            logContainer.style.visibility = 'hidden';
            logContainer.classList.remove('log-showing');
            logContainer.classList.add('log-hiding');
            logContainer.style.height = '0px';
            logContainer.style.minHeight = '0px';
            logContainer.style.overflow = 'hidden';
            
            // Main container no longer needs log classes
            
            // Update log button state
            const logButton = document.getElementById('log-btn');
            if (logButton) {
                logButton.classList.remove('active');
            }
        }
        
        // Always update buttons for consistency
        this.updateButtons();
    },
    
    updateButtons() {
        const logBtn = document.getElementById('log-btn');
        if (logBtn) {
            logBtn.classList.toggle('active', this.visible);
        }
        
        const minimizeBtn = document.getElementById('minimize-log-btn');
        if (minimizeBtn) {
            minimizeBtn.textContent = '×';
            minimizeBtn.title = this.visible ? 'Hide Log' : 'Show Log';
            minimizeBtn.style.opacity = '0.7';
            minimizeBtn.style.cursor = 'pointer';
        }
    },
    
    saveState() {
        localStorage.setItem('logVisible', String(this.visible));
        localStorage.setItem('logHeight', String(this.height));
        console.log(`[LOG DEBUG] State saved to localStorage: visible=${this.visible}, height=${this.height}`);
    }
};

/**
 * Force log to be hidden regardless of current state
 * @param {boolean} saveToStorage - Whether to save the state to localStorage
 * @returns {boolean} - Always returns false
 */
export function forceLogHidden(saveToStorage = true) {
    console.log('[LOG] Forcing log to be hidden');
    logState.visible = false;
    
    // Only update localStorage if requested
    if (saveToStorage) {
        localStorage.setItem('logVisible', 'false');
    }
    
    // Set the data attribute on the HTML element for CSS to use
    document.documentElement.setAttribute('data-log-visible', 'false');
    
    // Directly manipulate the DOM to hide the log
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        logContainer.style.display = 'none';
        logContainer.style.visibility = 'hidden';
        logContainer.classList.remove('visible');
        logContainer.classList.add('hidden');
        logContainer.setAttribute('data-log-visible', 'false');
    } else {
        console.log('[LOG] Log container not found in DOM');
    }
    
    // Update buttons and UI state
    logState.updateUI();
    return false;
}

// Variables for toggle debouncing
let forceVisibleOnLog = false;
let lastToggleTime = 0;
const TOGGLE_DEBOUNCE = 200; // ms

/**
 * Toggle log visibility
 * @param {string} source - Source of the toggle action
 * @returns {boolean} - New visibility state
 */
export function toggleLog(source = 'button') {
    // Simple check for active input elements
    const activeElement = document.activeElement;
    if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.isContentEditable
    )) {
        // Don't toggle if we're in an input
        return logState.visible;
    }
    
    // Don't toggle during split interactions
    if (interactingWithSplit || recentViewChange) {
        return logState.visible;
    }
    
    // Debounce rapid toggles
    const now = Date.now();
    if (now - lastToggleTime < TOGGLE_DEBOUNCE) {
        return logState.visible;
    }
    
    lastToggleTime = now;
    console.log('[LOG] Toggling log visibility');
    
    // Call the simpler toggle function
    toggleSource = source;
    return toggleLogWithoutAutoShow(source);
}

/**
 * Toggle log visibility without auto-show behavior
 * @param {string} source - Source of the toggle action
 * @returns {boolean} - New visibility state
 */
export function toggleLogWithoutAutoShow(source = 'button') {
    console.log(`[LOG] Toggle log called with source: ${source}`);
    toggleSource = source;
    forceVisibleOnLog = false;
    
    // Simple toggle - if visible, hide; if hidden, show
    const oldState = logState.visible;
    const newState = !oldState;
    const oldStoredValue = localStorage.getItem('logVisible');
    
    console.log(`[LOG] Toggle: ${oldState ? 'visible→hidden' : 'hidden→visible'}`);
    console.log(`[LOG] Previous localStorage value: ${oldStoredValue}`);
    
    // Set the state directly
    logState.visible = newState;
    
    // Save to localStorage and log the change
    localStorage.setItem('logVisible', String(newState));
    console.log(`[LOG] Saved new state to localStorage: logVisible=${newState}`);
    
    // Update the UI
    logState.updateUI();
    
    // Re-enable auto-show after a delay
    setTimeout(() => {
        forceVisibleOnLog = true;
        toggleSource = '';
    }, 500);
    
    return logState.visible;
}

/**
 * Initialize log visibility from localStorage
 */
export function initLogVisibility() {
    if (initialized) {
        console.log('[LOG] Already initialized, skipping');
        return;
    }

    console.log('[LOG] Starting log initialization');
    
    // Get ALL localStorage values related to log state for debugging
    const storedVisibility = localStorage.getItem('logVisible');
    const storedHeight = localStorage.getItem('logHeight');
    
    // Debug all current localStorage values
    console.log('[LOG] LOCALSTORAGE VALUES:');
    console.log('[LOG] - logVisible:', storedVisibility);
    console.log('[LOG] - logHeight:', storedHeight);
    console.log('[LOG] - All localStorage:', Object.entries(localStorage).filter(([key]) => key.includes('log')));
    
    // Set the data attribute on the HTML element for CSS to use
    document.documentElement.setAttribute('data-log-visible', storedVisibility === 'true' ? 'true' : 'false');
    
    // Also set it on the log container if it exists
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        logContainer.setAttribute('data-log-visible', storedVisibility === 'true' ? 'true' : 'false');
    }
    
    // CRITICAL: Set visibility DIRECTLY from localStorage, with no additional logic
    if (storedVisibility === 'true') {
        logState.visible = true;
        console.log('[LOG] *** RESPECTING USER PREFERENCE: Setting log VISIBLE from localStorage ***');
        // DO NOT save anything to localStorage here as it might override user's value
    } else {
        logState.visible = false;
        console.log('[LOG] Setting log HIDDEN (default or from localStorage)');
        
        // Only set localStorage if null (don't overwrite false value)
        if (storedVisibility === null) {
            localStorage.setItem('logVisible', 'false');
            console.log('[LOG] No stored value, saving default (false) to localStorage');
        }
    }

    // Handle height
    if (storedHeight !== null) {
        logState.height = parseInt(storedHeight, 10) || 120;
        console.log('[LOG] Using stored height:', logState.height);
        
        // Set the CSS variable for height
        document.documentElement.style.setProperty('--log-height', `${logState.height}px`);
    } else {
        localStorage.setItem('logHeight', String(logState.height));
        console.log('[LOG] No stored height, saving default:', logState.height);
        
        // Set the CSS variable for height with the default value
        document.documentElement.style.setProperty('--log-height', `${logState.height}px`);
    }

    // IMPORTANT - Disable auto-saving state to localStorage during initialization
    const originalSaveState = logState.saveState;
    logState.saveState = function() {
        console.log('[LOG] State save PREVENTED during initialization');
    };
    
    // Update UI based on the stored state
    logState.updateUI();
    
    // Mark as initialized
    initialized = true;
    console.log('[LOG] Log initialization complete');
    
    // Restore save state functionality after a short delay
    setTimeout(() => {
        logState.saveState = originalSaveState;
        console.log('[LOG] Normal state saving restored');
    }, 500);
    
    // Final debug - confirm log state in console
    console.log('[LOG] FINAL STATE AFTER INIT:');
    console.log('[LOG] - logState.visible =', logState.visible);
    console.log('[LOG] - logState.height =', logState.height);
    console.log('[LOG] - localStorage.logVisible =', localStorage.getItem('logVisible'));
}

// Add these functions to manage recentViewChange
export function setRecentViewChange(value) {
    recentViewChange = value;
}

export function getRecentViewChange() {
    return recentViewChange;
} 