import { eventBus } from '/client/eventBus.js';
import { appState } from '/client/appState.js'; // ADDED: Import central state

// Helper for logging
function logMessage(message, type = 'debug') {
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, type, 'VIEW_CONTROLS');
    } else {
        console.log(`[VIEW_CONTROLS]: ${message}`);
    }
}

export function createViewControlsComponent(targetElementId) {
    let element = null;
    let appStateUnsubscribe = null; // ADDED: Store unsubscribe function for appState

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

    // ADDED: Handler for appState changes relevant to this component
    const handleAppStateChange = (newState, prevState) => {
        // Only update if the relevant UI slice changed
        if (newState.ui === prevState.ui) {
            return;
        }
        logMessage(`[ViewControls] Received appState change:`, 'debug', newState.ui);
        
        // Update buttons based on the new state
        if (newState.ui.viewMode !== prevState.ui?.viewMode) {
            updateActiveButton(newState.ui.viewMode);
        }
        if (newState.ui.logVisible !== prevState.ui?.logVisible) {
            updateLogButtonState(newState.ui.logVisible);
        }
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
            <button id="preview-reload-btn" title="Refresh Preview" data-action="refreshPreview">&#x21bb;</button> <!-- ADDED -->
        `;
        
        // ADDED: Subscribe to appState
        if (appStateUnsubscribe) appStateUnsubscribe(); // Unsubscribe previous if any
        appStateUnsubscribe = appState.subscribe(handleAppStateChange);
        logMessage('Subscribed to appState changes.');

        // ADDED: Call handler once with initial state to set initial button states
        handleAppStateChange(appState.getState(), {}); // Pass empty object as prevState

        logMessage('Mounted and subscribed to appState.');
        return true;
    };

    const destroy = () => {
        logMessage('Destroying...');
        // Unsubscribe from appState changes
        if (appStateUnsubscribe) {
            appStateUnsubscribe();
            appStateUnsubscribe = null;
            logMessage('Unsubscribed from appState changes.');
        }
        
        if (element) {
            element.innerHTML = '';
        }
        element = null;
        logMessage('Destroyed.');
    };

    return {
        mount,
        destroy
    };
}