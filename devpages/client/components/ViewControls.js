import { appStore } from '/client/appState.js'; // CHANGED: Use appStore
import eventBus from '/client/eventBus.js';
import { triggerActions } from '/client/actions.js';
import { logMessage } from '/client/log/index.js'; // Use the central logger
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export function createViewControlsComponent(targetElementId) {
    let element = null;
    let appStateUnsubscribe = null; // ADDED: Store unsubscribe function for appState

    const updateActiveButton = (newMode) => {
        if (!element) {
            console.error('[ViewControls] updateActiveButton called but element is null');
            logMessage('updateActiveButton called but element is null', 'error', 'VIEW_CONTROLS');
            return;
        }
        logMessage(`[VC] updateActiveButton: attempting to set mode to '${newMode}'`, 'debug', 'VIEW_CONTROLS');
        console.log(`[ViewControls DEBUG] updateActiveButton called with newMode: ${newMode}`);
        
        const buttons = element.querySelectorAll('button[data-action="setView"]');
        if (buttons.length === 0) {
            logMessage('updateActiveButton: no buttons found with data-action="setView"', 'warn', 'VIEW_CONTROLS');
            console.warn('[ViewControls DEBUG] updateActiveButton: no buttons found with data-action="setView"');
            return;
        }
        
        buttons.forEach(btn => {
            const viewModeOfButton = btn.dataset.viewMode;
            if (viewModeOfButton === newMode) {
                logMessage(`[VC] Activating button for mode: ${viewModeOfButton}`, 'debug', 'VIEW_CONTROLS');
                console.log(`[ViewControls DEBUG] Activating button for mode: ${viewModeOfButton}`);
                btn.classList.add('active');
            } else {
                logMessage(`[VC] Deactivating button for mode: ${viewModeOfButton} (target mode: ${newMode})`, 'debug', 'VIEW_CONTROLS');
                console.log(`[ViewControls DEBUG] Deactivating button for mode: ${viewModeOfButton} (current newMode: ${newMode})`);
                btn.classList.remove('active');
            }
        });
        // console.log(`[DEBUG ViewControls] Active button updated to: ${newMode}`); // Original log
    };
    
    // FIXED: Function to update the log button's visual state
    const updateLogButtonState = (isVisible) => {
        if (!element) return;
        
        const logButton = element.querySelector('#log-toggle-btn');
        if (logButton) {
            logMessage(`Updating log button state: isVisible=${isVisible}`, 'debug', 'VIEW_CONTROLS');
            
            // Force the class change and log it
            if (isVisible) {
                logButton.classList.add('active');
            } else {
                logButton.classList.remove('active');
            }
            
            logButton.title = isVisible ? 'Hide Log' : 'Show Log';
            
            // Log the result
            logMessage(`Button classes after update: ${logButton.className}`, 'debug', 'VIEW_CONTROLS');
        } else {
            logMessage('Log toggle button not found for state update.', 'warning', 'VIEW_CONTROLS');
        }
    };

    // ADDED: Handler for appState changes relevant to this component
    const handleAppStateChange = (newState, prevState) => {
        // Ensure ui objects exist before trying to access their properties
        const newUi = newState?.ui || {};
        const prevUi = prevState?.ui || {};

        const viewModeChanged = newUi.viewMode !== prevUi.viewMode;
        const logVisibilityChanged = newUi.logVisible !== prevUi.logVisible;

        if (!viewModeChanged && !logVisibilityChanged) {
            // console.log('[ViewControls DEBUG] handleAppStateChange: No relevant UI changes detected.');
            return;
        }

        logMessage(
            `Relevant appState.ui change. Mode: ${newUi.viewMode}, LogVisible: ${newUi.logVisible}`,
            'debug',
            'APP_STATE'
        );
        console.log(`[ViewControls DEBUG] handleAppStateChange: Relevant UI change. Mode: ${newUi.viewMode}, LogVisible: ${newUi.logVisible}. PrevMode: ${prevUi.viewMode}, PrevLog: ${prevUi.logVisible}`);
        
        if (viewModeChanged) {
            console.log(`[ViewControls DEBUG] viewModeChanged from '${prevUi.viewMode}' to '${newUi.viewMode}'. Calling updateActiveButton.`);
            updateActiveButton(newUi.viewMode);
        }
        if (logVisibilityChanged) {
            console.log(`[ViewControls DEBUG] logVisibilityChanged from '${prevUi.logVisible}' to '${newUi.logVisible}'. Calling updateLogButtonState.`);
            updateLogButtonState(newUi.logVisible);
        }
    };

    const mount = () => {
        console.log('[ViewControls URGENT DEBUG] appStore.getState().ui.viewMode at VERY START of mount:', appStore.getState().ui?.viewMode);

        logMessage('Mounting ViewControls...', 'info', 'VIEW_CONTROLS');
        console.log('[ViewControls DEBUG] Mounting...');
        element = document.getElementById(targetElementId);
        if (!element) {
            logMessage(`Target element #${targetElementId} not found.`, 'error', 'VIEW_CONTROLS');
            console.error(`[ViewControls DEBUG] Target element #${targetElementId} not found.`);
            return false;
        }

        // Render the buttons - ADDED Log Toggle Button
        element.innerHTML = `
            <button id="code-view" title="Code View" data-action="setView" data-view-mode="editor">Code</button>
            <button id="split-view" title="Split View" data-action="setView" data-view-mode="split">Split</button> 
            <button id="preview-view" title="Preview" data-action="setView" data-view-mode="preview">Preview</button>
            <button id="log-toggle-btn" title="Toggle Log" data-action="toggleLogVisibility">Log</button>
            <button id="preview-reload-btn" title="Refresh Preview" data-action="refreshPreview">&#x21bb;</button>
        `;
        console.log('[ViewControls DEBUG] Buttons rendered into element:', element);
        
        // ADDED: Subscribe to appState
        if (appStateUnsubscribe) appStateUnsubscribe(); // Unsubscribe previous if any
        appStateUnsubscribe = appStore.subscribe((newState, prevState) => {
            console.log('[ViewControls DEBUG] appStore.subscribe triggered. New state UI:', newState?.ui, 'Prev state UI:', prevState?.ui);
            handleAppStateChange(newState, prevState);
        });
        logMessage('ViewControls subscribed to appState changes.', 'info', 'VIEW_CONTROLS');
        console.log('[ViewControls DEBUG] Subscribed to appStore changes.');

        // ADDED: Call handler once with initial state to set initial button states
        const initialAppState = appStore.getState();
        console.log('[ViewControls DEBUG] Calling handleAppStateChange with initial appStore state:', initialAppState?.ui);
        handleAppStateChange(initialAppState, {}); // Pass empty object as prevState for initial call

        // ADDED: Handle button clicks through actions
        element.addEventListener('click', (e) => {
            const button = e.target.closest('button'); // Get the button element
            if (!button) return; // If the click was not on a button or its child

            const action = button.dataset.action;
            const viewMode = button.dataset.viewMode;

            if (action === 'toggleLogVisibility') {
                e.preventDefault();
                e.stopPropagation();
                // console.log('ViewControls Click Handler: dispatch function is:', dispatch);
                // console.log('ViewControls Click Handler: ActionTypes.UI_TOGGLE_LOG_VISIBILITY is:', ActionTypes.UI_TOGGLE_LOG_VISIBILITY);
                dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
            } else if (action === 'setView' && viewMode) {
                e.preventDefault();
                e.stopPropagation();
                logMessage(`Dispatching setView action with mode: ${viewMode}`, 'debug', 'VIEW_CONTROLS');
                dispatch({ type: ActionTypes.UI_SET_VIEW_MODE, payload: viewMode });
            }
            // Note: 'refreshPreview' action is not handled here yet, but can be added if needed.
        });

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