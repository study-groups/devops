// ✅ MODERNIZED: Enhanced Redux patterns for view controls
import { logMessage } from '/client/log/index.js';
import { topBarController } from './TopBarController.js';

/**
 * ViewControls.js - Simplified view controls component
 * Now uses unified TopBarController for all button interactions
 * Legacy CSS reload functions moved to TopBarController
 */

export function createViewControlsComponent(targetElementId, layoutManager = null) {
    let element = null;

    function init() {
        logMessage('Mounting ViewControls with unified TopBarController...', 'info', 'VIEW_CONTROLS');
        
        element = document.getElementById(targetElementId);
        if (!element) {
            logMessage(`Target element #${targetElementId} not found.`, 'error', 'VIEW_CONTROLS');
            return false;
        }

        // Create the button HTML - TopBarController handles all interactions
        element.innerHTML = `
            <button id="edit-toggle" class="btn btn-ghost btn-sm" title="Open Editor (Alt+T)" data-action="toggleEdit">Edit</button>
            <button id="preview-toggle" class="btn btn-ghost btn-sm" title="Show Preview (Alt+P)" data-action="togglePreview">Preview</button>
            <button id="log-toggle-btn" class="btn btn-ghost btn-sm" title="Show Log (Alt+L)" data-action="toggleLogVisibility">Log</button>
            <button id="preview-reload-btn" class="btn btn-ghost btn-sm" title="Soft Reload - Refresh All CSS" data-action="refreshPreview">&#x21bb;</button>
        `;
        
        // Initialize the unified controller if not already done
        if (!topBarController.initialized) {
            topBarController.initialize();
        }

        logMessage('ViewControls mounted with TopBarController.', 'info', 'VIEW_CONTROLS');
        return true;
    }

    const destroy = () => {
        // TopBarController handles its own cleanup
        logMessage('ViewControls destroyed.', 'info', 'VIEW_CONTROLS');
    };

    // Auto-initialize for bootloader compatibility
    const success = init();
    if (!success) {
        throw new Error('ViewControls failed to initialize');
    }

    return {
        init,
        destroy
    };
}