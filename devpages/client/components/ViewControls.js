import { appStore } from '/client/appState.js'; // CHANGED: Use appStore
import eventBus from '/client/eventBus.js';
import { triggerActions } from '/client/actions.js';
import { logMessage } from '/client/log/index.js'; // Use the central logger
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export function createViewControlsComponent(targetElementId, layoutManager) {
    let element = null;
    let appStateUnsubscribe = null; // ADDED: Store unsubscribe function for appState

    const updateToggleButtons = (layoutState) => {
        if (!element) {
            console.error('[ViewControls] updateToggleButtons called but element is null');
            logMessage('updateToggleButtons called but element is null', 'error', 'VIEW_CONTROLS');
            return;
        }
        
        const { isSplitMode, isRightSidebarVisible } = layoutState;
        
        // Update Split toggle (now controls editor panel visibility)
        const splitToggle = element.querySelector('#split-toggle');
        if (splitToggle) {
            splitToggle.classList.toggle('active', isSplitMode);
            splitToggle.title = isSplitMode ? 'Hide Editor Panel (Alt+S)' : 'Show Editor Panel (Alt+S)';
        }
        
        // Update Code toggle (controls right sidebar)
        const codeToggle = element.querySelector('#code-toggle');
        if (codeToggle) {
            codeToggle.classList.toggle('active', isRightSidebarVisible);
            codeToggle.title = isRightSidebarVisible ? 'Hide Code Sidebar (Alt+C)' : 'Show Code Sidebar (Alt+C)';
        }
        
        logMessage(`Toggle buttons updated: Split(Editor)=${isSplitMode}, Code(RightSidebar)=${isRightSidebarVisible}`, 'debug', 'VIEW_CONTROLS');
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

    // Convert app state to layout state for toggle buttons
    const getLayoutStateFromAppState = (appState) => {
        const ui = appState.ui || {};
        const viewMode = ui.viewMode || 'preview';
        
        return {
            isSplitMode: viewMode === 'split',
            isRightSidebarVisible: ui.rightSidebarVisible || false
        };
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
            console.log(`[ViewControls DEBUG] Layout state changed, updating toggle buttons.`);
            const layoutState = getLayoutStateFromAppState(newState);
            updateToggleButtons(layoutState);
        }
        if (logVisibilityChanged) {
            console.log(`[ViewControls DEBUG] logVisibilityChanged from '${prevUi.logVisible}' to '${newUi.logVisible}'. Calling updateLogButtonState.`);
            updateLogButtonState(newUi.logVisible);
        }
    };

    const mount = () => {
        console.log('[ViewControls URGENT DEBUG] appStore.getState().ui.viewMode at VERY START of mount:', appStore.getState().ui?.viewMode);
        console.log('[ViewControls DEBUG] layoutManager parameter received:', layoutManager);
        console.log('[ViewControls DEBUG] layoutManager type:', typeof layoutManager);
        console.log('[ViewControls DEBUG] layoutManager.getState type:', typeof layoutManager?.getState);

        logMessage('Mounting ViewControls...', 'info', 'VIEW_CONTROLS');
        console.log('[ViewControls DEBUG] Mounting...');
        element = document.getElementById(targetElementId);
        if (!element) {
            logMessage(`Target element #${targetElementId} not found.`, 'error', 'VIEW_CONTROLS');
            console.error(`[ViewControls DEBUG] Target element #${targetElementId} not found.`);
            return false;
        }

        // Render the toggle buttons
        element.innerHTML = `
            <button id="split-toggle" title="Toggle Editor Panel (Alt+S)" data-action="toggleSplit">Split</button>
            <button id="code-toggle" title="Toggle Code Sidebar (Alt+C)" data-action="toggleCodeSidebar">Code</button>
            <button id="log-toggle-btn" title="Show Log" data-action="toggleLogVisibility">Log</button>
            <button id="preview-reload-btn" title="Refresh Preview" data-action="refreshPreview">&#x21bb;</button>
        `;
        console.log('[ViewControls DEBUG] Buttons rendered into element:', element);
        
        // ADDED: Subscribe to appState
        if (appStateUnsubscribe) appStateUnsubscribe(); // Unsubscribe previous if any
        appStateUnsubscribe = appStore.subscribe((newState, prevState) => {
            console.log('[ViewControls DEBUG] appStore.subscribe triggered. New state UI:', newState?.ui, 'Prev state UI:', prevState?.ui);
            handleAppStateChange(newState, prevState);
        });
        
        // Subscribe to layout state changes from LayoutManager
        if (eventBus && typeof eventBus.on === 'function') {
            eventBus.on('layout:modernStateChanged', () => {
                const currentAppState = appStore.getState();
                const layoutState = getLayoutStateFromAppState(currentAppState);
                updateToggleButtons(layoutState);
            });
        }
        
        logMessage('ViewControls subscribed to appState and layout changes.', 'info', 'VIEW_CONTROLS');
        console.log('[ViewControls DEBUG] Subscribed to appStore and layout changes.');

        // ADDED: Call handler once with initial state to set initial button states
        const initialAppState = appStore.getState();
        console.log('[ViewControls DEBUG] Setting initial toggle button states');
        
        // Set initial button states from appState
        const initialLayoutState = getLayoutStateFromAppState(initialAppState);
        updateToggleButtons(initialLayoutState);
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
                dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
            } else if (action === 'toggleCodeSidebar') {
                e.preventDefault();
                e.stopPropagation();
                console.log('[ViewControls DEBUG] Dispatching UI_TOGGLE_RIGHT_SIDEBAR...');
                dispatch({ type: ActionTypes.UI_TOGGLE_RIGHT_SIDEBAR });
            } else if (action === 'toggleSplit') {
                e.preventDefault();
                e.stopPropagation();
                console.log('[ViewControls DEBUG] Toggling split mode (editor panel)...');
                const currentState = appStore.getState();
                const currentViewMode = currentState.ui?.viewMode || 'preview';
                const newViewMode = currentViewMode === 'split' ? 'preview' : 'split';
                dispatch({ type: ActionTypes.UI_SET_VIEW_MODE, payload: { viewMode: newViewMode } });
            }
            // Note: 'refreshPreview' action is not handled here yet, but can be added if needed.

            // Handle layout button clicks
            if (action === 'toggleLeftSidebar') {
                e.preventDefault();
                if (layoutManager) {
                    layoutManager.toggleLeftSidebar();
                }
                return;
            }

            if (action === 'toggleRightSidebar') {
                e.preventDefault();
                if (layoutManager) {
                    layoutManager.toggleRightSidebar();
                }
                return;
            }
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