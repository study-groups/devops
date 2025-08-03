/**
 * Keyboard Shortcuts Manager
 * Handles global keyboard shortcuts for the application using a mapping configuration.
 */

import { logMessage } from './log/index.js';
import { eventBus } from './eventBus.js';
import { dispatch } from './messaging/messageQueue.js';
import { ActionTypes } from './messaging/actionTypes.js';
import { triggerActions } from '/client/actions.js';
import { appStore } from './appState.js';
import { panelThunks } from './store/slices/panelSlice.js';

const SMART_COPY_A_KEY = 'smartCopyBufferA';
const SMART_COPY_B_KEY = 'smartCopyBufferB';

function getSelectedText() {
    // This function is not used in the current shortcut mappings,
    // but it's kept as it was in the original file.
    // If it were used, it would need to be defined here.
}

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
    { key: 'S', ctrl: true, shift: true, alt: false, useDispatch: true, action: panelThunks.togglePanel, payload: 'settings-panel' },
    // Save File
    { key: 's', ctrl: 'optional', shift: false, alt: false, useDispatch: false, action: 'shortcut:saveFile', payload: null }, 
    // Refresh Preview (Assuming this triggers a non-state process)
    { key: 'r', ctrl: 'optional', shift: false, alt: true, useDispatch: false, action: 'shortcut:refreshPreview', payload: null },
    // Comprehensive Refresh (Ctrl+Shift+R)
    { key: 'r', ctrl: true, shift: true, alt: false, useDispatch: false, action: 'shortcut:comprehensiveRefresh', payload: null },
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
    console.log('[Keyboard] Initializing components for keyboard shortcuts...');
    
    // Settings Panel now initialized via StateKit-based system in bootstrap.js
    
    // Main shortcut handler for configured mappings
    document.addEventListener('keydown', (event) => {
        const activeElement = document.activeElement;
        const targetTagName = activeElement?.tagName?.toLowerCase() || 'none';
        const isEditable = activeElement?.isContentEditable || false;

        // Ignore shortcuts if typing in an input field, textarea, or contenteditable,
        // UNLESS modifier keys (Ctrl, Alt, Meta) are also pressed.
        if ( (['input', 'textarea', 'select'].includes(targetTagName) || isEditable) && 
             !(event.ctrlKey || event.altKey || event.metaKey) ) 
        {
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
                    if (typeof mapping.action === 'function') {
                        dispatch(mapping.action(mapping.payload));
                    } else {
                        dispatch({ type: mapping.action, payload: mapping.payload });
                    }
                } else { // Assumes eventBus if not useDispatch and not triggerAction
                    eventBus.emit(mapping.action, mapping.payload);
                }

                // Stop processing other mappings for this event
                break;
            }
        }
    });
    
    // Add handlers for Debug Panel, DOM Inspector, and DevTools
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && !event.altKey) {
            if (event.key === 'D') {
                event.preventDefault();
                if (window.debugPanelManager) {
                    window.debugPanelManager.toggleVisibility();
                } else {
                     console.error("[GENERAL] Debug Panel Manager not found on window.");
                }
            } else if (event.key === 'O') {
                event.preventDefault();
                // On-demand activation of DOM Inspector
                if (window.devPages && window.devPages.domInspector) {
                    window.devPages.domInspector.toggle();
                } else {
                    console.log('[Keyboard] DOM Inspector not found, activating for the first time...');
                    import('/client/dom-inspector/domInspectorInitializer.js')
                        .then(({ activateDomInspector }) => {
                            return activateDomInspector();
                        })
                        .then(instance => {
                            if (instance) {
                                console.log('[Keyboard] DOM Inspector activated on-demand.');
                                instance.toggle();
                            } else {
                                console.error("[Keyboard] Failed to activate DOM Inspector on-demand.");
                            }
                        })
                        .catch(error => {
                            console.error("[Keyboard] Error activating DOM Inspector on-demand:", error);
                        });
                }
            } else if (event.key === 'L') {
                event.preventDefault();
                if (window.logPanel && typeof window.logPanel.toggleVisibility === 'function') {
                    try {
                        window.logPanel.toggleVisibility();
                    } catch (error) {
                        console.error("[GENERAL] Error calling Log Panel toggle:", error);
                    }
                } else {
                    console.error("[GENERAL] Log Panel not initialized on window.logPanel");
                }
            } else if (event.key === 'T') {
                event.preventDefault();
                // Use the popup system to launch the registered 'dev-tools' panel
                if (window.popup) {
                    try {
                        window.popup.show('dev-tools', {
                            title: 'DevTools',
                            width: 800,
                            height: 600
                        });
                        console.log('[GENERAL] DevTools panel opened successfully');
                    } catch (error) {
                        console.error("[GENERAL] Error opening DevTools panel popup:", error);
                    }
                } else {
                    console.error("[GENERAL] popup system not found on window.");
                }
            }
        }
    });
    
    logMessage('[Keyboard] Keyboard shortcuts initialized', 'info');
    
    // Add a global debug function for testing the DOM Inspector
    window.testDomInspector = function() {
        console.log('[TEST] Testing DOM Inspector...');
        if (window.devPages && window.devPages.domInspector) {
            try {
                console.log('[TEST] Calling toggleVisibility() on DOM Inspector...');
                const result = window.devPages.domInspector.toggleVisibility();
                console.log('[TEST] toggleVisibility() returned:', result);
                return result;
            } catch (error) {
                console.error('[TEST] Error calling toggleVisibility() on DOM Inspector:', error);
                return false;
            }
        } else {
            console.warn('[TEST] DOM Inspector not available!');
            return false;
        }
    };

    // Add a function to test popup system
    window.testPopup = function() {
        console.log('[TEST] Testing popup system...');
        if (window.popup) {
            try {
                console.log('[TEST] Opening DevTools panel popup...');
                const popupId = window.popup.show('dev-tools', {
                    title: 'DevTools Test',
                    width: 600,
                    height: 400
                });
                console.log('[TEST] DevTools popup opened with ID:', popupId);
                return popupId;
            } catch (error) {
                console.error('[TEST] Error opening DevTools popup:', error);
            }
        } else {
            console.error('[TEST] popup not found on window');
            return null;
        }
    };
    
    console.log('[Keyboard DEBUG] Global testPopup() function added. Call testPopup() to test the popup system.');
}

// Auto-initialize when module is imported
// initKeyboardShortcuts(); 