/**
import { appStore } from "/appState.js";
 * UI action handlers
 * Responsible for UI interactions like view modes, log panel, etc.
 */
// REMOVED: messageQueue import (file deleted)
import { uiActions } from '/client/messaging/actionCreators.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('UIActions');

export const uiActionHandlers = {
    /**
     * Sets the view mode using thunks
     * @param {string} mode - View mode ('preview', 'split', 'editor')
     */
    setView: (mode) => {
        log.info('ACTION', 'SET_VIEW', `Triggering setView action for mode: ${mode}`);
        dispatch(uiActions.setViewModeAsync(mode));
    },

    /**
     * Refreshes the preview using thunks
     */
    refreshPreview: () => {
        log.info('ACTION', 'REFRESH_PREVIEW', 'Triggering refreshPreview action...');
        dispatch(uiActions.refreshPreview());
    },

    /**
     * Copies log content to clipboard
     */
    copyLog: () => {
        log.info('ACTION', 'COPY_LOG', 'Triggering copyLog action...');
        try {
            const logPanel = document.querySelector('#log-display');
            if (logPanel) {
                const logContent = logPanel.textContent || logPanel.innerText;
                navigator.clipboard.writeText(logContent).then(() => {
                    log.info('ACTION', 'COPY_LOG_SUCCESS', 'Log content copied to clipboard');
                }).catch(err => {
                    log.error('ACTION', 'COPY_LOG_FAILED', `Failed to copy log content: ${err.message}`, err);
                });
            } else {
                log.warn('ACTION', 'COPY_LOG_SKIPPED', 'Log panel not found');
            }
        } catch (error) {
            log.error('ACTION', 'COPY_LOG_FAILED', `Error during copyLog: ${error.message}`, error);
        }
    },

    /**
     * Clears the log panel
     */
    clearLog: () => {
        log.info('ACTION', 'CLEAR_LOG', 'Triggering clearLog action...');
        try {
            const logPanel = document.querySelector('#log-display');
            if (logPanel) {
                logPanel.innerHTML = '';
                log.info('ACTION', 'CLEAR_LOG_SUCCESS', 'Log panel cleared');
            } else {
                log.warn('ACTION', 'CLEAR_LOG_SKIPPED', 'Log panel not found');
            }
        } catch (error) {
            log.error('ACTION', 'CLEAR_LOG_FAILED', `Error during clearLog: ${error.message}`, error);
        }
    },

    /**
     * Minimizes the log panel
     */
    minimizeLog: () => {
        log.info('ACTION', 'MINIMIZE_LOG', 'Triggering minimizeLog action...');
        try {
            const logPanel = document.querySelector('#log-display');
            if (logPanel) {
                logPanel.style.height = '30px';
                logPanel.style.overflow = 'hidden';
                log.info('ACTION', 'MINIMIZE_LOG_SUCCESS', 'Log panel minimized');
            } else {
                log.warn('ACTION', 'MINIMIZE_LOG_SKIPPED', 'Log panel not found');
            }
        } catch (error) {
            log.error('ACTION', 'MINIMIZE_LOG_FAILED', `Error during minimizeLog: ${error.message}`, error);
        }
    },

    /**
     * Shows system information
     */
    showSystemInfo: () => {
        log.info('ACTION', 'SHOW_SYSTEM_INFO', 'Triggering showSystemInfo action...');
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
            log.info('ACTION', 'SHOW_SYSTEM_INFO_DATA', 'System Information:', info);
        } catch (error) {
            log.error('ACTION', 'SHOW_SYSTEM_INFO_FAILED', `Error during showSystemInfo: ${error.message}`, error);
        }
    },

    /**
     * Toggles log menu using thunks
     */
    toggleLogMenu: () => {
        log.info('ACTION', 'TOGGLE_LOG_MENU', 'Triggering toggleLogMenu action...');
        dispatch(uiActions.toggleLogMenuAsync());
    },

    /**
     * Copies a specific log entry to clipboard
     * @param {string} entryText - Log entry text to copy
     */
    copyLogEntry: (entryText) => {
        log.info('ACTION', 'COPY_LOG_ENTRY', 'Triggering copyLogEntry action...');
        try {
            navigator.clipboard.writeText(entryText).then(() => {
                log.info('ACTION', 'COPY_LOG_ENTRY_SUCCESS', 'Log entry copied to clipboard');
            }).catch(err => {
                log.error('ACTION', 'COPY_LOG_ENTRY_FAILED', `Failed to copy log entry: ${err.message}`, err);
            });
        } catch (error) {
            log.error('ACTION', 'COPY_LOG_ENTRY_FAILED', `Error during copyLogEntry: ${error.message}`, error);
        }
    },

    /**
     * Pastes text from clipboard to log
     */
    pasteLogEntry: () => {
        log.info('ACTION', 'PASTE_LOG_ENTRY', 'Triggering pasteLogEntry action...');
        try {
            navigator.clipboard.readText().then(text => {
                const logPanel = document.querySelector('#log-display');
                if (logPanel) {
                    const entry = document.createElement('div');
                    entry.textContent = `[PASTED] ${text}`;
                    logPanel.appendChild(entry);
                    log.info('ACTION', 'PASTE_LOG_ENTRY_SUCCESS', 'Text pasted to log panel');
                } else {
                    log.warn('ACTION', 'PASTE_LOG_ENTRY_SKIPPED', 'Log panel not found');
                }
            }).catch(err => {
                log.error('ACTION', 'PASTE_LOG_ENTRY_FAILED', `Failed to paste log entry: ${err.message}`, err);
            });
        } catch (error) {
            log.error('ACTION', 'PASTE_LOG_ENTRY_FAILED', `Error during pasteLogEntry: ${error.message}`, error);
        }
    },

    /**
     * Applies initial UI state using thunks
     */
    applyInitialUIState: () => {
        log.info('ACTION', 'APPLY_INITIAL_UI_STATE', 'Triggering applyInitialUIState action...');
        dispatch(uiActions.applyInitialUIState());
    }
}; 