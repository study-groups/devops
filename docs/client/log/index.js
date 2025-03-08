// log/index.js - Main entry point for the log system
import { logMessage, clearLog, copyLog, updateLogEntryCount } from './core.js';
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

// Initialize on DOMContentLoaded
let domReadyHandled = false;
document.addEventListener('DOMContentLoaded', () => {
    if (domReadyHandled) return;
    domReadyHandled = true;
    
    console.log('[LOG] DOM Content Loaded - starting initialization');
    
    // Complete initialization in one place - respects localStorage
    initLogVisibility();
    
    // Connect buttons
    ensureLogButtonsConnected();
    
    // Initialize toolbar
    initLogToolbar();
    
    // Add CLI to log bar
    addCLIToLogBar();
    
    // Set up diagnostic handlers
    setupDiagnosticHandlers();
    
    // Add view change listener
    document.addEventListener('view:changed', (e) => {
        console.log('View change detected:', e.detail);
        setRecentViewChange(true);
        
        // Update UI when view changes - don't change visibility
        logState.updateUI();
        
        // Reset the flag after a short delay
        setTimeout(() => {
            setRecentViewChange(false);
        }, 500);
    });
});

// Add a window load event to ensure log state is correctly reflected in UI
window.addEventListener('load', () => {
    console.log('[LOG] Window loaded - checking localStorage state');
    
    // Wait for any other onload handlers to complete
    setTimeout(() => {
        const storedVisibility = localStorage.getItem('logVisible');
        console.log('[LOG] Window loaded check - localStorage.logVisible =', storedVisibility);
        
        // CRITICAL: Ensure UI reflects localStorage without triggering saveState()
        if (storedVisibility === 'true' && !logState.visible) {
            console.log('[LOG] *** FIXING UI: Making log visible based on localStorage ***');
            
            // Temporarily disable saveState
            const originalSaveState = logState.saveState;
            logState.saveState = function() {
                console.log('[LOG] State save PREVENTED during visibility fix');
            };
            
            // Update both logState and UI - this will fix button state too
            logState.visible = true;
            logState.updateUI();
            
            // Restore original saveState
            setTimeout(() => {
                logState.saveState = originalSaveState;
                console.log('[LOG] Normal state saving restored after visibility fix');
            }, 100);
            
        } else if (storedVisibility === 'false' && logState.visible) {
            console.log('[LOG] *** FIXING UI: Making log hidden based on localStorage ***');
            
            // Temporarily disable saveState
            const originalSaveState = logState.saveState;
            logState.saveState = function() {
                console.log('[LOG] State save PREVENTED during visibility fix');
            };
            
            // Update both logState and UI - this will fix button state too
            logState.visible = false;
            logState.updateUI();
            
            // Restore original saveState
            setTimeout(() => {
                logState.saveState = originalSaveState;
                console.log('[LOG] Normal state saving restored after visibility fix');
            }, 100);
        } else {
            console.log('[LOG] UI already matches localStorage value:', storedVisibility);
        }
        
        // Final verification
        console.log('[LOG] After window.load fixes:');
        console.log('[LOG] - logState.visible =', logState.visible);
        console.log('[LOG] - localStorage.logVisible =', localStorage.getItem('logVisible'));
        console.log('[LOG] - Log button state =', document.getElementById('log-btn')?.classList.contains('active'));
    }, 200);
});

// Immediately expose these functions to the global scope
if (typeof window !== 'undefined') {
    window.clearLog = clearLog;
    window.copyLog = copyLog;
    window.toggleLog = toggleLog;
    window.debugSplitInteraction = () => interactingWithSplit;
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