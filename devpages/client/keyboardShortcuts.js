/**
 * Keyboard Shortcuts Manager
 * Handles global keyboard shortcuts for the application using a mapping configuration.
 */

import { logMessage } from './log/index.js';
import { eventBus } from './eventBus.js';
import { dispatch } from './messaging/messageQueue.js';
import { ActionTypes } from './messaging/actionTypes.js';
import { triggerActions } from '/client/actions.js';
import { SMART_COPY_A_KEY, SMART_COPY_B_KEY } from '/client/appState.js';
import { debugPanelManager } from '/client/debug/DebugPanelManager.js';

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
    // Initialize Settings Panel and DOM Inspector on startup
    console.log('[Keyboard] Initializing components for keyboard shortcuts...');
    
    // Initialize Settings Panel
    import('/client/settings/core/settingsInitializer.js').then(({ initializeSettingsPanel }) => {
        initializeSettingsPanel().catch(error => {
            console.warn('[Keyboard] Failed to initialize Settings Panel:', error);
        });
    }).catch(error => {
        console.warn('[Keyboard] Failed to import Settings Panel initializer:', error);
    });
    
    // Initialize DOM Inspector
    import('/client/dom-inspector/domInspectorInitializer.js').then(({ initializeDomInspector }) => {
        initializeDomInspector();
        console.log('[Keyboard] DOM Inspector initialized for keyboard shortcuts');
    }).catch(error => {
        console.warn('[Keyboard] Failed to initialize DOM Inspector:', error);
    });
    
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
    
    // Add a SINGLE handler for Ctrl+Shift+S for the Settings Panel
    document.addEventListener('keydown', function(event) {
        if (event.key === 'S' && event.ctrlKey && event.shiftKey && !event.altKey) {
            event.preventDefault();
            console.log("[GENERAL] Ctrl+Shift+S pressed, toggling Settings Panel.");
            if (window.devPages && window.devPages.settingsPanel) {
                try {
                    window.devPages.settingsPanel.toggleVisibility();
                    console.log("[GENERAL] Settings Panel toggle called successfully");
                } catch (error) {
                    console.error("[GENERAL] Error calling Settings Panel toggle:", error);
                }
            } else {
                console.warn('[GENERAL] Settings Panel not found!');
                console.log("[GENERAL] window.devPages:", window.devPages);
                console.log("[GENERAL] Available debug functions: debugInitSettings(), testSettingsPanel()");
                
                // Try to auto-initialize if missing
                console.log("[GENERAL] Attempting to auto-initialize Settings Panel...");
                if (typeof window.debugInitSettings === 'function') {
                    window.debugInitSettings().then(result => {
                        if (result && window.devPages?.settingsPanel) {
                            console.log("[GENERAL] Settings Panel auto-initialization successful, trying toggle again...");
                            try {
                                window.devPages.settingsPanel.toggleVisibility();
                            } catch (error) {
                                console.error("[GENERAL] Error toggling Settings Panel after auto-init:", error);
                            }
                        } else {
                            console.error("[GENERAL] Settings Panel auto-initialization failed");
                        }
                    });
                } else {
                    console.error("[GENERAL] debugInitSettings function not available");
                }
            }
        }
    });

    // Add a SINGLE handler for Ctrl+Shift+D for the DOM Inspector
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.shiftKey && !event.altKey) {
            if (event.key === 'I') {
                event.preventDefault();
                console.log("[GENERAL] Ctrl+Shift+I pressed, toggling DOM Inspector.");
                
                if (window.devPages && window.devPages.domInspector) {
                    try {
                        window.devPages.domInspector.toggle();
                    } catch (error) {
                        console.error("[GENERAL] Error calling DOM Inspector toggle:", error);
                    }
                } else {
                    console.error("[GENERAL] DOM Inspector not initialized on window.devPages.domInspector");
                }
            } else if (event.key === 'D') {
                event.preventDefault();
                console.log("[GENERAL] Ctrl+Shift+D pressed, toggling Debug Panel.");
                debugPanelManager.toggleVisibility();
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
            console.warn('[TEST] DOM Inspector not available! Use debugInitDomInspector() to load it.');
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

    // Add a function to manually initialize DOM Inspector for debugging
    window.debugInitDomInspector = async function() {
        console.log('[DEBUG] Manually initializing DOM Inspector...');
        try {
            const { initializeDomInspector } = await import('/client/dom-inspector/domInspectorInitializer.js');
            const result = initializeDomInspector();
            console.log('[DEBUG] DOM Inspector initialization result:', result);
            return result;
        } catch (error) {
            console.error('[DEBUG] Error initializing DOM Inspector:', error);
            return null;
        }
    };
    
    console.log('[Keyboard DEBUG] Global debugInitSettings() function added. Call debugInitSettings() to manually initialize.');
    console.log('[Keyboard DEBUG] Global debugInitDomInspector() function added. Call debugInitDomInspector() to manually initialize.');
}

// Auto-initialize when module is imported
initKeyboardShortcuts(); 