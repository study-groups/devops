import { appStore } from '/client/appState.js'; // StateKit store
// import { getUIState, setUIState } from '/client/uiState.js'; // If you have a separate uiState module
import { logInfo, logError, logDebug, logWarn } from './LogCore.js';

const LOG_VISIBLE_KEY = 'logVisible'; // Duplicated from LogPanel.js - centralize if possible
const LOG_HEIGHT_KEY = 'logHeight';   // Duplicated from LogPanel.js - centralize if possible

/**
 * Loads LogPanel preferences (e.g., height, visibility) from storage.
 * @param {LogPanel} logPanelInstance - The instance of the LogPanel.
 * @param {number} defaultHeight - Default height if nothing is stored.
 * @param {number} minHeight - Minimum allowable height.
 */
export function loadLogPanelPreferences(logPanelInstance, defaultHeight, minHeight) {
    logDebug('[logPanelState] loadLogPanelPreferences called.', { type: 'LOG_PANEL', subtype: 'STATE' });
    let loadedHeight = defaultHeight;
    // Visibility is primarily driven by appStore.ui.logVisible.
    // This function just sets the instance's height.
    // The initial visibility in the appStore should be set by appState.js itself.

    try {
        const savedHeightStr = localStorage.getItem(LOG_HEIGHT_KEY);
        if (savedHeightStr) {
            const savedHeight = parseInt(savedHeightStr, 10);
            loadedHeight = (!isNaN(savedHeight) && savedHeight >= minHeight) ? savedHeight : defaultHeight;
        }
    } catch (e) {
        logError('[logPanelState] Error loading height from localStorage.', { type: 'LOG_PANEL', subtype: 'ERROR', details: e });
    }
    logPanelInstance.state.height = loadedHeight;
    logDebug(`[logPanelState] Loaded height: ${loadedHeight}. Initial visibility will be from appStore.`, { type: 'LOG_PANEL', subtype: 'STATE' });
    // No appStore.update here for visibility; appState.js initializes it.
}

/**
 * Saves LogPanel preferences to storage.
 * This is the function imported as saveLogPanelPreferencesState in LogPanel.js
 * @param {LogPanel} logPanelInstance - The instance of the LogPanel.
 */
export function saveLogPanelPreferences(logPanelInstance) {
    logDebug('[logPanelState] saveLogPanelPreferences (state function) called.', { type: 'LOG_PANEL', subtype: 'STATE' });
    if (!logPanelInstance) return;

    try {
        localStorage.setItem(LOG_HEIGHT_KEY, String(logPanelInstance.state.height));
        // Visibility is already saved by uiReducer or the toggle mechanism directly to localStorage.
        // If we wanted this function to be the SOLE place to save visibility:
        // const currentVisibility = appStore.getState().ui.logVisible;
        // localStorage.setItem(LOG_VISIBLE_KEY, String(currentVisibility));
        logInfo(`[logPanelState] Saved height: ${logPanelInstance.state.height}`, { type: 'LOG_PANEL', subtype: 'STATE' });
    } catch (e) {
        logError('[logPanelState] Error saving height to localStorage.', { type: 'LOG_PANEL', subtype: 'ERROR', details: e });
    }
}

/**
 * Subscribes the LogPanel to relevant changes in the application's global state.
 * @param {LogPanel} logPanelInstance - The instance of the LogPanel.
 */
export function subscribeToAppStoreChanges(logPanelInstance) {
    logDebug('[logPanelState] subscribeToAppStoreChanges called (StateKit model).', { type: 'LOG_PANEL', subtype: 'STATE' });
    if (!appStore || typeof appStore.subscribe !== 'function') {
        logError('[logPanelState] appStore.subscribe not available.', { type: 'LOG_PANEL', subtype: 'ERROR' });
        return;
    }

    const unsubscribe = appStore.subscribe((newState, prevState) => {
        if (!prevState) {
            logWarn("[logPanelState] PrevState not available in subscriber, cannot reliably detect changes this cycle.");
            if (typeof logPanelInstance.updateUI === 'function') logPanelInstance.updateUI();
            if (typeof logPanelInstance._applyFiltersToLogEntries === 'function') logPanelInstance._applyFiltersToLogEntries();
            if (typeof logPanelInstance._updateTagsBar === 'function') logPanelInstance._updateTagsBar();
            return;
        }

        let needsGeneralUIUpdate = false;

        // Check for main log panel visibility change
        if (newState.ui && prevState.ui && newState.ui.logVisible !== prevState.ui.logVisible) {
            // logDebug(`[logPanelState] Main LogPanel visibility changed. Requesting UI update.`, { type: 'LOG_PANEL', subtype: 'STATE' }); // SILENCED
            needsGeneralUIUpdate = true;
        }

        // Check for log menu visibility change
        if (newState.ui && prevState.ui && newState.ui.logMenuVisible !== prevState.ui.logMenuVisible) {
            // logDebug(`[logPanelState] Log Menu visibility changed. Requesting UI update.`, { type: 'LOG_PANEL', subtype: 'STATE' }); // SILENCED
            needsGeneralUIUpdate = true; // The general updateUI will handle this
        }

        if (needsGeneralUIUpdate && typeof logPanelInstance.updateUI === 'function') {
            logPanelInstance.updateUI();
        }

        // Check for log filtering changes
        const newFiltering = newState.logFiltering || { discoveredTypes: [], activeFilters: [] };
        const prevFiltering = prevState.logFiltering || { discoveredTypes: [], activeFilters: [] };

        const activeFiltersChanged = JSON.stringify(newFiltering.activeFilters) !== JSON.stringify(prevFiltering.activeFilters);
        const discoveredTypesChanged = JSON.stringify(newFiltering.discoveredTypes) !== JSON.stringify(prevFiltering.discoveredTypes);

        if (activeFiltersChanged) {
            // REMOVED: Excessive logging about filter changes
            // logDebug('[logPanelState] Active log filters changed. Applying to entries & updating tags bar.', { type: 'LOG_PANEL', subtype: 'STATE' });
            if (typeof logPanelInstance._applyFiltersToLogEntries === 'function') {
                logPanelInstance._applyFiltersToLogEntries();
            }
            if (typeof logPanelInstance._updateTagsBar === 'function') {
                logPanelInstance._updateTagsBar();
            }
        }

        if (discoveredTypesChanged && !activeFiltersChanged) { // Avoid double-updating tags bar if active filters also changed
            // REMOVED: Excessive logging about type discovery
            // logDebug('[logPanelState] Discovered log types changed. Updating tags bar.', { type: 'LOG_PANEL', subtype: 'STATE' });
            if (typeof logPanelInstance._updateTagsBar === 'function') {
                logPanelInstance._updateTagsBar();
            }
        }
    });

    logPanelInstance._appStateUnsubscribe = unsubscribe; // Store the unsubscribe function correctly on the instance
    logInfo('[logPanelState] Subscribed to appStore changes (StateKit model).', { type: 'LOG_PANEL', subtype: 'STATE' });
}

/**
 * Updates the UI of selection buttons based on their state
 * @param {HTMLElement} toolbarElement - The toolbar element containing the buttons
 * @param {string} bufferType - Either 'A' or 'B' 
 * @param {boolean} hasData - Whether the buffer has data
 * @param {object} stateData - The data stored in the buffer
 */
export function updateSelectionButtonUI(toolbarElement, bufferType, hasData, stateData = null) {
    // The entire updateSelectionButtonUI method from LogPanel.js (lines ~878-905)
    const buttonId = bufferType === 'A' ? 'log-state-a-btn' : 'log-state-b-btn';
    
    if (!toolbarElement) {
        console.warn(`Toolbar element not found when trying to update button ${buttonId}.`);
        return;
    }
    
    const button = toolbarElement.querySelector(`#${buttonId}`);

    if (button) {
        if (hasData && stateData) {
            button.classList.add('button-state-active');
            const snippet = (stateData.text || '').substring(0, 50).replace(/\n/g, '↵');
            const filePathDisplay = stateData.filePath || 'N/A';
            button.title = `State ${bufferType}: ${filePathDisplay}\nRange: [${stateData.start}-${stateData.end}]\nText: "${snippet}..."`;
        } else {
            button.classList.remove('button-state-active');
            button.title = `Store Editor Selection ${bufferType}`;
        }
    } else {
        console.warn(`Button #${buttonId} not found in toolbar for UI update.`);
    }
}

// Add other state management utility functions as needed.

// Helper (if not already present)
function logPanelInternalDebug(message, level = 'debug') {
    const logFunc = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
    logFunc(message);
}
