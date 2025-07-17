/**
 * UI action handlers
 * Responsible for UI interactions like view modes, log panel, etc.
 */
import { logMessage } from '/client/log/index.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { uiActions } from '/client/messaging/actionCreators.js';

// Helper for logging within this module
function logAction(message, level = 'debug') {
    const type = 'ACTION'
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

export const uiActionHandlers = {
    /**
     * Sets the view mode using thunks
     * @param {string} mode - View mode ('preview', 'split', 'editor')
     */
    setView: (mode) => {
        logAction(`Triggering setView action for mode: ${mode}`);
        
        // Use the thunk action creator
        dispatch(uiActions.setViewModeAsync(mode));
        
        logAction(`setView executed for mode: ${mode}`);
    },

    /**
     * Refreshes the preview using thunks
     */
    refreshPreview: () => {
        logAction('Triggering refreshPreview action...');
        
        // Use the thunk action creator
        dispatch(uiActions.refreshPreview());
        
        logAction('refreshPreview executed');
    },

    /**
     * Copies log content to clipboard
     */
    copyLog: () => {
        logAction('Triggering copyLog action...');
        
        try {
            const logPanel = document.querySelector('#log-panel');
            if (logPanel) {
                const logContent = logPanel.textContent || logPanel.innerText;
                navigator.clipboard.writeText(logContent).then(() => {
                    logAction('Log content copied to clipboard');
                }).catch(err => {
                    logAction(`Failed to copy log content: ${err.message}`, 'error');
                });
            } else {
                logAction('Log panel not found', 'warning');
            }
        } catch (error) {
            logAction(`Error during copyLog: ${error.message}`, 'error');
        }
    },

    /**
     * Clears the log panel
     */
    clearLog: () => {
        logAction('Triggering clearLog action...');
        
        try {
            const logPanel = document.querySelector('#log-panel');
            if (logPanel) {
                logPanel.innerHTML = '';
                logAction('Log panel cleared');
            } else {
                logAction('Log panel not found', 'warning');
            }
        } catch (error) {
            logAction(`Error during clearLog: ${error.message}`, 'error');
        }
    },

    /**
     * Toggles log visibility using thunks
     */
    toggleLogVisibility: () => {
        logAction('Triggering toggleLogVisibility action...');
        
        // Use the thunk action creator
        dispatch(uiActions.toggleLogVisibilityAsync());
        
        logAction('toggleLogVisibility executed');
    },

    /**
     * Minimizes the log panel
     */
    minimizeLog: () => {
        logAction('Triggering minimizeLog action...');
        
        try {
            const logPanel = document.querySelector('#log-panel');
            if (logPanel) {
                logPanel.style.height = '30px';
                logPanel.style.overflow = 'hidden';
                logAction('Log panel minimized');
            } else {
                logAction('Log panel not found', 'warning');
            }
        } catch (error) {
            logAction(`Error during minimizeLog: ${error.message}`, 'error');
        }
    },

    /**
     * Shows system information
     */
    showSystemInfo: () => {
        logAction('Triggering showSystemInfo action...');
        
        try {
            const info = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine,
                screenSize: `${screen.width}x${screen.height}`,
                windowSize: `${window.innerWidth}x${window.innerHeight}`,
                timestamp: new Date().toISOString()
            };
            
            console.log('System Information:', info);
            logAction('System information logged to console');
        } catch (error) {
            logAction(`Error during showSystemInfo: ${error.message}`, 'error');
        }
    },

    /**
     * Toggles log menu using thunks
     */
    toggleLogMenu: () => {
        logAction('Triggering toggleLogMenu action...');
        
        // Use the thunk action creator
        dispatch(uiActions.toggleLogMenuAsync());
        
        logAction('toggleLogMenu executed');
    },

    /**
     * Copies a specific log entry to clipboard
     * @param {string} entryText - Log entry text to copy
     */
    copyLogEntry: (entryText) => {
        logAction('Triggering copyLogEntry action...');
        
        try {
            navigator.clipboard.writeText(entryText).then(() => {
                logAction('Log entry copied to clipboard');
            }).catch(err => {
                logAction(`Failed to copy log entry: ${err.message}`, 'error');
            });
        } catch (error) {
            logAction(`Error during copyLogEntry: ${error.message}`, 'error');
        }
    },

    /**
     * Pastes text from clipboard to log
     */
    pasteLogEntry: () => {
        logAction('Triggering pasteLogEntry action...');
        
        try {
            navigator.clipboard.readText().then(text => {
                const logPanel = document.querySelector('#log-panel');
                if (logPanel) {
                    const entry = document.createElement('div');
                    entry.textContent = `[PASTED] ${text}`;
                    logPanel.appendChild(entry);
                    logAction('Text pasted to log panel');
                } else {
                    logAction('Log panel not found', 'warning');
                }
            }).catch(err => {
                logAction(`Failed to paste log entry: ${err.message}`, 'error');
            });
        } catch (error) {
            logAction(`Error during pasteLogEntry: ${error.message}`, 'error');
        }
    },

    /**
     * Applies initial UI state using thunks
     */
    applyInitialUIState: () => {
        logAction('Triggering applyInitialUIState action...');
        
        // Use the thunk action creator
        dispatch(uiActions.applyInitialUIState());
        
        logAction('applyInitialUIState executed');
    }
}; 