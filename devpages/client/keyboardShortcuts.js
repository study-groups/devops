/**
 * Keyboard Shortcuts Manager
 * Handles global keyboard shortcuts for the application using a mapping configuration.
 */

import { logMessage } from './log/index.js';
import { eventBus } from './eventBus.js';
import { dispatch, ActionTypes } from './messaging/messageQueue.js'; // <<< Import dispatch and ActionTypes
// Remove imports for directly called functions and state
// import { saveFile } from './fileManager/index.js';
// import { setView } from './views.js';
// import { executeRefresh } from './markdown-svg.js';
// import { authState } from '/client/authState.js';

// --- Shortcut Definitions ---
// ctrl: boolean | 'optional' (allows Ctrl or Meta)
// shift: boolean
// alt: boolean
// action: string (ActionType for dispatch or event name for eventBus)
// useDispatch: boolean (true to use dispatch, false for eventBus)
// payload: object | null (data for the action/event)
// preventDefault: boolean (defaults true)
const shortcutMappings = [
    // Settings Panel Toggle
    { key: 'S', ctrl: true, shift: true, alt: false, useDispatch: true, action: ActionTypes.SETTINGS_PANEL_TOGGLE, payload: null },
    // Save File
    { key: 's', ctrl: 'optional', shift: false, alt: false, useDispatch: false, action: 'shortcut:saveFile', payload: null }, 
    // Refresh Preview (Assuming this triggers a non-state process)
    { key: 'r', ctrl: 'optional', shift: false, alt: true, useDispatch: false, action: 'shortcut:refreshPreview', payload: null },
    // Set View Modes (Using dispatch and the reducer)
    { key: '1', ctrl: false, shift: false, alt: true, useDispatch: true, action: ActionTypes.UI_SET_VIEW_MODE, payload: { viewMode: 'editor' } }, // Using 'editor' to match bootstrap.js
    { key: '2', ctrl: false, shift: false, alt: true, useDispatch: true, action: ActionTypes.UI_SET_VIEW_MODE, payload: { viewMode: 'preview' } },
    { key: '3', ctrl: false, shift: false, alt: true, useDispatch: true, action: ActionTypes.UI_SET_VIEW_MODE, payload: { viewMode: 'split' } },
    // Add more mappings here...
    // { key: 'l', ctrl: true, shift: false, alt: false, useDispatch: false, action: 'shortcut:focusLogInput', payload: null } 
];

// Initialize keyboard shortcuts
export function initKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Ignore shortcuts if typing in an input field, textarea, or contenteditable
        const targetTagName = event.target.tagName.toLowerCase();
        if (['input', 'textarea', 'select'].includes(targetTagName) || event.target.isContentEditable) {
            // Allow specific shortcuts even in inputs, e.g., Ctrl+S if needed
            // if (!(event.ctrlKey && event.key === 's')) return; 
            return; // Generally ignore shortcuts in inputs
        }

        for (const mapping of shortcutMappings) {
            // Check modifiers
            const ctrlPressed = event.ctrlKey || event.metaKey; // Treat Ctrl and Cmd the same
            const ctrlMatch = (mapping.ctrl === 'optional') ? ctrlPressed : (mapping.ctrl === ctrlPressed);
            const shiftMatch = mapping.shift === event.shiftKey;
            const altMatch = mapping.alt === event.altKey;

            // Check key (case-insensitive for letters unless specified)
            const keyMatch = mapping.key.toUpperCase() === event.key.toUpperCase();

            if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
                // Shortcut match found!
                if (mapping.preventDefault !== false) { // Default to true
                    event.preventDefault();
                }

                logMessage(`[Keyboard] Shortcut detected: ${mapping.key} (Ctrl: ${mapping.ctrl}, Shift: ${mapping.shift}, Alt: ${mapping.alt}). Action: ${mapping.action}`);

                if (mapping.useDispatch) {
                    dispatch({ type: mapping.action, payload: mapping.payload });
                } else {
                    eventBus.emit(mapping.action, mapping.payload);
                    // Example: Specific handling for non-dispatch actions if needed
                    // if (mapping.action === 'shortcut:focusLogInput') {
                    //     document.getElementById('cli-input')?.focus();
                    // }
                }

                // Stop processing other mappings for this event
                break; 
            }
        }
    });
    
    logMessage('[Keyboard] Keyboard shortcuts initialized', 'info');
} 