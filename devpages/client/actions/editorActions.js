/**
import { appStore } from "/appState.js";
 * Editor action handlers
 * Responsible for editor operations like text manipulation
 */
// REMOVED: messageQueue import (file deleted)
import { smartCopyActions } from '/client/messaging/actionCreators.js';
import eventBus from '/client/eventBus.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('EditorActions');

export const editorActionHandlers = {
    /**
     * Sets the SmartCopy buffer A with the current selection
     */
    setSmartCopyBufferA: () => {
        log.info('ACTION', 'SET_SMART_COPY_A_START', 'Setting SmartCopy Buffer A...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        if (!editorTextArea) {
            log.error('ACTION', 'SET_SMART_COPY_A_FAILED', 'Cannot set SmartCopy A: Editor textarea not found.');
            alert('Editor not found to copy selection from.');
            return;
        }
        const start = editorTextArea.selectionStart;
        const end = editorTextArea.selectionEnd;
        const selectedText = editorTextArea.value.substring(start, end);

        if (start === end) {
             log.warn('ACTION', 'SET_SMART_COPY_A_SKIPPED', 'Cannot set SmartCopy A: No text selected.');
             return;
        }

        try {
            // Dispatch the action which will handle state update
            dispatch(smartCopyActions.setSmartCopyA(selectedText));
            log.info('ACTION', 'SET_SMART_COPY_A_SUCCESS', `SmartCopy Buffer A set (Length: ${selectedText.length})`);
        } catch (e) {
            log.error('ACTION', 'SET_SMART_COPY_A_FAILED', `Failed to set SmartCopy Buffer A: ${e.message}`, e);
            alert('Failed to save selection to buffer A.');
        }
    },

    /**
     * Sets the SmartCopy buffer B with the current selection
     */
    setSmartCopyBufferB: (data, element) => {
        log.info('ACTION', 'SET_SMART_COPY_B_START', 'Setting SmartCopy Buffer B...');
        const editorTextArea = document.querySelector('#editor-container textarea');
        if (!editorTextArea) {
            log.error('ACTION', 'SET_SMART_COPY_B_FAILED', 'Cannot set SmartCopy B: Editor textarea not found.');
            alert('Editor not found to copy selection from.');
            return;
        }
        const start = editorTextArea.selectionStart;
        const end = editorTextArea.selectionEnd;
        const selectedText = editorTextArea.value.substring(start, end);

        if (start === end) {
             log.warn('ACTION', 'SET_SMART_COPY_B_SKIPPED', 'Cannot set SmartCopy B: No text selected.');
             return;
        }

        try {
            // Dispatch the action which will handle state update and persistence
            dispatch(smartCopyActions.setSmartCopyB(selectedText));
            log.info('ACTION', 'SET_SMART_COPY_B_SUCCESS', `SmartCopy Buffer B set (Length: ${selectedText.length})`);
        } catch (e) {
            log.error('ACTION', 'SET_SMART_COPY_B_FAILED', `Failed to set SmartCopy Buffer B: ${e.message}`, e);
            alert('Failed to save selection to buffer B.');
        }
    },

    /**
     * Replaces the current editor selection with the provided content
     */
    replaceEditorSelection: (payload) => {
        const { codeContent } = payload;
        if (typeof codeContent === 'string') {
            log.info('ACTION', 'REPLACE_EDITOR_SELECTION', `Triggering replaceEditorSelection with content length: ${codeContent.length}`);
            
            // Get the main editor textarea
            const editorTextArea = document.querySelector('#editor-container textarea');
            if (editorTextArea) {
                editorTextArea.value = codeContent;
                editorTextArea.dispatchEvent(new Event('input'));
                log.info('ACTION', 'REPLACE_EDITOR_SELECTION_SUCCESS', 'Editor content replaced successfully');
            } else {
                log.error('ACTION', 'REPLACE_EDITOR_SELECTION_FAILED', 'Editor textarea not found');
            }
        } else {
            log.error('ACTION', 'REPLACE_EDITOR_SELECTION_FAILED', `Invalid codeContent provided to replaceEditorSelection: ${typeof codeContent}`);
        }
    },

    /**
     * Pastes text at the current cursor position in the editor
     */
    pasteTextAtCursor: (data) => {
        const textToPaste = data?.textToPaste;
        log.info('ACTION', 'PASTE_TEXT_AT_CURSOR_START', '>>> pasteTextAtCursor Action Started <<<');
        
        if (textToPaste === undefined || textToPaste === null) {
            log.error('ACTION', 'PASTE_TEXT_AT_CURSOR_FAILED', 'PasteText failed: textToPaste is undefined or null.');
            return;
        }

        try {
            const editorTextArea = document.querySelector('#editor-container textarea');
            if (!editorTextArea) {
                log.error('ACTION', 'PASTE_TEXT_AT_CURSOR_FAILED', 'PasteText failed: Editor textarea not found.');
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
                log.warn('ACTION', 'PASTE_TEXT_AT_CURSOR_FAILED', 'PasteText execCommand insertText failed.');
                throw new Error('document.execCommand("insertText") failed');
            }

            log.info('ACTION', 'PASTE_TEXT_AT_CURSOR_SUCCESS', 'Text pasted into editor at cursor.');

            // Trigger preview update
            if (eventBus) {
                eventBus.emit('editor:contentChanged', { content: editorTextArea.value });
            }

        } catch (err) {
            log.error('ACTION', 'PASTE_TEXT_AT_CURSOR_FAILED', `Error during PasteText insertion: ${err}`, err);
        }
    },

    /**
     * Pastes CLI response over a previously marked selection
     */
    pasteCliResponseOverSelection: (data, element) => {
        log.info('ACTION', 'PASTE_CLI_RESPONSE_START', '>>> pasteCliResponseOverSelection Action Started <<<');
        if (!element || element.tagName !== 'BUTTON') { 
            log.error('ACTION', 'PASTE_CLI_RESPONSE_FAILED', `PasteOver failed: Expected button element, got ${element?.tagName}.`);
            return;
        }
        const buttonElement = element;

        // Retrieve data from button dataset
        const start = parseInt(buttonElement.dataset.selectionStart, 10);
        const end = parseInt(buttonElement.dataset.selectionEnd, 10);
        const responseText = buttonElement.dataset.responseText;

        log.debug('ACTION', 'PASTE_CLI_RESPONSE_DATA', `PasteOver: Start=${start}, End=${end}, ResponseText Length=${responseText?.length}`);

        // Validate data
        if (isNaN(start) || isNaN(end) || responseText === undefined || responseText === null) {
            log.error('ACTION', 'PASTE_CLI_RESPONSE_FAILED', 'PasteOver failed: Invalid data retrieved from button dataset.');
            return;
        }

        try {
            const editorTextArea = document.querySelector('#editor-container textarea');
            if (!editorTextArea) {
                log.error('ACTION', 'PASTE_CLI_RESPONSE_FAILED', 'PasteOver failed: Editor textarea not found.');
                alert('Editor is not available to paste into.');
                return;
            }

            // Select the original range
            editorTextArea.focus();
            editorTextArea.setSelectionRange(start, end);

            // Execute the insertText command to replace selection
            const success = document.execCommand('insertText', false, responseText);
            if (!success) {
                log.warn('ACTION', 'PASTE_CLI_RESPONSE_FAILED', 'PasteOver execCommand insertText failed.');
                throw new Error('document.execCommand("insertText") failed');
            }

            log.info('ACTION', 'PASTE_CLI_RESPONSE_SUCCESS', 'CLI Response pasted over original selection.');

            // Trigger preview update
            if (eventBus) {
                eventBus.emit('editor:contentChanged', { content: editorTextArea.value });
            }

            // Optional: Feedback on button
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = '✓'; 
            setTimeout(() => { buttonElement.innerHTML = originalHTML; }, 1500);

        } catch (err) {
            log.error('ACTION', 'PASTE_CLI_RESPONSE_FAILED', `Error during PasteOver insertion: ${err}`, err);
        }
    }
}; 