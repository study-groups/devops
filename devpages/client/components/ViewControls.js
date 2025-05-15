import { appStore } from '/client/appState.js'; // CHANGED: Use appStore
import eventBus from '/client/eventBus.js';
import { triggerActions } from '/client/actions.js';
import { logMessage } from '/client/log/index.js'; // Use the central logger

export function createViewControlsComponent(targetElementId) {
    let element = null;
    let appStateUnsubscribe = null; // ADDED: Store unsubscribe function for appState

    const updateActiveButton = (newMode) => {
        if (!element) return;
        logMessage(`Updating active button for mode: ${newMode}`, 'debug', 'VIEW_CONTROLS');
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
             logMessage(`Updating log button state: isVisible=${isVisible}`, 'debug', 'VIEW_CONTROLS');
            logButton.classList.toggle('active', isVisible);
            // Optional: Change icon or text based on state
            // logButton.textContent = isVisible ? 'Hide Log' : 'Show Log';
            logButton.title = isVisible ? 'Hide Log' : 'Show Log';
        } else {
            logMessage('Log toggle button not found for state update.', 'warning', 'VIEW_CONTROLS');
        }
    };

    // ADDED: Handler for appState changes relevant to this component
    const handleAppStateChange = (newState, prevState) => {
        const viewModeChanged = newState.ui.viewMode !== prevState.ui?.viewMode;
        const logVisibilityChanged = newState.ui.logVisible !== prevState.ui?.logVisible;

        if (!viewModeChanged && !logVisibilityChanged) return;

        logMessage(
            `Relevant appState.ui change. Mode: ${newState.ui.viewMode}, LogVisible: ${newState.ui.logVisible}`,
            'debug',
            'APP_STATE'
        );
        
        if (viewModeChanged) updateActiveButton(newState.ui.viewMode);
        if (logVisibilityChanged) updateLogButtonState(newState.ui.logVisible);
    };

    const mount = () => {
        logMessage('Mounting ViewControls...', 'info', 'VIEW_CONTROLS');
        element = document.getElementById(targetElementId);
        if (!element) {
            logMessage(`Target element #${targetElementId} not found.`, 'error', 'VIEW_CONTROLS');
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
        appStateUnsubscribe = appStore.subscribe(handleAppStateChange);
        logMessage('ViewControls subscribed to appState changes.', 'info', 'VIEW_CONTROLS');

        // ADDED: Call handler once with initial state to set initial button states
        handleAppStateChange(appStore.getState(), {}); // Pass empty object as prevState

        logMessage('ViewControls mounted and subscribed.', 'info', 'VIEW_CONTROLS');
        return true;
    };

    const destroy = () => {
        logMessage('Destroying ViewControls...', 'info', 'VIEW_CONTROLS');
        // Unsubscribe from appState changes
        if (appStateUnsubscribe) {
            appStateUnsubscribe();
            appStateUnsubscribe = null;
            logMessage('ViewControls unsubscribed from appState changes.', 'info', 'VIEW_CONTROLS');
        }
        
        if (element) {
            element.innerHTML = '';
        }
        element = null;
        logMessage('ViewControls destroyed.', 'info', 'VIEW_CONTROLS');
    };

    return {
        mount,
        destroy
    };
}