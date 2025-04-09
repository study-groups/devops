import { eventBus } from '/client/eventBus.js';
// Import necessary functions from uiState
import { getUIState, setUIState, subscribeToUIStateChange } from '/client/uiState.js'; 

// Helper for logging
function logMessage(message, level = 'text') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level);
    } else {
        console.log(`[ViewControls] ${message}`);
    }
}

export function createViewControlsComponent(targetElementId) {
    let element = null;
    let logVisibleUnsubscribe = null; // Store unsubscribe function

    const updateActiveButton = (newMode) => {
        if (!element) return;
        logMessage(`Updating active button for mode: ${newMode}`);
        const buttons = element.querySelectorAll('button[data-action="setView"]');
        buttons.forEach(btn => {
            if (btn.dataset.viewMode === newMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
         console.log(`[DEBUG ViewControls] Active button updated to: ${newMode}`);
    };
    
    // ADDED: Function to update the log button's visual state
    const updateLogButtonState = (isVisible) => {
        if (!element) return;
        const logButton = element.querySelector('#log-toggle-btn');
        if (logButton) {
             logMessage(`Updating log button state: isVisible=${isVisible}`);
            logButton.classList.toggle('active', isVisible);
            // Optional: Change icon or text based on state
            // logButton.textContent = isVisible ? 'Hide Log' : 'Show Log';
            logButton.title = isVisible ? 'Hide Log' : 'Show Log';
        } else {
            logMessage('Log toggle button not found for state update.', 'warning');
        }
    };

    // --- Update Method (Kept for potential future use or external triggers) --- 
    const update = (data = {}) => {
        console.log('[DEBUG ViewControls] update called with data:', data);
        if (data.viewMode !== undefined) {
            updateActiveButton(data.viewMode);
        }
        // Note: Log button updates are handled by subscription below
    };

    const mount = () => {
        logMessage('Mounting...');
        element = document.getElementById(targetElementId);
        if (!element) {
            logMessage(`Target element #${targetElementId} not found.`, 'error');
            return false;
        }

        // Render the buttons - ADDED Log Toggle Button
        element.innerHTML = `
            <button id="code-view" title="Code View" data-action="setView" data-view-mode="editor">Code</button>
            <button id="split-view" title="Split View" data-action="setView" data-view-mode="split">Split</button> 
            <button id="preview-view" title="Preview" data-action="setView" data-view-mode="preview">Preview</button>
            <button id="log-toggle-btn" title="Show Log" data-action="toggleLogVisibility">Log</button> <!-- ADDED -->
        `;
        
        // Event bus subscription for viewMode is handled by uiManager
        logMessage('Event bus subscription skipped (handled by uiManager).');
        
        // --- Set Initial State for View Buttons --- 
        try {
            const initialViewMode = getUIState('viewMode'); 
            if (initialViewMode !== undefined) { 
                 logMessage(`Setting initial active view button state from uiState: ${initialViewMode}`);
                 updateActiveButton(initialViewMode);
            } else {
                logMessage('Could not get initial viewMode from uiState, defaulting.', 'warning');
                updateActiveButton('split'); 
            }
        } catch (err) {
             logMessage(`Error getting initial viewMode from uiState: ${err.message}. Defaulting active button.`, 'error');
             updateActiveButton('split'); 
        }
        
        // --- Set Initial State & Subscribe for Log Button --- 
        try {
            const initialLogVisible = getUIState('logVisible');
            if (initialLogVisible !== undefined) {
                logMessage(`Setting initial log button state from uiState: ${initialLogVisible}`);
                updateLogButtonState(initialLogVisible); // Set initial state
            } else {
                 logMessage('Could not get initial logVisible state', 'warning');
            }
            // Subscribe to future changes
            logVisibleUnsubscribe = subscribeToUIStateChange('logVisible', updateLogButtonState);
            logMessage('Subscribed to logVisible uiState changes.');
            
        } catch (err) {
            logMessage(`Error setting initial log state or subscribing: ${err.message}`, 'error');
        }

        logMessage('Mounted.');
        return true;
    };

    const destroy = () => {
        logMessage('Destroying...');
        // Unsubscribe from uiState changes
        if (logVisibleUnsubscribe) {
            logVisibleUnsubscribe();
            logVisibleUnsubscribe = null;
            logMessage('Unsubscribed from logVisible uiState changes.');
        }
        
        if (element) {
            element.innerHTML = '';
        }
        element = null;
        logMessage('Destroyed.');
    };

    return {
        mount,
        update, 
        destroy
    };
}