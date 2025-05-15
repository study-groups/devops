// client/log/index.js
// log/index.js – public re-exports for all modules

import {
    log,
    logDebug,
    logInfo,
    logWarn,
    logError,
    legacyPositional as logMessage, // Import the legacy shim and RENAME it to logMessage for export
    setLogPanelInstance
} from './core.js';
import { LogPanel } from './LogPanel.js';

// Re-export everything imported, including the RENAME_D logMessage.
// There is NO "export function logMessage()" declaration in this file.
export {
    log,
    logDebug,
    logInfo,
    logWarn,
    logError,
    logMessage, // This now correctly refers to the imported 'legacyPositional as logMessage'
    LogPanel,
    setLogPanelInstance
}; 