/**
 * UI action handlers
 * Responsible for UI operations like view mode changes and log operations
 */
import { dispatch } from '/client/messaging/messageQueue.js';
import { uiActions } from '/client/messaging/actionCreators.js';
import { refreshPreview as refreshPreviewFunction } from '/client/previewManager.js';
import eventBus from '/client/eventBus.js';

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
     * Sets the view mode (editor, preview, or split)
     * @param {Object} data - Data containing the viewMode
     */
    setView: (data) => {
        console.log('[DEBUG actions.js] setView action triggered. Data:', data);
        const mode = data.viewMode;
        if (mode && ['editor', 'preview', 'split'].includes(mode)) { // Validate mode
            logAction(`Triggering setView: ${mode}`);
            // Use the action creator for cleaner state management
            dispatch(uiActions.setViewMode(mode));
            logAction(`Dispatched UI_SET_VIEW_MODE with mode: ${mode}`);
        } else {
            logAction(`setView triggered with invalid or missing viewMode: ${mode}`, 'warning');
            console.warn('[DEBUG actions.js] setView called with invalid/missing viewMode data.', data);
        }
    },

    /**
     * Refreshes the preview panel
     */
    refreshPreview: () => {
        console.log('[Action] refreshPreview triggered');
        try {
            refreshPreviewFunction();
        } catch (error) {
            console.error('[Action refreshPreview ERROR]', error);
        }
    },

    /**
     * Copies the current log content to clipboard
     */
    copyLog: async () => {
        try {
            window.logPanel?.copyLog(); 
        } catch (e) { 
            logAction(`copyLog failed: ${e.message}`, 'error'); 
        }
    },

    /**
     * Clears the log panel
     */
    clearLog: async () => {
        try {
            window.logPanel?.clearLog();
        } catch (e) { 
            logAction(`clearLog failed: ${e.message}`, 'error'); 
        }
    },

    /**
     * Toggles the log panel visibility
     */
    toggleLogVisibility: async () => { 
        logAction('Triggering toggleLogVisibility via dispatch...');
        try {
            dispatch(uiActions.toggleLogVisibility());
        } catch (e) {
            logAction(`toggleLogVisibility dispatch failed: ${e.message}`, 'error');
        }
    },

    /**
     * Minimizes the log panel
     */
    minimizeLog: async () => {
        logAction('Triggering minimizeLog via dispatch...');
        try {
            dispatch(uiActions.setLogVisibility(false));
        } catch (e) {
            logAction(`minimizeLog dispatch failed: ${e.message}`, 'error');
        }
    },

    /**
     * Shows system information
     */
    showSystemInfo: async () => {
        try {
            window.dev?.showAppInfo?.();
        } catch (e) { 
            logAction(`showSystemInfo/showAppInfo failed: ${e.message}`, 'error'); 
        }
    },

    /**
     * Toggles the log menu
     */
    toggleLogMenu: () => {
        logAction('Triggering toggleLogMenu...');
        try {
            dispatch(uiActions.toggleLogMenu());
        } catch (e) {
            logAction(`toggleLogMenu dispatch failed: ${e.message}`, 'error');
        }
    },

    /**
     * Copies text content of a log entry
     */
    copyLogEntry: async (data, element) => {
        if (!element) {
            logAction('copyLogEntry failed: No element provided.', 'error');
            return;
        }
        const logEntryDiv = element.closest('.log-entry');
        const textSpan = logEntryDiv?.querySelector('.log-entry-text');
        if (textSpan?.textContent) {
            try {
                await navigator.clipboard.writeText(textSpan.textContent);
                logAction('Log entry copied to clipboard.');
                // Optional: Show brief feedback
                const originalText = element.textContent;
                element.textContent = '✓';
                setTimeout(() => { element.textContent = originalText; }, 1000);
            } catch (err) {
                logAction(`Failed to copy log entry: ${err}`, 'error');
            }
        } else {
            logAction('Could not find text content for log entry.', 'warning');
        }
    },

    /**
     * Pastes a log entry into the editor
     */
    pasteLogEntry: (data, element) => {
        if (!element || element.tagName !== 'BUTTON') {
            logAction(`pasteLogEntry failed: Expected button element, got ${element?.tagName}.`, 'error');
            return;
        }
        const buttonElement = element;
        const logText = buttonElement.dataset.logText;

        if (logText === undefined || logText === null) {
            logAction('Paste failed: logText is undefined or null.', 'error');
            return;
        }
        if (logText.trim() === '') {
            logAction('Paste failed: logText is empty or whitespace.', 'warning');
            return;
        }

        try {
            const editorTextArea = document.querySelector('#editor-container textarea'); 
            if (!editorTextArea) {
                logAction('Paste failed: Editor textarea element not found.', 'error');
                alert('Editor is not available to paste into.');
                return;
            }

            logAction(`Attempting to insert text into editor...`, 'debug');
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;
            
            editorTextArea.focus();
            editorTextArea.setSelectionRange(start, end);
            
            const success = document.execCommand('insertText', false, logText);
            if (!success) {
                logAction('execCommand insertText failed. Pasting may not be undoable.', 'warning');
                throw new Error('document.execCommand("insertText") failed');
            }
            
            logAction('Log entry pasted into editor.');
            
            if (eventBus) {
                logAction('Emitting editor:contentChanged to trigger preview update.', 'debug');
                eventBus.emit('editor:contentChanged', { content: editorTextArea.value });
            } else {
                logAction('eventBus not available, cannot trigger preview update.', 'warning');
            }

            // Feedback
            const originalText = buttonElement.textContent;
            buttonElement.textContent = '✓';
            buttonElement.classList.add('pasted-feedback');
            setTimeout(() => { 
                buttonElement.textContent = originalText;
                buttonElement.classList.remove('pasted-feedback');
            }, 1500);
        } catch (err) {
            logAction(`Error during text insertion: ${err}`, 'error');
            console.error("Paste Log Entry Error:", err);
        }
    }
}; 