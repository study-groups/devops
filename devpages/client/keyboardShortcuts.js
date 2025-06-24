/**
 * Keyboard Shortcuts Manager
 * Handles global keyboard shortcuts for the application using a mapping configuration.
 */

import { logMessage } from './log/index.js';
import { eventBus } from './eventBus.js';
import { dispatch, ActionTypes } from './messaging/messageQueue.js';
import { triggerActions } from '/client/actions.js';
import { SMART_COPY_A_KEY, SMART_COPY_B_KEY } from '/client/appState.js';

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
    // REMOVED Settings Panel Toggle from here - handled separately below
    // Save File
    { key: 's', ctrl: 'optional', shift: false, alt: false, useDispatch: false, action: 'shortcut:saveFile', payload: null }, 
    // Refresh Preview (Assuming this triggers a non-state process)
    { key: 'r', ctrl: 'optional', shift: false, alt: true, useDispatch: false, action: 'shortcut:refreshPreview', payload: null },
    // Set View Modes (Using dispatch and the reducer)
    { key: '1', ctrl: false, shift: false, alt: true, useDispatch: true, action: ActionTypes.UI_SET_VIEW_MODE, payload: { viewMode: 'editor' } },
    { key: '2', ctrl: false, shift: false, alt: true, useDispatch: true, action: ActionTypes.UI_SET_VIEW_MODE, payload: { viewMode: 'preview' } },
    { key: '3', ctrl: false, shift: false, alt: true, useDispatch: true, action: ActionTypes.UI_SET_VIEW_MODE, payload: { viewMode: 'split' } },
    // SmartCopy Actions (Integrated)
    { key: 'A', ctrl: true, shift: true, alt: false, triggerAction: 'setSmartCopyBufferA' },
    { key: 'B', ctrl: true, shift: true, alt: false, useDispatch: true, action: ActionTypes.SET_SMART_COPY_B, payload: null },
];

// Initialize keyboard shortcuts
export function initKeyboardShortcuts() {
    // Main shortcut handler for configured mappings
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
            const keyMatch = mapping.key.toUpperCase() === (event.key || '').toUpperCase();

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
    
    // Add a SINGLE handler for Ctrl+Shift+S
    document.addEventListener('keydown', function(event) {
        if (event.key === 'S' && event.ctrlKey && event.shiftKey && !event.altKey) {
            event.preventDefault();
            console.log('[Keyboard DEBUG] Ctrl+Shift+S pressed. window.devPages:', window.devPages);
            console.log('[Keyboard DEBUG] window.devPages exists:', !!window.devPages);
            console.log('[Keyboard DEBUG] window.devPages.settingsPanel exists:', !!(window.devPages && window.devPages.settingsPanel));
            console.log('[Keyboard DEBUG] toggleVisibility method exists:', !!(window.devPages && window.devPages.settingsPanel && typeof window.devPages.settingsPanel.toggleVisibility === 'function'));
            
            if (window.devPages && window.devPages.settingsPanel) {
                console.log('[Keyboard DEBUG] Toggling settings panel visibility.');
                try {
                    window.devPages.settingsPanel.toggleVisibility();
                    console.log('[Keyboard DEBUG] toggleVisibility() called successfully.');
                } catch (error) {
                    console.error('[Keyboard DEBUG] Error calling toggleVisibility():', error);
                }
            } else {
                console.warn('[Keyboard DEBUG] window.devPages.settingsPanel not found!');
                console.log('[Keyboard DEBUG] Available window properties:', Object.keys(window).filter(key => key.includes('dev') || key.includes('settings')));
            }
        }
    });
    
    logMessage('[Keyboard] Keyboard shortcuts initialized', 'info');
    
    // Add a global debug function for testing settings panel
    window.testSettingsPanel = function() {
        console.log('[TEST] Testing settings panel...');
        console.log('[TEST] window.devPages exists:', !!window.devPages);
        console.log('[TEST] window.devPages.settingsPanel exists:', !!(window.devPages && window.devPages.settingsPanel));
        console.log('[TEST] toggleVisibility method exists:', !!(window.devPages && window.devPages.settingsPanel && typeof window.devPages.settingsPanel.toggleVisibility === 'function'));
        
        if (window.devPages && window.devPages.settingsPanel) {
            try {
                console.log('[TEST] Calling toggleVisibility()...');
                const result = window.devPages.settingsPanel.toggleVisibility();
                console.log('[TEST] toggleVisibility() returned:', result);
                return result;
            } catch (error) {
                console.error('[TEST] Error calling toggleVisibility():', error);
                return false;
            }
        } else {
            console.warn('[TEST] Settings panel not available!');
            return false;
        }
    };
    
    console.log('[Keyboard DEBUG] Global testSettingsPanel() function added. Call testSettingsPanel() to test manually.');
    
    // Add a function to manually initialize settings panel for debugging
    window.debugInitSettings = async function() {
        console.log('[DEBUG] Manually initializing settings panel...');
        try {
            const { initializeSettingsPanel } = await import('/client/settings/core/settingsInitializer.js');
            const result = initializeSettingsPanel();
            console.log('[DEBUG] Settings panel initialization result:', result);
            console.log('[DEBUG] window.devPages after init:', window.devPages);
            return result;
        } catch (error) {
            console.error('[DEBUG] Error initializing settings panel:', error);
            return null;
        }
    };
    
    console.log('[Keyboard DEBUG] Global debugInitSettings() function added. Call debugInitSettings() to manually initialize.');
} 