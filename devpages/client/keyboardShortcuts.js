/**
 * Keyboard Shortcuts Manager
 * Handles global keyboard shortcuts for the application using a mapping configuration.
 */

import { logMessage } from './log/index.js';
import { eventBus } from './eventBus.js';
import { dispatch, ActionTypes } from './messaging/messageQueue.js'; // <<< Import dispatch and ActionTypes
import { triggerActions } from '/client/actions.js';
import { SMART_COPY_A_KEY, SMART_COPY_B_KEY } from '/client/appState.js'; // Import keys if needed, though actions.js handles storage
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
// triggerAction: string | null (Name of function in triggerActions to call directly)
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

    // SmartCopy Actions (Integrated)
    { key: 'A', ctrl: true, shift: true, alt: false, triggerAction: 'setSmartCopyBufferA' },
    { key: 'B', ctrl: true, shift: true, alt: false, useDispatch: true, action: ActionTypes.SET_SMART_COPY_B, payload: null },
];

// Initialize keyboard shortcuts
export function initKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // --- Detailed Log Start --- 
        console.log(`[Shortcut DEBUG] KeyDown: key='${event.key}', code='${event.code}', ctrl=${event.ctrlKey}, meta=${event.metaKey}, shift=${event.shiftKey}, alt=${event.altKey}`);
        const activeElement = document.activeElement;
        const targetTagName = activeElement?.tagName?.toLowerCase() || 'none';
        const isEditable = activeElement?.isContentEditable || false;
        console.log(`[Shortcut DEBUG] Active Element: <${targetTagName}>, isContentEditable: ${isEditable}`);
        // --- End Detailed Log --- 

        // Ignore shortcuts if typing in an input field, textarea, or contenteditable,
        // UNLESS modifier keys (Ctrl, Alt, Meta) are also pressed.
        if ( (['input', 'textarea', 'select'].includes(targetTagName) || isEditable) && 
             !(event.ctrlKey || event.altKey || event.metaKey) ) 
        {
            // Allow specific single-key shortcuts here if needed (e.g., Escape key)
            // if (event.key === 'Escape') { /* handle escape */ }
            
            console.log(`[Shortcut DEBUG] Ignoring event: Typing in input/editable without Ctrl/Alt/Meta.`);
            return; 
        }

        for (const mapping of shortcutMappings) {
            // Check modifiers
            const ctrlPressed = event.ctrlKey || event.metaKey; // Treat Ctrl and Cmd the same
            const ctrlMatch = (mapping.ctrl === 'optional') ? ctrlPressed : (mapping.ctrl === ctrlPressed);
            const shiftMatch = mapping.shift === event.shiftKey;
            const altMatch = mapping.alt === event.altKey;

            // Check key (case-insensitive for letters unless specified)
            const keyMatch = mapping.key.toUpperCase() === event.key.toUpperCase();

            // --- Detailed Log Inside Loop (for A/B) --- 
            if (mapping.key === 'A' || mapping.key === 'B') {
                console.log(`[Shortcut DEBUG] Checking mapping for key '${mapping.key}': ctrlMatch=${ctrlMatch}, shiftMatch=${shiftMatch}, altMatch=${altMatch}, keyMatch=${keyMatch}`);
            }
            // --- End Detailed Log --- 

            if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
                // Shortcut match found!
                if (mapping.preventDefault !== false) { // Default to true
                    event.preventDefault();
                }

                // Determine log message based on action type
                const actionDesc = mapping.triggerAction ? `triggerActions.${mapping.triggerAction}` 
                                   : (mapping.useDispatch ? `dispatch(${mapping.action})` : `eventBus.emit(${mapping.action})`);
                logMessage(`[Keyboard] Shortcut detected: ${mapping.key} (Ctrl: ${mapping.ctrl}, Shift: ${mapping.shift}, Alt: ${mapping.alt}). Action: ${actionDesc}`);

                // Execute the appropriate action
                if (mapping.triggerAction && triggerActions[mapping.triggerAction]) {
                    triggerActions[mapping.triggerAction](); // Call function from triggerActions
                } else if (mapping.useDispatch) {
                    dispatch({ type: mapping.action, payload: mapping.payload });
                } else { // Assumes eventBus if not useDispatch and not triggerAction
                    eventBus.emit(mapping.action, mapping.payload);
                }

                // Stop processing other mappings for this event
                break;
            }
        }
    });
    
    logMessage('[Keyboard] Keyboard shortcuts initialized', 'info');
} 