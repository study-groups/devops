/**
 * Editor action handlers
 * Responsible for editor operations like text manipulation
 */
import { dispatch } from '/client/messaging/messageQueue.js';
import { smartCopyActions } from '/client/messaging/actionCreators.js';
// Editor functionality now handled by EditorPanel directly
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

export const editorActionHandlers = {
    /**
     * Sets the SmartCopy buffer A with the current selection
     */
    setSmartCopyBufferA: () => {
        logAction('Setting SmartCopy Buffer A...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        if (!editorTextArea) {
            logAction('Cannot set SmartCopy A: Editor textarea not found.', 'error');
            alert('Editor not found to copy selection from.');
            return;
        }
        const start = editorTextArea.selectionStart;
        const end = editorTextArea.selectionEnd;
        const selectedText = editorTextArea.value.substring(start, end);

        if (start === end) {
             logAction('Cannot set SmartCopy A: No text selected.', 'warning');
             return;
        }

        try {
            // Dispatch the action which will handle state update
            dispatch(smartCopyActions.setSmartCopyA(selectedText));
            logAction(`SmartCopy Buffer A set (Length: ${selectedText.length})`);
        } catch (e) {
            logAction(`Failed to set SmartCopy Buffer A: ${e.message}`, 'error');
            alert('Failed to save selection to buffer A.');
        }
    },

    /**
     * Sets the SmartCopy buffer B with the current selection
     */
    setSmartCopyBufferB: (data, element) => {
        logAction('Setting SmartCopy Buffer B...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        if (!editorTextArea) {
            logAction('Cannot set SmartCopy B: Editor textarea not found.', 'error');
            alert('Editor not found to copy selection from.');
            return;
        }
        const start = editorTextArea.selectionStart;
        const end = editorTextArea.selectionEnd;
        const selectedText = editorTextArea.value.substring(start, end);

        if (start === end) {
             logAction('Cannot set SmartCopy B: No text selected.', 'warning');
             return;
        }

        try {
            // Dispatch the action which will handle state update and persistence
            dispatch(smartCopyActions.setSmartCopyB(selectedText));
            logAction(`SmartCopy Buffer B set (Length: ${selectedText.length})`);
        } catch (e) {
            logAction(`Failed to set SmartCopy Buffer B: ${e.message}`, 'error');
            alert('Failed to save selection to buffer B.');
        }
    },

    /**
     * Replaces the current editor selection with the provided content
     */
    replaceEditorSelection: (payload) => {
        const { codeContent } = payload;
        if (typeof codeContent === 'string') {
            logAction(`Triggering replaceEditorSelection with content length: ${codeContent.length}`);
            
            // Get the main editor textarea
            const editorTextArea = document.querySelector('#editor-container textarea');
            if (editorTextArea) {
                editorTextArea.value = codeContent;
                editorTextArea.dispatchEvent(new Event('input'));
                logAction('Editor content replaced successfully');
            } else {
                logAction('Editor textarea not found', 'error');
            }
        } else {
            logAction('Invalid codeContent provided to replaceEditorSelection', 'error');
        }
    },

    /**
     * Pastes text at the current cursor position in the editor
     */
    pasteTextAtCursor: (data) => {
        const textToPaste = data?.textToPaste;
        logAction('>>> pasteTextAtCursor Action Started <<<');
        
        if (textToPaste === undefined || textToPaste === null) {
            logAction('PasteText failed: textToPaste is undefined or null.', 'error');
            return;
        }

        try {
            const editorTextArea = document.querySelector('#editor-container textarea');
            if (!editorTextArea) {
                logAction('PasteText failed: Editor textarea not found.', 'error');
                alert('Editor is not available to paste into.');
                return;
            }

            // Get current cursor position
            const start = editorTextArea.selectionStart;
            const end = editorTextArea.selectionEnd;

            // Select the current range (usually just the cursor position)
            editorTextArea.focus();
            editorTextArea.setSelectionRange(start, end);

            // Execute the insertText command to insert/replace
            const success = document.execCommand('insertText', false, textToPaste);
            if (!success) {
                logAction('PasteText execCommand insertText failed.', 'warning');
                throw new Error('document.execCommand("insertText") failed');
            }

            logAction('Text pasted into editor at cursor.');

            // Trigger preview update
            if (eventBus) {
                eventBus.emit('editor:contentChanged', { content: editorTextArea.value });
            }

        } catch (err) {
            logAction(`Error during PasteText insertion: ${err}`, 'error');
            console.error("Paste Text Error:", err);
        }
    },

    /**
     * Pastes CLI response over a previously marked selection
     */
    pasteCliResponseOverSelection: (data, element) => {
        logAction('>>> pasteCliResponseOverSelection Action Started <<<');
        if (!element || element.tagName !== 'BUTTON') { 
            logAction(`PasteOver failed: Expected button element, got ${element?.tagName}.`, 'error');
            return;
        }
        const buttonElement = element;

        // Retrieve data from button dataset
        const start = parseInt(buttonElement.dataset.selectionStart, 10);
        const end = parseInt(buttonElement.dataset.selectionEnd, 10);
        const responseText = buttonElement.dataset.responseText;

        logAction(`PasteOver: Start=${start}, End=${end}, ResponseText Length=${responseText?.length}`, 'debug');

        // Validate data
        if (isNaN(start) || isNaN(end) || responseText === undefined || responseText === null) {
            logAction('PasteOver failed: Invalid data retrieved from button dataset.', 'error');
            return;
        }

        try {
            const editorTextArea = document.querySelector('#editor-container textarea');
            if (!editorTextArea) {
                logAction('PasteOver failed: Editor textarea not found.', 'error');
                alert('Editor is not available to paste into.');
                return;
            }

            // Select the original range
            editorTextArea.focus();
            editorTextArea.setSelectionRange(start, end);

            // Execute the insertText command to replace selection
            const success = document.execCommand('insertText', false, responseText);
            if (!success) {
                logAction('PasteOver execCommand insertText failed.', 'warning');
                throw new Error('document.execCommand("insertText") failed');
            }

            logAction('CLI Response pasted over original selection.');

            // Trigger preview update
            if (eventBus) {
                eventBus.emit('editor:contentChanged', { content: editorTextArea.value });
            }

            // Optional: Feedback on button
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '✓'; 
            setTimeout(() => { buttonElement.innerHTML = originalHTML; }, 1500);

        } catch (err) {
            logAction(`Error during PasteOver insertion: ${err}`, 'error');
            console.error("Paste Over Selection Error:", err);
        }
    }
}; 