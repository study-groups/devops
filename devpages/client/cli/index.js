// client/cli/index.js - Main CLI integration
import { logInfo } from '../log/index.js';
import EventBus from '../eventBus.js';
import { CLI_EVENTS } from './cliEvents.js';
// Remove unused registry imports
// import { registerCliCommand, executeCliCommand } from './registry.js';
import { eventBus } from '../eventBus.js';
// Import the new remote execution function
import { executeRemoteCommand } from './handlers.js';
// Import SmartCopy keys and appStore
import { SMART_COPY_A_KEY, SMART_COPY_B_KEY, appStore } from '/client/appState.js';
// import { getLogPanelInstance } from '../log/logPanelAccess.js'; // Create this file

// Log successful import
console.log('[CLI] Core imports completed');

// --- Substitution Function for $$a / $$b ---
const substituteBuffers = (text) => {
    if (!text) return '';
    // Replace $$a and $$b with their localStorage values
    return text.replace(/\$\$([ab])/g, (match, bufferId) => {
        const key = bufferId === 'a' ? SMART_COPY_A_KEY : SMART_COPY_B_KEY;
        const bufferValue = localStorage.getItem(key);
        if (bufferValue !== null) {
            console.debug(`[CLI Buffer Subst] Substituting ${match} with content from Buffer ${bufferId.toUpperCase()}`);
            // Basic sanitize: remove potential control characters except newline/carriage return
            // Adjust sanitization if needed
            return bufferValue.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
        } else {
            console.warn(`[CLI Buffer Subst] Buffer ${bufferId.toUpperCase()} for ${match} is empty. Using empty string.`);
            return '';
        }
    });
};
// ---

// --- Substitution Function for $(...) (Keep as is) ---
const substituteCommands = async (text) => {
    if (!text) return '';
    const substitutionRegex = /\$\(([^)]+)\)/g; // g flag is important
    
    // Find all matches upfront
    const matches = Array.from(text.matchAll(substitutionRegex));
    if (!matches.length) {
        return text; // No substitutions found
    }

    // Use console.debug for internal details
    console.debug(`[CLI Subst] Found ${matches.length} potential sub-command(s) in: "${text}"`);
    
    let currentText = text;
    
    // Process each match sequentially
    for (const match of matches) {
        const placeholder = match[0]; // The full $(...) part
        const commandToRun = match[1].trim();
        
        if (!commandToRun) continue; // Skip empty $( )

        // Use logMessage for user-visible actions/info
        logInfo(`[CLI Subst] Executing sub-command from ${placeholder}: '${commandToRun}'...`, 'info');
        try {
            // Execute the sub-command via the API
            const subPayload = { command: commandToRun, encoded_data: btoa(''), environment: {} };
            const subResultOutput = await executeRemoteCommand(subPayload);
            const outputSnippet = (subResultOutput || '').substring(0, 50);
            // Log output info to UI log
            logInfo(`[CLI Subst] Sub-command '${commandToRun}' output: "${outputSnippet}${subResultOutput.length > 50 ? '...' : ''}"`, 'info');

            // Replace the *first* occurrence of this specific placeholder in the *current* text state.
            // This handles cases where the same placeholder appears multiple times, replacing them one by one.
            currentText = currentText.replace(placeholder, subResultOutput || '');
            // Keep debug log in console
            console.debug(`[CLI Subst] Text after replacing ${placeholder}: "${currentText.substring(0,100)}..."`)

        } catch (error) {
             // Log error to console and UI log
             console.error(`[CLI Subst] Sub-command '${commandToRun}' failed: ${error.message}`);
             logInfo(`[CLI Subst ERROR] Sub-command '${commandToRun}' failed: ${error.message}`, 'error');
             // Abort main command if sub-command fails
             throw new Error(`Sub-command '${commandToRun}' failed: ${error.message}`);
        }
    }
    // Keep debug log in console
    console.debug(`[CLI Subst] Final text after all substitutions: "${currentText}"`);
    return currentText; // Return the fully processed string
};
// ---

// Helper function to execute command (used by both Enter and Button)
async function handleSendCommand() {
    const cliInput = document.getElementById('cli-input');
    if (!cliInput) return;

    const originalRawInput = cliInput.value.trim();
    if (!originalRawInput) return;
    // Use console.info for this internal action start
    console.info(`[CLI Action] Raw Input: "${originalRawInput}"`);

    let commandStringForParsing = originalRawInput;
    const environmentToSend = {};
    let payload = {};

    try { // Wrap the main logic in try/catch to handle substitution errors

        // --- PRE-SUBSTITUTION for $$a / $$b ---
        console.debug(`[CLI Buffer Subst] Before $$a/$$b substitution: "${commandStringForParsing}"`);
        commandStringForParsing = substituteBuffers(commandStringForParsing);
        console.debug(`[CLI Buffer Subst] After $$a/$$b substitution: "${commandStringForParsing}"`);
    // ---

        // --- Step 1: Handle Environment Vars (potential substitution) ---
        const assignmentRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)=(.+?)\s+/; // Allow more complex values
    const assignmentMatch = commandStringForParsing.match(assignmentRegex);
    if (assignmentMatch) {
        const varName = assignmentMatch[1];
            let varValue = assignmentMatch[2]; // Get the initial value string
             // Use console.debug
             console.debug(`[CLI PreProc] Found potential assignment: ${varName}=${varValue}`);
            // Perform substitution on the value part
            varValue = await substituteCommands(varValue);
            environmentToSend[varName] = varValue;
        commandStringForParsing = commandStringForParsing.substring(assignmentMatch[0].length).trim();
             // Use console.info for state change info
             console.info(`[CLI PreProc] Assignment ${varName}= processed. Remaining command: "${commandStringForParsing}"`);
    }
        // ---

        // --- Step 2: Separate Command and Args ---
        const parts = commandStringForParsing.match(/^([^\s]+)(?:\s+(.*))?$/) || ['', commandStringForParsing, ''];
        let mainCommand = parts[1];
        let argumentsDataString = parts[2] || '';
        // ---

        // --- Step 3: Perform $(...) Substitution on Args ---
        console.debug(`[CLI Subst] Args before $(...) substitution: "${argumentsDataString}"`);
        argumentsDataString = await substituteCommands(argumentsDataString);
        console.debug(`[CLI Subst] Args after $(...) substitution: "${argumentsDataString}"`);
        // ---

        // --- Step 4: Prepare Payload (Standardized) ---
        let encodedData = '';
        try {
             // Always encode the processed arguments/data string
             encodedData = btoa(unescape(encodeURIComponent(argumentsDataString)));
        } catch (e) {
             console.error('[CLI Flow] Error Base64 encoding arguments/data:', e);
             logInfo(`[CLIENT ERROR] Failed to Base64 encode arguments/data for ${mainCommand}.`, 'error');
             return; // Stop processing if encoding fails
        }

        payload = {
            command: mainCommand,      // Just the command name
            encoded_data: encodedData, // Base64 of substituted arguments/data
            environment: environmentToSend
        };

        // Log based on command type for clarity, but payload structure is the same
        const qaCommandRegex = /^(qq|q1|q2|q3|q4)$/;
        if (qaCommandRegex.test(mainCommand)) {
             console.info(`[CLI Flow] Detected QA command '${mainCommand}'. Args/Data passed via encoded_data.`);
    } else {
             console.info(`[CLI Flow] Detected regular command '${mainCommand}'. Args/Data passed via encoded_data.`);
        }
        console.debug(`[CLI Flow] Payload:`, { command: payload.command, encoded_data: '...', environment: payload.environment });
        // --- End Payload Preparation ---

    // --- Add to Command History ---
     try {
        const historyKey = 'cliCommandHistory';
        let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        if (history[history.length - 1] !== originalRawInput) {
             history.push(originalRawInput);
             if (history.length > 100) history = history.slice(history.length - 100);
             localStorage.setItem(historyKey, JSON.stringify(history));
        }
    } catch (e) { console.error('[CLI History] Error saving command history:', e); }
    // --- End Command History ---

        // --- Execute Main Command ---
    cliInput.value = '';
        logInfo(`> ${originalRawInput}`); // Log original input
         // Log execution start to UI
         logInfo(`Executing main command: ${payload.command}...`, 'info');
        console.log('[CLI Action] Payload OBJECT being sent to executeRemoteCommand:', payload); // Log final payload

        const resultOutput = await executeRemoteCommand(payload);
        console.log(`[CLI Action] executeRemoteCommand returned: "${resultOutput}"`);
        // --- DEBUG LINES ADDED ---
        console.log(`[CLI DEBUG] resultOutput from executeRemoteCommand: "${resultOutput}" (Type: ${typeof resultOutput})`);
        console.log(`[CLI DEBUG] Is resultOutput trimmed non-empty?: ${!!(resultOutput && resultOutput.trim())}`);
        // --- END DEBUG LINES ---
        if (resultOutput && resultOutput.trim()) {
            // Get a direct reference to the LogPanel instance
            const logPanelInstance = window.logPanelInstance;
            
            // First attempt: use window.logMessage as it should normally work
            window.logMessage(resultOutput, 'DEVPAGES', 'CLI', 'RESULT', 'info');
            
            // Backup approach: If we have direct access to logPanelInstance, use it
            if (logPanelInstance && typeof logPanelInstance.addEntry === 'function') {
                const entry = {
                    message: resultOutput,
                    level: 'INFO',
                    type: 'CLI',
                    subtype: 'OUTPUT',
                    ts: Date.now()
                };
                logPanelInstance.addEntry(entry);
            }
            
            // Force a manual update of the tag filtering system to ensure CLI is added
            const currentState = appStore.getState().logFiltering;
            if (!currentState.discoveredTypes.includes('CLI')) {
                appStore.update(prevState => ({
                    ...prevState,
                    logFiltering: {
                        ...prevState.logFiltering,
                        discoveredTypes: [...prevState.logFiltering.discoveredTypes, 'CLI'],
                        activeFilters: [...prevState.logFiltering.activeFilters, 'CLI']
                    }
                }));
                console.log('[CLI] Manually added CLI to discovered types and active filters');
            }
        }

    } catch (error) { // Catch errors from substitution or main execution
         console.error(`[CLI Action] Command processing failed: ${error.message}`);
         logInfo(`[ERROR] ${error.message}`, 'error'); // Display error in log panel
    } finally {
    console.log('[CLI Action] Command handling complete.');
    }
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