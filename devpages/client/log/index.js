// log/index.js - Main entry point for the log system
import { logMessage, clearLog, copyLog, updateLogEntryCount } from './core.js';

// --- REMOVE Debug Import ---
// import * as stateModuleForDebug from './state.js';
// console.log('[LOG DEBUG] Raw import of state.js:', stateModuleForDebug);
// --- End REMOVE ---

import {
    logState,
    toggleLog,
    toggleLogWithoutAutoShow,
    forceLogHidden,
    initLogVisibility,
    recentViewChange,
    interactingWithSplit,
    setRecentViewChange,
    getRecentViewChange
} from './state.js';
import {
    initLogToolbar,
    ensureLogButtonsConnected,
    handleScrollLockChange,
    setupDiagnosticHandlers
} from './ui.js';
import { addCLIToLogBar } from './cli.js';

// --- REMOVE DOMContentLoaded Listener ---
// let domReadyHandled = false;
// document.addEventListener('DOMContentLoaded', () => {
//     if (domReadyHandled) return;
//     domReadyHandled = true;
//     console.log('[LOG] DOM Content Loaded - starting initialization');
//
//     // --- REMOVE Enhanced check ---
//     console.log('[LOG DEBUG] Checking initLogVisibility. Type:', typeof initLogVisibility, 'Value:', initLogVisibility);
//     if (typeof initLogVisibility !== 'function') {
//         // ... error handling ...
//         return;
//     }
//     // --- End REMOVE ---
//
//     try {
//         // NOTE: initLogVisibility should be called by the main app initializer now
//         // initLogVisibility(); // DO NOT CALL HERE
//
//         // Connect buttons, init toolbar etc. - These might need DOM elements,
//         // so they might still need DOMContentLoaded or be called later.
//         // For simplicity, let's assume the main init handles this timing.
//         // If elements aren't found later, we might need to adjust.
//         ensureLogButtonsConnected();
//         initLogToolbar();
//         addCLIToLogBar();
//         setupDiagnosticHandlers();
//
//         // Add view change listener
//         document.addEventListener('view:changed', (e) => {
//             // ... listener code ...
//         });
//         logMessage('[LOG] Log system event listeners attached.'); // Changed message
//     } catch (error) {
//         console.error('[LOG ERROR] Error during log system setup:', error); // Changed message
//         logMessage(`[LOG ERROR] Setup failed: ${error.message}`);
//     }
// });
// --- End REMOVE DOMContentLoaded Listener ---

// --- REMOVE Window Load Listener ---
// window.addEventListener('load', () => {
//     // ... complex visibility fixing code ...
// });
// --- End REMOVE ---


// Immediately expose these functions to the global scope
if (typeof window !== 'undefined') {
    window.clearLog = clearLog;
    window.copyLog = copyLog;
    window.toggleLog = toggleLog;
    // window.debugSplitInteraction = () => interactingWithSplit; // Keep commented if not essential
    window.logMessage = logMessage;
}

// Export everything needed by other modules
export {
    // From core.js
    logMessage,
    clearLog,
    copyLog,
    updateLogEntryCount,

    // From state.js
    logState,
    toggleLog,
    toggleLogWithoutAutoShow,
    forceLogHidden,
    initLogVisibility,
    recentViewChange,
    interactingWithSplit,
    setRecentViewChange,
    getRecentViewChange,

    // From ui.js
    initLogToolbar,
    ensureLogButtonsConnected,
    handleScrollLockChange,
    setupDiagnosticHandlers,

    // From cli.js
    addCLIToLogBar
}; 