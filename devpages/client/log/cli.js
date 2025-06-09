// client/log/cli.js - CLI input handling for the log component
import { logMessage } from './LogCore.js';

/**
 * Add CLI input to the log toolbar
 */
export function addCLIToLogBar() {
    console.log('[CLI] Adding CLI input to log toolbar');
    const logToolbar = document.getElementById('log-toolbar');
    if (!logToolbar) {
        console.log('[CLI] Log toolbar not found - ID: log-toolbar');
        return;
    }
    
    // Create CLI input element if it doesn't exist
    let cliInput = document.getElementById('cli-input');
    if (!cliInput) {
        console.log('[CLI] CLI input element not found, creating it');
        cliInput = document.createElement('input');
        cliInput.id = 'cli-input';
        cliInput.type = 'text';
        cliInput.placeholder = 'Enter command...';
        cliInput.className = 'cli-input';
        logToolbar.appendChild(cliInput);
        
        // Dispatch an event to notify that the CLI input was created
        console.log('[CLI] Dispatching cli:input-created event');
        document.dispatchEvent(new CustomEvent('cli:input-created', { 
            detail: { element: cliInput } 
        }));
    } else {
        console.log('[CLI] Found existing CLI input element');
    }

    // Remove old app info element (if needed)
    let appInfo = document.getElementById('app-info');
    if (appInfo) {
        appInfo.remove();
    }

    console.log('[CLI] CLI input added to log toolbar');
    
    // Note: Event handlers are now attached in client/cli/handlers.js
    return cliInput;
} 