// --- Helper: Send Command to Server ---
// Unified function to send different types of commands
async function processAndSendCommand(rawInput) {
    log.info(`[CLI Action] Raw Input: "${rawInput}"`);
    // Clear input after processing
    cliInput.value = '';

    // Determine command type and prepare payload
    let payload = null;
    let commandName = ''; // Store the command name for logging/display

    // Regex to detect QA commands like qq, q1, etc., followed by arguments
    const qaCommandMatch = rawInput.match(/^([qQ][a-zA-Z0-9]*)(\s+.*)?$/);

    if (qaCommandMatch) {
        commandName = qaCommandMatch[1]; // e.g., 'qq', 'q1'
        const argsAndData = (qaCommandMatch[2] || '').trim(); // Args + data part, or empty string
        log.debug(`[CLI Flow] Detected QA command '${commandName}'. Using Base64 stdin flow.`);

        log.debug(`[CLI Flow] Args/Data string before substitution: "${argsAndData}"`);
        // Substitute $$a and $$b
        const substitutedData = await substitutePlaceholders(argsAndData);
        log.debug(`[CLI Flow] Args/Data string after substitution length: ${substitutedData.length}`);


        // --- Prepare payload for STDIN commands ---
        const encodedData = btoa(unescape(encodeURIComponent(substitutedData))); // Base64 encode
        payload = {
            // type: 'qa_query_stdin', // Removed: Server now only cares about command/encoded_data
            // qa_alias: commandName, // Renamed below
            command: commandName, // Use the 'command' field as expected by server
            encoded_data: encodedData, // Use the 'encoded_data' field
            environment: {} // Add environment if needed later
        };
        log.debug(`[CLI Flow] Payload (QQ type):`, { ...payload, encoded_data: '...' }); // Log safely

    } else {
        // Assume it's a regular command (no args for now, potential future enhancement)
        commandName = rawInput.trim();
        log.debug(`[CLI Flow] Detected regular command '${commandName}'. Using standard web command flow.`);

        // --- Prepare payload for standard commands ---
        payload = {
            command: commandName,
            encoded_data: btoa(''),
            environment: {}
        };
        log.debug(`[CLI Flow] Payload (standard type):`, payload);
    }

    // --- Send the command ---
    if (payload) {
        // Log the command execution attempt in the UI log
        log.info(`Executing command: ${commandName}...`, {
            tags: ['cli', 'command-request'],
            // metadata: { payload } // Avoid logging potentially large encoded data
        });
        log.debug(`[CLI Action] UI log message sent.`);
        log.debug(`[CLI Action] Payload OBJECT being sent to executeRemoteCommand:`, { ...payload, encoded_data: payload.encoded_data ? '...' : '' }); // Log payload safely
        try {
            log.debug(`[CLI Action] Calling executeRemoteCommand...`);
            const result = await executeRemoteCommand(payload); // Send the constructed payload

            // Log the result from the server
            // Check if result.output exists, otherwise show a generic success or error based on status
            if (result && typeof result.output !== 'undefined') {
                 // Log successful output
                 log.info(`Command '${commandName}' output:`, {
                    tags: ['cli', 'command-response', 'success'],
                    metadata: { output: result.output }
                 });
                 // Potentially add result to smart copy buffer B or paste it
                 handleCommandSuccess(result.output);
            } else if (result && result.error) {
                 // Log server-side handled error (e.g., command execution failure)
                 log.error(`Command '${commandName}' failed on server: ${result.error}`, {
                     tags: ['cli', 'command-response', 'server-error'],
                     metadata: { output: result.output } // Include output even if there's an error object
                 });
            } else {
                 // Log unexpected response structure (treat as error)
                 log.error(`Command '${commandName}' completed with unexpected response format.`, {
                     tags: ['cli', 'command-response', 'network-error'], // Or a different tag?
                     metadata: { response: result }
                 });
            }

        } catch (error) {
            // Log network or other client-side errors during the fetch
            log.error(`Error executing command '${commandName}': ${error.message}`, {
                tags: ['cli', 'command-response', 'client-error'],
                metadata: { error: error }
            });
        } finally {
            log.debug(`[CLI Action] Command handling complete.`);
        }
    } else {
         log.warn(`[CLI Action] No valid command detected or payload constructed for input: "${rawInput}"`);
    }
} 