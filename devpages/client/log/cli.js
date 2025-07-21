// client/log/cli.js - CLI input handling for the log component
const log = window.APP.services.log.createLogger('LogCLI');

/**
 * Add CLI input to the log toolbar
 */
export function addCLIToLogBar() {
    log.info('CLI', 'ADD_CLI_TO_LOG_BAR', 'Adding CLI input to log toolbar');
    const logToolbar = document.getElementById('log-toolbar');
    if (!logToolbar) {
        log.warn('CLI', 'LOG_TOOLBAR_NOT_FOUND', 'Log toolbar not found - ID: log-toolbar');
        return;
    }
    
    // Create CLI input element if it doesn't exist
    let cliInput = document.getElementById('cli-input');
    if (!cliInput) {
        log.info('CLI', 'CREATING_CLI_INPUT', 'CLI input element not found, creating it');
        cliInput = document.createElement('input');
        cliInput.id = 'cli-input';
        cliInput.type = 'text';
        cliInput.placeholder = 'Enter command...';
        cliInput.className = 'cli-input';
        logToolbar.appendChild(cliInput);
        
        // Dispatch an event to notify that the CLI input was created
        log.info('CLI', 'DISPATCH_EVENT', 'Dispatching cli:input-created event');
        document.dispatchEvent(new CustomEvent('cli:input-created', { 
            detail: { element: cliInput } 
        }));
    } else {
        log.info('CLI', 'EXISTING_CLI_INPUT', 'Found existing CLI input element');
    }

    // Remove old app info element (if needed)
    let appInfo = document.getElementById('app-info');
    if (appInfo) {
        appInfo.remove();
    }

    log.info('CLI', 'CLI_INPUT_ADDED', 'CLI input added to log toolbar');
    
    // Note: Event handlers are now attached in client/cli/handlers.js
    return cliInput;
} 