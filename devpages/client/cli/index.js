// client/cli/index.js - Main CLI integration
import { logMessage } from '../log/index.js';
import EventBus from '../eventBus.js';
import { CLI_EVENTS } from './cliEvents.js';
// Remove unused registry imports
// import { registerCliCommand, executeCliCommand } from './registry.js';
import { eventBus } from '../eventBus.js';
// Import the new remote execution function
import { executeRemoteCommand } from './handlers.js';

// Log successful import
console.log('[CLI] Core imports completed');

// Helper function to execute command (used by both Enter and Button)
function handleSendCommand() {
    const cliInput = document.getElementById('cli-input');
    if (!cliInput) return; // Should not happen if listener is attached

    const inputText = cliInput.value.trim();
    console.log(`[CLI Action] Input text: "${inputText}"`);
    if (!inputText) {
         console.log('[CLI Action] Input text is empty, returning.');
         return;
    }

    cliInput.value = '';
    console.log('[CLI Action] Input cleared.');
    logMessage(`> ${inputText}`); // Log command to UI
    console.log('[CLI Action] UI log message sent.');

    // Directly call the remote execution function
    console.log('[CLI Action] Calling executeRemoteCommand...');
    executeRemoteCommand(inputText);
    console.log('[CLI Action] Returned from executeRemoteCommand call.');
}

// Export the initialization function
export async function initializeCLI() {
    console.log('[CLI] Starting CLI initialization');

    try {
        // Keep client-side registrations if still needed for other things
        // Example: 
        // registerCliCommand('force-reload', async (args) => { ... });
        // const { registerMermaidCommands } = await import('./mermaidCommands.js');
        // await registerMermaidCommands();

        // Set up Input Listener
        const cliInput = document.getElementById('cli-input');
        if (cliInput) {
            // Restore Enter Key Listener
            cliInput.addEventListener('keydown', (event) => {
                console.log(`[DEBUG] Keydown on #cli-input: ${event.key}`); // Keep debug log
                if (event.key === 'Enter') {
                    console.log('[CLI Input Listener] Enter key detected!');
                    event.preventDefault(); // Prevent default form submission/newline
                    handleSendCommand(); // Call shared handler function
                }
            });
             console.log('[CLI] Attached keydown listener to #cli-input');

             // Set up Send Button Listener
             const sendButton = document.getElementById('cli-send-button');
             if (sendButton) {
                 sendButton.addEventListener('click', (event) => {
                     console.log('[CLI Button Listener] Send button clicked!');
                     handleSendCommand(); // Call shared handler function
                 });
                 console.log('[CLI] Attached click listener to #cli-send-button');
             } else {
                 console.warn('[CLI] Could not find #cli-send-button element');
             }

        } else {
             console.warn('[CLI] Could not find #cli-input element');
        }

        // Remove the Command Execution Listener as it's no longer needed
        // eventBus.on(CLI_EVENTS.EXECUTE_COMMAND, async ({ command, args }) => {
        //     await executeCliCommand(command, args);
        // });
        // console.log(`[CLI] Listening for ${CLI_EVENTS.EXECUTE_COMMAND} events on EventBus`);

        // Emit ready event
        eventBus.emit(CLI_EVENTS.CLI_READY, { timestamp: Date.now() });

        console.log('[CLI] Initialization complete (YOLO mode with Button)');
        return true;
    } catch (error) {
        console.error('[CLI] Initialization failed:', error);
        return false;
    }
}

// Remove unused exports if they are truly unused now
// export { registerCliCommand, executeCliCommand }; 