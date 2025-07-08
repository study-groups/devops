import { appStore } from '/client/appState.js'; // StateKit store
// import { getUIState, setUIState } from '/client/uiState.js'; // If you have a separate uiState module

const LOG_VISIBLE_KEY = 'logVisible'; // Duplicated from LogPanel.js - centralize if possible
const LOG_HEIGHT_KEY = 'logHeight';   // Duplicated from LogPanel.js - centralize if possible

/**
 * Loads LogPanel preferences (e.g., height, visibility) from storage.
 * @param {LogPanel} logPanelInstance - The instance of the LogPanel.
 * @param {number} defaultHeight - Default height if nothing is stored.
 * @param {number} minHeight - Minimum allowable height.
 */
export function loadLogPanelPreferences(logPanelInstance, defaultHeight, minHeight) {
    console.debug('[logPanelState] loadLogPanelPreferences called.');
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
        console.error('[logPanelState] Error loading height from localStorage.', e);
    }
    logPanelInstance.state.height = loadedHeight;
    console.debug(`[logPanelState] Loaded height: ${loadedHeight}. Initial visibility will be from appStore.`);
    // No appStore.update here for visibility; appState.js initializes it.
}

/**
 * Saves LogPanel preferences to storage.
 * This is the function imported as saveLogPanelPreferencesState in LogPanel.js
 * @param {LogPanel} logPanelInstance - The instance of the LogPanel.
 */
export function saveLogPanelPreferences(logPanelInstance) {
    console.debug('[logPanelState] saveLogPanelPreferences (state function) called.');
    if (!logPanelInstance) return;

    try {
        localStorage.setItem(LOG_HEIGHT_KEY, String(logPanelInstance.state.height));
        // Visibility is already saved by uiReducer or the toggle mechanism directly to localStorage.
        // If we wanted this function to be the SOLE place to save visibility:
        // const currentVisibility = appStore.getState().ui.logVisible;
        // localStorage.setItem(LOG_VISIBLE_KEY, String(currentVisibility));
        console.info(`[logPanelState] Saved height: ${logPanelInstance.state.height}`);
    } catch (e) {
        console.error('[logPanelState] Error saving height to localStorage.', e);
    }
}

/**
 * Subscribes the LogPanel to relevant changes in the application's global state.
 * @param {LogPanel} logPanelInstance - The instance of the LogPanel.
 */
export function subscribeToAppStoreChanges(logPanelInstance) {
    console.debug('[logPanelState] subscribeToAppStoreChanges called (StateKit model).');
    if (!appStore || typeof appStore.subscribe !== 'function') {
        console.error('[logPanelState] appStore.subscribe not available.');
        return;
    }

    const unsubscribe = appStore.subscribe((newState, prevState) => {
        if (!prevState) {
            console.warn("[logPanelState] PrevState not available in subscriber, deferring updates to prevent loops.");
            // Defer updates to prevent immediate loops during initialization
            setTimeout(() => {
                if (typeof logPanelInstance.updateUI === 'function') logPanelInstance.updateUI();
                // Don't call filter-related updates immediately to prevent loops
                // if (typeof logPanelInstance._applyFiltersToLogEntries === 'function') logPanelInstance._applyFiltersToLogEntries();
                // if (typeof logPanelInstance._updateTagsBar === 'function') logPanelInstance._updateTagsBar();
            }, 100);
            return;
        }

        let needsGeneralUIUpdate = false;

        // Check for main log panel visibility change
        if (newState.ui && prevState.ui && newState.ui.logVisible !== prevState.ui.logVisible) {
            // console.debug(`[logPanelState] Main LogPanel visibility changed. Requesting UI update.`); // SILENCED
            needsGeneralUIUpdate = true;
        }

        // Check for log menu visibility change
        if (newState.ui && prevState.ui && newState.ui.logMenuVisible !== prevState.ui.logMenuVisible) {
            // console.debug(`[logPanelState] Log Menu visibility changed. Requesting UI update.`); // SILENCED
            needsGeneralUIUpdate = true; // The general updateUI will handle this
        }

        if (needsGeneralUIUpdate && typeof logPanelInstance.updateUI === 'function') {
            logPanelInstance.updateUI();
        }

        // Check for log filtering changes with proper null checks
        const newFiltering = newState.logFiltering || { discoveredTypes: [], activeFilters: [] };
        const prevFiltering = prevState.logFiltering || { discoveredTypes: [], activeFilters: [] };

        const activeFiltersChanged = JSON.stringify(newFiltering.activeFilters || []) !== JSON.stringify(prevFiltering.activeFilters || []);
        const discoveredTypesChanged = JSON.stringify(newFiltering.discoveredTypes || []) !== JSON.stringify(prevFiltering.discoveredTypes || []);

        if (activeFiltersChanged) {
            // REMOVED: Excessive logging about filter changes
            // console.debug('[logPanelState] Active log filters changed. Applying to entries & updating tags bar.');
            if (typeof logPanelInstance._applyFiltersToLogEntries === 'function') {
                logPanelInstance._applyFiltersToLogEntries();
            }
            if (typeof logPanelInstance._updateTagsBar === 'function') {
                logPanelInstance._updateTagsBar();
            }
        }

        if (discoveredTypesChanged && !activeFiltersChanged) { // Avoid double-updating tags bar if active filters also changed
            // REMOVED: Excessive logging about type discovery
            // console.debug('[logPanelState] Discovered log types changed. Updating tags bar.');
            if (typeof logPanelInstance._updateTagsBar === 'function') {
                logPanelInstance._updateTagsBar();
            }
        }
    });

    logPanelInstance._appStateUnsubscribe = unsubscribe; // Store the unsubscribe function correctly on the instance
    console.info('[logPanelState] Subscribed to appStore changes (StateKit model).');
}

/**
 * Updates the UI of selection buttons based on their state
 * This function can accept either a LogPanel instance or a toolbar element directly
 * @param {LogPanel|HTMLElement} logPanelInstanceOrToolbar - The LogPanel instance or toolbar element
 * @param {string} bufferType - 'A' or 'B'
 * @param {boolean} hasData - Whether there is data in the buffer
 * @param {Object} stateData - The state data object
 */
export function updateSelectionButtonUI(logPanelInstanceOrToolbar, bufferType, hasData, stateData = null) {
    let toolbarElement;
    
    // Determine if we received a LogPanel instance or toolbar element directly
    if (logPanelInstanceOrToolbar && logPanelInstanceOrToolbar.toolbarElement) {
        // It's a LogPanel instance
        toolbarElement = logPanelInstanceOrToolbar.toolbarElement;
    } else if (logPanelInstanceOrToolbar && logPanelInstanceOrToolbar.querySelector) {
        // It's a toolbar element directly
        toolbarElement = logPanelInstanceOrToolbar;
    } else {
        console.warn('LogPanel instance or toolbar element not available for updateSelectionButtonUI');
        return;
    }

    const buttonId = bufferType === 'A' ? 'log-state-a-btn' : 'log-state-b-btn';
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