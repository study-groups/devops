// client/cli/handlers.js - CLI handlers with globalFetch integration
import EventBus from '../eventBus.js';
import { CLI_EVENTS } from './cliEvents.js';
import { globalFetch } from '../globalFetch.js';

// New function to handle ONLY remote execution via API
export async function executeRemoteCommand(command) {
  // Log the attempt to send to server
  if (typeof window.logMessage === 'function') {
      window.logMessage(`[CLI] Sending to server: ${command}`);
  } else {
      console.warn('window.logMessage not available for CLI send log');
  }
  EventBus.emit(CLI_EVENTS.COMMAND_PROCESSING, {
    command,
    timestamp: Date.now()
  });

  try {
    // Make the server request
    const response = await globalFetch('/api/cli', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ command })
    });

    // Check response and parse data
    if (!response.ok) {
      // Try to get error details from response body
      let errorText = `Server returned ${response.status}`;
      try {
        const errorData = await response.json();
        errorText = errorData.output || errorData.error || errorText;
      } catch (e) { /* Ignore if response isn't JSON */ }
      throw new Error(errorText);
    }

    const data = await response.json();
    console.log('[CLI] Server response:', data);

    // Log successful output, separating STDERR
    if (data.output) {
        const lines = data.output.split('\\n');
        let stdoutBuffer = []; // Collect regular stdout lines

        lines.forEach(line => {
            if (line.startsWith('STDERR:')) {
                // Log STDERR lines separately, potentially as errors or warnings
                const stderrMsg = line.substring(7).trim(); // Remove 'STDERR:' prefix
                if (typeof window.logMessage === 'function') {
                    window.logMessage(`[CLI STDERR] ${stderrMsg}`, 'warning'); // Use 'warning' or 'error' type
                } else {
                     console.warn('window.logMessage not available for CLI STDERR log');
                }
            } else if (line.trim() !== '') {
                // Log non-empty stdout lines
                stdoutBuffer.push(line); // Add to buffer for event payload
            }
        });

         // Update event payloads with filtered stdout
         const filteredStdout = stdoutBuffer.join('\\n');

         EventBus.emit(CLI_EVENTS.COMMAND_RESPONSE, {
             command,
             result: filteredStdout, // Send filtered stdout
             success: true,
             source: 'server',
             timestamp: Date.now()
         });

         EventBus.emit(CLI_EVENTS.COMMAND_EXECUTED, {
             command,
             result: filteredStdout, // Send filtered stdout
             success: true,
             source: 'server',
             timestamp: Date.now()
         });

         return filteredStdout; // Return filtered stdout

    } else {
         // Handle cases with no output but successful response
         EventBus.emit(CLI_EVENTS.COMMAND_RESPONSE, { command, result: '', success: true, source: 'server', timestamp: Date.now() });
         EventBus.emit(CLI_EVENTS.COMMAND_EXECUTED, { command, result: '', success: true, source: 'server', timestamp: Date.now() });
         return '';
    }

  } catch (error) {
    // Log the error to the console, including the command that failed
    console.error(`[CLI] Remote command execution error for "${command}":`, error);

    // Check if error.message exists
    const errorMessage = error?.message || 'Unknown execution error';

    // Log a user-friendly error message to the UI log
    if (typeof window.logMessage === 'function') {
        window.logMessage(`[CLI ERROR] ${errorMessage}`, 'error'); // Use the safe error message
    } else {
        console.warn('window.logMessage not available for CLI ERROR log');
    }

    // Emit an error event for other parts of the system if needed
    EventBus.emit(CLI_EVENTS.COMMAND_ERROR, {
      command,
      error: errorMessage, // Use the safe error message
      timestamp: Date.now()
    });
    
    // Optional: Depending on how errors should propagate, you might re-throw
    // throw error; 
  }
}