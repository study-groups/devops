import { appStore } from '/client/appState.js'; // CHANGED: Use appStore
import eventBus from '/client/eventBus.js';
import { triggerActions } from '/client/actions.js';
import { logMessage } from '/client/log/index.js'; // Use the central logger
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export function createViewControlsComponent(targetElementId, layoutManager) {
    let element = null;
    let appStateUnsubscribe = null; // ADDED: Store unsubscribe function for appState

    const updateToggleButtons = (panelsState) => {
        if (!element) {
            console.error('[ViewControls] updateToggleButtons called but element is null');
            return;
        }
        
        const editorPanelState = panelsState['editor-panel'];
        const previewPanelState = panelsState['preview-panel'];

        // Update Edit toggle (editor panel visibility)
        const editToggle = element.querySelector('#edit-toggle');
        if (editToggle && editorPanelState) {
            editToggle.classList.toggle('active', editorPanelState.visible);
            editToggle.title = editorPanelState.visible ? 'Hide Editor Panel (Alt+T)' : 'Show Editor Panel (Alt+T)';
        }
        
        // Update Preview toggle (preview panel visibility)
        const previewToggle = element.querySelector('#preview-toggle');
        if (previewToggle && previewPanelState) {
            previewToggle.classList.toggle('active', previewPanelState.visible);
            previewToggle.title = previewPanelState.visible ? 'Hide Preview Panel (Alt+P)' : 'Show Preview Panel (Alt+P)';
        }
    };
    
    const updateLogButtonState = (isVisible) => {
        if (!element) return;
        
        const logButton = element.querySelector('#log-toggle-btn');
        if (logButton) {
            logButton.classList.toggle('active', isVisible);
            logButton.title = isVisible ? 'Hide Log (Alt+L)' : 'Show Log (Alt+L)';
        }
    };

    // Handle app state changes
    const handleAppStateChange = (newState, prevState) => {
        const newPanels = newState?.panels || {};
        const prevPanels = prevState?.panels || {};

        if (JSON.stringify(newPanels) !== JSON.stringify(prevPanels)) {
            updateToggleButtons(newPanels);
        }

        const newUi = newState?.ui || {};
        updateLogButtonState(newUi.logVisible || false);
    };

    const mount = () => {
        logMessage('Mounting ViewControls with text/preview system...', 'info', 'VIEW_CONTROLS');
        
        element = document.getElementById(targetElementId);
        if (!element) {
            logMessage(`Target element #${targetElementId} not found.`, 'error', 'VIEW_CONTROLS');
            return false;
        }

        // Render the updated toggle buttons for editor/preview system
        element.innerHTML = `
            <button id="edit-toggle" title="Toggle Editor Panel (Alt+T)" data-action="toggleEdit">Edit</button>
            <button id="preview-toggle" title="Toggle Preview Panel (Alt+P)" data-action="togglePreview">Preview</button>
            <button id="log-toggle-btn" title="Show Log (Alt+L)" data-action="toggleLogVisibility">Log</button>
            <button id="preview-reload-btn" title="Refresh Preview" data-action="refreshPreview">&#x21bb;</button>
        `;
        
        // Subscribe to app state changes
        if (appStateUnsubscribe) appStateUnsubscribe();
        appStateUnsubscribe = appStore.subscribe(handleAppStateChange);
        
        // Subscribe to layout system events
        if (eventBus && typeof eventBus.on === 'function') {
            eventBus.on('layout:panelStateChanged', (layoutState) => {
                updateToggleButtons(layoutState);
            });
        }
        
        // Set initial button states - delay to ensure store is initialized
        setTimeout(() => {
            const initialAppState = appStore.getState();
            updateToggleButtons(initialAppState.panels || {});
            updateLogButtonState(initialAppState.ui?.logVisible || false);
        }, 0);

        // Handle button clicks
        element.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            e.preventDefault();
            e.stopPropagation();

            switch (action) {
                case 'toggleLogVisibility':
                    dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
                    break;
                    
                case 'toggleEdit':
                    dispatch({ type: ActionTypes.PANEL_TOGGLE_VISIBILITY, payload: { panelId: 'editor-panel' } });
                    break;
                    
                case 'togglePreview':
                    dispatch({ type: ActionTypes.PANEL_TOGGLE_VISIBILITY, payload: { panelId: 'preview-panel' } });
                    break;
                    
                case 'refreshPreview':
                    if (window.previewManager && typeof window.previewManager.refresh === 'function') {
                        window.previewManager.refresh();
                    }
                    break;
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