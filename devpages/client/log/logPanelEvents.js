import { appStore } from '/client/appState.js';
import { triggerActions } from '/client/actions.js'; // Assuming this is where actions like toggleLogVisibility are.
import { logInfo, logError, logDebug, logWarn } from './LogCore.js'; // For logging within this module
import eventBus from '/client/eventBus.js'; // For emitting resize events
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

// These might be better as part of logPanelInstance.config or passed in
const MIN_LOG_HEIGHT = 80; // Or get from LogPanel constants

// Store boundmousemove and mouseup handlers to be able to remove them correctly
let boundHandleResizeMouseMove = null;
let boundHandleResizeMouseUp = null;

/**
 * Attaches all necessary event listeners for the LogPanel.
 * @param {LogPanel} logPanelInstance - The instance of the LogPanel.
 */
export function attachLogPanelEventListeners(logPanelInstance) {
    if (!logPanelInstance || !logPanelInstance.container) {
        logError('Cannot attach event listeners: logPanelInstance or container is null.');
        return;
    }

    // --- Resize Listeners ---
    if (logPanelInstance.resizeHandle) {
        // Ensure methods are bound to the logPanelInstance for correct `this` context
        const handleResizeMouseDown = _handleResizeMouseDown.bind(logPanelInstance);
        logPanelInstance.resizeHandle.addEventListener('mousedown', handleResizeMouseDown);
        logDebug('Attached resize mousedown listener.', { type: 'LOG_PANEL', subtype: 'EVENTS' });
    } else {
        logWarn('Resize handle not found on LogPanel instance. Resizing will not work.', { type: 'LOG_PANEL', subtype: 'ERROR' });
    }

    // --- Delegated Click Listener for Toolbar Actions ---
    // This assumes actions are identified by `data-action` attributes on buttons
    // within the logPanelInstance.toolbarElement or logPanelInstance.container
    const delegateContainer = logPanelInstance.toolbarElement || logPanelInstance.container;
    if (delegateContainer) {
        delegateContainer.addEventListener('click', (event) => {
            const targetButton = event.target.closest('button[data-action]');
            if (!targetButton) return;

            const action = targetButton.dataset.action;
            // logDebug(`Delegated click detected for action: ${action}`, { type: 'LOG_PANEL', subtype: 'EVENTS' }); // SILENCED

            // Prevent event from propagating to avoid double-triggering
            event.preventDefault();
            event.stopPropagation();

            if (action === 'toggleLogMenu') {
                // For toggleLogMenu, add a guard to prevent double-triggering
                if (targetButton.dataset.processing === 'true') {
                    // console.log('[DEBUG] Preventing double processing of toggleLogMenu'); // SILENCED
                    return;
                }
                
                // Mark as processing
                targetButton.dataset.processing = 'true';
                
                // Schedule cleanup of this flag
                setTimeout(() => {
                    delete targetButton.dataset.processing;
                }, 100); // Short timeout to prevent rapid double-clicks
            }

            switch (action) {
                case 'toggleLogVisibility':
                case 'minimizeLog':
                    dispatch({ type: ActionTypes.UI_TOGGLE_LOG_VISIBILITY });
                    break;
                case 'copyLog':
                    if (typeof logPanelInstance.copyLog === 'function') logPanelInstance.copyLog();
                    break;
                case 'clearLog':
                    if (typeof logPanelInstance.clearLog === 'function') logPanelInstance.clearLog();
                    break;
                // Add other cases for different data-actions like copyLogEntry, etc.
                // case 'collapseLogEntry':
                //     const entryToCollapse = event.target.closest('.log-entry');
                //     if (entryToCollapse && typeof logPanelInstance._collapseLogEntry === 'function') {
                //         logPanelInstance._collapseLogEntry(entryToCollapse);
                //     }
                //     break;
                default:
                    // If triggerActions is available and the action is defined there, use it.
                    // This is useful for actions that are more global or complex.
                    if (triggerActions && typeof triggerActions[action] === 'function') {
                        // logDebug(`Passing action '${action}' to triggerActions.`, { type: 'LOG_PANEL', subtype: 'EVENTS' }); // SILENCED
                        triggerActions[action]({ event, target: targetButton, logPanel: logPanelInstance });
                    } else {
                        logWarn(`No handler defined for data-action: ${action} in LogPanel events or triggerActions.`, { type: 'LOG_PANEL', subtype: 'EVENTS' });
                    }
                    break;
            }
        });
        logDebug('Attached delegated click listener to LogPanel toolbar/container.', { type: 'LOG_PANEL', subtype: 'EVENTS' });
    } else {
        logWarn('LogPanel toolbarElement or container not found for delegated click listener.', { type: 'LOG_PANEL', subtype: 'ERROR' });
    }

    // TODO: Add listeners for log entry interactions (click to expand/collapse, copy individual entry)
    // This might also use event delegation on logPanelInstance.logElement
    if (logPanelInstance.logElement) {
        logPanelInstance.logElement.addEventListener('click', (event) => {
            const entryDiv = event.target.closest('.log-entry');
            if (!entryDiv) return;

            // If entry is expanded:
            if (entryDiv.classList.contains('expanded')) {
                // Check if click is on the pin button (which handles collapse itself)
                if (event.target.closest('.collapse-pin-button')) {
                    return; // Pin button has its own handler
                }
                
                // Check if click is in the toolbar
                const isInToolbar = event.target.closest('.log-entry-expanded-toolbar');
                if (isInToolbar) {
                    // Only collapse if clicking empty space in toolbar, not on buttons
                    const isButtonClick = event.target.closest('button, .log-entry-codefence-menu');
                    if (!isButtonClick) {
                        if (typeof logPanelInstance._collapseLogEntry === 'function') {
                            logPanelInstance._collapseLogEntry(entryDiv);
                        }
                    }
                }
                // If click is in the content area (not toolbar), do nothing
                // This prevents collapse when clicking in the expanded content
            } else {
                // For collapsed entries, expand on click (unless clicking a button)
                const isButtonClick = event.target.closest('button, .log-entry-codefence-menu');
                if (!isButtonClick) {
                    if (typeof logPanelInstance._expandLogEntry === 'function') {
                        logPanelInstance._expandLogEntry(entryDiv);
                    }
                }
            }

            // Handle click on original copy button (if not handled by general delegate)
            const originalCopyButton = event.target.closest('.original-button[data-log-text]');
            if (originalCopyButton) {
                event.stopPropagation(); // Prevent entry expand/collapse
                const textToCopy = originalCopyButton.dataset.logText;
                navigator.clipboard.writeText(textToCopy)
                    .then(() => logInfo('Original log entry copied to clipboard.', {type: 'LOG_PANEL', subtype: 'EVENTS'}))
                    .catch(err => logError('Failed to copy original log entry.', {type: 'LOG_PANEL', subtype: 'ERROR', details: err}));
                 // TODO: Consider calling logPanelInstance._showTemporaryFeedback if available
            }
        });
         logDebug('Attached click listener to logElement for expand/collapse/copy.', { type: 'LOG_PANEL', subtype: 'EVENTS' });
    }
}

/**
 * Handles mouse down on the resize handle.
 * `this` is bound to the LogPanel instance.
 */
function _handleResizeMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    this._isResizing = true;
    this._startY = event.clientY;
    // Ensure container is valid before trying to access offsetHeight
    if (!this.container) {
        logError("LogPanel container not found during resize mouse down.", { type: 'LOG_PANEL', subtype: 'ERROR' });
        this._isResizing = false;
        return;
    }
    this._startHeight = this.container.offsetHeight;
    this.container.classList.add('resizing');

    // Bind and store for removal
    boundHandleResizeMouseMove = _handleResizeMouseMove.bind(this);
    boundHandleResizeMouseUp = _handleResizeMouseUp.bind(this);

    document.addEventListener('mousemove', boundHandleResizeMouseMove);
    document.addEventListener('mouseup', boundHandleResizeMouseUp);
    logDebug('Resize mouse down, added global listeners.', { type: 'LOG_PANEL', subtype: 'RESIZE' });
}

/**
 * Handles mouse move during resize.
 * `this` is bound to the LogPanel instance.
 */
function _handleResizeMouseMove(event) {
    if (!this._isResizing || !this.container) return;

    const deltaY = this._startY - event.clientY;
    let newHeight = this._startHeight + deltaY;

    if (newHeight < MIN_LOG_HEIGHT) {
        newHeight = MIN_LOG_HEIGHT;
    }

    // Apply immediately for smooth UX
    this.container.style.height = `${newHeight}px`;
    document.documentElement.style.setProperty('--log-height', `${newHeight}px`);
    
    // Store new height for dispatch on mouse up
    this._currentHeight = newHeight;
}

/**
 * Handles mouse up after resize, saves the new height.
 * `this` is bound to the LogPanel instance.
 */
function _handleResizeMouseUp() {
    if (!this._isResizing) return;
    this._isResizing = false;

    document.removeEventListener('mousemove', boundHandleResizeMouseMove);
    document.removeEventListener('mouseup', boundHandleResizeMouseUp);
    boundHandleResizeMouseMove = null; // Clear stored handlers
    boundHandleResizeMouseUp = null;

    if (this.container) {
        this.container.classList.remove('resizing');
    }
    if (document.body) { // Check if body exists, for robustness
       document.body.style.userSelect = '';
    }

    // Dispatch final height to appStore
    if (this._currentHeight) {
        dispatch({ 
            type: ActionTypes.UI_SET_LOG_HEIGHT, 
            payload: this._currentHeight 
        });
    }

    // The saveLogPanelPreferences method should be part of the LogPanel instance,
    // potentially calling a function from logPanelState.js
    if (typeof this.saveLogPanelPreferences === 'function') {
        this.saveLogPanelPreferences();
    } else {
        logWarn('LogPanel.saveLogPanelPreferences is not a function. Cannot save height.', { type: 'LOG_PANEL', subtype: 'RESIZE' });
    }
    logDebug(`Resize ended. Final height: ${this._currentHeight}`, { type: 'LOG_PANEL', subtype: 'RESIZE' });
}

/**
 * Cleans up event listeners.
 * @param {LogPanel} logPanelInstance - The instance of the LogPanel.
 */
export function removeLogPanelEventListeners(logPanelInstance) {
    if (logPanelInstance && logPanelInstance.resizeHandle) {
        // To fully remove, we'd need a reference to the exact function passed to addEventListener.
        // For simplicity, if _handleResizeMouseDown was bound and stored, we could use that.
        // This part needs careful management if listeners are dynamically added/removed.
        // For now, this is a placeholder.
        logDebug('removeLogPanelEventListeners called. Placeholder - actual removal needs to track exact bound functions.', { type: 'LOG_PANEL', subtype: 'EVENTS' });
    }
    // Clean up global listeners if they are still attached (e.g. on destroy)
    if (boundHandleResizeMouseMove) {
        document.removeEventListener('mousemove', boundHandleResizeMouseMove);
        boundHandleResizeMouseMove = null;
    }
    if (boundHandleResizeMouseUp) {
        document.removeEventListener('mouseup', boundHandleResizeMouseUp);
        boundHandleResizeMouseUp = null;
    }
}

// Add other event-related helper functions as needed.
